import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  Agreement,
  AgreementEventEnvelopeV2,
  agreementState,
  AgreementV2,
  fromAgreementV2,
  genericInternalError,
  makeGSIPKConsumerIdEServiceId,
  makePlatformStatesAgreementPK,
  PlatformStatesAgreementEntry,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";
import {
  agreementStateToItemState,
  readAgreementEntry,
  updateAgreementStateInPlatformStatesEntry,
  updateAgreementStateOnTokenGenStates,
  isLatestAgreement,
  updateLatestAgreementOnTokenGenStates,
  extractAgreementTimestamp,
  upsertPlatformStatesAgreementEntry,
} from "./utils.js";

export async function handleMessageV2(
  message: AgreementEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> {
  await match(message)
    .with({ type: "AgreementActivated" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);
      const primaryKey = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

      const existingAgreementEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );

      const agreementTimestamp =
        agreement.stamps.activation?.when.toISOString();
      if (!agreementTimestamp) {
        throw genericInternalError(
          "An activated agreement should have activation stamp"
        );
      }

      if (isLatestAgreement(existingAgreementEntry, agreementTimestamp)) {
        if (
          existingAgreementEntry &&
          existingAgreementEntry.version > msg.version &&
          existingAgreementEntry.agreementId === agreement.id
        ) {
          logger.info(
            `Skipping processing of entry ${primaryKey}. Reason: a more recent entry already exists`
          );
          return Promise.resolve();
        } else {
          const agreementEntry: PlatformStatesAgreementEntry = {
            PK: primaryKey,
            state: agreementStateToItemState(agreement.state),
            version: msg.version,
            updatedAt: new Date().toISOString(),
            agreementId: agreement.id,
            agreementTimestamp,
            agreementDescriptorId: agreement.descriptorId,
          };

          await upsertPlatformStatesAgreementEntry(
            agreementEntry,
            dynamoDBClient,
            logger
          );

          await updateLatestAgreementOnTokenGenStates(
            dynamoDBClient,
            agreement,
            logger
          );
        }
      } else {
        logger.info(
          `Platform-states and token-generation-states. Skipping processing of entry with agreementId ${agreement.id}. Reason: agreement is not the latest`
        );
        return Promise.resolve();
      }
    })
    .with(
      { type: "AgreementUnsuspendedByProducer" },
      { type: "AgreementUnsuspendedByConsumer" },
      { type: "AgreementUnsuspendedByPlatform" },
      { type: "AgreementSuspendedByProducer" },
      { type: "AgreementSuspendedByConsumer" },
      { type: "AgreementSuspendedByPlatform" },
      async (msg) => {
        const agreement = parseAgreement(msg.data.agreement);
        const primaryKey = makePlatformStatesAgreementPK({
          consumerId: agreement.consumerId,
          eserviceId: agreement.eserviceId,
        });
        const agreementEntry = await readAgreementEntry(
          primaryKey,
          dynamoDBClient
        );

        const agreementTimestamp = extractAgreementTimestamp(agreement);

        if (isLatestAgreement(agreementEntry, agreementTimestamp)) {
          if (!agreementEntry) {
            logger.info(
              `Skipping processing of entry ${primaryKey}. Reason: entry not found in platform-states`
            );
          } else if (
            agreementEntry &&
            agreementEntry.version > msg.version &&
            agreementEntry.agreementId === agreement.id
          ) {
            logger.info(
              `Skipping processing of entry ${primaryKey}. Reason: a more recent entry already exists`
            );
            return Promise.resolve();
          } else {
            await updateAgreementStateInPlatformStatesEntry(
              dynamoDBClient,
              primaryKey,
              agreementStateToItemState(agreement.state),
              msg.version,
              logger
            );

            const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
              consumerId: agreement.consumerId,
              eserviceId: agreement.eserviceId,
            });

            // token-generation-states only if agreement is the latest
            await updateAgreementStateOnTokenGenStates({
              GSIPK_consumerId_eserviceId,
              agreementState: agreement.state,
              dynamoDBClient,
              logger,
            });
          }
        } else {
          logger.info(
            `Platform-states and token-generation-states. Skipping processing of entry with agreementId ${
              agreement.id
            }. Reason: ${
              agreementEntry
                ? "entry not found in platform-states"
                : "agreement is not the latest"
            }`
          );
          return Promise.resolve();
        }
      }
    )
    .with({ type: "AgreementUpgraded" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);
      const primaryKey = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const agreementEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );

      const agreementTimestamp = agreement.stamps.upgrade?.when.toISOString();
      if (!agreementTimestamp) {
        throw genericInternalError(
          "An upgraded agreement should have an upgrade stamp"
        );
      }

      if (isLatestAgreement(agreementEntry, agreementTimestamp)) {
        if (
          agreementEntry &&
          agreementEntry.version > msg.version &&
          agreementEntry.agreementId === agreement.id
        ) {
          logger.info(
            `Skipping processing of entry ${agreementEntry.PK}. Reason: a more recent entry already exists`
          );
          return Promise.resolve();
        } else if (
          agreement.state !== agreementState.active &&
          agreement.state !== agreementState.suspended
        ) {
          logger.info(
            `Skipping processing of entry ${primaryKey}. Reason: the agreement state ${agreement.state} is not active or suspended`
          );
          return Promise.resolve();
        } else {
          const newAgreementEntry: PlatformStatesAgreementEntry = {
            PK: primaryKey,
            state: agreementStateToItemState(agreement.state),
            version: msg.version,
            updatedAt: new Date().toISOString(),
            agreementId: agreement.id,
            agreementTimestamp,
            agreementDescriptorId: agreement.descriptorId,
          };

          await upsertPlatformStatesAgreementEntry(
            newAgreementEntry,
            dynamoDBClient,
            logger
          );
        }

        await updateLatestAgreementOnTokenGenStates(
          dynamoDBClient,
          agreement,
          logger
        );
      } else {
        logger.info(
          `Platform-states and token-generation-states. Skipping processing of entry with agreementId ${agreement.id}. Reason: agreement is not the latest`
        );
        return Promise.resolve();
      }
    })
    .with(
      { type: "AgreementArchivedByConsumer" },
      { type: "AgreementArchivedByRevokedDelegation" },
      async (msg) => {
        const agreement = parseAgreement(msg.data.agreement);

        const primaryKey = makePlatformStatesAgreementPK({
          consumerId: agreement.consumerId,
          eserviceId: agreement.eserviceId,
        });
        const agreementEntry = await readAgreementEntry(
          primaryKey,
          dynamoDBClient
        );

        const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
          consumerId: agreement.consumerId,
          eserviceId: agreement.eserviceId,
        });

        const agreementTimestamp = extractAgreementTimestamp(agreement);

        if (
          isLatestAgreement(agreementEntry, agreementTimestamp) &&
          agreementEntry?.agreementId === agreement.id
        ) {
          // token-generation-states only if agreement is the latest
          await updateAgreementStateOnTokenGenStates({
            GSIPK_consumerId_eserviceId,
            agreementState: agreement.state,
            dynamoDBClient,
            logger,
          });
          await updateAgreementStateInPlatformStatesEntry(
            dynamoDBClient,
            primaryKey,
            agreementStateToItemState(agreement.state),
            msg.version,
            logger
          );
        } else {
          logger.info(
            `Platform-states and Token-generation-states. Skipping processing of entry with GSIPK_consumerId_eserviceId ${GSIPK_consumerId_eserviceId} and agreement ${agreement.id}. Reason: agreement is not the latest`
          );
        }
      }
    )
    .with(
      { type: "AgreementAdded" },
      { type: "AgreementDeleted" },
      { type: "DraftAgreementUpdated" },
      { type: "AgreementSubmitted" },
      { type: "AgreementRejected" },
      { type: "AgreementConsumerDocumentAdded" },
      { type: "AgreementConsumerDocumentRemoved" },
      { type: "AgreementSetDraftByPlatform" },
      { type: "AgreementSetMissingCertifiedAttributesByPlatform" },
      { type: "AgreementArchivedByUpgrade" },
      { type: "AgreementDeletedByRevokedDelegation" },
      () => Promise.resolve()
    )
    .exhaustive();
}

const parseAgreement = (agreementV2: AgreementV2 | undefined): Agreement => {
  if (!agreementV2) {
    throw genericInternalError(`Agreement not found in message data`);
  }

  return fromAgreementV2(agreementV2);
};
