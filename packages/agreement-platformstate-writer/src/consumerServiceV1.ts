import { match } from "ts-pattern";
import {
  Agreement,
  AgreementEventEnvelopeV1,
  AgreementV1,
  genericInternalError,
  fromAgreementV1,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesAgreementPK,
  makePlatformStatesEServiceDescriptorPK,
  PlatformStatesAgreementEntry,
  agreementState,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Logger } from "pagopa-interop-commons";
import {
  readAgreementEntry,
  updateAgreementStateInPlatformStatesEntry,
  agreementStateToItemState,
  updateAgreementStateOnTokenGenStates,
  writeAgreementEntry,
  readCatalogEntry,
  updateAgreementStateAndDescriptorInfoOnTokenGenStates,
  deleteAgreementEntry,
  isLatestAgreement,
  updateLatestAgreementOnTokenGenStates,
  extractAgreementTimestamp,
} from "./utils.js";

export async function handleMessageV1(
  message: AgreementEventEnvelopeV1,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> {
  await match(message)
    .with(
      { type: "AgreementActivated" },
      { type: "AgreementSuspended" },
      async (msg) => {
        const agreement = parseAgreement(msg.data.agreement);
        await handleActivationOrSuspension(
          agreement,
          dynamoDBClient,
          msg.version,
          logger
        );
      }
    )
    .with({ type: "AgreementUpdated" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);

      await match(agreement.state)
        // eslint-disable-next-line sonarjs/no-identical-functions
        .with(agreementState.active, agreementState.suspended, async () => {
          const agreement = parseAgreement(msg.data.agreement);
          await handleActivationOrSuspension(
            agreement,
            dynamoDBClient,
            msg.version,
            logger
          );
        })
        .with(agreementState.archived, async () => {
          const agreement = parseAgreement(msg.data.agreement);
          await handleArchiving(agreement, dynamoDBClient, logger);
        })
        .with(
          agreementState.draft,
          agreementState.missingCertifiedAttributes,
          agreementState.pending,
          agreementState.rejected,
          () => {
            logger.info(
              `Skipping processing of entry ${agreement.id}. Reason: state ${agreement.state}`
            );
            return Promise.resolve();
          }
        )
        .exhaustive();
    })
    .with({ type: "AgreementAdded" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);

      await match(agreement.state)
        // eslint-disable-next-line sonarjs/no-identical-functions
        .with(agreementState.active, agreementState.suspended, async () => {
          // this case is for agreement upgraded
          const agreement = parseAgreement(msg.data.agreement);
          await handleUpgrade(agreement, dynamoDBClient, msg.version, logger);
        })
        .with(
          agreementState.draft,
          agreementState.archived,
          agreementState.missingCertifiedAttributes,
          agreementState.pending,
          agreementState.rejected,
          // eslint-disable-next-line sonarjs/no-identical-functions
          () => {
            logger.info(
              `Skipping processing of entry ${agreement.id}. Reason: state ${agreement.state}`
            );
            return Promise.resolve();
          }
        )
        .exhaustive();
    })
    .with({ type: "AgreementDeactivated" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);
      await handleArchiving(agreement, dynamoDBClient, logger);
    })
    .with(
      { type: "AgreementDeleted" },
      { type: "VerifiedAttributeUpdated" },
      { type: "AgreementConsumerDocumentAdded" },
      { type: "AgreementConsumerDocumentRemoved" },
      { type: "AgreementContractAdded" },
      async () => Promise.resolve()
    )
    .exhaustive();
}

const parseAgreement = (agreementV1: AgreementV1 | undefined): Agreement => {
  if (!agreementV1) {
    throw genericInternalError(`Agreement not found in message data`);
  }

  return fromAgreementV1(agreementV1);
};

const handleActivationOrSuspension = async (
  agreement: Agreement,
  dynamoDBClient: DynamoDBClient,
  incomingVersion: number,
  logger: Logger
): Promise<void> => {
  const primaryKey = makePlatformStatesAgreementPK(agreement.id);

  const existingAgreementEntry = await readAgreementEntry(
    primaryKey,
    dynamoDBClient
  );
  const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
    consumerId: agreement.consumerId,
    eserviceId: agreement.eserviceId,
  });

  const agreementTimestamp = extractAgreementTimestamp(agreement);

  if (existingAgreementEntry) {
    if (existingAgreementEntry.version > incomingVersion) {
      // Stops processing if the message is older than the agreement entry
      logger.info(
        `Skipping processing of entry ${existingAgreementEntry}. Reason: a more recent entry already exists`
      );
      return Promise.resolve();
    } else {
      await updateAgreementStateInPlatformStatesEntry(
        dynamoDBClient,
        primaryKey,
        agreementStateToItemState(agreement.state),
        incomingVersion,
        logger
      );
    }
  } else {
    if (agreement.stamps.activation === undefined) {
      logger.warn(
        `Missing agreement activation stamp for agreement with id ${agreement.id}. Using createdAt as fallback.`
      );
    }

    const agreementEntry: PlatformStatesAgreementEntry = {
      PK: primaryKey,
      state: agreementStateToItemState(agreement.state),
      version: incomingVersion,
      updatedAt: new Date().toISOString(),
      GSIPK_consumerId_eserviceId,
      GSISK_agreementTimestamp: agreementTimestamp,
      agreementDescriptorId: agreement.descriptorId,
    };

    await writeAgreementEntry(agreementEntry, dynamoDBClient, logger);
  }

  if (
    await isLatestAgreement(
      GSIPK_consumerId_eserviceId,
      agreement.id,
      agreementTimestamp,
      dynamoDBClient
    )
  ) {
    // token-generation-states
    /* 
    In consumerServiceV2, the handler for activation and suspension doesn't have to update 
    the descriptor info in the token-generation-states. Here it's needed because this handler also 
    includes the agreement upgrade (which requires updating descriptor info).
    */

    const pkCatalogEntry = makePlatformStatesEServiceDescriptorPK({
      eserviceId: agreement.eserviceId,
      descriptorId: agreement.descriptorId,
    });
    const catalogEntry = await readCatalogEntry(pkCatalogEntry, dynamoDBClient);

    const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
      eserviceId: agreement.eserviceId,
      descriptorId: agreement.descriptorId,
    });

    await updateAgreementStateAndDescriptorInfoOnTokenGenStates({
      GSIPK_consumerId_eserviceId,
      agreementId: agreement.id,
      agreementState: agreement.state,
      dynamoDBClient,
      GSIPK_eserviceId_descriptorId,
      catalogEntry,
      logger,
    });
  } else {
    logger.info(
      `Token-generation-states. Skipping processing of entry GSIPK_consumerId_eserviceId ${GSIPK_consumerId_eserviceId}. Reason: agreement is not the latest`
    );
  }
};

const handleArchiving = async (
  agreement: Agreement,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  const primaryKey = makePlatformStatesAgreementPK(agreement.id);
  const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
    consumerId: agreement.consumerId,
    eserviceId: agreement.eserviceId,
  });

  const agreementTimestamp = extractAgreementTimestamp(agreement);

  if (
    await isLatestAgreement(
      GSIPK_consumerId_eserviceId,
      agreement.id,
      agreementTimestamp,
      dynamoDBClient
    )
  ) {
    // token-generation-states only if agreement is the latest

    await updateAgreementStateOnTokenGenStates({
      GSIPK_consumerId_eserviceId,
      agreementState: agreement.state,
      dynamoDBClient,
      logger,
    });
  } else {
    logger.info(
      `Token-generation-states. Skipping processing of entry GSIPK_consumerId_eserviceId ${GSIPK_consumerId_eserviceId}. Reason: agreement is not the latest`
    );
  }

  await deleteAgreementEntry(primaryKey, dynamoDBClient, logger);
};

const handleUpgrade = async (
  agreement: Agreement,
  dynamoDBClient: DynamoDBClient,
  msgVersion: number,
  logger: Logger
): Promise<void> => {
  const primaryKey = makePlatformStatesAgreementPK(agreement.id);
  const agreementEntry = await readAgreementEntry(primaryKey, dynamoDBClient);

  const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
    consumerId: agreement.consumerId,
    eserviceId: agreement.eserviceId,
  });

  const agreementTimestamp = extractAgreementTimestamp(agreement);

  if (agreementEntry) {
    if (agreementEntry.version > msgVersion) {
      logger.info(
        `Skipping processing of entry ${agreementEntry}. Reason: a more recent entry already exists`
      );
      return Promise.resolve();
    } else {
      await updateAgreementStateInPlatformStatesEntry(
        dynamoDBClient,
        primaryKey,
        agreementStateToItemState(agreement.state),
        msgVersion,
        logger
      );
    }
  } else {
    if (agreement.stamps.upgrade === undefined) {
      logger.warn(
        `Missing agreement upgrade stamp for agreement with id ${agreement.id}. Using activation stamp or createdAt as fallback.`
      );
    }

    const newAgreementEntry: PlatformStatesAgreementEntry = {
      PK: primaryKey,
      state: agreementStateToItemState(agreement.state),
      version: msgVersion,
      updatedAt: new Date().toISOString(),
      GSIPK_consumerId_eserviceId,
      GSISK_agreementTimestamp: agreementTimestamp,
      agreementDescriptorId: agreement.descriptorId,
    };

    await writeAgreementEntry(newAgreementEntry, dynamoDBClient, logger);
  }

  await updateLatestAgreementOnTokenGenStates(
    dynamoDBClient,
    agreement,
    logger
  );
};
