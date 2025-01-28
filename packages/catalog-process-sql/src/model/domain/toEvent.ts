import { CreateEvent } from "pagopa-interop-commons";
import {
  EService,
  EServiceEvent,
  DescriptorId,
  EServiceDocumentId,
  RiskAnalysisId,
  toEServiceV2,
  CorrelationId,
} from "pagopa-interop-models";

export const toCreateEventEServiceAdded = (
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId: eservice.id,
  version: 0,
  event: {
    type: "EServiceAdded",
    event_version: 2,
    data: { eservice: toEServiceV2(eservice) },
  },
  correlationId,
});

export const toCreateEventClonedEServiceAdded = (
  sourceDescriptorId: DescriptorId,
  sourceEservice: EService,
  clonedEservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId: clonedEservice.id,
  version: 0,
  event: {
    type: "EServiceCloned",
    event_version: 2,
    data: {
      sourceDescriptorId,
      sourceEservice: toEServiceV2(sourceEservice),
      eservice: toEServiceV2(clonedEservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceInterfaceAdded = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  },
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorInterfaceAdded",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDocumentAdded = (
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  },
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId: eservice.id,
  version,
  event: {
    type: "EServiceDescriptorDocumentAdded",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorAdded = (
  eservice: EService,
  version: number,
  descriptorId: DescriptorId,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId: eservice.id,
  version,
  event: {
    type: "EServiceDescriptorAdded",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceUpdated = (
  streamId: string,
  version: number,
  updatedEService: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "DraftEServiceUpdated",
    event_version: 2,
    data: {
      eservice: toEServiceV2(updatedEService),
    },
  },
  correlationId,
});

export const toCreateEventEServiceInterfaceUpdated = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  },
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorInterfaceUpdated",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDocumentUpdated = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  },
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorDocumentUpdated",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDraftDescriptorUpdated = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDraftDescriptorUpdated",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorQuotasUpdated = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorQuotasUpdated",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorActivated = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorActivated",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorArchived = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorArchived",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorPublished = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorPublished",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorSuspended = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorSuspended",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDeleted = (
  version: number,
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId: eservice.id,
  version,
  event: {
    type: "EServiceDeleted",
    event_version: 2,
    data: {
      eserviceId: eservice.id,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceInterfaceDeleted = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  },
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorInterfaceDeleted",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});
export const toCreateEventEServiceDocumentDeleted = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  },
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorDocumentDeleted",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDraftDescriptorDeleted = (
  version: number,
  eservice: EService,
  descriptorId: DescriptorId,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId: eservice.id,
  version,
  event: {
    type: "EServiceDraftDescriptorDeleted",
    event_version: 2,
    data: {
      eservice: toEServiceV2(eservice),
      descriptorId,
    },
  },
  correlationId,
});

export const toCreateEventEServiceRiskAnalysisAdded = (
  streamId: string,
  version: number,
  riskAnalysisId: RiskAnalysisId,
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceRiskAnalysisAdded",
    event_version: 2,
    data: {
      riskAnalysisId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceRiskAnalysisUpdated = (
  streamId: string,
  version: number,
  riskAnalysisId: RiskAnalysisId,
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceRiskAnalysisUpdated",
    event_version: 2,
    data: {
      riskAnalysisId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceRiskAnalysisDeleted = (
  streamId: string,
  version: number,
  riskAnalysisId: RiskAnalysisId,
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceRiskAnalysisDeleted",
    event_version: 2,
    data: {
      riskAnalysisId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptionUpdated = (
  version: number,
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId: eservice.id,
  version,
  event: {
    type: "EServiceDescriptionUpdated",
    event_version: 2,
    data: {
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorDelegateSubmitted = (
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId: eservice.id,
  version,
  event: {
    type: "EServiceDescriptorSubmittedByDelegate",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorDelegatorApproved = (
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId: eservice.id,
  version,
  event: {
    type: "EServiceDescriptorApprovedByDelegator",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

export const toCreateEventEServiceDescriptorDelegatorRejected = (
  version: number,
  descriptorId: DescriptorId,
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId: eservice.id,
  version,
  event: {
    type: "EServiceDescriptorRejectedByDelegator",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});
