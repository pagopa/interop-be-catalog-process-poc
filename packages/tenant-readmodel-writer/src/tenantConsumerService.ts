import { match } from "ts-pattern";
import { logger, TenantCollection } from "pagopa-interop-commons";
import { TenantEventEnvelopeV1, fromTenantV1 } from "pagopa-interop-models";

export async function handleMessage(
  message: TenantEventEnvelopeV1,
  tenants: TenantCollection
): Promise<void> {
  logger.info(message);
  await match(message)
    .with({ type: "TenantCreated" }, async (msg) => {
      await tenants.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $setOnInsert: {
            data: msg.data.tenant ? fromTenantV1(msg.data.tenant) : undefined,
            metadata: {
              version: msg.version,
            },
          },
        },
        { upsert: true }
      );
    })
    .with({ type: "TenantDeleted" }, async (_msg) => {
      logger.info("TODO");
    })
    .with(
      { type: "TenantUpdated" },
      async (msg) =>
        await tenants.updateOne(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $set: {
              data: msg.data.tenant ? fromTenantV1(msg.data.tenant) : undefined,
              metadata: {
                version: msg.version,
              },
            },
          }
        )
    )
    .with({ type: "SelfcareMappingCreated" }, async (_msg) => {
      logger.info("TODO");
    })
    .with({ type: "SelfcareMappingDeleted" }, async (_msg) => {
      logger.info("TODO");
    })
    .exhaustive();
}
