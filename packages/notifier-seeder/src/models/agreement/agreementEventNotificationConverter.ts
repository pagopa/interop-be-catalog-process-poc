import {
  AgreementEventEnvelopeV2,
  fromAgreementV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { eventV1ConversionError } from "../../notifierErrors.js";
import {
  AgreementDocumentV1Notification,
  AgreementEventNotification,
  AgreementIdAndDocumentIdNotification,
  AgreementIdAndDocumentNotification,
  AgreementIdNotification,
  AgreementNotification,
  AgreementV1Notification,
} from "./agreementEventNotification.js";
import { toAgreementV1Notification } from "./agreementEventNotificationMappers.js";

const getAgreement = (
  event: AgreementEventEnvelopeV2
): AgreementV1Notification => {
  if (!event.data.agreement) {
    throw missingKafkaMessageDataError("agreement", event.type);
  }
  const agreement = fromAgreementV2(event.data.agreement);
  return toAgreementV1Notification(agreement);
};

const getDocument = (
  agreement: AgreementV1Notification,
  documentId: string
): AgreementDocumentV1Notification => {
  const document = agreement.consumerDocuments.find((d) => d.id === documentId);
  if (!document) {
    throw eventV1ConversionError(
      `Expected document ${documentId} in agreement ${agreement.id} during eventV1 conversion`
    );
  }

  return document;
};

export const toAgreementEventNotification = (
  event: AgreementEventEnvelopeV2
): AgreementEventNotification =>
  match(event)
    .with(
      { type: "AgreementAdded" },
      { type: "AgreementUpgraded" },
      { type: "DraftAgreementUpdated" },
      { type: "AgreementSubmitted" },
      { type: "AgreementActivated" },
      { type: "AgreementUnsuspendedByProducer" },
      { type: "AgreementUnsuspendedByConsumer" },
      { type: "AgreementUnsuspendedByPlatform" },
      { type: "AgreementSuspendedByProducer" },
      { type: "AgreementSuspendedByConsumer" },
      { type: "AgreementSuspendedByPlatform" },
      { type: "AgreementSetDraftByPlatform" },
      { type: "AgreementSetMissingCertifiedAttributesByPlatform" },
      { type: "AgreementRejected" },
      { type: "AgreementArchivedByUpgrade" },
      { type: "AgreementArchivedByConsumer" },
      { type: "AgreementArchivedByRevokedDelegation" },
      (event): AgreementNotification => ({
        agreement: getAgreement(event),
      })
    )
    .with(
      { type: "AgreementDeleted" },
      { type: "AgreementDeletedByRevokedDelegation" },
      (event): AgreementIdNotification => ({
        agreementId: getAgreement(event).id,
      })
    )
    .with(
      { type: "AgreementConsumerDocumentAdded" },
      (event): AgreementIdAndDocumentNotification => {
        const agreementV1Notification = getAgreement(event);
        return {
          agreementId: agreementV1Notification.id,
          document: getDocument(agreementV1Notification, event.data.documentId),
        };
      }
    )
    .with(
      { type: "AgreementConsumerDocumentRemoved" },
      (event): AgreementIdAndDocumentIdNotification => ({
        agreementId: getAgreement(event).id,
        documentId: event.data.documentId,
      })
    )
    .exhaustive();
