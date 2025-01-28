import {
  TenantAttributeV2,
  TenantEventEnvelopeV2,
  TenantFeatureV2,
  TenantV2,
} from "pagopa-interop-models";
import {
  TenantEvent as OutboundTenantEvent,
  TenantV2 as OutboundTenantV2,
  TenantFeatureV2 as OutboundTenantFeatureV2,
  TenantAttributeV2 as OutboundTenantAttributeV2,
} from "@pagopa/interop-outbound-models";
import { match } from "ts-pattern";
import { Exact } from "pagopa-interop-commons";

function toOutboundTenantFeaturesV1(
  feature: TenantFeatureV2
): Exact<OutboundTenantFeatureV2, TenantFeatureV2> {
  return feature as Exact<OutboundTenantFeatureV2, TenantFeatureV2>;
}

function toOutboundTenantAttributeV1(
  attribute: TenantAttributeV2
): Exact<OutboundTenantAttributeV2, TenantAttributeV2> {
  return attribute as Exact<OutboundTenantAttributeV2, TenantAttributeV2>;
}

function toOutboundTenantV2(
  tenant: TenantV2
): Exact<OutboundTenantV2, TenantV2> {
  return {
    ...tenant,
    mails: undefined,
    features: tenant.features.map(toOutboundTenantFeaturesV1),
    attributes: tenant.attributes.map(toOutboundTenantAttributeV1),
  };
}

export function toOutboundEventV2(
  message: TenantEventEnvelopeV2
): OutboundTenantEvent | undefined {
  return match(message)
    .returnType<OutboundTenantEvent | undefined>()
    .with(
      { type: "TenantOnboarded" },
      { type: "TenantOnboardDetailsUpdated" },
      { type: "MaintenanceTenantPromotedToCertifier" },
      { type: "MaintenanceTenantUpdated" },
      { type: "TenantDelegatedProducerFeatureAdded" },
      { type: "TenantDelegatedProducerFeatureRemoved" },
      { type: "TenantDelegatedConsumerFeatureAdded" },
      { type: "TenantDelegatedConsumerFeatureRemoved" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          tenant:
            msg.data.tenant &&
            (toOutboundTenantV2(msg.data.tenant) as OutboundTenantV2),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with(
      { type: "TenantCertifiedAttributeAssigned" },
      { type: "TenantCertifiedAttributeRevoked" },
      { type: "TenantDeclaredAttributeAssigned" },
      { type: "TenantDeclaredAttributeRevoked" },
      { type: "TenantVerifiedAttributeAssigned" },
      { type: "TenantVerifiedAttributeRevoked" },
      { type: "TenantVerifiedAttributeExpirationUpdated" },
      { type: "TenantVerifiedAttributeExtensionUpdated" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          attributeId: msg.data.attributeId,
          tenant:
            msg.data.tenant &&
            (toOutboundTenantV2(msg.data.tenant) as OutboundTenantV2),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with({ type: "MaintenanceTenantDeleted" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        tenantId: msg.data.tenantId,
        tenant:
          msg.data.tenant &&
          (toOutboundTenantV2(msg.data.tenant) as OutboundTenantV2),
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with({ type: "TenantKindUpdated" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        oldKind: msg.data.oldKind,
        tenant:
          msg.data.tenant &&
          (toOutboundTenantV2(msg.data.tenant) as OutboundTenantV2),
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with(
      { type: "TenantMailAdded" },
      { type: "TenantMailDeleted" },
      () => undefined
    )
    .exhaustive();
}
