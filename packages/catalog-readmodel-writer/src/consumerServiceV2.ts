import { match } from "ts-pattern";
import { EServiceCollection, logger } from "pagopa-interop-commons";
import { EServiceEventEnvelopeV2 } from "pagopa-interop-models";
import { fromEServiceV2 } from "./model/converterV2.js";

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2,
  eservices: EServiceCollection
): Promise<void> {
  logger.info(message);

  const eservice = match(message)
    .with({ type: "EServiceCloned" }, (msg) => msg.data.clonedEservice)
    .otherwise((msg) => msg.data.eservice);

  await match(message)
    .with({ type: "EServiceDeleted" }, async (message) => {
      await eservices.deleteOne({
        "data.id": message.stream_id,
        "metadata.version": { $lt: message.version },
      });
    })
    .with(
      { type: "EServiceAdded" },
      { type: "DraftEServiceUpdated" },
      { type: "EServiceCloned" },
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceDraftDescriptorUpdated" },
      { type: "EServiceDescriptorUpdated" },
      { type: "EServiceDescriptorActivated" },
      { type: "EServiceDescriptorArchived" },
      { type: "EServiceDescriptorPublished" },
      { type: "EServiceDescriptorSuspended" },
      { type: "EServiceDescriptorDeleted" },
      { type: "EServiceDescriptorInterfaceAdded" },
      { type: "EServiceDescriptorDocumentAdded" },
      { type: "EServiceDescriptorInterfaceUpdated" },
      { type: "EServiceDescriptorDocumentUpdated" },
      { type: "EServiceDescriptorInterfaceDeleted" },
      { type: "EServiceDescriptorDocumentDeleted" },
      async (message) =>
        await eservices.updateOne(
          {
            "data.id": message.stream_id,
            "metadata.version": { $lt: message.version },
          },
          {
            $set: {
              data: eservice ? fromEServiceV2(eservice) : undefined,
              metadata: {
                version: message.version,
              },
            },
          },
          { upsert: true }
        )
    )
    .exhaustive();
}
