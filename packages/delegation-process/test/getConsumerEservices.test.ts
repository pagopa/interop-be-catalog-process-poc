/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockAgreement,
  getMockDelegation,
  getMockEService,
  randomArrayItem,
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
import { requesterIsNotConsumerDelegate } from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEservice,
  delegationService,
} from "./utils.js";

describe("getConsumerEservices", () => {
  const delegatorId1 = generateId<TenantId>();
  const delegatorId2 = generateId<TenantId>();

  const requesterId = generateId<TenantId>();

  const eservice1 = { ...getMockEService(), name: "Servizio 1" };
  const eservice2 = { ...getMockEService(), name: "Servizio 2" };
  const eservice3 = { ...getMockEService(), name: "PagoPaService" };
  const eservice4 = { ...getMockEService(), name: "Pippo" };
  const eservice5 = { ...getMockEService(), name: "Paperino" };
  const eservice6 = getMockEService();

  const agreementInvalidStates = Object.values(agreementState).filter(
    (state) => state !== agreementState.active
  );

  const delegationInvalidStates = Object.values(delegationState).filter(
    (state) => state !== delegationState.active
  );

  const delegationDelegator1Eservice1 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegatorId1,
    eserviceId: eservice1.id,
  });

  const agreementDelegator1Eservice1 = {
    ...getMockAgreement(eservice1.id, delegatorId1, agreementState.active),
    producerId: eservice1.producerId,
  };

  const delegationDelegator1Eservice2 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegatorId1,
    eserviceId: eservice2.id,
  });

  const agreementDelegator1Eservice2 = {
    ...getMockAgreement(eservice2.id, delegatorId1, agreementState.active),
    producerId: eservice2.producerId,
  };

  const delegationDelegator1Eservice3 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegatorId1,
    eserviceId: eservice3.id,
  });

  const agreementDelegator1Eservice3 = {
    ...getMockAgreement(eservice3.id, delegatorId1, agreementState.active),
    producerId: eservice3.producerId,
  };

  const delegationDelegator1Eservice4 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegatorId1,
    eserviceId: eservice4.id,
  });

  const agreementDelegator1Eservice4 = {
    ...getMockAgreement(eservice4.id, delegatorId1, agreementState.active),
    producerId: eservice4.producerId,
  };

  const invalidDelegationDelegator1Eservice5 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: randomArrayItem(delegationInvalidStates),
    delegateId: requesterId,
    delegatorId: delegatorId1,
    eserviceId: eservice5.id,
  });

  const agreementDelegator1Eservice5 = {
    ...getMockAgreement(eservice5.id, delegatorId1, agreementState.active),
    producerId: eservice5.producerId,
  };

  const delegationDelegator1Eservice6 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegatorId1,
    eserviceId: eservice6.id,
  });

  const invalidAgreementDelegator1Eservice6 = {
    ...getMockAgreement(
      eservice6.id,
      delegatorId1,
      randomArrayItem(agreementInvalidStates)
    ),
    producerId: eservice6.producerId,
  };

  // Delegator1 and Requester have 4 active delegations with 4 active agreements, 1 invalid delegation and 1 invalid agreement

  const delegationDelegator2Eservice1 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegatorId2,
    eserviceId: eservice1.id,
  });

  const agreementDelegator2Eservice1 = {
    ...getMockAgreement(eservice1.id, delegatorId2, agreementState.active),
    producerId: eservice1.producerId,
  };

  // Delegator2 and delegate1 have 1 active delegation and 1 active agreement

  const delegationDelegator1Delegate2Eservice1 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: generateId<TenantId>(),
    delegatorId: delegatorId1,
    eserviceId: eservice1.id,
  });

  const agreementDelegator1Delegate2Eservice1 = {
    ...getMockAgreement(eservice1.id, delegatorId1, agreementState.active),
    producerId: eservice1.producerId,
  };

  // Delegator1 and another tenant have 1 active delegation and 1 active agreement

  beforeEach(async () => {
    await addOneEservice(eservice1);
    await addOneEservice(eservice2);
    await addOneEservice(eservice3);
    await addOneEservice(eservice4);
    await addOneEservice(eservice5);
    await addOneEservice(eservice6);
    await addOneDelegation(delegationDelegator1Eservice1);
    await addOneDelegation(delegationDelegator1Eservice2);
    await addOneDelegation(delegationDelegator1Eservice3);
    await addOneDelegation(delegationDelegator1Eservice4);
    await addOneDelegation(invalidDelegationDelegator1Eservice5);
    await addOneDelegation(delegationDelegator1Eservice6);
    await addOneDelegation(delegationDelegator1Delegate2Eservice1);
    await addOneDelegation(delegationDelegator2Eservice1);
    await addOneAgreement(agreementDelegator1Eservice1);
    await addOneAgreement(agreementDelegator1Eservice2);
    await addOneAgreement(agreementDelegator1Eservice3);
    await addOneAgreement(agreementDelegator1Eservice4);
    await addOneAgreement(agreementDelegator1Eservice5);
    await addOneAgreement(invalidAgreementDelegator1Eservice6);
    await addOneAgreement(agreementDelegator2Eservice1);
    await addOneAgreement(agreementDelegator1Delegate2Eservice1);
  });

  it("should apply offset and limit", async () => {
    expect(
      await delegationService.getConsumerEservices(
        {
          delegatorId: delegatorId1,
          requesterId,
          offset: 1,
          limit: 1,
        },
        genericLogger
      )
    ).toEqual({
      results: [
        {
          name: eservice4.name,
          id: eservice4.id,
          producerId: eservice4.producerId,
        },
      ],
      totalCount: 4,
    });
  });
  it("should filter eservices by the 'eserviceName' parameter", async () => {
    expect(
      await delegationService.getConsumerEservices(
        {
          delegatorId: delegatorId1,
          requesterId,
          eserviceName: "servizio",
          offset: 0,
          limit: 50,
        },
        genericLogger
      )
    ).toEqual({
      results: [
        {
          name: eservice1.name,
          id: eservice1.id,
          producerId: eservice1.producerId,
        },
        {
          name: eservice2.name,
          id: eservice2.id,
          producerId: eservice2.producerId,
        },
      ],
      totalCount: 2,
    });

    expect(
      await delegationService.getConsumerEservices(
        {
          delegatorId: delegatorId1,
          requesterId,
          eserviceName: "pippo",
          offset: 0,
          limit: 50,
        },
        genericLogger
      )
    ).toEqual({
      results: [
        {
          name: eservice4.name,
          id: eservice4.id,
          producerId: eservice4.producerId,
        },
      ],
      totalCount: 1,
    });
  });
  it("should throw requesterIsNotConsumerDelegate if the requester is not a consumer delegate of the delegator", async () => {
    const invalidRequesterId = generateId<TenantId>();

    expect(
      delegationService.getConsumerEservices(
        {
          delegatorId: delegatorId1,
          requesterId: invalidRequesterId,
          offset: 0,
          limit: 50,
        },
        genericLogger
      )
    ).rejects.toThrowError(
      requesterIsNotConsumerDelegate(invalidRequesterId, delegatorId1)
    );
  });
});
