import { z } from "zod";
import { match } from "ts-pattern";

import {
  EServiceTemplateVersionActivatedV2,
  EServiceTemplateAddedV2,
  EServiceTemplateAudienceDescriptionUpdatedV2,
  EServiceTemplateEServiceDescriptionUpdatedV2,
  EServiceTemplateDeletedV2,
  EServiceTemplateDraftVersionDeletedV2,
  EServiceTemplateDraftVersionUpdatedV2,
  EServiceTemplateDraftUpdatedV2,
  EServiceTemplateNameUpdatedV2,
  EServiceTemplateRiskAnalysisAddedV2,
  EServiceTemplateRiskAnalysisDeletedV2,
  EServiceTemplateRiskAnalysisUpdatedV2,
  EServiceTemplateVersionSuspendedV2,
  EServiceTemplateVersionAddedV2,
  EServiceTemplateVersionAttributesUpdatedV2,
  EServiceTemplateVersionDocumentAddedV2,
  EServiceTemplateVersionDocumentDeletedV2,
  EServiceTemplateVersionDocumentUpdatedV2,
  EServiceTemplateVersionInterfaceAddedV2,
  EServiceTemplateVersionInterfaceDeletedV2,
  EServiceTemplateVersionInterfaceUpdatedV2,
  EServiceTemplateVersionPublishedV2,
  EServiceTemplateVersionQuotasUpdatedV2,
} from "../gen/v2/eservice-template/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import { EventEnvelope } from "../events/events.js";

export const EServiceTemplateEventV2 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateAdded"),
    data: protobufDecoder(EServiceTemplateAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateRiskAnalysisAdded"),
    data: protobufDecoder(EServiceTemplateRiskAnalysisAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateRiskAnalysisDeleted"),
    data: protobufDecoder(EServiceTemplateRiskAnalysisDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateRiskAnalysisUpdated"),
    data: protobufDecoder(EServiceTemplateRiskAnalysisUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateDraftVersionUpdated"),
    data: protobufDecoder(EServiceTemplateDraftVersionUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateDraftUpdated"),
    data: protobufDecoder(EServiceTemplateDraftUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateDraftVersionDeleted"),
    data: protobufDecoder(EServiceTemplateDraftVersionDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateDeleted"),
    data: protobufDecoder(EServiceTemplateDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateVersionInterfaceAdded"),
    data: protobufDecoder(EServiceTemplateVersionInterfaceAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateVersionDocumentAdded"),
    data: protobufDecoder(EServiceTemplateVersionDocumentAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateVersionInterfaceDeleted"),
    data: protobufDecoder(EServiceTemplateVersionInterfaceDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateVersionDocumentDeleted"),
    data: protobufDecoder(EServiceTemplateVersionDocumentDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateVersionInterfaceUpdated"),
    data: protobufDecoder(EServiceTemplateVersionInterfaceUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateVersionDocumentUpdated"),
    data: protobufDecoder(EServiceTemplateVersionDocumentUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateVersionPublished"),
    data: protobufDecoder(EServiceTemplateVersionPublishedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateNameUpdated"),
    data: protobufDecoder(EServiceTemplateNameUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateAudienceDescriptionUpdated"),
    data: protobufDecoder(EServiceTemplateAudienceDescriptionUpdatedV2),
  }),
  z.object({
    type: z.literal("EServiceTemplateEServiceDescriptionUpdated"),
    event_version: z.literal(2),
    data: protobufDecoder(EServiceTemplateEServiceDescriptionUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateVersionQuotasUpdated"),
    data: protobufDecoder(EServiceTemplateVersionQuotasUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateVersionAdded"),
    data: protobufDecoder(EServiceTemplateVersionAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateVersionAttributesUpdated"),
    data: protobufDecoder(EServiceTemplateVersionAttributesUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateVersionSuspended"),
    data: protobufDecoder(EServiceTemplateVersionSuspendedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceTemplateVersionActivated"),
    data: protobufDecoder(EServiceTemplateVersionActivatedV2),
  }),
]);

export type EServiceTemplateEventV2 = z.infer<typeof EServiceTemplateEventV2>;

export function eserviceTemplateEventToBinaryDataV2(
  event: EServiceTemplateEventV2
): Uint8Array {
  return match(event)
    .with({ type: "EServiceTemplateVersionActivated" }, ({ data }) =>
      EServiceTemplateVersionActivatedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateAdded" }, ({ data }) =>
      EServiceTemplateAddedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateAudienceDescriptionUpdated" }, ({ data }) =>
      EServiceTemplateAudienceDescriptionUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateEServiceDescriptionUpdated" }, ({ data }) =>
      EServiceTemplateEServiceDescriptionUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateDeleted" }, ({ data }) =>
      EServiceTemplateDeletedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateDraftVersionDeleted" }, ({ data }) =>
      EServiceTemplateDraftVersionDeletedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateDraftVersionUpdated" }, ({ data }) =>
      EServiceTemplateDraftVersionUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateDraftUpdated" }, ({ data }) =>
      EServiceTemplateDraftUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateNameUpdated" }, ({ data }) =>
      EServiceTemplateNameUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateRiskAnalysisAdded" }, ({ data }) =>
      EServiceTemplateRiskAnalysisAddedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateRiskAnalysisDeleted" }, ({ data }) =>
      EServiceTemplateRiskAnalysisDeletedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateRiskAnalysisUpdated" }, ({ data }) =>
      EServiceTemplateRiskAnalysisUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateVersionSuspended" }, ({ data }) =>
      EServiceTemplateVersionSuspendedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateVersionAdded" }, ({ data }) =>
      EServiceTemplateVersionAddedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateVersionAttributesUpdated" }, ({ data }) =>
      EServiceTemplateVersionAttributesUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateVersionDocumentAdded" }, ({ data }) =>
      EServiceTemplateVersionDocumentAddedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateVersionDocumentDeleted" }, ({ data }) =>
      EServiceTemplateVersionDocumentDeletedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateVersionDocumentUpdated" }, ({ data }) =>
      EServiceTemplateVersionDocumentUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateVersionInterfaceAdded" }, ({ data }) =>
      EServiceTemplateVersionInterfaceAddedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateVersionInterfaceDeleted" }, ({ data }) =>
      EServiceTemplateVersionInterfaceDeletedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateVersionInterfaceUpdated" }, ({ data }) =>
      EServiceTemplateVersionInterfaceUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateVersionPublished" }, ({ data }) =>
      EServiceTemplateVersionPublishedV2.toBinary(data)
    )
    .with({ type: "EServiceTemplateVersionQuotasUpdated" }, ({ data }) =>
      EServiceTemplateVersionQuotasUpdatedV2.toBinary(data)
    )
    .exhaustive();
}

const eventV2 = z
  .object({
    event_version: z.literal(2),
  })
  .passthrough();

export const EServiceTemplateEvent = z
  .discriminatedUnion("event_version", [eventV2])
  .transform((obj, ctx) => {
    const res = match(obj)
      .with({ event_version: 2 }, () => EServiceTemplateEventV2.safeParse(obj))
      .exhaustive();

    if (!res.success) {
      res.error.issues.forEach(ctx.addIssue);
      return z.NEVER;
    }
    return res.data;
  });

export type EServiceTemplateEvent = z.infer<typeof EServiceTemplateEvent>;

export const EServiceTemplateEnvelopeV2 = EventEnvelope(
  EServiceTemplateEventV2
);
export type EServiceTemplateEnvelopeV2 = z.infer<
  typeof EServiceTemplateEnvelopeV2
>;

export const EServiceTemplateEventEnvelope = EventEnvelope(
  EServiceTemplateEvent
);
export type EServiceTemplateEventEnvelope = z.infer<
  typeof EServiceTemplateEventEnvelope
>;
