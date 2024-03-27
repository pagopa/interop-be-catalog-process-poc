import { match } from "ts-pattern";
import {
  logger,
  readModelWriterConfig,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { AttributeEventEnvelope, fromAttributeV1 } from "pagopa-interop-models";

const { attributes } = ReadModelRepository.init(readModelWriterConfig());

export async function handleMessage(
  message: AttributeEventEnvelope
): Promise<void> {
  logger.info(message);
  await match(message)
    .with({ type: "AttributeAdded" }, async (msg) => {
      await attributes.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $setOnInsert: {
            data: msg.data.attribute
              ? fromAttributeV1(msg.data.attribute)
              : undefined,
            metadata: {
              version: msg.version,
            },
          },
        },
        { upsert: true }
      );
    })
    .with({ type: "MaintenanceAttributeDeleted" }, async (msg) => {
      await attributes.deleteOne({
        "data.id": msg.stream_id,
        "metadata.version": { $lt: msg.version },
      });
    })
    .exhaustive();
}
