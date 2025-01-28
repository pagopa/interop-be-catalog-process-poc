import { catalogApi } from "pagopa-interop-api-clients";
import {
  AuthData,
  RiskAnalysisValidatedForm,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  Descriptor,
  EService,
  EServiceId,
  Tenant,
  TenantId,
  TenantKind,
  descriptorState,
  eserviceMode,
  operationForbidden,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  draftDescriptorAlreadyExists,
  eServiceRiskAnalysisIsRequired,
  eserviceNotInDraftState,
  eserviceNotInReceiveMode,
  notValidDescriptorState,
  riskAnalysisNotValid,
  riskAnalysisValidationFailed,
  tenantKindNotFound,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

export async function assertRequesterIsDelegateProducerOrProducer(
  _producerId: TenantId,
  _eserviceId: EServiceId,
  _authData: AuthData,
  _readModelService: ReadModelService
): Promise<void> {
  return Promise.resolve();

  // if (authData.userRoles.includes("internal")) {
  //   return;
  // }

  // // Search for active producer delegation
  // const producerDelegation = await readModelService.getLatestDelegation({
  //   eserviceId,
  //   kind: delegationKind.delegatedProducer,
  //   states: [delegationState.active],
  // });

  // // If an active producer delegation exists, check if the requester is the delegate
  // if (producerDelegation) {
  //   const isRequesterDelegateProducer =
  //     authData.organizationId === producerDelegation.delegateId;

  //   if (!isRequesterDelegateProducer) {
  //     throw operationForbidden;
  //   }
  // } else {
  //   // If no active producer delegation exists, ensure the requester is the producer
  //   assertRequesterIsProducer(producerId, authData);
  // }
}

export function assertRequesterIsProducer(
  producerId: TenantId,
  authData: AuthData
): void {
  if (authData.userRoles.includes("internal")) {
    return;
  }
  if (producerId !== authData.organizationId) {
    throw operationForbidden;
  }
}

export async function assertNoExistingProducerDelegationInActiveOrPendingState(
  _eserviceId: EServiceId,
  _readModelService: ReadModelService
): Promise<void> {
  return Promise.resolve();
  // const producerDelegation = await readModelService.getLatestDelegation({
  //   eserviceId,
  //   kind: delegationKind.delegatedProducer,
  //   states: [delegationState.active, delegationState.waitingForApproval],
  // });

  // if (producerDelegation) {
  //   throw eserviceWithActiveOrPendingDelegation(
  //     eserviceId,
  //     producerDelegation.id
  //   );
  // }
}

export function assertIsDraftEservice(eservice: EService): void {
  if (eservice.descriptors.some((d) => d.state !== descriptorState.draft)) {
    throw eserviceNotInDraftState(eservice.id);
  }
}

export function assertIsReceiveEservice(eservice: EService): void {
  if (eservice.mode !== eserviceMode.receive) {
    throw eserviceNotInReceiveMode(eservice.id);
  }
}

export function assertTenantKindExists(
  tenant: Tenant
): asserts tenant is Tenant & { kind: NonNullable<Tenant["kind"]> } {
  if (tenant.kind === undefined) {
    throw tenantKindNotFound(tenant.id);
  }
}

export function assertHasNoDraftOrWaitingForApprovalDescriptor(
  eservice: EService
): void {
  const hasInvalidDescriptor = eservice.descriptors.some(
    (d: Descriptor) =>
      d.state === descriptorState.draft ||
      d.state === descriptorState.waitingForApproval
  );
  if (hasInvalidDescriptor) {
    throw draftDescriptorAlreadyExists(eservice.id);
  }
}

export function validateRiskAnalysisSchemaOrThrow(
  riskAnalysisForm: catalogApi.EServiceRiskAnalysisSeed["riskAnalysisForm"],
  tenantKind: TenantKind
): RiskAnalysisValidatedForm {
  const result = validateRiskAnalysis(riskAnalysisForm, true, tenantKind);
  if (result.type === "invalid") {
    throw riskAnalysisValidationFailed(result.issues);
  } else {
    return result.value;
  }
}

export function assertRiskAnalysisIsValidForPublication(
  eservice: EService,
  tenantKind: TenantKind
): void {
  if (eservice.riskAnalysis.length === 0) {
    throw eServiceRiskAnalysisIsRequired(eservice.id);
  }

  eservice.riskAnalysis.forEach((riskAnalysis) => {
    const result = validateRiskAnalysis(
      riskAnalysisFormToRiskAnalysisFormToValidate(
        riskAnalysis.riskAnalysisForm
      ),
      false,
      tenantKind
    );

    if (result.type === "invalid") {
      throw riskAnalysisNotValid();
    }
  });
}

export function assertInterfaceDeletableDescriptorState(
  descriptor: Descriptor
): void {
  match(descriptor.state)
    .with(descriptorState.draft, () => void 0)
    .with(
      descriptorState.archived,
      descriptorState.deprecated,
      descriptorState.published,
      descriptorState.suspended,
      descriptorState.waitingForApproval,
      () => {
        throw notValidDescriptorState(descriptor.id, descriptor.state);
      }
    )
    .exhaustive();
}

export function assertDocumentDeletableDescriptorState(
  descriptor: Descriptor
): void {
  match(descriptor.state)
    .with(
      descriptorState.draft,
      descriptorState.deprecated,
      descriptorState.published,
      descriptorState.suspended,
      descriptorState.waitingForApproval,
      () => void 0
    )
    .with(descriptorState.archived, () => {
      throw notValidDescriptorState(descriptor.id, descriptor.state);
    })
    .exhaustive();
}
