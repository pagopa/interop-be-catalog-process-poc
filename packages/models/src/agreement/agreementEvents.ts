import { match } from "ts-pattern";
import { z } from "zod";
import {
  AgreementAddedV1,
  AgreementDeletedV1,
  AgreementUpdatedV1,
  AgreementContractAddedV1,
  AgreementConsumerDocumentAddedV1,
  AgreementConsumerDocumentRemovedV1,
  AgreementActivatedV1,
  AgreementSuspendedV1,
  AgreementDeactivatedV1,
  VerifiedAttributeUpdatedV1,
} from "../gen/v1/agreement/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import { EventEnvelope } from "../index.js";
import {
  AgreementActivatedV2,
  AgreementAddedV2,
  AgreementArchivedByUpgradeV2,
  AgreementArchivedByConsumerV2,
  AgreementConsumerDocumentAddedV2,
  AgreementConsumerDocumentRemovedV2,
  AgreementDeletedV2,
  AgreementRejectedV2,
  AgreementSubmittedV2,
  AgreementSuspendedByConsumerV2,
  AgreementSuspendedByPlatformV2,
  AgreementSuspendedByProducerV2,
  AgreementUnsuspendedByConsumerV2,
  AgreementUnsuspendedByPlatformV2,
  AgreementUnsuspendedByProducerV2,
  AgreementUpgradedV2,
  DraftAgreementUpdatedV2,
  AgreementSetDraftByPlatformV2,
  AgreementSetMissingCertifiedAttributesByPlatformV2,
  AgreementArchivedByRevokedDelegationV2,
  AgreementDeletedByRevokedDelegationV2,
} from "../gen/v2/agreement/events.js";

export function agreementEventToBinaryData(event: AgreementEvent): Uint8Array {
  return match(event)
    .with({ event_version: 1 }, agreementEventToBinaryDataV1)
    .with({ event_version: 2 }, agreementEventToBinaryDataV2)
    .exhaustive();
}

export function agreementEventToBinaryDataV1(
  event: AgreementEventV1
): Uint8Array {
  return match(event)
    .with({ type: "AgreementDeleted" }, ({ data }) =>
      AgreementDeletedV1.toBinary(data)
    )
    .with({ type: "AgreementAdded" }, ({ data }) =>
      AgreementAddedV1.toBinary(data)
    )
    .with({ type: "AgreementActivated" }, ({ data }) =>
      AgreementActivatedV1.toBinary(data)
    )
    .with({ type: "AgreementSuspended" }, ({ data }) =>
      AgreementSuspendedV1.toBinary(data)
    )
    .with({ type: "AgreementDeactivated" }, ({ data }) =>
      AgreementDeactivatedV1.toBinary(data)
    )
    .with({ type: "VerifiedAttributeUpdated" }, ({ data }) =>
      VerifiedAttributeUpdatedV1.toBinary(data)
    )
    .with({ type: "AgreementUpdated" }, ({ data }) =>
      AgreementUpdatedV1.toBinary(data)
    )
    .with({ type: "AgreementContractAdded" }, ({ data }) =>
      AgreementContractAddedV1.toBinary(data)
    )
    .with({ type: "AgreementConsumerDocumentAdded" }, ({ data }) =>
      AgreementConsumerDocumentAddedV1.toBinary(data)
    )
    .with({ type: "AgreementConsumerDocumentRemoved" }, ({ data }) =>
      AgreementConsumerDocumentRemovedV1.toBinary(data)
    )
    .exhaustive();
}

export function agreementEventToBinaryDataV2(
  event: AgreementEventV2
): Uint8Array {
  return match(event)
    .with({ type: "AgreementAdded" }, ({ data }) =>
      AgreementAddedV2.toBinary(data)
    )
    .with({ type: "AgreementDeleted" }, ({ data }) =>
      AgreementDeletedV2.toBinary(data)
    )
    .with({ type: "DraftAgreementUpdated" }, ({ data }) =>
      DraftAgreementUpdatedV2.toBinary(data)
    )
    .with({ type: "AgreementSubmitted" }, ({ data }) =>
      AgreementSubmittedV2.toBinary(data)
    )
    .with({ type: "AgreementActivated" }, ({ data }) =>
      AgreementActivatedV2.toBinary(data)
    )
    .with({ type: "AgreementUnsuspendedByProducer" }, ({ data }) =>
      AgreementUnsuspendedByProducerV2.toBinary(data)
    )
    .with({ type: "AgreementUnsuspendedByConsumer" }, ({ data }) =>
      AgreementUnsuspendedByConsumerV2.toBinary(data)
    )
    .with({ type: "AgreementUnsuspendedByPlatform" }, ({ data }) =>
      AgreementUnsuspendedByPlatformV2.toBinary(data)
    )
    .with({ type: "AgreementArchivedByConsumer" }, ({ data }) =>
      AgreementArchivedByConsumerV2.toBinary(data)
    )
    .with({ type: "AgreementArchivedByUpgrade" }, ({ data }) =>
      AgreementArchivedByUpgradeV2.toBinary(data)
    )
    .with({ type: "AgreementUpgraded" }, ({ data }) =>
      AgreementUpgradedV2.toBinary(data)
    )
    .with({ type: "AgreementSuspendedByProducer" }, ({ data }) =>
      AgreementSuspendedByProducerV2.toBinary(data)
    )
    .with({ type: "AgreementSuspendedByConsumer" }, ({ data }) =>
      AgreementSuspendedByConsumerV2.toBinary(data)
    )
    .with({ type: "AgreementSuspendedByPlatform" }, ({ data }) =>
      AgreementSuspendedByPlatformV2.toBinary(data)
    )
    .with({ type: "AgreementRejected" }, ({ data }) =>
      AgreementRejectedV2.toBinary(data)
    )
    .with({ type: "AgreementConsumerDocumentAdded" }, ({ data }) =>
      AgreementConsumerDocumentAddedV2.toBinary(data)
    )
    .with({ type: "AgreementConsumerDocumentRemoved" }, ({ data }) =>
      AgreementConsumerDocumentRemovedV2.toBinary(data)
    )
    .with({ type: "AgreementSetDraftByPlatform" }, ({ data }) =>
      AgreementSetDraftByPlatformV2.toBinary(data)
    )
    .with(
      { type: "AgreementSetMissingCertifiedAttributesByPlatform" },
      ({ data }) =>
        AgreementSetMissingCertifiedAttributesByPlatformV2.toBinary(data)
    )
    .with({ type: "AgreementDeletedByRevokedDelegation" }, ({ data }) =>
      AgreementDeletedByRevokedDelegationV2.toBinary(data)
    )
    .with({ type: "AgreementArchivedByRevokedDelegation" }, ({ data }) =>
      AgreementArchivedByRevokedDelegationV2.toBinary(data)
    )
    .exhaustive();
}

export const AgreementEventV1 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(1),
    type: z.literal("AgreementAdded"),
    data: protobufDecoder(AgreementAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("AgreementActivated"),
    data: protobufDecoder(AgreementActivatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("AgreementSuspended"),
    data: protobufDecoder(AgreementSuspendedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("AgreementDeactivated"),
    data: protobufDecoder(AgreementDeactivatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("AgreementDeleted"),
    data: protobufDecoder(AgreementDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("VerifiedAttributeUpdated"),
    data: protobufDecoder(VerifiedAttributeUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("AgreementUpdated"),
    data: protobufDecoder(AgreementUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("AgreementConsumerDocumentAdded"),
    data: protobufDecoder(AgreementConsumerDocumentAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("AgreementConsumerDocumentRemoved"),
    data: protobufDecoder(AgreementConsumerDocumentRemovedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("AgreementContractAdded"),
    data: protobufDecoder(AgreementContractAddedV1),
  }),
]);
export type AgreementEventV1 = z.infer<typeof AgreementEventV1>;

export const AgreementEventV2 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementAdded"),
    data: protobufDecoder(AgreementAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementDeleted"),
    data: protobufDecoder(AgreementDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("DraftAgreementUpdated"),
    data: protobufDecoder(DraftAgreementUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementSubmitted"),
    data: protobufDecoder(AgreementSubmittedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementActivated"),
    data: protobufDecoder(AgreementActivatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementUnsuspendedByProducer"),
    data: protobufDecoder(AgreementUnsuspendedByProducerV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementUnsuspendedByConsumer"),
    data: protobufDecoder(AgreementUnsuspendedByConsumerV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementUnsuspendedByPlatform"),
    data: protobufDecoder(AgreementUnsuspendedByPlatformV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementArchivedByConsumer"),
    data: protobufDecoder(AgreementArchivedByConsumerV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementArchivedByUpgrade"),
    data: protobufDecoder(AgreementArchivedByUpgradeV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementUpgraded"),
    data: protobufDecoder(AgreementUpgradedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementSuspendedByProducer"),
    data: protobufDecoder(AgreementSuspendedByProducerV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementSuspendedByConsumer"),
    data: protobufDecoder(AgreementSuspendedByConsumerV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementSuspendedByPlatform"),
    data: protobufDecoder(AgreementSuspendedByPlatformV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementRejected"),
    data: protobufDecoder(AgreementRejectedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementConsumerDocumentAdded"),
    data: protobufDecoder(AgreementConsumerDocumentAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementConsumerDocumentRemoved"),
    data: protobufDecoder(AgreementConsumerDocumentRemovedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementSetDraftByPlatform"),
    data: protobufDecoder(AgreementSetDraftByPlatformV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementSetMissingCertifiedAttributesByPlatform"),
    data: protobufDecoder(AgreementSetMissingCertifiedAttributesByPlatformV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementDeletedByRevokedDelegation"),
    data: protobufDecoder(AgreementDeletedByRevokedDelegationV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("AgreementArchivedByRevokedDelegation"),
    data: protobufDecoder(AgreementArchivedByRevokedDelegationV2),
  }),
]);
export type AgreementEventV2 = z.infer<typeof AgreementEventV2>;

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

export const AgreementEvent = z
  .discriminatedUnion("event_version", [eventV1, eventV2])
  .transform((obj, ctx) => {
    const res = match(obj)
      .with({ event_version: 1 }, () => AgreementEventV1.safeParse(obj))
      .with({ event_version: 2 }, () => AgreementEventV2.safeParse(obj))
      .exhaustive();

    if (!res.success) {
      res.error.issues.forEach(ctx.addIssue);
      return z.NEVER;
    }
    return res.data;
  });

export type AgreementEvent = z.infer<typeof AgreementEvent>;

export const AgreementEventEnvelopeV1 = EventEnvelope(AgreementEventV1);
export type AgreementEventEnvelopeV1 = z.infer<typeof AgreementEventEnvelopeV1>;

export const AgreementEventEnvelopeV2 = EventEnvelope(AgreementEventV2);
export type AgreementEventEnvelopeV2 = z.infer<typeof AgreementEventEnvelopeV2>;

export const AgreementEventEnvelope = EventEnvelope(AgreementEvent);
export type AgreementEventEnvelope = z.infer<typeof AgreementEventEnvelope>;
