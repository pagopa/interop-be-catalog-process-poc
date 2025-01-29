import { randomUUID } from "crypto";
import { PurposeEventEnvelopeV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { QueueMessage } from "../../queue-manager/queueMessage.js";
import { PurposeEventNotification } from "./purposeEventNotification.js";

export const eventV2TypeMapper = (
  eventType: PurposeEventEnvelopeV2["type"]
): string =>
  match(eventType)
    .with("PurposeAdded", "PurposeCloned", () => "purpose_created")
    .with("DraftPurposeUpdated", () => "purpose_updated")
    .with(
      "PurposeWaitingForApproval",
      "NewPurposeVersionWaitingForApproval",
      "PurposeVersionOverQuotaUnsuspended",
      () => "purpose_version_waited_for_approval"
    )
    .with(
      "PurposeActivated",
      "NewPurposeVersionActivated",
      "PurposeVersionActivated",
      "PurposeVersionUnsuspendedByProducer",
      "PurposeVersionUnsuspendedByConsumer",
      () => "purpose_version_activated"
    )
    .with(
      "DraftPurposeDeleted",
      "WaitingForApprovalPurposeDeleted",
      "PurposeDeletedByRevokedDelegation",
      () => "purpose_deleted"
    )
    .with(
      "PurposeVersionSuspendedByProducer",
      "PurposeVersionSuspendedByConsumer",
      () => "purpose_version_suspended"
    )
    .with(
      "PurposeArchived",
      "PurposeVersionArchivedByRevokedDelegation",
      () => "purpose_version_archived"
    )
    .with(
      "WaitingForApprovalPurposeVersionDeleted",
      () => "purpose_version_deleted"
    )
    .with("PurposeVersionRejected", () => "purpose_version_rejected")
    .exhaustive();

export const buildPurposeMessage = (
  event: PurposeEventEnvelopeV2,
  purposeEvent: PurposeEventNotification
): QueueMessage => ({
  messageUUID: randomUUID(),
  eventJournalPersistenceId: event.stream_id,
  eventJournalSequenceNumber: event.version,
  eventTimestamp: Number(event.log_date),
  kind: eventV2TypeMapper(event.type),
  payload: purposeEvent,
});
