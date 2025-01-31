/* eslint-disable max-params */
import { CreateEvent } from "pagopa-interop-commons";
import {
  EServiceTemplateEvent,
  toEServiceTemplateV2,
  CorrelationId,
  EServiceTemplate,
  RiskAnalysisId,
  EServiceTemplateVersionId,
  EServiceDocumentId,
  AttributeId,
} from "pagopa-interop-models";

export const toCreateEventEServiceTemplateAdded = (
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId: eserviceTemplate.id,
  version: undefined,
  event: {
    type: "EServiceTemplateAdded",
    event_version: 2,
    data: { eserviceTemplate: toEServiceTemplateV2(eserviceTemplate) },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateRiskAnalysisAdded = (
  streamId: string,
  version: number,
  riskAnalysisId: RiskAnalysisId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateRiskAnalysisAdded",
    event_version: 2,
    data: {
      riskAnalysisId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateRiskAnalysisDeleted = (
  streamId: string,
  version: number,
  riskAnalysisId: RiskAnalysisId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateRiskAnalysisDeleted",
    event_version: 2,
    data: {
      riskAnalysisId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateRiskAnalysisUpdated = (
  streamId: string,
  version: number,
  riskAnalysisId: RiskAnalysisId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateRiskAnalysisUpdated",
    event_version: 2,
    data: {
      riskAnalysisId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateDraftUpdated = (
  streamId: string,
  version: number,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateDraftUpdated",
    event_version: 2,
    data: {
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateDraftVersionUpdated = (
  streamId: string,
  version: number,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateDraftVersionUpdated",
    event_version: 2,
    data: {
      eserviceTemplateVersionId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateDraftVersionDeleted = (
  streamId: string,
  version: number,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateDraftVersionDeleted",
    event_version: 2,
    data: {
      eserviceTemplateVersionId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateDeleted = (
  streamId: string,
  version: number,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateDeleted",
    event_version: 2,
    data: {
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateVersionInterfaceAdded = (
  streamId: string,
  version: number,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  documentId: EServiceDocumentId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateVersionInterfaceAdded",
    event_version: 2,
    data: {
      eserviceTemplateVersionId,
      documentId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateVersionDocumentAdded = (
  streamId: string,
  version: number,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  documentId: EServiceDocumentId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateVersionDocumentAdded",
    event_version: 2,
    data: {
      eserviceTemplateVersionId,
      documentId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateVersionInterfaceDeleted = (
  streamId: string,
  version: number,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  documentId: EServiceDocumentId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateVersionInterfaceDeleted",
    event_version: 2,
    data: {
      eserviceTemplateVersionId,
      documentId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateVersionDocumentDeleted = (
  streamId: string,
  version: number,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  documentId: EServiceDocumentId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateVersionDocumentDeleted",
    event_version: 2,
    data: {
      eserviceTemplateVersionId,
      documentId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateVersionInterfaceUpdated = (
  streamId: string,
  version: number,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  documentId: EServiceDocumentId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateVersionInterfaceUpdated",
    event_version: 2,
    data: {
      eserviceTemplateVersionId,
      documentId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateVersionDocumentUpdated = (
  streamId: string,
  version: number,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  documentId: EServiceDocumentId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateVersionDocumentUpdated",
    event_version: 2,
    data: {
      eserviceTemplateVersionId,
      documentId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateVersionPublished = (
  streamId: string,
  version: number,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateVersionPublished",
    event_version: 2,
    data: {
      eserviceTemplateVersionId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateNameUpdated = (
  streamId: string,
  version: number,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateNameUpdated",
    event_version: 2,
    data: {
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateAudienceDescriptionUpdated = (
  streamId: string,
  version: number,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateAudienceDescriptionUpdated",
    event_version: 2,
    data: {
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateEServiceDescriptionUpdated = (
  streamId: string,
  version: number,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateEServiceDescriptionUpdated",
    event_version: 2,
    data: {
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateVersionQuotasUpdated = (
  streamId: string,
  version: number,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateVersionQuotasUpdated",
    event_version: 2,
    data: {
      eserviceTemplateVersionId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateVersionAdded = (
  streamId: string,
  version: number,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateVersionAdded",
    event_version: 2,
    data: {
      eserviceTemplateVersionId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateVersionAttributesUpdated = (
  streamId: string,
  version: number,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  attributeIds: AttributeId[],
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateVersionAttributesUpdated",
    event_version: 2,
    data: {
      eserviceTemplateVersionId,
      attributeIds,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateVersionSuspended = (
  streamId: string,
  version: number,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateVersionSuspended",
    event_version: 2,
    data: {
      eserviceTemplateVersionId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});

export const toCreateEventEServiceTemplateVersionActivated = (
  streamId: string,
  version: number,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplate: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceTemplateVersionActivated",
    event_version: 2,
    data: {
      eserviceTemplateVersionId,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    },
  },
  correlationId,
});
