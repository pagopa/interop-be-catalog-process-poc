import {
  ApiError,
  DelegationId,
  DescriptorId,
  EServiceId,
  EServiceMode,
  PurposeId,
  PurposeVersionDocumentId,
  PurposeVersionId,
  PurposeVersionState,
  RiskAnalysisId,
  TenantId,
  TenantKind,
  makeApiProblemBuilder,
} from "pagopa-interop-models";
import { RiskAnalysisValidationIssue } from "pagopa-interop-commons";

export const errorCodes = {
  purposeNotFound: "0001",
  eserviceNotFound: "0002",
  tenantNotFound: "0003",
  tenantKindNotFound: "0004",
  purposeVersionNotFound: "0005",
  purposeVersionDocumentNotFound: "0006",
  organizationNotAllowed: "0007",
  organizationIsNotTheConsumer: "0008",
  purposeVersionCannotBeDeleted: "0009",
  organizationIsNotTheProducer: "0010",
  notValidVersionState: "0011",
  eServiceModeNotAllowed: "0012",
  missingFreeOfChargeReason: "0013",
  riskAnalysisValidationFailed: "0014",
  purposeNotInDraftState: "0015",
  duplicatedPurposeTitle: "0016",
  purposeCannotBeDeleted: "0017",
  agreementNotFound: "0018",
  eserviceRiskAnalysisNotFound: "0019",
  purposeCannotBeCloned: "0020",
  riskAnalysisConfigVersionNotFound: "0021",
  descriptorNotFound: "0022",
  unchangedDailyCalls: "0023",
  missingRiskAnalysis: "0024",
  purposeVersionStateConflict: "0025",
  riskAnalysisConfigLatestVersionNotFound: "0026",
  organizationIsNotTheDelegatedConsumer: "0027",
  organizationIsNotTheDelegatedProducer: "0028",
  purposeDelegationNotFound: "0029",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function purposeNotFound(purposeId: PurposeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
    title: "Purpose not found",
  });
}

export function eserviceNotFound(eserviceId: EServiceId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eserviceNotFound",
    title: "EService not found",
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

export function purposeVersionNotFound(
  purposeId: PurposeId,
  versionId: PurposeVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Version ${versionId} not found for purpose ${purposeId}`,
    code: "purposeVersionNotFound",
    title: "Purpose version not found",
  });
}

export function purposeVersionDocumentNotFound(
  purposeId: PurposeId,
  versionId: PurposeVersionId,
  documentId: PurposeVersionDocumentId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Document ${documentId} not found for version ${versionId} of purpose ${purposeId}`,
    code: "purposeVersionDocumentNotFound",
    title: "Purpose version document not found",
  });
}

export function organizationNotAllowed(
  organizationId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed to perform the operation because is neither producer/consumer nor delegate`,
    code: "organizationNotAllowed",
    title: "Organization not allowed",
  });
}

export function organizationIsNotTheConsumer(
  organizationId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed to perform the operation because is not the consumer`,
    code: "organizationIsNotTheConsumer",
    title: "Organization not allowed",
  });
}

export function organizationIsNotTheDelegatedConsumer(
  organizationId: TenantId,
  delegationId: DelegationId | undefined
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed to perform the operation because is not the delegated consumer${
      delegationId ? ` of delegation ${delegationId}` : ""
    }`,
    code: "organizationIsNotTheDelegatedConsumer",
    title: "Organization not allowed",
  });
}

export function purposeVersionCannotBeDeleted(
  purposeId: PurposeId,
  versionId: PurposeVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Version ${versionId} of Purpose ${purposeId} cannot be deleted`,
    code: "purposeVersionCannotBeDeleted",
    title: "Purpose version canont be deleted",
  });
}

export function organizationIsNotTheProducer(
  organizationId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed to perform the operation because is not the producer`,
    code: "organizationIsNotTheProducer",
    title: "Organization not allowed",
  });
}

export function organizationIsNotTheDelegatedProducer(
  organizationId: TenantId,
  delegationId: DelegationId | undefined
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed to perform the operation because is not the delegate producer${
      delegationId ? ` of delegation ${delegationId}` : ""
    }`,
    code: "organizationIsNotTheDelegatedProducer",
    title: "Organization not allowed",
  });
}

export function eServiceModeNotAllowed(
  eserviceId: EServiceId,
  mode: EServiceMode
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} has not ${mode} mode`,
    code: "eServiceModeNotAllowed",
    title: "EService mode not allowed",
  });
}

export function missingFreeOfChargeReason(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Missing free of charge reason",
    code: "missingFreeOfChargeReason",
    title: "Missing free of charge reason",
  });
}

export function riskAnalysisValidationFailed(
  reasons: RiskAnalysisValidationIssue[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk analysis validation failed. Reasons: ${reasons}`,
    code: "riskAnalysisValidationFailed",
    title: "Risk analysis validation failed",
  });
}

export function purposeNotInDraftState(
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} is not in draft state`,
    code: "purposeNotInDraftState",
    title: "Purpose not in draft state",
  });
}

export function notValidVersionState(
  purposeVersionId: PurposeVersionId,
  versionState: PurposeVersionState
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose version ${purposeVersionId} has a not valid state for this operation: ${versionState}`,
    code: "notValidVersionState",
    title: "Not valid purpose version state",
  });
}

export function duplicatedPurposeTitle(title: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose with title: ${title} already exists`,
    code: "duplicatedPurposeTitle",
    title: "Duplicated Purpose Title",
  });
}

export function purposeCannotBeDeleted(
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Versions in Purpose ${purposeId} do not allow deletion`,
    code: "purposeCannotBeDeleted",
    title: "Purpose cannot be deleted",
  });
}

export function agreementNotFound(
  eserviceId: EServiceId,
  consumerId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Agreement found for EService ${eserviceId} and Consumer ${consumerId}`,
    code: "agreementNotFound",
    title: "Agreement Not Found",
  });
}

export function eserviceRiskAnalysisNotFound(
  eserviceId: EServiceId,
  riskAnalysisId: RiskAnalysisId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk Analysis ${riskAnalysisId} not found for EService ${eserviceId}`,
    code: "eserviceRiskAnalysisNotFound",
    title: "Risk analysis not found",
  });
}

export function purposeCannotBeCloned(
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} cannot be cloned`,
    code: "purposeCannotBeCloned",
    title: "Purpose cannot be cloned",
  });
}

export function riskAnalysisConfigVersionNotFound(
  version: string,
  tenantKind: TenantKind
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk Analysis Configuration version ${version} for tenant kind ${tenantKind} not found`,
    code: "riskAnalysisConfigVersionNotFound",
    title: "Risk Analysis config version not found",
  });
}

export function riskAnalysisConfigLatestVersionNotFound(
  tenantKind: TenantKind
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Latest Risk Analysis Configuration for tenant kind ${tenantKind} not found`,
    code: "riskAnalysisConfigLatestVersionNotFound",
    title: "Risk Analysis config latest version not found",
  });
}

export function descriptorNotFound(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found for eservice ${eserviceId}`,
    code: "descriptorNotFound",
    title: "Descriptor not found",
  });
}

export function missingRiskAnalysis(
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} must contain a valid risk analysis`,
    code: "missingRiskAnalysis",
    title: "Missing risk analysis",
  });
}

export function unchangedDailyCalls(
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Creation of new version without changing daily calls for purpose ${purposeId}`,
    code: "unchangedDailyCalls",
    title: "Unchanged daily calls",
  });
}

export function purposeVersionStateConflict(
  purposeId: PurposeId,
  versionId: PurposeVersionId,
  state: PurposeVersionState
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Operation is not allowed on state ${state} for Version ${versionId} of Purpose ${purposeId}`,
    code: "purposeVersionStateConflict",
    title: "Purpose version state conflict",
  });
}

export function puroposeDelegationNotFound(
  purposeId: PurposeId,
  delegationId: DelegationId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${delegationId} not found for delegated purpose ${purposeId}`,
    code: "purposeDelegationNotFound",
    title: "Purpose delegation not found",
  });
}
