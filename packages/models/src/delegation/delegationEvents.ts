import { z } from "zod";
import { match } from "ts-pattern";

import {
  ProducerDelegationSubmittedV2,
  ProducerDelegationApprovedV2,
  ProducerDelegationRejectedV2,
  ProducerDelegationRevokedV2,
  ConsumerDelegationSubmittedV2,
  ConsumerDelegationApprovedV2,
  ConsumerDelegationRejectedV2,
  ConsumerDelegationRevokedV2,
} from "../gen/v2/delegation/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import { EventEnvelope } from "../events/events.js";

export const DelegationEventV2 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(2),
    type: z.literal("ProducerDelegationSubmitted"),
    data: protobufDecoder(ProducerDelegationSubmittedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ProducerDelegationApproved"),
    data: protobufDecoder(ProducerDelegationApprovedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ProducerDelegationRejected"),
    data: protobufDecoder(ProducerDelegationRejectedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ProducerDelegationRevoked"),
    data: protobufDecoder(ProducerDelegationRevokedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ConsumerDelegationSubmitted"),
    data: protobufDecoder(ConsumerDelegationSubmittedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ConsumerDelegationApproved"),
    data: protobufDecoder(ConsumerDelegationApprovedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ConsumerDelegationRejected"),
    data: protobufDecoder(ConsumerDelegationRejectedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ConsumerDelegationRevoked"),
    data: protobufDecoder(ConsumerDelegationRevokedV2),
  }),
]);

export type DelegationEventV2 = z.infer<typeof DelegationEventV2>;

export function delegationEventToBinaryDataV2(
  event: DelegationEventV2
): Uint8Array {
  return match(event)
    .with({ type: "ProducerDelegationSubmitted" }, ({ data }) =>
      ProducerDelegationSubmittedV2.toBinary(data)
    )
    .with({ type: "ProducerDelegationApproved" }, ({ data }) =>
      ProducerDelegationApprovedV2.toBinary(data)
    )
    .with({ type: "ProducerDelegationRejected" }, ({ data }) =>
      ProducerDelegationRejectedV2.toBinary(data)
    )
    .with({ type: "ProducerDelegationRevoked" }, ({ data }) =>
      ProducerDelegationRevokedV2.toBinary(data)
    )
    .with({ type: "ConsumerDelegationSubmitted" }, ({ data }) =>
      ConsumerDelegationSubmittedV2.toBinary(data)
    )
    .with({ type: "ConsumerDelegationApproved" }, ({ data }) =>
      ConsumerDelegationApprovedV2.toBinary(data)
    )
    .with({ type: "ConsumerDelegationRejected" }, ({ data }) =>
      ConsumerDelegationRejectedV2.toBinary(data)
    )
    .with({ type: "ConsumerDelegationRevoked" }, ({ data }) =>
      ConsumerDelegationRevokedV2.toBinary(data)
    )
    .exhaustive();
}

const eventV2 = z
  .object({
    event_version: z.literal(2),
  })
  .passthrough();

export const DelegationEvent = z
  .discriminatedUnion("event_version", [eventV2])
  .transform((obj, ctx) => {
    const res = match(obj)
      .with({ event_version: 2 }, () => DelegationEventV2.safeParse(obj))
      .exhaustive();

    if (!res.success) {
      res.error.issues.forEach(ctx.addIssue);
      return z.NEVER;
    }
    return res.data;
  });

export type DelegationEvent = z.infer<typeof DelegationEvent>;

export const DelegationEventEnvelopeV2 = EventEnvelope(DelegationEventV2);
export type DelegationEventEnvelopeV2 = z.infer<
  typeof DelegationEventEnvelopeV2
>;

export const DelegationEventEnvelope = EventEnvelope(DelegationEvent);
export type DelegationEventEnvelope = z.infer<typeof DelegationEventEnvelope>;
