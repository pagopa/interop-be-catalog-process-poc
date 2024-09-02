import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DescriptorId,
  descriptorState,
  EServiceEventEnvelopeV2,
  fromEServiceV2,
  genericInternalError,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  PlatformStatesCatalogEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  deleteCatalogEntry,
  descriptorStateToClientState,
  readCatalogEntry,
  updateEntriesInTokenGenerationStatesTable,
  writeCatalogEntry,
} from "./utils.js";

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with({ type: "EServiceDescriptorPublished" }, async (msg) => {
      const descriptorId = msg.data.descriptorId;
      const eserviceV2 = msg.data.eservice;
      if (!eserviceV2) {
        throw genericInternalError(
          `EService not found in message data for event ${msg.type}`
        );
      }

      const eservice = fromEServiceV2(eserviceV2);

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );
      if (!descriptor) {
        throw genericInternalError(
          `Unable to find descriptor with id ${descriptorId}`
        );
      }
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      });
      const existingCatalogEntry = await readCatalogEntry(
        primaryKey,
        dynamoDBClient
      );

      // Stops processing if the message is older than the catalog entry
      if (existingCatalogEntry && existingCatalogEntry.version > msg.version) {
        return;
      }

      const catalogEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: descriptorStateToClientState(descriptor.state),
        descriptorAudience: descriptor.audience[0],
        version: msg.version,
        updatedAt: new Date().toISOString(),
      };

      await writeCatalogEntry(catalogEntry, dynamoDBClient);

      // TODO: Add token-generation-states part
    })
    .with(
      { type: "EServiceDescriptorActivated" },
      { type: "EServiceDescriptorSuspended" },
      async (msg) => {
        const eserviceV2 = msg.data.eservice;
        if (!eserviceV2) {
          throw genericInternalError(
            `EService not found in message data for event ${msg.type}`
          );
        }

        const eservice = fromEServiceV2(eserviceV2);
        const descriptorId = unsafeBrandId<DescriptorId>(msg.data.descriptorId);
        const descriptor = eservice.descriptors.find(
          (d) => d.id === descriptorId
        );
        if (!descriptor) {
          throw genericInternalError(
            `Unable to find descriptor with id ${descriptorId}`
          );
        }
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: unsafeBrandId<DescriptorId>(descriptorId),
        });
        const catalogEntry = await readCatalogEntry(primaryKey, dynamoDBClient);

        if (!catalogEntry) {
          throw genericInternalError(
            `Unable to find catalog entry with PK ${primaryKey}`
          );
        } else {
          // Stops processing if the message is older than the catalog entry
          if (catalogEntry.version > msg.version) {
            return;
          }

          const updatedCatalogEntry: PlatformStatesCatalogEntry = {
            ...catalogEntry,
            state: descriptorStateToClientState(descriptor.state),
            version: msg.version,
            updatedAt: new Date().toISOString(),
          };
          await writeCatalogEntry(updatedCatalogEntry, dynamoDBClient);

          // token-generation-states
          const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId,
          });
          await updateEntriesInTokenGenerationStatesTable(
            eserviceId_descriptorId,
            descriptor.state,
            dynamoDBClient
          );
        }
      }
    )
    .with({ type: "EServiceDescriptorArchived" }, async (msg) => {
      const eserviceV2 = msg.data.eservice;
      if (!eserviceV2) {
        throw genericInternalError(
          `EService not found in message data for event ${msg.type}`
        );
      }
      const eservice = fromEServiceV2(eserviceV2);

      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: unsafeBrandId<DescriptorId>(msg.data.descriptorId),
      });
      await deleteCatalogEntry(primaryKey, dynamoDBClient);

      // token-generation-states
      const descriptorId = unsafeBrandId<DescriptorId>(msg.data.descriptorId);
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId,
      });
      await updateEntriesInTokenGenerationStatesTable(
        eserviceId_descriptorId,
        descriptorState.archived,
        dynamoDBClient
      );
    })
    .with(
      { type: "EServiceDeleted" },
      { type: "EServiceAdded" },
      { type: "DraftEServiceUpdated" },
      { type: "EServiceCloned" },
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceDraftDescriptorDeleted" },
      { type: "EServiceDraftDescriptorUpdated" },
      { type: "EServiceDescriptorQuotasUpdated" },
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
      () => Promise.resolve()
    )
    .exhaustive();
}
