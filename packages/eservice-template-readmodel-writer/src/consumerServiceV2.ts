import { EServiceTemplateCollection } from "pagopa-interop-commons";
import {
  EServiceTemplateEventEnvelope,
  fromEServiceTemplateV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: EServiceTemplateEventEnvelope,
  eserviceTemplates: EServiceTemplateCollection
): Promise<void> {
  const eserviceTemplate = message.data.eserviceTemplate;

  await match(message)
    .with({ type: "EServiceTemplateDeleted" }, async (message) => {
      await eserviceTemplates.deleteOne({
        "data.id": message.stream_id,
        "metadata.version": { $lte: message.version },
      });
    })
    .with(
      { type: "EServiceTemplateVersionActivated" },
      { type: "EServiceTemplateAdded" },
      { type: "EServiceTemplateAudienceDescriptionUpdated" },
      { type: "EServiceTemplateEServiceDescriptionUpdated" },
      { type: "EServiceTemplateDraftVersionDeleted" },
      { type: "EServiceTemplateDraftVersionUpdated" },
      { type: "EServiceTemplateDraftUpdated" },
      { type: "EServiceTemplateNameUpdated" },
      { type: "EServiceTemplateRiskAnalysisAdded" },
      { type: "EServiceTemplateRiskAnalysisDeleted" },
      { type: "EServiceTemplateRiskAnalysisUpdated" },
      { type: "EServiceTemplateVersionSuspended" },
      { type: "EServiceTemplateVersionAdded" },
      { type: "EServiceTemplateVersionAttributesUpdated" },
      { type: "EServiceTemplateVersionDocumentAdded" },
      { type: "EServiceTemplateVersionDocumentDeleted" },
      { type: "EServiceTemplateVersionDocumentUpdated" },
      { type: "EServiceTemplateVersionInterfaceAdded" },
      { type: "EServiceTemplateVersionInterfaceDeleted" },
      { type: "EServiceTemplateVersionInterfaceUpdated" },
      { type: "EServiceTemplateVersionPublished" },
      { type: "EServiceTemplateVersionQuotasUpdated" },
      async (message) =>
        await eserviceTemplates.updateOne(
          {
            "data.id": message.stream_id,
            "metadata.version": { $lte: message.version },
          },
          {
            $set: {
              data: eserviceTemplate
                ? fromEServiceTemplateV2(eserviceTemplate)
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
