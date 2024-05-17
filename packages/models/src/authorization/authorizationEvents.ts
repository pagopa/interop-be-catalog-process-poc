import { match } from "ts-pattern";
import { z } from "zod";
import { EventEnvelope } from "../events/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import {
  AgreementAndEServiceStatesUpdatedV1,
  AgreementStateUpdatedV1,
  ClientAddedV1,
  ClientDeletedV1,
  ClientPurposeAddedV1,
  ClientPurposeRemovedV1,
  EServiceStateUpdatedV1,
  KeyDeletedV1,
  KeysAddedV1,
  PurposeStateUpdatedV1,
  RelationshipAddedV1,
  RelationshipRemovedV1,
} from "../gen/v1/authorization/events.js";

export function authorizationEventToBinaryData(
  event: AuthorizationEvent
): Uint8Array {
  return (
    match(event)
      .with({ event_version: 1 }, authorizationEventToBinaryDataV1)
      // .with({ event_version: 2 }, authorizationEventToBinaryDataV2)
      .exhaustive()
  );
}

export function authorizationEventToBinaryDataV1(
  event: AuthorizationEventV1
): Uint8Array {
  return match(event)
    .with({ type: "KeysAdded" }, ({ data }) => KeysAddedV1.toBinary(data))
    .with({ type: "KeyDeleted" }, ({ data }) => KeyDeletedV1.toBinary(data))
    .with({ type: "ClientAdded" }, ({ data }) => ClientAddedV1.toBinary(data))
    .with({ type: "ClientDeleted" }, ({ data }) =>
      ClientDeletedV1.toBinary(data)
    )
    .with({ type: "RelationshipAdded" }, ({ data }) =>
      RelationshipAddedV1.toBinary(data)
    )
    .with({ type: "RelationshipRemoved" }, ({ data }) =>
      RelationshipRemovedV1.toBinary(data)
    )
    .with({ type: "ClientPurposeAdded" }, ({ data }) =>
      ClientPurposeAddedV1.toBinary(data)
    )
    .with({ type: "ClientPurposeRemoved" }, ({ data }) =>
      ClientPurposeRemovedV1.toBinary(data)
    )
    .with({ type: "EServiceStateUpdated" }, ({ data }) =>
      EServiceStateUpdatedV1.toBinary(data)
    )
    .with({ type: "AgreementStateUpdated" }, ({ data }) =>
      AgreementStateUpdatedV1.toBinary(data)
    )
    .with({ type: "PurposeStateUpdated" }, ({ data }) =>
      PurposeStateUpdatedV1.toBinary(data)
    )
    .with({ type: "AgreementAndEServiceStatesUpdated" }, ({ data }) =>
      AgreementAndEServiceStatesUpdatedV1.toBinary(data)
    )
    .exhaustive();
}

// export function authorizationEventToBinaryDataV2(
//   event: AuthorizationEventV2
// ): Uint8Array {
//   return match(event).exhaustive();
// }

export const AuthorizationEventV1 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(1),
    type: z.literal("KeysAdded"),
    data: protobufDecoder(KeysAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("KeyDeleted"),
    data: protobufDecoder(KeyDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("ClientAdded"),
    data: protobufDecoder(ClientAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("ClientDeleted"),
    data: protobufDecoder(ClientDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("RelationshipAdded"),
    data: protobufDecoder(RelationshipAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("RelationshipRemoved"),
    data: protobufDecoder(RelationshipRemovedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("ClientPurposeAdded"),
    data: protobufDecoder(ClientPurposeAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("ClientPurposeRemoved"),
    data: protobufDecoder(ClientPurposeRemovedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceStateUpdated"),
    data: protobufDecoder(EServiceStateUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("AgreementStateUpdated"),
    data: protobufDecoder(AgreementStateUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("AgreementStateUpdated"),
    data: protobufDecoder(AgreementStateUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeStateUpdated"),
    data: protobufDecoder(PurposeStateUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("AgreementAndEServiceStatesUpdated"),
    data: protobufDecoder(AgreementAndEServiceStatesUpdatedV1),
  }),
]);
export type AuthorizationEventV1 = z.infer<typeof AuthorizationEventV1>;

// export const AuthorizationEventV2 = z.discriminatedUnion("type", [
//   z.object({
//     event_version: z.literal(2),
//     type: z.literal("To do"),
//     data: protobufDecoder("to do"),
//   }),
// ]);
// export type AuthorizationEventV2 = z.infer<typeof AuthorizationEventV2>;

const eventV1 = z
  .object({
    event_version: z.literal(1),
  })
  .passthrough();

// const eventV2 = z
//   .object({
//     event_version: z.literal(2),
//   })
//   .passthrough();

export const AuthorizationEvent = z
  .discriminatedUnion("event_version", [eventV1])
  .transform((obj, ctx) => {
    const res = match(obj)
      .with({ event_version: 1 }, () => AuthorizationEventV1.safeParse(obj))
      // .with({ event_version: 2 }, () => AuthorizationEventV2.safeParse(obj))
      .exhaustive();

    if (!res.success) {
      res.error.issues.forEach(ctx.addIssue);
      return z.NEVER;
    }
    return res.data;
  });
export type AuthorizationEvent = z.infer<typeof AuthorizationEvent>;

export const AuthorizationEventEnvelopeV1 = EventEnvelope(AuthorizationEventV1);
export type AuthorizationEventEnvelopeV1 = z.infer<
  typeof AuthorizationEventEnvelopeV1
>;

// export const AuthorizationEventEnvelopeV2 = EventEnvelope(AuthorizationEventV2);
// export type AuthorizationEventEnvelopeV2 = z.infer<
//   typeof AuthorizationEventEnvelopeV2
// >;

export const AuthorizationEventEnvelope = EventEnvelope(AuthorizationEvent);
export type AuthorizationEventEnvelope = z.infer<
  typeof AuthorizationEventEnvelope
>;
