import { AuthData, userRoles } from "pagopa-interop-commons";
import {
  Attribute,
  AttributeId,
  CONTRACT_AUTHORITY_PUBLIC_SERVICES_MANAGERS,
  ExternalId,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  PUBLIC_SERVICES_MANAGERS,
  Tenant,
  TenantAttribute,
  TenantFeatureCertifier,
  TenantId,
  TenantKind,
  TenantVerifier,
  VerifiedTenantAttribute,
  WithMetadata,
  operationForbidden,
  tenantAttributeType,
  tenantKind,
  SCP,
  TenantFeature,
  Agreement,
  Delegation,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  expirationDateCannotBeInThePast,
  organizationNotFoundInVerifiers,
  verifiedAttributeNotFoundInTenant,
  selfcareIdConflict,
  expirationDateNotFoundInVerifier,
  tenantIsNotACertifier,
  attributeNotFound,
  tenantDoesNotHaveFeature,
  tenantAlreadyHasFeature,
  eServiceNotFound,
  descriptorNotFoundInEservice,
} from "../model/domain/errors.js";
import { config } from "../config/config.js";
import { ReadModelService } from "./readModelService.js";

export function assertVerifiedAttributeExistsInTenant(
  attributeId: AttributeId,
  attribute: TenantAttribute | undefined,
  tenant: WithMetadata<Tenant>
): asserts attribute is NonNullable<VerifiedTenantAttribute> {
  if (!attribute || attribute.type !== tenantAttributeType.VERIFIED) {
    throw verifiedAttributeNotFoundInTenant(tenant.data.id, attributeId);
  }
}

export async function assertVerifiedAttributeOperationAllowed({
  requesterId,
  producerDelegation,
  attributeId,
  agreement,
  readModelService,
  error,
}: {
  requesterId: TenantId;
  producerDelegation: Delegation | undefined;
  attributeId: AttributeId;
  agreement: Agreement;
  readModelService: ReadModelService;
  error: Error;
}): Promise<void> {
  if (producerDelegation && producerDelegation.delegateId !== requesterId) {
    throw error;
  }

  if (!producerDelegation && requesterId !== agreement.producerId) {
    throw error;
  }

  const descriptorId = agreement.descriptorId;

  const eservice = await readModelService.getEServiceById(agreement.eserviceId);

  if (!eservice) {
    throw eServiceNotFound(agreement.eserviceId);
  }

  const descriptor = eservice.descriptors.find(
    (descriptor) => descriptor.id === descriptorId
  );

  if (!descriptor) {
    throw descriptorNotFoundInEservice(eservice.id, descriptorId);
  }

  const attributeIds = new Set(
    descriptor.attributes.verified.flatMap((attribute) =>
      attribute.map((a) => a.id)
    )
  );

  // Check if attribute is allowed
  if (!attributeIds.has(attributeId)) {
    throw error;
  }
}

export function assertOrganizationVerifierExist(
  verifierId: string,
  tenantId: TenantId,
  attributeId: AttributeId,
  tenantVerifier: TenantVerifier | undefined
): asserts tenantVerifier is NonNullable<TenantVerifier> {
  if (tenantVerifier === undefined) {
    throw organizationNotFoundInVerifiers(verifierId, tenantId, attributeId);
  }
}

export function assertExpirationDateExist(
  tenantId: TenantId,
  attributeId: string,
  verifierId: string,
  expirationDate: Date | undefined
): asserts expirationDate is Date {
  if (expirationDate === undefined) {
    throw expirationDateNotFoundInVerifier(verifierId, attributeId, tenantId);
  }
}

export function getTenantKind(
  attributes: ExternalId[],
  externalId: ExternalId
): TenantKind {
  return match(externalId.origin)
    .with(
      PUBLIC_ADMINISTRATIONS_IDENTIFIER,
      // condition to be satisfied
      (origin) =>
        attributes.some(
          (attr) =>
            attr.origin === origin &&
            (attr.value === PUBLIC_SERVICES_MANAGERS ||
              attr.value === CONTRACT_AUTHORITY_PUBLIC_SERVICES_MANAGERS)
        ),
      () => tenantKind.GSP
    )
    .with(PUBLIC_ADMINISTRATIONS_IDENTIFIER, () => tenantKind.PA)
    .with(SCP, () => tenantKind.SCP)
    .otherwise(() => tenantKind.PRIVATE);
}

export async function assertRequesterAllowed(
  resourceId: string,
  requesterId: string
): Promise<void> {
  if (resourceId !== requesterId) {
    throw operationForbidden;
  }
}

export function assertRequesterDelegationsAllowedOrigin(
  authData: AuthData
): void {
  if (!config.delegationsAllowedOrigins.includes(authData.externalId.origin)) {
    throw operationForbidden;
  }
}

export async function assertResourceAllowed(
  resourceId: string,
  authData: AuthData
): Promise<void> {
  const roles = authData.userRoles;
  const organizationId = authData.organizationId;

  if (!roles.includes(userRoles.INTERNAL_ROLE)) {
    return await assertRequesterAllowed(resourceId, organizationId);
  }
}

export async function getTenantKindLoadingCertifiedAttributes(
  readModelService: ReadModelService,
  attributes: TenantAttribute[],
  externalId: ExternalId
): Promise<TenantKind> {
  function getCertifiedAttributesIds(
    attributes: TenantAttribute[]
  ): AttributeId[] {
    return attributes.flatMap((attr) =>
      attr.type === tenantAttributeType.CERTIFIED ? attr.id : []
    );
  }

  const convertAttributes = (attributes: Attribute[]): ExternalId[] =>
    attributes.flatMap((attr) => {
      const origin = attr.origin;
      const code = attr.code;

      if (origin !== undefined && code !== undefined) {
        return { origin, value: code } as ExternalId;
      } else {
        return [];
      }
    });

  const tenantAttributesIds = getCertifiedAttributesIds(attributes);
  const retrievedAttributes = await readModelService.getAttributesById(
    tenantAttributesIds
  );
  tenantAttributesIds.forEach((attributeId) => {
    if (!retrievedAttributes.some((attr) => attr.id === attributeId)) {
      throw attributeNotFound(attributeId);
    }
  });
  const extIds = convertAttributes(retrievedAttributes);
  return getTenantKind(extIds, externalId);
}

export function assertValidExpirationDate(
  expirationDate: Date | undefined
): void {
  if (expirationDate && expirationDate < new Date()) {
    throw expirationDateCannotBeInThePast(expirationDate);
  }
}

export function assertOrganizationIsInAttributeVerifiers(
  verifierId: string,
  tenantId: TenantId,
  attribute: VerifiedTenantAttribute
): void {
  if (!attribute.verifiedBy.some((v) => v.id === verifierId)) {
    throw organizationNotFoundInVerifiers(verifierId, tenantId, attribute.id);
  }
}

export function evaluateNewSelfcareId({
  tenant,
  newSelfcareId,
}: {
  tenant: Tenant;
  newSelfcareId: string;
}): void {
  if (tenant.selfcareId && tenant.selfcareId !== newSelfcareId) {
    throw selfcareIdConflict({
      tenantId: tenant.id,
      existingSelfcareId: tenant.selfcareId,
      newSelfcareId,
    });
  }
}

export function retrieveCertifierId(tenant: Tenant): string {
  const certifierFeature = tenant.features.find(
    (f): f is TenantFeatureCertifier => f.type === "PersistentCertifier"
  )?.certifierId;

  if (!certifierFeature) {
    throw tenantIsNotACertifier(tenant.id);
  }
  return certifierFeature;
}

function isFeatureAssigned(
  tenant: Tenant,
  featureType: TenantFeature["type"]
): boolean {
  return tenant.features.some((f) => f.type === featureType);
}

export function assertFeatureNotAssigned(
  tenant: Tenant,
  featureType: TenantFeature["type"]
): void {
  if (isFeatureAssigned(tenant, featureType)) {
    throw tenantAlreadyHasFeature(tenant.id, featureType);
  }
}

export function assertFeatureAssigned(
  tenant: Tenant,
  featureType: TenantFeature["type"]
): void {
  if (!isFeatureAssigned(tenant, featureType)) {
    throw tenantDoesNotHaveFeature(tenant.id, featureType);
  }
}
