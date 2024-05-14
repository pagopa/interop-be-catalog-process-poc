import {
  EService,
  EServiceMode,
  Purpose,
  PurposeVersion,
  PurposeRiskAnalysisForm,
  RiskAnalysisForm,
  Tenant,
  TenantId,
  TenantKind,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  validateRiskAnalysis,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  riskAnalysisValidatedFormToNewRiskAnalysisForm,
} from "pagopa-interop-commons";
import {
  agreementNotFound,
  descriptorNotFound,
  eServiceModeNotAllowed,
  missingFreeOfChargeReason,
  organizationIsNotTheConsumer,
  purposeNotInDraftState,
  riskAnalysisValidationFailed,
  tenantKindNotFound,
  unchangedDailyCalls,
} from "../model/domain/errors.js";
import { ApiRiskAnalysisFormSeed } from "../model/domain/models.js";
import { ReadModelService } from "./readModelService.js";
import { retrieveActiveAgreement } from "./purposeService.js";

export const isRiskAnalysisFormValid = (
  riskAnalysisForm: RiskAnalysisForm | undefined,
  schemaOnlyValidation: boolean,
  tenantKind: TenantKind
): boolean => {
  if (riskAnalysisForm === undefined) {
    return false;
  } else {
    return (
      validateRiskAnalysis(
        riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysisForm),
        schemaOnlyValidation,
        tenantKind
      ).type === "valid"
    );
  }
};

export const purposeIsDraft = (purpose: Purpose): boolean =>
  !purpose.versions.some((v) => v.state !== purposeVersionState.draft);

export const isDeletableVersion = (
  purposeVersion: PurposeVersion,
  purpose: Purpose
): boolean =>
  purposeVersion.state === purposeVersionState.waitingForApproval &&
  purpose.versions.length !== 1;

export const isRejectable = (purposeVersion: PurposeVersion): boolean =>
  purposeVersion.state === purposeVersionState.waitingForApproval;

export const assertEserviceMode = (
  eservice: EService,
  expectedMode: EServiceMode
): void => {
  if (eservice.mode !== expectedMode) {
    throw eServiceModeNotAllowed(eservice.id, expectedMode);
  }
};

export const assertConsistentFreeOfCharge = (
  isFreeOfCharge: boolean,
  freeOfChargeReason: string | undefined
): void => {
  if (isFreeOfCharge && !freeOfChargeReason) {
    throw missingFreeOfChargeReason();
  }
};

export const assertOrganizationIsAConsumer = (
  organizationId: TenantId,
  consumerId: TenantId
): void => {
  if (organizationId !== consumerId) {
    throw organizationIsNotTheConsumer(organizationId);
  }
};

export function validateRiskAnalysisSchemaOrThrow(
  riskAnalysisForm: ApiRiskAnalysisFormSeed,
  tenantKind: TenantKind
): RiskAnalysisValidatedForm {
  const result = validateRiskAnalysis(riskAnalysisForm, true, tenantKind);
  if (result.type === "invalid") {
    throw riskAnalysisValidationFailed(result.issues);
  } else {
    return result.value;
  }
}

export function validateAndTransformRiskAnalysis(
  riskAnalysisForm: ApiRiskAnalysisFormSeed | undefined,
  tenantKind: TenantKind
): PurposeRiskAnalysisForm | undefined {
  if (!riskAnalysisForm) {
    return undefined;
  }

  const validatedForm = validateRiskAnalysisSchemaOrThrow(
    riskAnalysisForm,
    tenantKind
  );

  return {
    ...riskAnalysisValidatedFormToNewRiskAnalysisForm(validatedForm),
    riskAnalysisId: undefined,
  };
}

export function reverseValidateAndTransformRiskAnalysis(
  riskAnalysisForm: PurposeRiskAnalysisForm | undefined,
  tenantKind: TenantKind
): PurposeRiskAnalysisForm | undefined {
  if (!riskAnalysisForm) {
    return undefined;
  }

  const formToValidate =
    riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysisForm);
  const validatedForm = validateRiskAnalysisSchemaOrThrow(
    formToValidate,
    tenantKind
  );

  return {
    ...riskAnalysisValidatedFormToNewRiskAnalysisForm(validatedForm),
    riskAnalysisId: riskAnalysisForm.riskAnalysisId,
  };
}

export function assertTenantKindExists(
  tenant: Tenant
): asserts tenant is Tenant & { kind: NonNullable<Tenant["kind"]> } {
  if (!tenant.kind) {
    throw tenantKindNotFound(tenant.id);
  }
}

export function assertPurposeIsDraft(purpose: Purpose): void {
  if (!purposeIsDraft(purpose)) {
    throw purposeNotInDraftState(purpose.id);
  }
}

export function assertDailyCallsIsDifferentThanBefore(
  purpose: Purpose,
  dailyCalls: number
): void {
  const previousDailyCalls = [...purpose.versions].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )[0]?.dailyCalls;

  if (previousDailyCalls === dailyCalls) {
    throw unchangedDailyCalls(purpose.id);
  }
}

export const isDeletable = (purpose: Purpose): boolean =>
  purpose.versions.every(
    (v) =>
      v.state === purposeVersionState.draft ||
      v.state === purposeVersionState.waitingForApproval
  );

export const isArchivable = (purposeVersion: PurposeVersion): boolean =>
  purposeVersion.state === purposeVersionState.active ||
  purposeVersion.state === purposeVersionState.suspended;

export const isSuspendable = (purposeVersion: PurposeVersion): boolean =>
  purposeVersion.state === purposeVersionState.active ||
  purposeVersion.state === purposeVersionState.suspended;

export async function isLoadAllowed(
  eservice: EService,
  purpose: Purpose,
  purposeVersion: PurposeVersion,
  readModelService: ReadModelService
): Promise<boolean> {
  const consumerPurposes = await readModelService.getAllPurposes({
    eservicesIds: [eservice.id],
    consumersIds: [purpose.consumerId],
    states: [purposeVersionState.active],
    producersIds: [],
    excludeDraft: true,
  });

  const allPurposes = await readModelService.getAllPurposes({
    eservicesIds: [eservice.id],
    consumersIds: [],
    producersIds: [],
    states: [purposeVersionState.active],
    excludeDraft: true,
  });

  const agreement = await retrieveActiveAgreement(
    eservice.id,
    purpose.consumerId,
    readModelService
  );

  const getActiveVersions = (purposes: Purpose[]): PurposeVersion[] =>
    purposes
      .flatMap((p) => p.versions)
      .filter((v) => v.state === purposeVersionState.active);

  const consumerActiveVersions = getActiveVersions(consumerPurposes);
  const allPurposesActiveVersions = getActiveVersions(allPurposes);

  const aggregateDailyCalls = (versions: PurposeVersion[]): number =>
    versions.reduce((acc, v) => acc + v.dailyCalls, 0);

  const consumerLoadRequestsSum = aggregateDailyCalls(consumerActiveVersions);
  const allPurposesRequestsSum = aggregateDailyCalls(allPurposesActiveVersions);

  const currentDescriptor = eservice.descriptors.find(
    (d) => d.id === agreement.descriptorId
  );

  if (!currentDescriptor) {
    throw descriptorNotFound(eservice.id, agreement.descriptorId);
  }

  const maxDailyCallsPerConsumer = currentDescriptor.dailyCallsPerConsumer;
  const maxDailyCallsTotal = currentDescriptor.dailyCallsTotal;

  return (
    consumerLoadRequestsSum + purposeVersion.dailyCalls <=
      maxDailyCallsPerConsumer &&
    allPurposesRequestsSum + purposeVersion.dailyCalls <= maxDailyCallsTotal
  );
}
