/* eslint-disable max-params */
import {
  TenantAttribute,
  AttributeId,
  EServiceAttribute,
  unsafeBrandId,
  tenantAttributeType,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  VerifiedTenantAttribute,
} from "pagopa-interop-models";
import {
  DescriptorWithOnlyAttributes,
  TenantWithOnlyAttributes,
} from "pagopa-interop-agreement-lifecycle";
import {
  agreementApi,
  authorizationApi,
  bffApi,
  catalogApi,
  selfcareV2ClientApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { agreementApiState, catalogApiDescriptorState } from "./apiTypes.js";

export function toDescriptorWithOnlyAttributes(
  descriptor: catalogApi.EServiceDescriptor
): DescriptorWithOnlyAttributes {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const toAttribute = (atts: catalogApi.Attribute[]): EServiceAttribute[] =>
    atts.map((att) => ({
      ...att,
      id: unsafeBrandId(att.id),
    }));

  return {
    ...descriptor,
    attributes: {
      certified: descriptor.attributes.certified.map(toAttribute),
      declared: descriptor.attributes.declared.map(toAttribute),
      verified: descriptor.attributes.verified.map(toAttribute),
    },
  };
}

export function toEserviceCatalogProcessQueryParams(
  queryParams: bffApi.BffGetCatalogQueryParam
): catalogApi.GetCatalogQueryParam {
  return {
    ...queryParams,
    eservicesIds: [],
    name: queryParams.q,
  };
}

export function toBffCatalogApiEServiceResponse(
  eservice: catalogApi.EService,
  producerTenant: tenantApi.Tenant,
  hasCertifiedAttributes: boolean,
  isRequesterEqProducer: boolean,
  activeDescriptor?: catalogApi.EServiceDescriptor,
  agreement?: agreementApi.Agreement
): bffApi.CatalogEService {
  const isUpgradable = (agreement: agreementApi.Agreement): boolean => {
    const eserviceDescriptor = eservice.descriptors.find(
      (e) => e.id === agreement.descriptorId
    );

    return (
      eserviceDescriptor !== undefined &&
      eservice.descriptors
        .filter((d) => Number(d.version) > Number(eserviceDescriptor.version))
        .find(
          (d) =>
            (d.state === catalogApiDescriptorState.PUBLISHED ||
              d.state === catalogApiDescriptorState.SUSPENDED) &&
            (agreement.state === agreementApiState.ACTIVE ||
              agreement.state === agreementApiState.SUSPENDED)
        ) !== undefined
    );
  };

  const partialEnhancedEservice = {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    producer: {
      id: eservice.producerId,
      name: producerTenant.name,
    },
    isMine: isRequesterEqProducer,
    hasCertifiedAttributes,
  };

  return {
    ...partialEnhancedEservice,
    ...(activeDescriptor
      ? {
          activeDescriptor: {
            id: activeDescriptor.id,
            version: activeDescriptor.version,
            audience: activeDescriptor.audience,
            state: activeDescriptor.state,
          },
        }
      : {}),
    ...(agreement
      ? {
          agreement: {
            id: agreement.id,
            state: agreement.state,
            canBeUpgraded: isUpgradable(agreement),
          },
        }
      : {}),
  };
}

export function toTenantAttribute(
  att: tenantApi.TenantAttribute
): TenantAttribute[] {
  const certified: CertifiedTenantAttribute | undefined = att.certified && {
    id: unsafeBrandId<AttributeId>(att.certified.id),
    type: tenantAttributeType.CERTIFIED,
    revocationTimestamp: att.certified.revocationTimestamp
      ? new Date(att.certified.revocationTimestamp)
      : undefined,
    assignmentTimestamp: new Date(att.certified.assignmentTimestamp),
  };

  const verified: VerifiedTenantAttribute | undefined = att.verified && {
    id: unsafeBrandId<AttributeId>(att.verified.id),
    type: tenantAttributeType.VERIFIED,
    assignmentTimestamp: new Date(att.verified.assignmentTimestamp),
    verifiedBy: att.verified.verifiedBy.map((v) => ({
      id: v.id,
      verificationDate: new Date(v.verificationDate),
      expirationDate: v.expirationDate ? new Date(v.expirationDate) : undefined,
      extensionDate: v.extensionDate ? new Date(v.extensionDate) : undefined,
    })),
    revokedBy: att.verified.revokedBy.map((r) => ({
      id: r.id,
      verificationDate: new Date(r.verificationDate),
      revocationDate: new Date(r.revocationDate),
      expirationDate: r.expirationDate ? new Date(r.expirationDate) : undefined,
      extensionDate: r.extensionDate ? new Date(r.extensionDate) : undefined,
    })),
  };

  const declared: DeclaredTenantAttribute | undefined = att.declared && {
    id: unsafeBrandId<AttributeId>(att.declared.id),
    type: tenantAttributeType.DECLARED,
    assignmentTimestamp: new Date(att.declared.assignmentTimestamp),
    revocationTimestamp: att.declared.revocationTimestamp
      ? new Date(att.declared.revocationTimestamp)
      : undefined,
  };

  return [certified, verified, declared].filter(
    (a): a is TenantAttribute => !!a
  );
}

export function toTenantWithOnlyAttributes(
  tenant: tenantApi.Tenant
): TenantWithOnlyAttributes {
  return {
    ...tenant,
    attributes: tenant.attributes.map(toTenantAttribute).flat(),
  };
}

export const toBffApiCompactProducerKeychain = (
  input: authorizationApi.ProducerKeychain
): bffApi.CompactProducerKeychain => ({
  hasKeys: input.keys.length > 0,
  id: input.id,
  name: input.name,
});

// TODO: correct?
export const toBffApiCompactUser = (
  input: selfcareV2ClientApi.UserResponse
): bffApi.CompactUser => ({
  userId: input.id ?? "",
  name: input.name ?? "",
  familyName: input.surname ?? "",
});
