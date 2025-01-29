import {
  attributeRegistryApi,
  bffApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { isDefined } from "pagopa-interop-commons";
import {
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  DelegationId,
  Tenant,
  TenantAttribute,
  TenantMail,
  VerifiedTenantAttribute,
  tenantAttributeType,
  unsafeBrandId,
} from "pagopa-interop-models";
import { getLatestTenantContactEmail } from "../model/modelMappingUtils.js";

export function toTenantAttribute(
  att: tenantApi.TenantAttribute
): TenantAttribute[] {
  const certified: CertifiedTenantAttribute | undefined = att.certified && {
    id: unsafeBrandId(att.certified.id),
    type: tenantAttributeType.CERTIFIED,
    revocationTimestamp: att.certified.revocationTimestamp
      ? new Date(att.certified.revocationTimestamp)
      : undefined,
    assignmentTimestamp: new Date(att.certified.assignmentTimestamp),
  };

  const verified: VerifiedTenantAttribute | undefined = att.verified && {
    id: unsafeBrandId(att.verified.id),
    type: tenantAttributeType.VERIFIED,
    assignmentTimestamp: new Date(att.verified.assignmentTimestamp),
    verifiedBy: att.verified.verifiedBy.map((v) => ({
      id: unsafeBrandId(v.id),
      verificationDate: new Date(v.verificationDate),
      expirationDate: v.expirationDate ? new Date(v.expirationDate) : undefined,
      extensionDate: v.extensionDate ? new Date(v.extensionDate) : undefined,
      delegationId: v.delegationId
        ? unsafeBrandId<DelegationId>(v.delegationId)
        : undefined,
    })),
    revokedBy: att.verified.revokedBy.map((r) => ({
      id: unsafeBrandId(r.id),
      verificationDate: new Date(r.verificationDate),
      revocationDate: new Date(r.revocationDate),
      expirationDate: r.expirationDate ? new Date(r.expirationDate) : undefined,
      extensionDate: r.extensionDate ? new Date(r.extensionDate) : undefined,
      delegationId: r.delegationId
        ? unsafeBrandId<DelegationId>(r.delegationId)
        : undefined,
    })),
  };

  const declared: DeclaredTenantAttribute | undefined = att.declared && {
    id: unsafeBrandId(att.declared.id),
    type: tenantAttributeType.DECLARED,
    assignmentTimestamp: new Date(att.declared.assignmentTimestamp),
    revocationTimestamp: att.declared.revocationTimestamp
      ? new Date(att.declared.revocationTimestamp)
      : undefined,
    delegationId: att.declared.delegationId
      ? unsafeBrandId<DelegationId>(att.declared.delegationId)
      : undefined,
  };

  return [certified, verified, declared].filter(
    (a): a is TenantAttribute => !!a
  );
}

export function tenantAttributesFromApi(
  tenantApiAttributes: tenantApi.Tenant["attributes"]
): Tenant["attributes"] {
  return tenantApiAttributes.map(toTenantAttribute).flat();
}

export const toBffApiRequesterCertifiedAttributes = (
  input: tenantApi.CertifiedAttribute
): bffApi.RequesterCertifiedAttribute => ({
  tenantId: input.id,
  tenantName: input.name,
  attributeId: input.attributeId,
  attributeName: input.attributeName,
});

export type RegistryAttributesMap = Map<
  attributeRegistryApi.Attribute["id"],
  attributeRegistryApi.Attribute
>;

const toBffApiCertifiedTenantAttribute = (
  tenantAttribute: tenantApi.CertifiedTenantAttribute,
  registryAttributesMap: RegistryAttributesMap
): bffApi.CertifiedTenantAttribute | undefined => {
  const registryAttribute = registryAttributesMap.get(tenantAttribute.id);

  return registryAttribute
    ? {
        id: tenantAttribute.id,
        name: registryAttribute.name,
        description: registryAttribute.description,
        assignmentTimestamp: tenantAttribute.assignmentTimestamp,
        revocationTimestamp: tenantAttribute.revocationTimestamp,
      }
    : undefined;
};

const toBffApiDeclaredTenantAttribute = (
  tenantAttribute: tenantApi.DeclaredTenantAttribute,
  registryAttributesMap: RegistryAttributesMap
  // eslint-disable-next-line sonarjs/no-identical-functions
): bffApi.DeclaredTenantAttribute | undefined => {
  const registryAttribute = registryAttributesMap.get(tenantAttribute.id);

  return registryAttribute
    ? {
        id: tenantAttribute.id,
        name: registryAttribute.name,
        description: registryAttribute.description,
        assignmentTimestamp: tenantAttribute.assignmentTimestamp,
        revocationTimestamp: tenantAttribute.revocationTimestamp,
        delegationId: tenantAttribute.delegationId,
      }
    : undefined;
};

const toBffApiVerifiedTenantAttribute = (
  tenantAttribute: tenantApi.VerifiedTenantAttribute,
  registryAttributesMap: RegistryAttributesMap
): bffApi.VerifiedTenantAttribute | undefined => {
  const registryAttribute = registryAttributesMap.get(tenantAttribute.id);

  return registryAttribute
    ? {
        id: tenantAttribute.id,
        name: registryAttribute.name,
        description: registryAttribute.description,
        assignmentTimestamp: tenantAttribute.assignmentTimestamp,
        verifiedBy: tenantAttribute.verifiedBy,
        revokedBy: tenantAttribute.revokedBy,
      }
    : undefined;
};

export function toBffApiCertifiedTenantAttributes(
  certifiedAttributes: tenantApi.CertifiedTenantAttribute[],
  registryAttributesMap: RegistryAttributesMap
): bffApi.CertifiedTenantAttribute[] {
  return certifiedAttributes
    .map((tenantAttribute) =>
      toBffApiCertifiedTenantAttribute(tenantAttribute, registryAttributesMap)
    )
    .filter(isDefined);
}

export function toBffApiDeclaredTenantAttributes(
  declaredAttributes: tenantApi.DeclaredTenantAttribute[],
  registryAttributesMap: RegistryAttributesMap
): bffApi.DeclaredTenantAttribute[] {
  return declaredAttributes
    .map((tenantAttribute) =>
      toBffApiDeclaredTenantAttribute(tenantAttribute, registryAttributesMap)
    )
    .filter(isDefined);
}

export function toBffApiVerifiedTenantAttributes(
  verifiedAttributes: tenantApi.VerifiedTenantAttribute[],
  registryAttributesMap: RegistryAttributesMap
): bffApi.VerifiedTenantAttribute[] {
  return verifiedAttributes
    .map((tenantAttribute) =>
      toBffApiVerifiedTenantAttribute(tenantAttribute, registryAttributesMap)
    )
    .filter(isDefined);
}

export function toBffApiTenant(
  tenant: tenantApi.Tenant,
  certifiedAttributes: tenantApi.CertifiedTenantAttribute[],
  declaredAttributes: tenantApi.DeclaredTenantAttribute[],
  verifiedAttributes: tenantApi.VerifiedTenantAttribute[],
  registryAttributesMap: RegistryAttributesMap
): bffApi.Tenant {
  return {
    id: tenant.id,
    selfcareId: tenant.selfcareId,
    externalId: tenant.externalId,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    name: tenant.name,
    features: tenant.features,
    onboardedAt: tenant.onboardedAt,
    subUnitType: tenant.subUnitType,
    contactMail: getLatestTenantContactEmail(tenant),
    attributes: {
      certified: toBffApiCertifiedTenantAttributes(
        certifiedAttributes,
        registryAttributesMap
      ),
      declared: toBffApiDeclaredTenantAttributes(
        declaredAttributes,
        registryAttributesMap
      ),
      verified: toBffApiVerifiedTenantAttributes(
        verifiedAttributes,
        registryAttributesMap
      ),
    },
  };
}

export async function toBffApiCompactTenant(
  tenant: tenantApi.Tenant,
  getLogoUrl: (
    selfcareId: tenantApi.Tenant["selfcareId"]
  ) => Promise<bffApi.CompactTenant["logoUrl"]>
): Promise<bffApi.CompactTenant> {
  return {
    id: tenant.id,
    name: tenant.name,
    selfcareId: tenant.selfcareId,
    logoUrl: await getLogoUrl(tenant.selfcareId),
  };
}

export function fromApiTenantMail(mail: tenantApi.Mail): TenantMail {
  return {
    id: mail.id,
    kind: mail.kind,
    address: mail.address,
    createdAt: new Date(mail.createdAt),
    description: mail.description,
  };
}

export function toBffTenantMail(mail: TenantMail): bffApi.Mail {
  return {
    address: mail.address,
    description: mail.description,
  };
}
