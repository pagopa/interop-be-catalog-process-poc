import {
  EService,
  EServiceMode,
  Purpose,
  PurposeVersion,
  PurposeRiskAnalysisForm,
  RiskAnalysisForm,
  TenantId,
  TenantKind,
  purposeVersionState,
  EServiceId,
  delegationKind,
  Delegation,
  delegationState,
} from "pagopa-interop-models";
import {
  validateRiskAnalysis,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  riskAnalysisValidatedFormToNewRiskAnalysisForm,
  AuthData,
} from "pagopa-interop-commons";
import { purposeApi } from "pagopa-interop-api-clients";
import {
  descriptorNotFound,
  duplicatedPurposeTitle,
  eServiceModeNotAllowed,
  missingFreeOfChargeReason,
  operationNotAllowed,
  organizationIsNotTheConsumer,
  organizationIsNotTheProducer,
  organizationNotAllowed,
  purposeNotInDraftState,
  riskAnalysisValidationFailed,
} from "../model/domain/errors.js";
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

const assertOrganizationIsAConsumer = (
  purpose: Pick<Purpose, "consumerId" | "eserviceId">,
  authData: AuthData
): void => {
  if (authData.organizationId !== purpose.consumerId) {
    throw organizationIsNotTheConsumer(authData.organizationId);
  }
};

export function validateRiskAnalysisOrThrow({
  riskAnalysisForm,
  schemaOnlyValidation,
  tenantKind,
}: {
  riskAnalysisForm: purposeApi.RiskAnalysisFormSeed;
  schemaOnlyValidation: boolean;
  tenantKind: TenantKind;
}): RiskAnalysisValidatedForm {
  const result = validateRiskAnalysis(
    riskAnalysisForm,
    schemaOnlyValidation,
    tenantKind
  );
  if (result.type === "invalid") {
    throw riskAnalysisValidationFailed(result.issues);
  } else {
    return result.value;
  }
}

export function validateAndTransformRiskAnalysis(
  riskAnalysisForm: purposeApi.RiskAnalysisFormSeed | undefined,
  schemaOnlyValidation: boolean,
  tenantKind: TenantKind
): PurposeRiskAnalysisForm | undefined {
  if (!riskAnalysisForm) {
    return undefined;
  }
  const validatedForm = validateRiskAnalysisOrThrow({
    riskAnalysisForm,
    schemaOnlyValidation,
    tenantKind,
  });

  return {
    ...riskAnalysisValidatedFormToNewRiskAnalysisForm(validatedForm),
    riskAnalysisId: undefined,
  };
}

export function reverseValidateAndTransformRiskAnalysis(
  riskAnalysisForm: PurposeRiskAnalysisForm | undefined,
  schemaOnlyValidation: boolean,
  tenantKind: TenantKind
): PurposeRiskAnalysisForm | undefined {
  if (!riskAnalysisForm) {
    return undefined;
  }

  const formToValidate =
    riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysisForm);
  const validatedForm = validateRiskAnalysisOrThrow({
    riskAnalysisForm: formToValidate,
    schemaOnlyValidation,
    tenantKind,
  });

  return {
    ...riskAnalysisValidatedFormToNewRiskAnalysisForm(validatedForm),
    riskAnalysisId: riskAnalysisForm.riskAnalysisId,
  };
}

export function assertPurposeIsDraft(purpose: Purpose): void {
  if (!purposeIsDraft(purpose)) {
    throw purposeNotInDraftState(purpose.id);
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

export const assertPurposeTitleIsNotDuplicated = async ({
  readModelService,
  eserviceId,
  consumerId,
  title,
}: {
  readModelService: ReadModelService;
  eserviceId: EServiceId;
  consumerId: TenantId;
  title: string;
}): Promise<void> => {
  const purposeWithSameName = await readModelService.getPurpose(
    eserviceId,
    consumerId,
    title
  );

  if (purposeWithSameName) {
    throw duplicatedPurposeTitle(title);
  }
};

export async function isOverQuota(
  eservice: EService,
  purpose: Purpose,
  dailyCalls: number,
  readModelService: ReadModelService
): Promise<boolean> {
  const allPurposes = await readModelService.getAllPurposes({
    eservicesIds: [eservice.id],
    consumersIds: [],
    producersIds: [],
    states: [purposeVersionState.active],
    excludeDraft: true,
  });

  const consumerPurposes = allPurposes.filter(
    (p) => p.consumerId === purpose.consumerId
  );

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

  return !(
    consumerLoadRequestsSum + dailyCalls <= maxDailyCallsPerConsumer &&
    allPurposesRequestsSum + dailyCalls <= maxDailyCallsTotal
  );
}

export const assertRequesterIsAllowedToRetrieveRiskAnalysisDocument = async ({
  eserviceId,
  organizationId,
  producerId,
  consumerId,
  readModelService,
}: {
  eserviceId: EServiceId;
  organizationId: TenantId;
  producerId: TenantId;
  consumerId: TenantId;
  readModelService: ReadModelService;
}): Promise<void> => {
  if (organizationId === producerId || organizationId === consumerId) {
    return;
  }

  const activeProducerDelegation =
    await readModelService.getActiveProducerDelegationByEserviceId(eserviceId);

  if (
    activeProducerDelegation &&
    organizationId === activeProducerDelegation.delegateId
  ) {
    return;
  }

  throw organizationNotAllowed(organizationId);
};

export const assertRequesterIsProducer = async ({
  eserviceId,
  organizationId,
  producerId,
  readModelService,
}: {
  eserviceId: EServiceId;
  organizationId: TenantId;
  producerId: TenantId;
  readModelService: ReadModelService;
}): Promise<void> => {
  const activeProducerDelegation =
    await readModelService.getActiveProducerDelegationByEserviceId(eserviceId);

  if (
    (activeProducerDelegation &&
      organizationId === activeProducerDelegation.delegateId) ||
    (!activeProducerDelegation && organizationId === producerId)
  ) {
    return;
  }

  throw organizationIsNotTheProducer(organizationId);
};

export const assertRequesterCanActAsConsumer = (
  purpose: Pick<Purpose, "consumerId" | "eserviceId">,
  authData: AuthData,
  activeConsumerDelegation: Delegation | undefined
): void => {
  if (!activeConsumerDelegation) {
    // No active consumer delegation, the requester is authorized only if they are the consumer
    assertOrganizationIsAConsumer(purpose, authData);
  } else {
    // Active consumer delegation, the requester is authorized only if they are the delegate
    assertRequesterIsDelegateConsumer(
      purpose,
      authData,
      activeConsumerDelegation
    );
  }
};

const assertRequesterIsDelegateConsumer = (
  purpose: Pick<Purpose, "consumerId" | "eserviceId">,
  authData: Pick<AuthData, "organizationId">,
  activeConsumerDelegation: Delegation | undefined
): void => {
  if (
    activeConsumerDelegation?.delegateId !== authData.organizationId ||
    activeConsumerDelegation?.delegatorId !== purpose.consumerId ||
    activeConsumerDelegation?.eserviceId !== purpose.eserviceId ||
    activeConsumerDelegation?.kind !== delegationKind.delegatedConsumer ||
    activeConsumerDelegation?.state !== delegationState.active
  ) {
    throw operationNotAllowed(authData.organizationId);
  }
};
