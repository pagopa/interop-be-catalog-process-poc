import {
  ApiError,
  AttributeId,
  DelegationId,
  EServiceId,
  TenantFeature,
  TenantId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  attributeNotFound: "0001",
  invalidAttributeStructure: "0002",
  tenantDuplicate: "0003",
  tenantNotFound: "0004",
  eServiceNotFound: "0005",
  tenantNotFoundBySelfcareId: "0006",
  selfcareIdConflict: "0007",
  verifiedAttributeNotFoundInTenant: "0008",
  expirationDateCannotBeInThePast: "009",
  organizationNotFoundInVerifiers: "0010",
  expirationDateNotFoundInVerifier: "0011",
  tenantIsNotACertifier: "0012",
  attributeDoesNotBelongToCertifier: "0013",
  certifiedAttributeAlreadyAssigned: "0014",
  attributeVerificationNotAllowed: "0015",
  verifiedAttributeSelfVerificationNotAllowed: "0016",
  mailNotFound: "0017",
  mailAlreadyExists: "0018",
  attributeAlreadyRevoked: "0019",
  attributeRevocationNotAllowed: "0020",
  verifiedAttributeSelfRevocationNotAllowed: "0021",
  tenantIsAlreadyACertifier: "0022",
  certifierWithExistingAttributes: "0023",
  attributeNotFoundInTenant: "0024",
  tenantNotFoundByExternalId: "0025",
  tenantAlreadyHasFeature: "0026",
  tenantDoesNotHaveFeature: "0027",
  notValidMailAddress: "0028",
  agreementNotFound: "0029",
  descriptorNotFoundInEservice: "0030",
  delegationNotFound: "0031",
  operationRestrictedToDelegate: "0032",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function verifiedAttributeSelfVerificationNotAllowed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organizations are not allowed to verify own attributes`,
    code: "verifiedAttributeSelfVerificationNotAllowed",
    title: "Verified attribute self verification not allowed",
  });
}

export function verifiedAttributeSelfRevocationNotAllowed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organizations are not allowed to revoke own attributes`,
    code: "verifiedAttributeSelfRevocationNotAllowed",
    title: "Verified attribute self revocation not allowed",
  });
}

export function attributeNotFound(identifier: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${identifier} not found`,
    code: "attributeNotFound",
    title: "Attribute not found",
  });
}

export function invalidAttributeStructure(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid attribute structure`,
    code: "invalidAttributeStructure",
    title: "Invalid attribute structure",
  });
}

export function tenantDuplicate(teanantName: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${teanantName} already exists`,
    code: "tenantDuplicate",
    title: "Duplicated tenant name",
  });
}

export function tenantNotFound(tenantId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
    title: "Tenant not found",
  });
}

export function tenantNotFoundByExternalId(
  origin: string,
  code: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant with externalId ${origin}/${code} not found`,
    code: "tenantNotFoundByExternalId",
    title: "Tenant not found by externalId",
  });
}

export function eServiceNotFound(eserviceId: EServiceId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
    title: "EService not found",
  });
}

export function verifiedAttributeNotFoundInTenant(
  tenantId: TenantId,
  attributeId: AttributeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Verified attribute ${attributeId} not found in tenant ${tenantId}`,
    code: "verifiedAttributeNotFoundInTenant",
    title: "Verified attribute not found in tenant",
  });
}

export function expirationDateCannotBeInThePast(
  date: Date
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Expiration date ${date} cannot be in the past`,
    code: "expirationDateCannotBeInThePast",
    title: "Expiration date cannot be in the past",
  });
}

export function attributeVerificationNotAllowed(
  consumerId: string,
  attributeId: AttributeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization is not allowed to verify attribute ${attributeId}
    for tenant ${consumerId}`,
    code: "attributeVerificationNotAllowed",
    title: "Attribute verification is not allowed",
  });
}

export function attributeRevocationNotAllowed(
  consumerId: string,
  attributeId: AttributeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization is not allowed to revoke attribute ${attributeId}
    for tenant ${consumerId}`,
    code: "attributeRevocationNotAllowed",
    title: "Attribute revocation is not allowed",
  });
}

export function organizationNotFoundInVerifiers(
  requesterId: string,
  tenantId: TenantId,
  attributeId: AttributeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${requesterId} not found in verifier for Tenant ${tenantId} and attribute ${attributeId}`,
    code: "organizationNotFoundInVerifiers",
    title: "Organization not found in verifiers",
  });
}

export function tenantNotFoundBySelfcareId(
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant with selfcareId ${selfcareId} not found`,
    code: "tenantNotFoundBySelfcareId",
    title: "Tenant not found by selfcareId",
  });
}

export function expirationDateNotFoundInVerifier(
  verifierId: string,
  attributeId: string,
  tenantId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `ExpirationDate not found in verifier ${verifierId} for Tenant ${tenantId} and attribute ${attributeId}`,
    code: "expirationDateNotFoundInVerifier",
    title: "ExpirationDate not found in verifier",
  });
}
export function selfcareIdConflict({
  tenantId,
  existingSelfcareId,
  newSelfcareId,
}: {
  tenantId: TenantId;
  existingSelfcareId: string;
  newSelfcareId: string;
}): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Conflict on Tenant SelfCareId update for tenant ${tenantId}: old value ${existingSelfcareId} - new value ${newSelfcareId}`,
    code: "selfcareIdConflict",
    title: "Selfcare id conflict",
  });
}

export function tenantIsNotACertifier(
  organizationId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} not allowed to assign attributes`,
    code: "tenantIsNotACertifier",
    title: "Tenant is not a certifier",
  });
}

export function attributeDoesNotBelongToCertifier(
  attributeId: AttributeId,
  organizationId: TenantId,
  tenantId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} not allowed to assign certified attribute ${attributeId} to tenant ${tenantId}`,
    code: "attributeDoesNotBelongToCertifier",
    title: "Attribute does not belong to certifier",
  });
}

export function certifiedAttributeAlreadyAssigned(
  attributeId: AttributeId,
  organizationId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Certified Attribute ${attributeId} already assigned to tenant ${organizationId}`,
    code: "certifiedAttributeAlreadyAssigned",
    title: "Certified attribute already assigned",
  });
}

export function attributeAlreadyRevoked(
  tenantId: TenantId,
  organizationId: TenantId,
  attributeId: AttributeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeId} has been already revoked for ${tenantId} by ${organizationId}`,
    code: "attributeAlreadyRevoked",
    title: "Attribute is already revoked",
  });
}
export function mailNotFound(mailId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `mail ${mailId} not found`,
    code: "mailNotFound",
    title: "Mail not found",
  });
}

export function mailAlreadyExists(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `mail already exists`,
    code: "mailAlreadyExists",
    title: "Mail already exists",
  });
}

export function tenantIsAlreadyACertifier(
  tenantId: TenantId,
  certifierId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${tenantId} is already a certifier with certifierId ${certifierId}`,
    code: "tenantIsAlreadyACertifier",
    title: "Tenant is already a certifier",
  });
}

export function certifierWithExistingAttributes(
  tenantId: TenantId,
  certifierId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${tenantId} with certifierId ${certifierId} has already created attributes`,
    code: "certifierWithExistingAttributes",
    title: "Certifier with existing attributes",
  });
}

export function attributeNotFoundInTenant(
  attributeId: AttributeId,
  tenantId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeId} not found in tenant ${tenantId}`,
    code: "attributeNotFoundInTenant",
    title: "Attribute not found in tenant",
  });
}

export function tenantAlreadyHasFeature(
  tenantId: TenantId,
  featureType: TenantFeature["type"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} already has ${featureType} feature assigned`,
    code: "tenantAlreadyHasFeature",
    title: "Feature already assigned",
  });
}

export function tenantDoesNotHaveFeature(
  tenantId: TenantId,
  featureType: TenantFeature["type"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} doesn't have ${featureType} feature assigned`,
    code: "tenantDoesNotHaveFeature",
    title: "Feature not assigned",
  });
}

export function agreementNotFound(agreementId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement ${agreementId} not found`,
    code: "agreementNotFound",
    title: "Agreement not found",
  });
}

export function descriptorNotFoundInEservice(
  descriptorId: string,
  eserviceId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found in EService ${eserviceId}`,
    code: "descriptorNotFoundInEservice",
    title: "Descriptor not found in EService",
  });
}

export function notValidMailAddress(address: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `mail address ${address} not valid`,
    code: "notValidMailAddress",
    title: "Not valid mail address",
  });
}

export function delegationNotFound(
  delegationId: DelegationId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${delegationId} not found`,
    code: "delegationNotFound",
    title: "Delegation not found",
  });
}

export function operationRestrictedToDelegate(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Not allowed to add declared attribute",
    code: "operationRestrictedToDelegate",
    title: "Not allowed to add declared attribute",
  });
}
