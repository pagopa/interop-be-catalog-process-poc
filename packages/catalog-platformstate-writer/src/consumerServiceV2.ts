import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceEventEnvelopeV2,
  EServiceV2,
  fromEServiceV2,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  missingKafkaMessageDataError,
  PlatformStatesCatalogEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";
import {
  deleteCatalogEntry,
  descriptorStateToItemState,
  readCatalogEntry,
  updateDescriptorInfoInTokenGenerationStatesTable,
  updateDescriptorStateInPlatformStatesEntry,
  updateDescriptorStateInTokenGenerationStatesTable,
  updateDescriptorVoucherLifespanInPlatformStateEntry,
  updateDescriptorVoucherLifespanInTokenGenerationStatesTable,
  writeCatalogEntry,
} from "./utils.js";

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> {
  await match(message)
    .with(
      { type: "EServiceDescriptorPublished" },
      { type: "EServiceDescriptorApprovedByDelegator" },
      async (msg) => {
        const { eservice, descriptor } = parseEServiceAndDescriptor(
          msg.data.eservice,
          unsafeBrandId(msg.data.descriptorId),
          message.type
        );
        const previousDescriptor = eservice.descriptors.find(
          (d) => d.version === (Number(descriptor.version) - 1).toString()
        );

        // flow for current descriptor
        const processCurrentDescriptor = async (): Promise<void> => {
          const primaryKeyCurrent = makePlatformStatesEServiceDescriptorPK({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
          });
          const existingCatalogEntryCurrent = await readCatalogEntry(
            primaryKeyCurrent,
            dynamoDBClient
          );
          if (existingCatalogEntryCurrent) {
            if (existingCatalogEntryCurrent.version > msg.version) {
              // Stops processing if the message is older than the catalog entry
              logger.info(
                `Skipping processing of entry ${existingCatalogEntryCurrent.PK} (the current descriptor). Reason: it already exists`
              );
              return Promise.resolve();
            } else {
              await updateDescriptorStateInPlatformStatesEntry(
                dynamoDBClient,
                primaryKeyCurrent,
                descriptorStateToItemState(descriptor.state),
                msg.version,
                logger
              );
            }
          } else {
            const catalogEntry: PlatformStatesCatalogEntry = {
              PK: primaryKeyCurrent,
              state: descriptorStateToItemState(descriptor.state),
              descriptorAudience: descriptor.audience,
              descriptorVoucherLifespan: descriptor.voucherLifespan,
              version: msg.version,
              updatedAt: new Date().toISOString(),
            };

            await writeCatalogEntry(catalogEntry, dynamoDBClient, logger);
          }

          // token-generation-states
          const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
          });
          await updateDescriptorInfoInTokenGenerationStatesTable(
            eserviceId_descriptorId,
            descriptorStateToItemState(descriptor.state),
            descriptor.voucherLifespan,
            descriptor.audience,
            dynamoDBClient,
            logger
          );
        };

        await processCurrentDescriptor();

        // flow for previous descriptor

        if (
          !previousDescriptor ||
          previousDescriptor.state !== descriptorState.archived
        ) {
          logger.info(
            `Skipping processing of previous descriptor${
              previousDescriptor
                ? ` ${previousDescriptor.id}. Reason: state ${previousDescriptor.state} is not archived`
                : ". Reason: there is only one"
            }`
          );
          return Promise.resolve();
        } else {
          const primaryKeyPrevious = makePlatformStatesEServiceDescriptorPK({
            eserviceId: eservice.id,
            descriptorId: previousDescriptor.id,
          });

          await deleteCatalogEntry(primaryKeyPrevious, dynamoDBClient, logger);

          // token-generation-states
          const eserviceId_descriptorId_previous =
            makeGSIPKEServiceIdDescriptorId({
              eserviceId: eservice.id,
              descriptorId: previousDescriptor.id,
            });
          await updateDescriptorStateInTokenGenerationStatesTable(
            eserviceId_descriptorId_previous,
            descriptorStateToItemState(previousDescriptor.state),
            dynamoDBClient,
            logger
          );
        }
      }
    )
    .with(
      { type: "EServiceDescriptorActivated" },
      { type: "EServiceDescriptorSuspended" },
      async (msg) => {
        const { eservice, descriptor } = parseEServiceAndDescriptor(
          msg.data.eservice,
          unsafeBrandId(msg.data.descriptorId),
          message.type
        );
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
        });
        const catalogEntry = await readCatalogEntry(primaryKey, dynamoDBClient);

        if (!catalogEntry || catalogEntry.version > msg.version) {
          logger.info(
            `Skipping processing of entry ${primaryKey}. Reason: ${
              !catalogEntry
                ? "entry not found in platform-states"
                : "a more recent entry already exists"
            }`
          );

          return Promise.resolve();
        } else {
          await updateDescriptorStateInPlatformStatesEntry(
            dynamoDBClient,
            primaryKey,
            descriptorStateToItemState(descriptor.state),
            msg.version,
            logger
          );

          // token-generation-states
          const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
          });
          await updateDescriptorStateInTokenGenerationStatesTable(
            eserviceId_descriptorId,
            descriptorStateToItemState(descriptor.state),
            dynamoDBClient,
            logger
          );
        }
      }
    )
    .with({ type: "EServiceDescriptorArchived" }, async (msg) => {
      const { eservice, descriptor } = parseEServiceAndDescriptor(
        msg.data.eservice,
        unsafeBrandId<DescriptorId>(msg.data.descriptorId),
        msg.type
      );

      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: unsafeBrandId<DescriptorId>(msg.data.descriptorId),
      });
      await deleteCatalogEntry(primaryKey, dynamoDBClient, logger);

      // token-generation-states
      const descriptorId = unsafeBrandId<DescriptorId>(msg.data.descriptorId);
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId,
      });
      await updateDescriptorStateInTokenGenerationStatesTable(
        eserviceId_descriptorId,
        descriptorStateToItemState(descriptor.state),
        dynamoDBClient,
        logger
      );
    })
    .with({ type: "EServiceDescriptorQuotasUpdated" }, async (msg) => {
      const { eservice, descriptor } = parseEServiceAndDescriptor(
        msg.data.eservice,
        unsafeBrandId(msg.data.descriptorId),
        message.type
      );
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      });
      const catalogEntry = await readCatalogEntry(primaryKey, dynamoDBClient);

      if (!catalogEntry || catalogEntry.version > msg.version) {
        logger.info(
          `Skipping processing of entry ${primaryKey}. Reason: ${
            !catalogEntry
              ? "entry not found in platform-states"
              : "a more recent entry already exists"
          }`
        );

        return Promise.resolve();
      } else {
        if (
          descriptor.voucherLifespan !== catalogEntry.descriptorVoucherLifespan
        ) {
          await updateDescriptorVoucherLifespanInPlatformStateEntry(
            dynamoDBClient,
            primaryKey,
            descriptor.voucherLifespan,
            msg.version,
            logger
          );

          // token-generation-states
          const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
          });
          await updateDescriptorVoucherLifespanInTokenGenerationStatesTable(
            eserviceId_descriptorId,
            descriptor.voucherLifespan,
            dynamoDBClient,
            logger
          );
        } else {
          logger.info(
            `Platform-states and Token-generation-states. Skipping processing of entry ${primaryKey}. Reason: unchanged voucherLifespan`
          );
        }
      }
    })
    .with(
      { type: "EServiceDeleted" },
      { type: "EServiceAdded" },
      { type: "DraftEServiceUpdated" },
      { type: "EServiceCloned" },
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceDraftDescriptorDeleted" },
      { type: "EServiceDraftDescriptorUpdated" },
      { type: "EServiceDescriptorInterfaceAdded" },
      { type: "EServiceDescriptorDocumentAdded" },
      { type: "EServiceDescriptorInterfaceUpdated" },
      { type: "EServiceDescriptorDocumentUpdated" },
      { type: "EServiceDescriptorInterfaceDeleted" },
      { type: "EServiceDescriptorDocumentDeleted" },
      { type: "EServiceRiskAnalysisAdded" },
      { type: "EServiceRiskAnalysisUpdated" },
      { type: "EServiceRiskAnalysisDeleted" },
      { type: "EServiceDescriptionUpdated" },
      { type: "EServiceIsDelegableEnabled" },
      { type: "EServiceIsDelegableDisabled" },
      { type: "EServiceIsClientAccessDelegableEnabled" },
      { type: "EServiceIsClientAccessDelegableDisabled" },
      { type: "EServiceDescriptorRejectedByDelegator" },
      { type: "EServiceDescriptorSubmittedByDelegate" },
      { type: "EServiceDescriptorAttributesUpdated" },
      { type: "EServiceNameUpdated" },
      () => Promise.resolve()
    )
    .exhaustive();
}

export const parseEServiceAndDescriptor = (
  eserviceV2: EServiceV2 | undefined,
  descriptorId: DescriptorId,
  eventType: string
): { eservice: EService; descriptor: Descriptor } => {
  if (!eserviceV2) {
    throw missingKafkaMessageDataError("eservice", eventType);
  }

  const eservice = fromEServiceV2(eserviceV2);

  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
  if (!descriptor) {
    throw missingKafkaMessageDataError("descriptor", eventType);
  }
  return { eservice, descriptor };
};
