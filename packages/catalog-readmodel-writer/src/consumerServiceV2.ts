import { EServiceCollection } from "pagopa-interop-commons";
import {
  EServiceEventEnvelopeV2,
  fromEServiceV2,
  toReadModelEService,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2,
  eservices: EServiceCollection
): Promise<void> {
  const eservice = message.data.eservice;

  await match(message)
    .with({ type: "EServiceDeleted" }, async (message) => {
      await eservices.deleteOne({
        "data.id": message.stream_id,
        "metadata.version": { $lte: message.version },
      });
    })
    .with(
      { type: "EServiceAdded" },
      { type: "DraftEServiceUpdated" },
      { type: "EServiceCloned" },
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceDraftDescriptorDeleted" },
      { type: "EServiceDraftDescriptorUpdated" },
      { type: "EServiceDescriptorQuotasUpdated" },
      { type: "EServiceDescriptorActivated" },
      { type: "EServiceDescriptorArchived" },
      { type: "EServiceDescriptorPublished" },
      { type: "EServiceDescriptorSuspended" },
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
      { type: "EServiceDescriptorApprovedByDelegator" },
      { type: "EServiceDescriptorRejectedByDelegator" },
      { type: "EServiceDescriptorAttributesUpdated" },
      { type: "EServiceNameUpdated" },
      async (message) =>
        await eservices.updateOne(
          {
            "data.id": message.stream_id,
            "metadata.version": { $lte: message.version },
          },
          {
            $set: {
              data: eservice
                ? toReadModelEService(fromEServiceV2(eservice))
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
