import {
  Delegation,
  delegationKind,
  DelegationKind,
  DelegationStamp,
  DelegationState,
  delegationState,
  EService,
  EServiceId,
  operationForbidden,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  delegationAlreadyExists,
  delegationStampNotFound,
  delegatorAndDelegateSameIdError,
  differentEServiceProducer,
  incorrectState,
  operationRestrictedToDelegate,
  operationRestrictedToDelegator,
  originNotCompliant,
  tenantNotAllowedToDelegation,
} from "../model/domain/errors.js";
import { config } from "../config/config.js";
import { ReadModelService } from "./readModelService.js";

/* ========= STATES ========= */
export const inactiveDelegationStates: DelegationState[] = [
  delegationState.rejected,
  delegationState.revoked,
];

export const activeDelegationStates: DelegationState[] = [
  delegationState.waitingForApproval,
  delegationState.active,
];

export const assertDelegatorIsProducer = (
  delegatorId: TenantId,
  eservice: EService
): void => {
  if (eservice.producerId !== delegatorId) {
    throw differentEServiceProducer(delegatorId);
  }
};

export const assertDelegatorIsNotDelegate = (
  delegatorId: TenantId,
  delegateId: TenantId
): void => {
  if (delegatorId === delegateId) {
    throw delegatorAndDelegateSameIdError();
  }
};

export const assertDelegatorAndDelegateAllowedOrigins = async (
  delegator: Tenant,
  delegate: Tenant
): Promise<void> => {
  if (!config.producerAllowedOrigins.includes(delegator?.externalId?.origin)) {
    throw originNotCompliant(delegator, "Delegator");
  }

  if (!config.producerAllowedOrigins.includes(delegate?.externalId?.origin)) {
    throw originNotCompliant(delegate, "Delegate");
  }
};

export const assertTenantAllowedToReceiveDelegation = (
  tenant: Tenant,
  kind: DelegationKind
): void => {
  const delegationFeature = tenant.features.find(
    (f) =>
      f.type ===
      match(kind)
        .with(delegationKind.delegatedProducer, () => "DelegatedProducer")
        .with(delegationKind.delegatedConsumer, () => "DelegatedConsumer")
        .exhaustive()
  );

  if (!delegationFeature) {
    throw tenantNotAllowedToDelegation(tenant.id, kind);
  }
};

export const assertDelegationNotExists = async (
  delegator: Tenant,
  eserviceId: EServiceId,
  delegationKind: DelegationKind,
  readModelService: ReadModelService
): Promise<void> => {
  const delegatorId = delegator.id;

  const delegations = await readModelService.findDelegations({
    delegatorId,
    eserviceId,
    delegationKind,
    states: activeDelegationStates,
  });

  if (delegations.length > 0) {
    throw delegationAlreadyExists(delegatorId, eserviceId, delegationKind);
  }
};

export const assertIsDelegate = (
  delegation: Delegation,
  requesterId: TenantId
): void => {
  if (delegation.delegateId !== requesterId) {
    throw operationRestrictedToDelegate(requesterId, delegation.id);
  }
};

// rename to assertRequesterIsDelegator?
export const assertIsDelegator = (
  delegation: Delegation,
  requesterId: TenantId
): void => {
  if (delegation.delegatorId !== requesterId) {
    throw operationRestrictedToDelegator(requesterId, delegation.id);
  }
};

// 1. rename to assertDelegationIsInExpectedState or assertDelegationHasExpectedState
// 2. use only DelegationState[] as input, so the implementation is cleaner. A single state can always be passed like [state]
export const assertIsState = (
  expected: DelegationState | DelegationState[],
  delegation: Delegation
): void => {
  if (
    (!Array.isArray(expected) && delegation.state !== expected) ||
    (Array.isArray(expected) && !expected.includes(delegation.state))
  ) {
    throw incorrectState(delegation.id, delegation.state, expected);
  }
};

export const assertRequesterIsDelegateOrDelegator = (
  delegation: Delegation,
  requesterId: TenantId
): void => {
  if (
    delegation.delegateId !== requesterId &&
    delegation.delegatorId !== requesterId
  ) {
    throw operationForbidden;
  }
};

export function assertStampExists<S extends keyof Delegation["stamps"]>(
  stamps: Delegation["stamps"],
  stamp: S
): asserts stamps is Delegation["stamps"] & {
  [key in S]: DelegationStamp;
} {
  if (!stamps[stamp]) {
    throw delegationStampNotFound(stamp);
  }
}
