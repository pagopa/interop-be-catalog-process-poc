import { RiskAnalysisValidationIssue } from "pagopa-interop-commons";
import {
  ApiError,
  DelegationId,
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  RiskAnalysisId,
  TenantId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  eServiceDescriptorNotFound: "0001",
  eServiceDescriptorWithoutInterface: "0002",
  notValidDescriptor: "0003",
  eServiceDocumentNotFound: "0004",
  eServiceNotFound: "0005",
  draftDescriptorAlreadyExists: "0006",
  eServiceDuplicate: "007",
  originNotCompliant: "0008",
  attributeNotFound: "0009",
  inconsistentDailyCalls: "0010",
  interfaceAlreadyExists: "0011",
  eserviceNotInDraftState: "0012",
  eserviceNotInReceiveMode: "0013",
  tenantNotFound: "0014",
  tenantKindNotFound: "0015",
  riskAnalysisValidationFailed: "0016",
  eServiceRiskAnalysisNotFound: "0017",
  eServiceRiskAnalysisIsRequired: "0018",
  riskAnalysisNotValid: "0019",
  prettyNameDuplicate: "0020",
  riskAnalysisDuplicated: "0021",
  eserviceWithoutValidDescriptors: "0022",
  audienceCannotBeEmpty: "0023",
  eserviceWithActiveOrPendingDelegation: "0024",
  invalidEServiceFlags: "0025",
  inconsistentAttributesSeedGroupsCount: "0026",
  descriptorAttributeGroupSupersetMissingInAttributesSeed: "0027",
  unchangedAttributes: "0028",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function eServiceNotFound(eserviceId: EServiceId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
    title: "EService not found",
  });
}

export function eServiceDuplicate(eserviceName: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `An EService with name ${eserviceName} already exists`,
    code: "eServiceDuplicate",
    title: "Duplicated service name",
  });
}

export function riskAnalysisDuplicated(
  riskAnalysisName: string,
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `A Risk Analysis with name ${riskAnalysisName} already exists for EService ${eserviceId}`,
    code: "riskAnalysisDuplicated",
    title: "Duplicated risk analysis name",
  });
}

export function eServiceDescriptorNotFound(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} for EService ${eserviceId} not found`,
    code: "eServiceDescriptorNotFound",
    title: "EService descriptor not found",
  });
}

export function eServiceDocumentNotFound(
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  documentId: EServiceDocumentId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Document with id ${documentId} not found in EService ${eserviceId} / Descriptor ${descriptorId}`,
    code: "eServiceDocumentNotFound",
    title: "EService document not found",
  });
}

export function notValidDescriptorState(
  descriptorId: DescriptorId,
  descriptorStatus: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} has a not valid status for this operation ${descriptorStatus}`,
    code: "notValidDescriptor",
    title: "Not valid descriptor",
  });
}

export function eServiceDescriptorWithoutInterface(
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} does not have an interface`,
    code: "eServiceDescriptorWithoutInterface",
    title: "Not valid descriptor",
  });
}

export function draftDescriptorAlreadyExists(
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} already contains a draft descriptor`,
    code: "draftDescriptorAlreadyExists",
    title: "EService already contains a draft descriptor",
  });
}

export function invalidDescriptorVersion(
  details: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: details,
    code: "notValidDescriptor",
    title: "Version is not a valid descriptor version",
  });
}

export function interfaceAlreadyExists(
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} already contains an interface`,
    code: "interfaceAlreadyExists",
    title: "Descriptor already contains an interface",
  });
}

export function attributeNotFound(attributeId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeId} not found`,
    code: "attributeNotFound",
    title: "Attribute not found",
  });
}

export function inconsistentDailyCalls(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `dailyCallsPerConsumer can't be greater than dailyCallsTotal`,
    code: "inconsistentDailyCalls",
    title: "Inconsistent daily calls",
  });
}

export function originNotCompliant(origin: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Requester origin ${origin} is not allowed`,
    code: "originNotCompliant",
    title: "Origin is not compliant",
  });
}

export function eserviceNotInDraftState(
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} is not in draft state`,
    code: "eserviceNotInDraftState",
    title: "EService is not in draft state",
  });
}

export function eserviceNotInReceiveMode(
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} is not in receive mode`,
    code: "eserviceNotInReceiveMode",
    title: "EService is not in receive mode",
  });
}

export function tenantNotFound(tenantId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
    title: "Tenant not found",
  });
}

export function tenantKindNotFound(tenantId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant kind for tenant ${tenantId} not found`,
    code: "tenantKindNotFound",
    title: "Tenant kind not found",
  });
}

export function riskAnalysisValidationFailed(
  issues: RiskAnalysisValidationIssue[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk analysis validation failed. Reasons: [${issues
      .map((i) => i.detail)
      .join(", ")}]`,
    code: "riskAnalysisValidationFailed",
    title: "Risk analysis validation failed",
  });
}

export function eServiceRiskAnalysisNotFound(
  eserviceId: EServiceId,
  riskAnalysisId: RiskAnalysisId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk Analysis ${riskAnalysisId} not found for EService ${eserviceId}`,
    code: "eServiceRiskAnalysisNotFound",
    title: "Risk analysis not found",
  });
}

export function eServiceRiskAnalysisIsRequired(
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `At least one Risk Analysis is required for EService ${eserviceId}`,
    code: "eServiceRiskAnalysisIsRequired",
    title: "Risk analysis is required",
  });
}

export function riskAnalysisNotValid(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk Analysis did not pass validation`,
    code: "riskAnalysisNotValid",
    title: "Risk Analysis did not pass validation",
  });
}

export function prettyNameDuplicate(
  prettyName: string,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `A document with prettyName ${prettyName} already exists in descriptor ${descriptorId}`,
    code: "prettyNameDuplicate",
    title: "Duplicated prettyName",
  });
}

export function eserviceWithoutValidDescriptors(
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} does not have a valid descriptor`,
    code: "eserviceWithoutValidDescriptors",
    title: "EService without valid descriptors",
  });
}

export function audienceCannotBeEmpty(
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} can't be published with empty audience`,
    code: "audienceCannotBeEmpty",
    title: "Audience cannot be empty",
  });
}

export function inconsistentAttributesSeedGroupsCount(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attributes seed contains a different number of groups than the descriptor for EService ${eserviceId} and Descriptor ${descriptorId}`,
    code: "inconsistentAttributesSeedGroupsCount",
    title: "Inconsistent attributes seed groups count",
  });
}

export function descriptorAttributeGroupSupersetMissingInAttributesSeed(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Missing required attribute group superset in attributes seed for EService ${eserviceId} and Descriptor ${descriptorId}`,
    code: "descriptorAttributeGroupSupersetMissingInAttributesSeed",
    title: "Descriptor attribute group superset missing in attributes seed",
  });
}

export function unchangedAttributes(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No new attributes detected in attribute seed for EService ${eserviceId} and Descriptor ${descriptorId}`,
    code: "unchangedAttributes",
    title: "Unchanged attributes",
  });
}

export function eserviceWithActiveOrPendingDelegation(
  eserviceId: EServiceId,
  delegationId: DelegationId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `E-service ${eserviceId} can't be deleted with an active or pending delegation ${delegationId}`,
    code: "eserviceWithActiveOrPendingDelegation",
    title: "E-service with active or pending delegation",
  });
}

export function invalidEServiceFlags(
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} flags are not valid`,
    code: "invalidEServiceFlags",
    title: "Invalid EService flags",
  });
}
