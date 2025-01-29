import { randomUUID } from "crypto";
import { EServiceEventEnvelopeV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { QueueMessage } from "../../queue-manager/queueMessage.js";
import { CatalogItemEventNotification } from "./catalogItemEventNotification.js";

export const eventV2TypeMapper = (
  eventType: EServiceEventEnvelopeV2["type"]
): string =>
  match(eventType)
    .with("EServiceAdded", () => "catalog_item_added")
    .with(
      "DraftEServiceUpdated",
      "EServiceDescriptionUpdated",
      "EServiceIsDelegableEnabled",
      "EServiceIsDelegableDisabled",
      "EServiceIsClientAccessDelegableEnabled",
      "EServiceIsClientAccessDelegableDisabled",
      "EServiceNameUpdated",
      () => "catalog_item_updated"
    )
    .with(
      "EServiceDraftDescriptorDeleted",
      () => "catalog_item_with_descriptors_deleted"
    )
    .with("EServiceDeleted", () => "catalog_item_deleted")
    .with("EServiceCloned", () => "cloned_catalog_item_added")
    .with(
      "EServiceDescriptorAdded",
      "EServiceDraftDescriptorUpdated", // Avoid generating notification
      () => "catalog_item_descriptor_added"
    )
    .with(
      "EServiceDescriptorQuotasUpdated",
      "EServiceDescriptorActivated",
      "EServiceDescriptorArchived",
      "EServiceDescriptorPublished",
      "EServiceDescriptorSuspended",
      "EServiceDescriptorSubmittedByDelegate",
      "EServiceDescriptorApprovedByDelegator",
      "EServiceDescriptorRejectedByDelegator",
      "EServiceDescriptorAttributesUpdated",
      () => "catalog_item_descriptor_updated"
    )
    .with(
      "EServiceDescriptorInterfaceAdded",
      "EServiceDescriptorDocumentAdded",
      () => "catalog_item_document_added"
    )
    .with(
      "EServiceDescriptorInterfaceUpdated",
      "EServiceDescriptorDocumentUpdated",
      () => "catalog_item_document_updated"
    )
    .with(
      "EServiceDescriptorInterfaceDeleted",
      "EServiceDescriptorDocumentDeleted",
      () => "catalog_item_document_deleted"
    )
    .with("EServiceRiskAnalysisAdded", () => "catalog_item_risk_analysis_added")
    .with(
      "EServiceRiskAnalysisUpdated",
      () => "catalog_item_risk_analysis_updated"
    )
    .with(
      "EServiceRiskAnalysisDeleted",
      () => "catalog_item_risk_analysis_deleted"
    )
    .exhaustive();

/*
  This method is used to build a message for catalog events, that to be sent to the notify queue,
  it will be used to mantains compatibility with the old version of queue consumers.
  Related issue https://pagopa.atlassian.net/browse/IMN-67
*/
export const buildCatalogMessage = (
  event: EServiceEventEnvelopeV2,
  catalogItemEvent: CatalogItemEventNotification
): QueueMessage => ({
  messageUUID: randomUUID(),
  eventJournalPersistenceId: event.stream_id,
  eventJournalSequenceNumber: event.version,
  eventTimestamp: Number(event.log_date),
  kind: eventV2TypeMapper(event.type),
  payload: catalogItemEvent,
});
