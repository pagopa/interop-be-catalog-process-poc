import { ClientCollection } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV1,
  fromClientV1,
  toReadModelClient,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV1(
  message: AuthorizationEventEnvelopeV1,
  clients: ClientCollection
): Promise<void> {
  await match(message)
    .with(
      { type: "ClientAdded" },
      { type: "RelationshipAdded" },
      { type: "UserAdded" },
      { type: "UserRemoved" },
      async (message) => {
        await clients.updateOne(
          {
            "data.id": message.stream_id,
            "metadata.version": { $lt: message.version },
          },
          {
            $set: {
              data: message.data.client
                ? toReadModelClient(fromClientV1(message.data.client))
                : undefined,
              metadata: {
                version: message.version,
              },
            },
          },
          { upsert: true }
        );
      }
    )
    .with({ type: "ClientPurposeAdded" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lt: message.version },
        },
        {
          $set: {
            "metadata.version": message.version,
          },
          $push: {
            "data.purposes": message.data.statesChain?.purpose?.purposeId,
          },
        }
      );
    })
    .with({ type: "ClientPurposeRemoved" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lt: message.version },
        },
        {
          $pull: {
            "data.purposes": message.data.purposeId,
          },
          $set: {
            "metadata.version": message.version,
          },
        }
      );
    })
    .with({ type: "RelationshipRemoved" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lt: message.version },
        },
        {
          $pull: {
            "data.relationships": message.data.relationshipId,
          },
          $set: {
            "metadata.version": message.version,
          },
        }
      );
    })
    .with({ type: "KeysAdded" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lt: message.version },
        },
        {
          $push: {
            "data.keys": message.data.keys,
          },
          $set: {
            "metadata.version": message.version,
          },
        }
      );
    })
    .with({ type: "KeyDeleted" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lt: message.version },
        },
        {
          $pull: {
            "data.keys": message.data.keyId,
          },
          $set: {
            "metadata.version": message.version,
          },
        }
      );
    })
    .with({ type: "ClientDeleted" }, async (message) => {
      await clients.deleteOne({
        "data.id": message.stream_id,
        "metadata.version": { $lt: message.version },
      });
    })
    .with({ type: "KeyRelationshipToUserMigrated" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lt: message.version },
        },
        {
          $push: {
            "data.users": message.data.userId,
          },
          $set: {
            "metadata.version": message.version,
          },
        }
      );
    })
    .exhaustive();
}
