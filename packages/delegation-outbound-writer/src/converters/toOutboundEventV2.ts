import {
  DelegationEventEnvelopeV2,
  DelegationV2,
  DelegationContractDocumentV2,
  DelegationStampV2,
  DelegationStampsV2,
} from "pagopa-interop-models";
import {
  DelegationEvent as OutboundDelegationEvent,
  DelegationV2 as OutboundDelegationV2,
  DelegationContractDocumentV2 as OutboundDelegationContractDocumentV2,
  DelegationStampV2 as OutboundDelegationStampV2,
  DelegationStampsV2 as OutboundDelegationStampsV2,
} from "@pagopa/interop-outbound-models";
import { match } from "ts-pattern";
import { Exact } from "pagopa-interop-commons";

function toOuboundDelegationContractDocumentV2(
  document: DelegationContractDocumentV2
): Exact<OutboundDelegationContractDocumentV2, DelegationContractDocumentV2> {
  return {
    ...document,
    path: undefined,
  };
}

function toOutboundStampV2(
  stamp: DelegationStampV2
): Exact<OutboundDelegationStampV2, DelegationStampV2> {
  return {
    ...stamp,
    who: undefined,
  };
}

function toOutboundStampsV2(
  stamp: DelegationStampsV2
): Exact<OutboundDelegationStampsV2, DelegationStampsV2> {
  return {
    activation: stamp.activation && toOutboundStampV2(stamp.activation),
    rejection: stamp.rejection && toOutboundStampV2(stamp.rejection),
    revocation: stamp.revocation && toOutboundStampV2(stamp.revocation),
    submission: stamp.submission && toOutboundStampV2(stamp.submission),
  };
}

function toOutboundDelegationV2(
  delegation: DelegationV2
): Exact<OutboundDelegationV2, DelegationV2> {
  return {
    ...delegation,
    activationContract:
      delegation.activationContract &&
      toOuboundDelegationContractDocumentV2(delegation.activationContract),
    revocationContract:
      delegation.revocationContract &&
      toOuboundDelegationContractDocumentV2(delegation.revocationContract),
    stamps: delegation.stamps && toOutboundStampsV2(delegation.stamps),
  };
}

export function toOutboundEventV2(
  message: DelegationEventEnvelopeV2
): OutboundDelegationEvent | undefined {
  return match(message)
    .returnType<OutboundDelegationEvent | undefined>()
    .with(
      { type: "ProducerDelegationSubmitted" },
      { type: "ProducerDelegationApproved" },
      { type: "ProducerDelegationRejected" },
      { type: "ProducerDelegationRevoked" },
      { type: "ConsumerDelegationSubmitted" },
      { type: "ConsumerDelegationApproved" },
      { type: "ConsumerDelegationRejected" },
      { type: "ConsumerDelegationRevoked" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          delegation:
            msg.data.delegation && toOutboundDelegationV2(msg.data.delegation),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .exhaustive();
}
