import { match } from "ts-pattern";
import { z } from "zod";
import { EventEnvelope } from "../events/events.js";
import {
  PurposeCreatedV1,
  PurposeDeletedV1,
  PurposeUpdatedV1,
  PurposeVersionActivatedV1,
  PurposeVersionArchivedV1,
  PurposeVersionCreatedV1,
  PurposeVersionDeletedV1,
  PurposeVersionRejectedV1,
  PurposeVersionSuspendedV1,
  PurposeVersionUpdatedV1,
  PurposeVersionWaitedForApprovalV1,
} from "../gen/v1/purpose/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import {
  PurposeAddedV2,
  DraftPurposeUpdatedV2,
  PurposeWaitingForApprovalV2,
  PurposeActivatedV2,
  DraftPurposeDeletedV2,
  WaitingForApprovalPurposeDeletedV2,
  NewPurposeVersionActivatedV2,
  PurposeVersionActivatedV2,
  PurposeVersionUnsuspendedByProducerV2,
  PurposeVersionUnsuspendedByConsumerV2,
  PurposeVersionSuspendedByProducerV2,
  PurposeVersionSuspendedByConsumerV2,
  NewPurposeVersionWaitingForApprovalV2,
  PurposeVersionOverQuotaUnsuspendedV2,
  PurposeArchivedV2,
  WaitingForApprovalPurposeVersionDeletedV2,
  PurposeVersionRejectedV2,
  PurposeClonedV2,
  PurposeDeletedByRevokedDelegationV2,
  PurposeVersionArchivedByRevokedDelegationV2,
} from "../gen/v2/purpose/events.js";

export function purposeEventToBinaryData(event: PurposeEvent): Uint8Array {
  return match(event)
    .with({ event_version: 1 }, purposeEventToBinaryDataV1)
    .with({ event_version: 2 }, purposeEventToBinaryDataV2)
    .exhaustive();
}

export function purposeEventToBinaryDataV1(event: PurposeEventV1): Uint8Array {
  return match(event)
    .with({ type: "PurposeCreated" }, ({ data }) =>
      PurposeCreatedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionCreated" }, ({ data }) =>
      PurposeVersionCreatedV1.toBinary(data)
    )
    .with({ type: "PurposeUpdated" }, ({ data }) =>
      PurposeUpdatedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionUpdated" }, ({ data }) =>
      PurposeVersionUpdatedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionActivated" }, ({ data }) =>
      PurposeVersionActivatedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionRejected" }, ({ data }) =>
      PurposeVersionRejectedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionSuspended" }, ({ data }) =>
      PurposeVersionSuspendedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionArchived" }, ({ data }) =>
      PurposeVersionArchivedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionWaitedForApproval" }, ({ data }) =>
      PurposeVersionWaitedForApprovalV1.toBinary(data)
    )
    .with({ type: "PurposeDeleted" }, ({ data }) =>
      PurposeDeletedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionDeleted" }, ({ data }) =>
      PurposeVersionDeletedV1.toBinary(data)
    )
    .exhaustive();
}

export function purposeEventToBinaryDataV2(event: PurposeEventV2): Uint8Array {
  return match(event)
    .with({ type: "PurposeAdded" }, ({ data }) => PurposeAddedV2.toBinary(data))
    .with({ type: "DraftPurposeUpdated" }, ({ data }) =>
      DraftPurposeUpdatedV2.toBinary(data)
    )
    .with({ type: "PurposeWaitingForApproval" }, ({ data }) =>
      PurposeWaitingForApprovalV2.toBinary(data)
    )
    .with({ type: "PurposeActivated" }, ({ data }) =>
      PurposeActivatedV2.toBinary(data)
    )
    .with({ type: "DraftPurposeDeleted" }, ({ data }) =>
      DraftPurposeDeletedV2.toBinary(data)
    )
    .with({ type: "WaitingForApprovalPurposeDeleted" }, ({ data }) =>
      WaitingForApprovalPurposeDeletedV2.toBinary(data)
    )
    .with({ type: "NewPurposeVersionActivated" }, ({ data }) =>
      NewPurposeVersionActivatedV2.toBinary(data)
    )
    .with({ type: "PurposeVersionActivated" }, ({ data }) =>
      PurposeVersionActivatedV2.toBinary(data)
    )
    .with({ type: "PurposeVersionUnsuspendedByProducer" }, ({ data }) =>
      PurposeVersionUnsuspendedByProducerV2.toBinary(data)
    )
    .with({ type: "PurposeVersionUnsuspendedByConsumer" }, ({ data }) =>
      PurposeVersionUnsuspendedByConsumerV2.toBinary(data)
    )
    .with({ type: "PurposeVersionSuspendedByProducer" }, ({ data }) =>
      PurposeVersionSuspendedByProducerV2.toBinary(data)
    )
    .with({ type: "PurposeVersionSuspendedByConsumer" }, ({ data }) =>
      PurposeVersionSuspendedByConsumerV2.toBinary(data)
    )
    .with({ type: "NewPurposeVersionWaitingForApproval" }, ({ data }) =>
      NewPurposeVersionWaitingForApprovalV2.toBinary(data)
    )
    .with({ type: "PurposeVersionOverQuotaUnsuspended" }, ({ data }) =>
      PurposeVersionOverQuotaUnsuspendedV2.toBinary(data)
    )
    .with({ type: "PurposeArchived" }, ({ data }) =>
      PurposeArchivedV2.toBinary(data)
    )
    .with({ type: "WaitingForApprovalPurposeVersionDeleted" }, ({ data }) =>
      WaitingForApprovalPurposeVersionDeletedV2.toBinary(data)
    )
    .with({ type: "PurposeVersionRejected" }, ({ data }) =>
      PurposeVersionRejectedV2.toBinary(data)
    )
    .with({ type: "PurposeCloned" }, ({ data }) =>
      PurposeClonedV2.toBinary(data)
    )
    .with({ type: "PurposeDeletedByRevokedDelegation" }, ({ data }) =>
      PurposeDeletedByRevokedDelegationV2.toBinary(data)
    )
    .with({ type: "PurposeVersionArchivedByRevokedDelegation" }, ({ data }) =>
      PurposeVersionArchivedByRevokedDelegationV2.toBinary(data)
    )
    .exhaustive();
}

export const PurposeEventV1 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeCreated"),
    data: protobufDecoder(PurposeCreatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeUpdated"),
    data: protobufDecoder(PurposeUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionWaitedForApproval"),
    data: protobufDecoder(PurposeVersionWaitedForApprovalV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionActivated"),
    data: protobufDecoder(PurposeVersionActivatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionCreated"),
    data: protobufDecoder(PurposeVersionCreatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionSuspended"),
    data: protobufDecoder(PurposeVersionSuspendedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionArchived"),
    data: protobufDecoder(PurposeVersionArchivedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionUpdated"),
    data: protobufDecoder(PurposeVersionUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionDeleted"),
    data: protobufDecoder(PurposeVersionDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeDeleted"),
    data: protobufDecoder(PurposeDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionRejected"),
    data: protobufDecoder(PurposeVersionRejectedV1),
  }),
]);
export type PurposeEventV1 = z.infer<typeof PurposeEventV1>;

export const PurposeEventV2 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeAdded"),
    data: protobufDecoder(PurposeAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("DraftPurposeUpdated"),
    data: protobufDecoder(DraftPurposeUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeWaitingForApproval"),
    data: protobufDecoder(PurposeWaitingForApprovalV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeActivated"),
    data: protobufDecoder(PurposeActivatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("DraftPurposeDeleted"),
    data: protobufDecoder(DraftPurposeDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("WaitingForApprovalPurposeDeleted"),
    data: protobufDecoder(WaitingForApprovalPurposeDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("NewPurposeVersionActivated"),
    data: protobufDecoder(NewPurposeVersionActivatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeVersionActivated"),
    data: protobufDecoder(PurposeVersionActivatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeVersionUnsuspendedByProducer"),
    data: protobufDecoder(PurposeVersionUnsuspendedByProducerV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeVersionUnsuspendedByConsumer"),
    data: protobufDecoder(PurposeVersionUnsuspendedByConsumerV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeVersionSuspendedByProducer"),
    data: protobufDecoder(PurposeVersionSuspendedByProducerV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeVersionSuspendedByConsumer"),
    data: protobufDecoder(PurposeVersionSuspendedByConsumerV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("NewPurposeVersionWaitingForApproval"),
    data: protobufDecoder(NewPurposeVersionWaitingForApprovalV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeVersionOverQuotaUnsuspended"),
    data: protobufDecoder(PurposeVersionOverQuotaUnsuspendedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeArchived"),
    data: protobufDecoder(PurposeArchivedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("WaitingForApprovalPurposeVersionDeleted"),
    data: protobufDecoder(WaitingForApprovalPurposeVersionDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeVersionRejected"),
    data: protobufDecoder(PurposeVersionRejectedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeCloned"),
    data: protobufDecoder(PurposeClonedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeDeletedByRevokedDelegation"),
    data: protobufDecoder(PurposeDeletedByRevokedDelegationV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeVersionArchivedByRevokedDelegation"),
    data: protobufDecoder(PurposeVersionArchivedByRevokedDelegationV2),
  }),
]);
export type PurposeEventV2 = z.infer<typeof PurposeEventV2>;

const eventV1 = z
  .object({
    event_version: z.literal(1),
  })
  .passthrough();

const eventV2 = z
  .object({
    event_version: z.literal(2),
  })
  .passthrough();

export const PurposeEvent = z
  .discriminatedUnion("event_version", [eventV1, eventV2])
  .transform((obj, ctx) => {
    const res = match(obj)
      .with({ event_version: 1 }, () => PurposeEventV1.safeParse(obj))
      .with({ event_version: 2 }, () => PurposeEventV2.safeParse(obj))
      .exhaustive();

    if (!res.success) {
      res.error.issues.forEach(ctx.addIssue);
      return z.NEVER;
    }
    return res.data;
  });
export type PurposeEvent = z.infer<typeof PurposeEvent>;

export const PurposeEventEnvelopeV1 = EventEnvelope(PurposeEventV1);
export type PurposeEventEnvelopeV1 = z.infer<typeof PurposeEventEnvelopeV1>;

export const PurposeEventEnvelopeV2 = EventEnvelope(PurposeEventV2);
export type PurposeEventEnvelopeV2 = z.infer<typeof PurposeEventEnvelopeV2>;

export const PurposeEventEnvelope = EventEnvelope(PurposeEvent);
export type PurposeEventEnvelope = z.infer<typeof PurposeEventEnvelope>;
