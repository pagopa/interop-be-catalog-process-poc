import {
  getMockAgreement,
  getMockDelegation,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  generateId,
  delegationKind,
  delegationState,
  agreementState,
  TenantId,
} from "pagopa-interop-models";
import { describe, beforeEach, it, expect } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEservice,
  addOneTenant,
  delegationService,
} from "./utils.js";

describe("getConsumerDelegatorsWithAgreements", () => {
  const delegator1 = { ...getMockTenant(), name: "Comune di Burione" };
  const delegator2 = { ...getMockTenant(), name: "Comune di Milano" };
  const delegator3 = { ...getMockTenant(), name: "DeleganteTre" };
  const delegator4 = { ...getMockTenant(), name: "DeleganteQuattro" };
  const delegator5 = { ...getMockTenant(), name: "PagoPA" };
  const delegator6 = getMockTenant();
  const requesterId = generateId<TenantId>();
  const eservice1 = getMockEService();
  const eservice2 = getMockEService();
  const eservice3 = getMockEService();

  const mockDelegation1 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegator1.id,
    eserviceId: eservice1.id,
  });

  const mockAgreement1 = {
    ...getMockAgreement(eservice1.id, delegator1.id, agreementState.active),
    producerId: eservice1.producerId,
  };

  const mockDelegation1Bis = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegator1.id,
    eserviceId: eservice2.id,
  });

  const mockAgreement1bis = {
    ...getMockAgreement(eservice2.id, delegator1.id, agreementState.active),
    producerId: eservice2.producerId,
  };

  // Delegator1 has 2 active delegations and 2 active agreements

  const mockDelegation2 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegator2.id,
    eserviceId: eservice1.id,
  });

  const mockAgreement2 = {
    ...getMockAgreement(eservice1.id, delegator2.id, agreementState.active),
    producerId: eservice1.producerId,
  };

  // Delegator2 has 1 active delegation and 1 active agreement

  const mockDelegation3 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.rejected,
    delegateId: requesterId,
    delegatorId: delegator3.id,
    eserviceId: eservice1.id,
  });

  // Delegator3 has 1 rejected delegation

  const mockDelegation4 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegator4.id,
    eserviceId: eservice1.id,
  });

  const mockAgreement4 = {
    ...getMockAgreement(eservice1.id, delegator4.id, agreementState.rejected),
    producerId: eservice1.producerId,
  };

  // Delegator4 has 1 active delegation and 1 rejected agreement

  const mockDelegation5 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegator5.id,
    eserviceId: eservice3.id,
  });

  const mockAgreement5 = {
    ...getMockAgreement(eservice3.id, delegator5.id, agreementState.active),
    producerId: eservice3.producerId,
  };

  // Delegator5 has 1 active delegation and 1 active agreement

  const mockDelegation6 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: generateId<TenantId>(),
    delegatorId: delegator6.id,
    eserviceId: eservice3.id,
  });

  const mockAgreement6 = {
    ...getMockAgreement(eservice3.id, delegator6.id, agreementState.active),
    producerId: eservice3.producerId,
  };

  // Delegator6 has 1 active delegation and 1 active agreement but a different delegateId

  beforeEach(async () => {
    await addOneEservice(eservice1);
    await addOneEservice(eservice2);
    await addOneEservice(eservice3);
    await addOneDelegation(mockDelegation1);
    await addOneDelegation(mockDelegation1Bis);
    await addOneDelegation(mockDelegation2);
    await addOneDelegation(mockDelegation3);
    await addOneDelegation(mockDelegation4);
    await addOneDelegation(mockDelegation5);
    await addOneDelegation(mockDelegation6);
    await addOneTenant(delegator1);
    await addOneTenant(delegator2);
    await addOneTenant(delegator3);
    await addOneTenant(delegator4);
    await addOneTenant(delegator5);
    await addOneTenant(delegator6);
    await addOneAgreement(mockAgreement1);
    await addOneAgreement(mockAgreement1bis);
    await addOneAgreement(mockAgreement2);
    await addOneAgreement(mockAgreement4);
    await addOneAgreement(mockAgreement5);
    await addOneAgreement(mockAgreement6);
  });

  it("should get delegators filtered by delegateId", async () => {
    expect(
      await delegationService.getConsumerDelegatorsWithAgreements(
        {
          requesterId,
          offset: 0,
          limit: 50,
        },
        genericLogger
      )
    ).toEqual({
      results: [
        {
          id: delegator1.id,
          name: delegator1.name,
        },
        {
          id: delegator2.id,
          name: delegator2.name,
        },
        {
          id: delegator5.id,
          name: delegator5.name,
        },
      ],
      totalCount: 3,
    });
  });
  it("should apply offset and limit", async () => {
    expect(
      await delegationService.getConsumerDelegatorsWithAgreements(
        {
          requesterId,
          offset: 1,
          limit: 1,
        },
        genericLogger
      )
    ).toEqual({
      results: [
        {
          id: delegator2.id,
          name: delegator2.name,
        },
      ],
      totalCount: 3,
    });
  });
  it("should filter delegators by the 'delegatorName' parameter", async () => {
    expect(
      await delegationService.getConsumerDelegatorsWithAgreements(
        {
          requesterId,
          offset: 0,
          limit: 50,
          delegatorName: "Comune",
        },
        genericLogger
      )
    ).toEqual({
      results: [
        {
          id: delegator1.id,
          name: delegator1.name,
        },
        {
          id: delegator2.id,
          name: delegator2.name,
        },
      ],
      totalCount: 2,
    });

    expect(
      await delegationService.getConsumerDelegatorsWithAgreements(
        {
          requesterId,
          offset: 0,
          limit: 50,
          delegatorName: "PagoPA",
        },
        genericLogger
      )
    ).toEqual({
      results: [
        {
          id: delegator5.id,
          name: delegator5.name,
        },
      ],
      totalCount: 1,
    });
  });
  it("should return no results if no delegations match the criteria", async () => {
    expect(
      await delegationService.getConsumerDelegatorsWithAgreements(
        {
          requesterId: generateId<TenantId>(),
          offset: 0,
          limit: 50,
        },
        genericLogger
      )
    ).toEqual({
      results: [],
      totalCount: 0,
    });

    expect(
      await delegationService.getConsumerDelegatorsWithAgreements(
        {
          requesterId: delegator3.id, // No active delegation
          offset: 0,
          limit: 50,
        },
        genericLogger
      )
    ).toEqual({
      results: [],
      totalCount: 0,
    });

    expect(
      await delegationService.getConsumerDelegatorsWithAgreements(
        {
          requesterId: delegator4.id, // No active agreements
          offset: 0,
          limit: 50,
        },
        genericLogger
      )
    ).toEqual({
      results: [],
      totalCount: 0,
    });
  });
});
