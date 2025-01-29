import {
  EServiceEventEnvelopeV2,
  EServiceV2,
  EServiceDescriptorV2,
  EServiceDocumentV2,
} from "pagopa-interop-models";
import {
  EServiceEvent as OutboundEServiceEvent,
  EServiceV2 as OutboundEServiceV2,
  EServiceDescriptorV2 as OutboundEServiceDescriptorV2,
  EServiceDocumentV2 as OutboundEServiceDocumentV2,
} from "@pagopa/interop-outbound-models";
import { match } from "ts-pattern";
import { Exact } from "pagopa-interop-commons";

function toOuboundEServiceDocumentV2(
  document: EServiceDocumentV2
): Exact<OutboundEServiceDocumentV2, EServiceDocumentV2> {
  return {
    ...document,
    path: undefined,
  };
}

function toOutboundDescriptorV2(
  descriptor: EServiceDescriptorV2
): Exact<OutboundEServiceDescriptorV2, EServiceDescriptorV2> {
  return {
    ...descriptor,
    interface:
      descriptor.interface && toOuboundEServiceDocumentV2(descriptor.interface),
    docs: descriptor.docs.map(toOuboundEServiceDocumentV2),
  };
}

function toOutboundEServiceV2(
  eservice: EServiceV2
): Exact<OutboundEServiceV2, EServiceV2> {
  return {
    ...eservice,
    riskAnalysis: undefined,
    descriptors: eservice.descriptors.map(toOutboundDescriptorV2),
  };
}

export function toOutboundEventV2(
  message: EServiceEventEnvelopeV2
): OutboundEServiceEvent | undefined {
  return match(message)
    .returnType<OutboundEServiceEvent | undefined>()
    .with(
      { type: "EServiceAdded" },
      { type: "DraftEServiceUpdated" },
      { type: "EServiceDescriptionUpdated" },
      { type: "EServiceIsDelegableEnabled" },
      { type: "EServiceIsDelegableDisabled" },
      { type: "EServiceIsClientAccessDelegableEnabled" },
      { type: "EServiceIsClientAccessDelegableDisabled" },
      { type: "EServiceNameUpdated" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          eservice:
            msg.data.eservice && toOutboundEServiceV2(msg.data.eservice),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with({ type: "EServiceDeleted" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        eserviceId: msg.data.eserviceId,
        eservice: msg.data.eservice && toOutboundEServiceV2(msg.data.eservice),
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with({ type: "EServiceCloned" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        sourceEservice:
          msg.data.sourceEservice &&
          toOutboundEServiceV2(msg.data.sourceEservice),
        sourceDescriptorId: msg.data.sourceDescriptorId,
        eservice: msg.data.eservice && toOutboundEServiceV2(msg.data.eservice),
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with(
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceDraftDescriptorUpdated" },
      { type: "EServiceDescriptorQuotasUpdated" },
      { type: "EServiceDescriptorActivated" },
      { type: "EServiceDescriptorArchived" },
      { type: "EServiceDescriptorPublished" },
      { type: "EServiceDescriptorSuspended" },
      { type: "EServiceDraftDescriptorDeleted" },
      { type: "EServiceDescriptorSubmittedByDelegate" },
      { type: "EServiceDescriptorApprovedByDelegator" },
      { type: "EServiceDescriptorRejectedByDelegator" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          descriptorId: msg.data.descriptorId,
          eservice:
            msg.data.eservice && toOutboundEServiceV2(msg.data.eservice),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with(
      { type: "EServiceDescriptorInterfaceAdded" },
      { type: "EServiceDescriptorDocumentAdded" },
      { type: "EServiceDescriptorInterfaceUpdated" },
      { type: "EServiceDescriptorDocumentUpdated" },
      { type: "EServiceDescriptorInterfaceDeleted" },
      { type: "EServiceDescriptorDocumentDeleted" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          descriptorId: msg.data.descriptorId,
          documentId: msg.data.documentId,
          eservice:
            msg.data.eservice && toOutboundEServiceV2(msg.data.eservice),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with({ type: "EServiceDescriptorAttributesUpdated" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        descriptorId: msg.data.descriptorId,
        attributeIds: msg.data.attributeIds,
        eservice: msg.data.eservice && toOutboundEServiceV2(msg.data.eservice),
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with(
      { type: "EServiceRiskAnalysisAdded" },
      { type: "EServiceRiskAnalysisDeleted" },
      { type: "EServiceRiskAnalysisUpdated" },
      () => undefined
    )
    .exhaustive();
}
