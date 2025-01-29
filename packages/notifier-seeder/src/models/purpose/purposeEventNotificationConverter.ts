import {
  PurposeEventEnvelopeV2,
  fromPurposeV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  PurposeAndVersionIdNotification,
  PurposeEventNotification,
  PurposeIdAndVersionIdNotification,
  PurposeIdNotification,
  PurposeNotification,
  PurposeV1Notification,
} from "./purposeEventNotification.js";
import { toPurposeV1Notification } from "./purposeEventNotificationMappers.js";

const getPurpose = (event: PurposeEventEnvelopeV2): PurposeV1Notification => {
  if (!event.data.purpose) {
    throw missingKafkaMessageDataError("purpose", event.type);
  }
  const purpose = fromPurposeV2(event.data.purpose);
  return toPurposeV1Notification(purpose);
};

export const toPurposeEventNotification = (
  event: PurposeEventEnvelopeV2
): PurposeEventNotification =>
  match(event)
    .with(
      { type: "PurposeAdded" },
      { type: "DraftPurposeUpdated" },
      { type: "PurposeWaitingForApproval" },
      { type: "PurposeActivated" },
      { type: "NewPurposeVersionActivated" },
      { type: "PurposeVersionActivated" },
      { type: "PurposeVersionUnsuspendedByProducer" },
      { type: "PurposeVersionUnsuspendedByConsumer" },
      { type: "PurposeVersionSuspendedByProducer" },
      { type: "PurposeVersionSuspendedByConsumer" },
      { type: "PurposeArchived" },
      { type: "PurposeCloned" },
      { type: "NewPurposeVersionWaitingForApproval" },
      { type: "PurposeVersionOverQuotaUnsuspended" },
      { type: "PurposeVersionArchivedByRevokedDelegation" },
      (event): PurposeNotification => ({
        purpose: getPurpose(event),
      })
    )
    .with(
      { type: "PurposeVersionRejected" },
      (event): PurposeAndVersionIdNotification => ({
        purpose: getPurpose(event),
        versionId: event.data.versionId,
      })
    )
    .with(
      { type: "DraftPurposeDeleted" },
      { type: "WaitingForApprovalPurposeDeleted" },
      { type: "PurposeDeletedByRevokedDelegation" },
      (event): PurposeIdNotification => ({
        purposeId: getPurpose(event).id,
      })
    )
    .with(
      { type: "WaitingForApprovalPurposeVersionDeleted" },
      (event): PurposeIdAndVersionIdNotification => ({
        purposeId: getPurpose(event).id,
        versionId: event.data.versionId,
      })
    )
    .exhaustive();
