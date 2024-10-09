import { DelegationKind, EServiceId, TenantId } from "pagopa-interop-models";

export type GetDelegationsFilters = {
  eserviceId?: EServiceId;
  delegatorId?: TenantId;
  delegateId?: TenantId;
  delegationKind?: DelegationKind;
};
