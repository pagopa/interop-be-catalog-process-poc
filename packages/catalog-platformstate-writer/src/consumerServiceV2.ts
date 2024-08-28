import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DescriptorState,
  EServiceEventEnvelopeV2,
  fromEServiceDescriptorStateV2,
  genericInternalError,
  ItemState,
  PlatformStatesCatalogEntry,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  deleteCatalogEntry,
  descriptorStateToClientState,
  readCatalogEntry,
  writeCatalogEntry,
} from "./utils.js";

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with({ type: "EServiceDescriptorPublished" }, async (msg) => {
      const descriptorId = msg.data.descriptorId;
      const eservice = msg.data.eservice;
      if (!eservice) {
        throw genericInternalError(
          `EService not found in message data for event ${msg.type}`
        );
      }

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );
      if (!descriptor) {
        throw genericInternalError(
          `Unable to find descriptor with id ${descriptorId}`
        );
      }
      const descriptorState: DescriptorState = fromEServiceDescriptorStateV2(
        descriptor.state
      );
      const catalogEntry: PlatformStatesCatalogEntry = {
        // TODO: change with the PK type
        PK: `ESERVICEDESCRIPTOR#${eservice.id}#${descriptorId}`,
        state: descriptorStateToClientState(descriptorState),
        descriptorAudience: descriptor.audience[0],
      };

      await writeCatalogEntry(catalogEntry, dynamoDBClient);

      // TODO: Add token-generation-states part
    })
    .with(
      { type: "EServiceDescriptorActivated" },
      { type: "EServiceDescriptorSuspended" },
      async (msg) => {
        const eservice = msg.data.eservice;
        if (!eservice) {
          throw genericInternalError(
            `EService not found in message data for event ${msg.type}`
          );
        }

        // TODO: change with the PK type
        const primaryKey = `ESERVICEDESCRIPTOR#${eservice.id}#${msg.data.descriptorId}`;
        // TODO: remove read?
        const catalogEntry = await readCatalogEntry(primaryKey, dynamoDBClient);

        if (!catalogEntry) {
          throw genericInternalError(
            `Unable to find catalog entry with PK ${primaryKey}`
          );
        } else {
          const updatedCatalogEntry: PlatformStatesCatalogEntry = {
            ...catalogEntry,
            state:
              msg.type === "EServiceDescriptorActivated"
                ? ItemState.Enum.ACTIVE
                : ItemState.Enum.INACTIVE,
          };
          await writeCatalogEntry(updatedCatalogEntry, dynamoDBClient);
        }

        // TODO: Add token-generation-states part
      }
    )
    .with({ type: "EServiceDescriptorArchived" }, async (msg) => {
      const eservice = msg.data.eservice;
      if (!eservice) {
        throw genericInternalError(
          `EService not found in message data for event ${msg.type}`
        );
      }

      const primaryKey = `ESERVICEDESCRIPTOR#${eservice.id}#${msg.data.descriptorId}`;
      await deleteCatalogEntry(primaryKey, dynamoDBClient);
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
