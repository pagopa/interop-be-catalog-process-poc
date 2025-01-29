import { EServiceEventEnvelopeV2, fromEServiceV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { FileManager, Logger } from "pagopa-interop-commons";
import { EachMessagePayload } from "kafkajs";
import { exportInterface } from "./interfaceExporter.js";

export async function exportInterfaceV2(
  decodedMsg: EServiceEventEnvelopeV2,
  originalPayload: EachMessagePayload,
  fileManager: FileManager,
  logger: Logger
): Promise<void> {
  await match(decodedMsg)
    .with(
      { type: "EServiceDescriptorPublished" },
      { type: "EServiceDescriptorApprovedByDelegator" },
      async ({ data }) => {
        if (data.eservice) {
          logger.info(
            `Processing ${decodedMsg.type} message - Partition number: ${originalPayload.partition} - Offset: ${originalPayload.message.offset}`
          );
          const eservice = fromEServiceV2(data.eservice);
          const publishedDescriptor = eservice.descriptors.find(
            (d) => d.id === data.descriptorId
          );
          if (publishedDescriptor) {
            await exportInterface(
              eservice.id,
              publishedDescriptor,
              fileManager,
              logger
            );
          }
        }
      }
    )
    .with(
      { type: "EServiceAdded" },
      { type: "DraftEServiceUpdated" },
      { type: "EServiceDeleted" },
      { type: "EServiceCloned" },
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceDraftDescriptorUpdated" },
      { type: "EServiceDescriptorQuotasUpdated" },
      { type: "EServiceDescriptorActivated" },
      { type: "EServiceDescriptorArchived" },
      { type: "EServiceDescriptorSuspended" },
      { type: "EServiceDraftDescriptorDeleted" },
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
      { type: "EServiceIsDelegableEnabled" },
      { type: "EServiceIsDelegableDisabled" },
      { type: "EServiceIsClientAccessDelegableEnabled" },
      { type: "EServiceIsClientAccessDelegableDisabled" },
      { type: "EServiceDescriptorSubmittedByDelegate" },
      { type: "EServiceDescriptorRejectedByDelegator" },
      { type: "EServiceDescriptorAttributesUpdated" },
      { type: "EServiceNameUpdated" },
      () => undefined
    )
    .exhaustive();
}
