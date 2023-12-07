import { ApiError } from "pagopa-interop-models";

const errorCodes = {
  attributeNotFound: "0001",
  invalidAttributeStructure: "0002",
  tenantDuplicate: "0003",
  tenantNotFound: "0004",
  eServiceNotFound: "0005",
  tenantBySelfcateIdNotFound: "0006",
  verifiedAttributeNotFoundInTenant: "0007",
  expirationDateNotFoundInVerifier: "0008",
  expirationDateCannotBeInThePast: "0009",
  organizationNotFoundInVerifiers: "0010",
};

export function attributeNotFound(identifier: string): ApiError {
  return new ApiError({
    detail: `Attribute ${identifier} not found`,
    code: errorCodes.attributeNotFound,
    httpStatus: 404,
    title: "Attribute not found",
  });
}

export function invalidAttributeStructure(): ApiError {
  return new ApiError({
    detail: `Invalid attribute structure`,
    code: errorCodes.invalidAttributeStructure,
    httpStatus: 400,
    title: "Invalid attribute structure",
  });
}

export function tenantDuplicate(teanantName: string): ApiError {
  return new ApiError({
    detail: `Tenant ${teanantName} already exists`,
    code: errorCodes.tenantDuplicate,
    httpStatus: 409,
    title: "Duplicated tenant name",
  });
}

export function tenantNotFound(tenantId: string): ApiError {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: errorCodes.tenantNotFound,
    httpStatus: 404,
    title: "Tenant not found",
  });
}

export function eServiceNotFound(eServiceId: string): ApiError {
  return new ApiError({
    detail: `EService ${eServiceId} not found`,
    code: errorCodes.eServiceNotFound,
    httpStatus: 404,
    title: "EService not found",
  });
}

export function verifiedAttributeNotFoundInTenant(
  tenantId: string,
  attributeId: string
): ApiError {
  return new ApiError({
    detail: `Verified attribute ${attributeId} not found in tenant ${tenantId}`,
    code: errorCodes.verifiedAttributeNotFoundInTenant,
    httpStatus: 404,
    title: "Verified attribute not found in tenant",
  });
}

export function expirationDateNotFoundInVerifier(
  tenantId: string,
  attributeId: string,
  verifierId: string
): ApiError {
  return new ApiError({
    detail: `ExpirationDate not found in verifier ${verifierId} for Tenant ${tenantId} and attribute ${attributeId}`,
    code: errorCodes.expirationDateNotFoundInVerifier,
    httpStatus: 400,
    title: "Expiration date not found in verifier",
  });
}

export function expirationDateCannotBeInThePast(date: Date): ApiError {
  return new ApiError({
    detail: `Expiration date ${date} cannot be in the past`,
    code: errorCodes.expirationDateCannotBeInThePast,
    httpStatus: 400,
    title: "Expiration date cannot be in the past",
  });
}

export function organizationNotFoundInVerifiers(
  requesterId: string,
  tenantId: string,
  attributeId: string
): ApiError {
  return new ApiError({
    detail: `Organization ${requesterId} not found in verifier for Tenant ${tenantId} and attribute ${attributeId}`,
    code: errorCodes.organizationNotFoundInVerifiers,
    httpStatus: 403,
    title: "Organization not found in verifiers",
  });
}

export function tenantBySelfcateIdNotFound(selfcareId: string): ApiError {
  return new ApiError({
    detail: `Tenant with selfcareId ${selfcareId} not found in the catalog`,
    code: errorCodes.tenantBySelfcateIdNotFound,
    httpStatus: 404,
    title: "Tenant with selfcareId not found",
  });
}
