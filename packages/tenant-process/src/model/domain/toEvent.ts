import { CreateEvent } from "pagopa-interop-commons";
import {
  Tenant,
  TenantEvent,
  AttributeId,
  toTenantV2,
} from "pagopa-interop-models";
export const toCreateEventTenantOnboarded = (
  tenant: Tenant,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId: tenant.id,
  version: 0,
  event: {
    event_version: 2,
    type: "TenantOnboarded",
    data: { tenant: toTenantV2(tenant) },
  },
  correlationId,
});

export const toCreateEventTenantOnboardDetailsUpdated = (
  streamId: string,
  version: number,
  updatedTenant: Tenant,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId,
  version,
  event: {
    event_version: 2,
    type: "TenantOnboardDetailsUpdated",
    data: {
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantVerifiedAttributeExtensionUpdated = (
  streamId: string,
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId,
  version,
  event: {
    event_version: 2,
    type: "TenantVerifiedAttributeExtensionUpdated",
    data: {
      attributeId,
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantVerifiedAttributeExpirationUpdated = (
  streamId: string,
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId,
  version,
  event: {
    event_version: 2,
    type: "TenantVerifiedAttributeExpirationUpdated",
    data: {
      attributeId,
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantCertifiedAttributeAssigned = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: {
    type: "TenantCertifiedAttributeAssigned",
    event_version: 2,
    data: {
      attributeId,
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantDeclaredAttributeAssigned = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: {
    type: "TenantDeclaredAttributeAssigned",
    event_version: 2,
    data: {
      attributeId,
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantDeclaredAttributeRevoked = (
  streamId: string,
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId,
  version,
  event: {
    type: "TenantDeclaredAttributeRevoked",
    event_version: 2,
    data: {
      attributeId,
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});
