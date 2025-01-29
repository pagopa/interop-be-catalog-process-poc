import {
  AgreementDocumentV2,
  AgreementV2,
  AgreementStampV2,
  AgreementStampsV2,
} from "pagopa-interop-models";
import {
  AgreementDocumentV2 as OutboundAgreementDocumentV2,
  AgreementV2 as OutboundAgreementV2,
  AgreementStampV2 as OutboundAgreementStampV2,
  AgreementStampsV2 as OutboundAgreementStampsV2,
} from "@pagopa/interop-outbound-models";
import { match } from "ts-pattern";
import { AgreementEventEnvelopeV2 } from "pagopa-interop-models";
import { AgreementEvent as OutboundAgreementEvent } from "@pagopa/interop-outbound-models";
import { Exact } from "pagopa-interop-commons";

function toOutboundStampV2(
  stamp: OutboundAgreementStampV2
): Exact<OutboundAgreementStampV2, AgreementStampV2> {
  return {
    ...stamp,
    who: undefined,
  };
}

function toOutboundStampsV2(
  stamp: AgreementStampsV2
): Exact<OutboundAgreementStampsV2, AgreementStampsV2> {
  return {
    activation: stamp.activation && toOutboundStampV2(stamp.activation),
    archiving: stamp.archiving && toOutboundStampV2(stamp.archiving),
    rejection: stamp.rejection && toOutboundStampV2(stamp.rejection),
    submission: stamp.submission && toOutboundStampV2(stamp.submission),
    suspensionByConsumer:
      stamp.suspensionByConsumer &&
      toOutboundStampV2(stamp.suspensionByConsumer),
    suspensionByProducer:
      stamp.suspensionByProducer &&
      toOutboundStampV2(stamp.suspensionByProducer),
    upgrade: stamp.upgrade && toOutboundStampV2(stamp.upgrade),
  };
}

function toOutboundAgreementV2(
  agreement: AgreementV2
): Exact<OutboundAgreementV2, AgreementV2> {
  return {
    ...agreement,
    consumerDocuments: agreement.consumerDocuments.map(
      toOutboundAgreementDocumentV2
    ),
    contract:
      agreement.contract && toOutboundAgreementDocumentV2(agreement.contract),
    stamps: agreement.stamps && toOutboundStampsV2(agreement.stamps),
  };
}

function toOutboundAgreementDocumentV2(
  document: AgreementDocumentV2
): Exact<OutboundAgreementDocumentV2, AgreementDocumentV2> {
  return {
    id: document.id,
    contentType: document.contentType,
    createdAt: document.createdAt,
    name: document.name,
    prettyName: document.prettyName,
    path: undefined,
  };
}

export function toOutboundEventV2(
  message: AgreementEventEnvelopeV2
): OutboundAgreementEvent {
  return match(message)
    .returnType<OutboundAgreementEvent>()
    .with(
      { type: "AgreementDeleted" },
      { type: "AgreementAdded" },
      { type: "DraftAgreementUpdated" },
      { type: "AgreementSubmitted" },
      { type: "AgreementActivated" },
      { type: "AgreementUpgraded" },
      { type: "AgreementUnsuspendedByProducer" },
      { type: "AgreementUnsuspendedByConsumer" },
      { type: "AgreementUnsuspendedByPlatform" },
      { type: "AgreementArchivedByConsumer" },
      { type: "AgreementSuspendedByProducer" },
      { type: "AgreementSuspendedByConsumer" },
      { type: "AgreementSuspendedByPlatform" },
      { type: "AgreementRejected" },
      { type: "AgreementArchivedByUpgrade" },
      { type: "AgreementSetDraftByPlatform" },
      { type: "AgreementSetMissingCertifiedAttributesByPlatform" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          agreement:
            message.data.agreement &&
            toOutboundAgreementV2(message.data.agreement),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with(
      { type: "AgreementConsumerDocumentAdded" },
      { type: "AgreementConsumerDocumentRemoved" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          documentId: msg.data.documentId,
          agreement:
            msg.data.agreement && toOutboundAgreementV2(msg.data.agreement),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with(
      { type: "AgreementArchivedByRevokedDelegation" },
      { type: "AgreementDeletedByRevokedDelegation" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          delegationId: msg.data.delegationId,
          agreement:
            msg.data.agreement && toOutboundAgreementV2(msg.data.agreement),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .exhaustive();
}
