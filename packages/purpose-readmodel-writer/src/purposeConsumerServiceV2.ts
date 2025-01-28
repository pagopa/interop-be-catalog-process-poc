import { PurposeCollection } from "pagopa-interop-commons";
import {
  PurposeEventEnvelopeV2,
  fromPurposeV2,
  toReadModelPurpose,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: PurposeEventEnvelopeV2,
  purposes: PurposeCollection
): Promise<void> {
  const purpose = message.data.purpose;

  await match(message)
    .with(
      { type: "DraftPurposeDeleted" },
      { type: "WaitingForApprovalPurposeDeleted" },
      { type: "PurposeDeletedByRevokedDelegation" },
      async (message) => {
        await purposes.deleteOne({
          "data.id": message.stream_id,
          "metadata.version": { $lte: message.version },
        });
      }
    )
    .with(
      { type: "PurposeAdded" },
      { type: "DraftPurposeUpdated" },
      { type: "NewPurposeVersionActivated" },
      { type: "NewPurposeVersionWaitingForApproval" },
      { type: "PurposeActivated" },
      { type: "PurposeArchived" },
      { type: "PurposeVersionOverQuotaUnsuspended" },
      { type: "PurposeVersionRejected" },
      { type: "PurposeVersionSuspendedByConsumer" },
      { type: "PurposeVersionSuspendedByProducer" },
      { type: "PurposeVersionUnsuspendedByConsumer" },
      { type: "PurposeVersionUnsuspendedByProducer" },
      { type: "PurposeWaitingForApproval" },
      { type: "WaitingForApprovalPurposeVersionDeleted" },
      { type: "PurposeVersionActivated" },
      { type: "PurposeCloned" },
      { type: "PurposeVersionArchivedByRevokedDelegation" },
      async (message) =>
        await purposes.updateOne(
          {
            "data.id": message.stream_id,
            "metadata.version": { $lte: message.version },
          },
          {
            $set: {
              data: purpose
                ? toReadModelPurpose(fromPurposeV2(purpose))
                : undefined,
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
