import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

const errorCodes = {
  attributeNotFound: "0001",
  invalidAttributeStructure: "0002",
  tenantDuplicate: "0003",
  tenantNotFound: "0004",
  eServiceNotFound: "0005",
  tenantBySelfcateIdNotFound: "0006",
  verifiedAttributeNotFoundInTenant: "0007",
  organizationNotFoundInVerifiers: "0008",
  expirationDateNotFoundInVerifier: "0009",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

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

export function tenantNotFound(tenantId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
    title: "Tenant not found",
  });
}

export function eServiceNotFound(eServiceId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eServiceId} not found`,
    code: "eServiceNotFound",
    title: "EService not found",
  });
}

export function tenantBySelfcateIdNotFound(
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant with selfcareId ${selfcareId} not found in the catalog`,
    code: "tenantBySelfcateIdNotFound",
    title: "Tenant with selfcareId not found",
  });
}

export function verifiedAttributeNotFoundInTenant(
  attributeId: string,
  tenantId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Verified Attribute ${attributeId} not found in tenant ${tenantId}`,
    code: "verifiedAttributeNotFoundInTenant",
    title: "Verified Attribute not found",
  });
}

export function organizationNotFoundInVerifiers(
  requesterId: string,
  attributeId: string,
  tenantId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${requesterId} not found in verifier for Tenant ${tenantId} and attribute ${attributeId}`,
    code: "organizationNotFoundInVerifiers",
    title: "Organization not found in verifier",
  });
}

export function expirationDateNotFoundInVerifier(
  verifierId: string,
  attributeId: string,
  tenantId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `ExpirationDate not found in verifier ${verifierId} for Tenant ${tenantId} and attribute ${attributeId}`,
    code: "expirationDateNotFoundInVerifier",
    title: "ExpirationDate not found in verifier",
  });
}
