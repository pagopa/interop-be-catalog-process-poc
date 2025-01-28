import {
  ExternalId,
  Tenant,
  TenantKind,
  tenantKind,
  TenantAttribute,
  TenantVerifier,
  TenantRevoker,
  TenantMail,
  TenantMailKind,
  tenantMailKind,
  TenantFeature,
  tenantAttributeType,
  TenantFeatureType,
  tenantFeatureType,
} from "pagopa-interop-models";
import { tenantApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";

export function toApiTenantKind(input: TenantKind): tenantApi.TenantKind {
  return match<TenantKind, tenantApi.TenantKind>(input)
    .with(tenantKind.GSP, () => "GSP")
    .with(tenantKind.PA, () => "PA")
    .with(tenantKind.PRIVATE, () => "PRIVATE")
    .with(tenantKind.SCP, () => "SCP")
    .exhaustive();
}

export function toApiTenantExternalId(input: ExternalId): tenantApi.ExternalId {
  return {
    origin: input.origin,
    value: input.value,
  };
}

export function toApiTenantFeature(
  input: TenantFeature
): tenantApi.TenantFeature {
  return match<TenantFeature, tenantApi.TenantFeature>(input)
    .with({ type: "PersistentCertifier" }, (feature) => ({
      certifier: {
        certifierId: feature.certifierId,
      },
    }))
    .with({ type: "DelegatedProducer" }, (feature) => ({
      delegatedProducer: {
        availabilityTimestamp: feature.availabilityTimestamp.toJSON(),
      },
    }))
    .with({ type: "DelegatedConsumer" }, (feature) => ({
      delegatedConsumer: {
        availabilityTimestamp: feature.availabilityTimestamp.toJSON(),
      },
    }))
    .exhaustive();
}

export function toApiTenantVerifier(
  verifier: TenantVerifier
): tenantApi.TenantVerifier {
  return {
    id: verifier.id,
    verificationDate: verifier.verificationDate.toJSON(),
    expirationDate: verifier.expirationDate?.toJSON(),
    extensionDate: verifier.extensionDate?.toJSON(),
    delegationId: verifier.delegationId,
  };
}

export function toApiTenantRevoker(
  revoker: TenantRevoker
): tenantApi.TenantRevoker {
  return {
    id: revoker.id,
    verificationDate: revoker.verificationDate.toJSON(),
    expirationDate: revoker.expirationDate?.toJSON(),
    extensionDate: revoker.extensionDate?.toJSON(),
    revocationDate: revoker.revocationDate.toJSON(),
    delegationId: revoker.delegationId,
  };
}

export function toApiTenantAttribute(
  input: TenantAttribute
): tenantApi.TenantAttribute {
  return match<TenantAttribute, tenantApi.TenantAttribute>(input)
    .with({ type: tenantAttributeType.CERTIFIED }, (attribute) => ({
      certified: {
        id: attribute.id,
        assignmentTimestamp: attribute.assignmentTimestamp.toJSON(),
        revocationTimestamp: attribute.revocationTimestamp?.toJSON(),
      },
    }))
    .with({ type: tenantAttributeType.VERIFIED }, (attribute) => ({
      verified: {
        id: attribute.id,
        assignmentTimestamp: attribute.assignmentTimestamp.toJSON(),
        verifiedBy: attribute.verifiedBy.map(toApiTenantVerifier),
        revokedBy: attribute.revokedBy.map(toApiTenantRevoker),
      },
    }))
    .with({ type: tenantAttributeType.DECLARED }, (attribute) => ({
      declared: {
        id: attribute.id,
        assignmentTimestamp: attribute.assignmentTimestamp.toJSON(),
        revocationTimestamp: attribute.revocationTimestamp?.toJSON(),
        delegationId: attribute.delegationId,
      },
    }))
    .exhaustive();
}

export function toApiMailKind(kind: TenantMailKind): tenantApi.MailKind {
  return match<TenantMailKind, tenantApi.MailKind>(kind)
    .with(tenantMailKind.ContactEmail, () => "CONTACT_EMAIL")
    .with(tenantMailKind.DigitalAddress, () => "DIGITAL_ADDRESS")
    .exhaustive();
}

export function toApiMail(mail: TenantMail): tenantApi.Mail {
  return {
    id: mail.id,
    kind: toApiMailKind(mail.kind),
    address: mail.address,
    createdAt: mail.createdAt.toJSON(),
    description: mail.description ?? undefined,
  };
}

export function toApiTenant(tenant: Tenant): tenantApi.Tenant {
  return {
    id: tenant.id,
    kind: tenant.kind ? toApiTenantKind(tenant.kind) : undefined,
    selfcareId: tenant.selfcareId ?? undefined,
    externalId: toApiTenantExternalId(tenant.externalId),
    features: tenant.features.map(toApiTenantFeature),
    attributes: tenant.attributes.map(toApiTenantAttribute),
    createdAt: tenant.createdAt.toJSON(),
    updatedAt: tenant.updatedAt?.toJSON(),
    mails: tenant.mails.map(toApiMail),
    name: tenant.name,
    onboardedAt: tenant.onboardedAt?.toJSON(),
    subUnitType: tenant.subUnitType,
  };
}

export function apiTenantFeatureTypeToTenantFeatureType(
  input: tenantApi.TenantFeatureType
): TenantFeatureType {
  return match<tenantApi.TenantFeatureType, TenantFeatureType>(input)
    .with(
      tenantApi.TenantFeatureType.Values.DELEGATED_PRODUCER,
      () => tenantFeatureType.delegatedProducer
    )
    .with(
      tenantApi.TenantFeatureType.Values.PERSISTENT_CERTIFIER,
      () => tenantFeatureType.persistentCertifier
    )
    .with(
      tenantApi.TenantFeatureType.Values.DELEGATED_CONSUMER,
      () => tenantFeatureType.delegatedConsumer
    )
    .exhaustive();
}
