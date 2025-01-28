/* eslint-disable functional/no-let */
import { genericLogger, AuthData, userRoles } from "pagopa-interop-commons";
import { getMockTenant } from "pagopa-interop-commons-test";
import {
  TenantId,
  EService,
  generateId,
  Descriptor,
  descriptorState,
  eserviceMode,
  Tenant,
  agreementState,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { beforeEach, expect, describe, it } from "vitest";
import { getMockDelegation } from "pagopa-interop-commons-test";
import {
  addOneEService,
  addOneTenant,
  addOneAgreement,
  catalogService,
  getMockAuthData,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
  getMockAgreement,
  getMockEServiceAttributes,
  addOneDelegation,
} from "./utils.js";

describe("get eservices", () => {
  let organizationId1: TenantId;
  let organizationId2: TenantId;
  let organizationId3: TenantId;
  let eservice1: EService;
  let eservice2: EService;
  let eservice3: EService;
  let eservice4: EService;
  let eservice5: EService;
  let eservice6: EService;
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  const attributesForDescriptor1and2 = getMockEServiceAttributes();
  const attributesForDescriptor3 = getMockEServiceAttributes();
  const attributesForDescriptor4 = getMockEServiceAttributes();

  beforeEach(async () => {
    organizationId1 = generateId();
    organizationId2 = generateId();
    organizationId3 = generateId();

    const descriptor1: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      interface: mockDocument,
      state: descriptorState.published,
      attributes: attributesForDescriptor1and2,
    };
    eservice1 = {
      ...mockEService,
      id: generateId(),
      name: "eservice 001 test",
      descriptors: [descriptor1],
      producerId: organizationId1,
      isSignalHubEnabled: true,
      isDelegable: true,
      isClientAccessDelegable: true,
    };
    await addOneEService(eservice1);

    const descriptor2: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      interface: mockDocument,
      state: descriptorState.published,
      attributes: attributesForDescriptor1and2,
    };
    eservice2 = {
      ...mockEService,
      id: generateId(),
      name: "eservice 002 test",
      descriptors: [descriptor2],
      producerId: organizationId1,
    };
    await addOneEService(eservice2);

    const descriptor3: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      interface: mockDocument,
      state: descriptorState.published,
      attributes: attributesForDescriptor3,
    };
    eservice3 = {
      ...mockEService,
      id: generateId(),
      name: "eservice 003 test",
      descriptors: [descriptor3],
      producerId: organizationId1,
    };
    await addOneEService(eservice3);

    const descriptor4: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      interface: mockDocument,
      state: descriptorState.archived,
      attributes: attributesForDescriptor4,
    };
    eservice4 = {
      ...mockEService,
      id: generateId(),
      name: "eservice 004 test",
      producerId: organizationId2,
      descriptors: [descriptor4],
      isDelegable: true,
    };
    await addOneEService(eservice4);

    const descriptor5: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      interface: mockDocument,
      state: descriptorState.published,
    };
    eservice5 = {
      ...mockEService,
      id: generateId(),
      name: "eservice 005 test",
      producerId: organizationId2,
      descriptors: [descriptor5],
    };
    await addOneEService(eservice5);

    const descriptor6: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      interface: mockDocument,
      state: descriptorState.archived,
    };
    eservice6 = {
      ...mockEService,
      id: generateId(),
      name: "eservice 006",
      producerId: organizationId2,
      descriptors: [descriptor6],
      mode: eserviceMode.receive,
    };
    await addOneEService(eservice6);

    const tenant: Tenant = {
      ...getMockTenant(),
      id: organizationId3,
    };
    await addOneTenant(tenant);
    const agreement1 = getMockAgreement({
      eserviceId: eservice1.id,
      descriptorId: descriptor1.id,
      producerId: eservice1.producerId,
      consumerId: tenant.id,
    });
    await addOneAgreement(agreement1);
    const agreement2 = getMockAgreement({
      eserviceId: eservice3.id,
      descriptorId: descriptor3.id,
      producerId: eservice3.producerId,
      consumerId: tenant.id,
    });
    await addOneAgreement(agreement2);
    const agreement3 = {
      ...getMockAgreement({
        eserviceId: eservice4.id,
        descriptorId: descriptor4.id,
        producerId: eservice4.producerId,
        consumerId: tenant.id,
      }),
      state: agreementState.draft,
    };
    await addOneAgreement(agreement3);
  });
  it("should get the eServices if they exist (parameters: eservicesIds)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [eservice1.id, eservice2.id],
        producersIds: [],
        states: [],
        agreementStates: [],
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([eservice1, eservice2]);
  });
  it("should get the eServices if they exist (parameters: producersIds)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [organizationId1],
        states: [],
        agreementStates: [],
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(3);
    expect(result.results).toEqual([eservice1, eservice2, eservice3]);
  });
  it("should get the eServices, including the ones with an active delegation, if they exist (parameters: producersIds)", async () => {
    const delegatedOrganization1 = generateId<TenantId>();
    const delegatedOrganization2 = generateId<TenantId>();

    const delegation1 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      delegateId: delegatedOrganization1,
      eserviceId: eservice4.id,
      state: delegationState.active,
    });
    await addOneDelegation(delegation1);

    const delegation2 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice5.id,
      state: delegationState.active,
      delegateId: delegatedOrganization2,
    });

    await addOneDelegation(delegation2);

    const delegation3 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice6.id,
      state: delegationState.rejected,
      delegateId: delegatedOrganization2,
    });

    await addOneDelegation(delegation3);

    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [
          organizationId1,
          delegatedOrganization1,
          delegatedOrganization2,
        ],
        states: [],
        agreementStates: [],
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(5);
    expect(result.results).toEqual([
      eservice1,
      eservice2,
      eservice3,
      eservice4,
      eservice5,
    ]);
  });
  it("should get the eServices if they exist (parameters: states)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [],
        states: ["Published"],
        agreementStates: [],
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(4);
    expect(result.results).toEqual([
      eservice1,
      eservice2,
      eservice3,
      eservice5,
    ]);
  });
  it("should get the eServices if they exist (parameters: agreementStates)", async () => {
    const result1 = await catalogService.getEServices(
      getMockAuthData(organizationId3),
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: ["Active"],
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );

    const result2 = await catalogService.getEServices(
      getMockAuthData(organizationId3),
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: ["Active", "Draft"],
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );

    expect(result1.totalCount).toBe(2);
    expect(result1.results).toEqual([eservice1, eservice3]);
    expect(result2.totalCount).toBe(3);
    expect(result2.results).toEqual([eservice1, eservice3, eservice4]);
  });
  it("should get the eServices if they exist (parameters: name)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: [],
        name: "test",
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(5);
    expect(result.results).toEqual([
      eservice1,
      eservice2,
      eservice3,
      eservice4,
      eservice5,
    ]);
  });
  it("should get the eServices if they exist (parameters: delegated = true)", async () => {
    const delegatedOrganization1 = generateId<TenantId>();
    const delegatedOrganization2 = generateId<TenantId>();

    const delegation1 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice4.id,
      delegateId: delegatedOrganization1,
      state: delegationState.active,
    });
    await addOneDelegation(delegation1);

    const delegation2 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice5.id,
      delegateId: delegatedOrganization2,
      state: delegationState.waitingForApproval,
    });

    await addOneDelegation(delegation2);

    const delegation3 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice6.id,
      delegateId: delegatedOrganization2,
      state: delegationState.rejected,
    });

    await addOneDelegation(delegation3);

    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: [],
        attributesIds: [],
        delegated: true,
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([eservice4, eservice5]);
  });
  it("should get the eServices if they exist (parameters: delegated = false)", async () => {
    const delegatedOrganization1 = generateId<TenantId>();
    const delegatedOrganization2 = generateId<TenantId>();

    const delegation1 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice4.id,
      delegateId: delegatedOrganization1,
      state: delegationState.active,
    });
    await addOneDelegation(delegation1);

    const delegation2 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice5.id,
      delegateId: delegatedOrganization2,
      state: delegationState.waitingForApproval,
    });

    await addOneDelegation(delegation2);

    const delegation3 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice6.id,
      delegateId: delegatedOrganization2,
      state: delegationState.rejected,
    });

    await addOneDelegation(delegation3);

    const delegation4 = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice6.id,
      delegateId: delegatedOrganization2,
      state: delegationState.active,
    });

    await addOneDelegation(delegation4);

    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: [],
        attributesIds: [],
        delegated: false,
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(4);
    expect(result.results).toEqual([
      eservice1,
      eservice2,
      eservice3,
      eservice6,
    ]);
  });
  it("should get the eServices if they exist (parameters: statestates, name)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(organizationId3),
      {
        eservicesIds: [],
        producersIds: [],
        states: ["Published"],
        agreementStates: ["Active"],
        name: "test",
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([eservice1, eservice3]);
  });
  it("should not get the eServices if they don't exist (parameters: statestates, name)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [],
        states: ["Archived"],
        agreementStates: ["Active"],
        name: "test",
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(0);
    expect(result.results).toEqual([]);
  });
  it("should get the eServices if they exist (parameters: producersIds, states, name)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [organizationId2],
        states: ["Published"],
        agreementStates: [],
        name: "test",
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([eservice5]);
  });
  it("should get the eServices, including the ones with an active delegation, if they exist (parameters: producersIds, states, name)", async () => {
    const delegatedOrganization1: TenantId = generateId();
    const delegatedOrganization2: TenantId = generateId();

    const delegatedEService1: EService = {
      ...mockEService,
      id: generateId(),
      name: "delegated eservice 1 test",
      producerId: organizationId1,
      descriptors: [
        {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          state: descriptorState.published,
        },
      ],
    };

    const delegatedEService2: EService = {
      ...mockEService,
      id: generateId(),
      name: "delegated eservice 2",
      producerId: organizationId1,
      descriptors: [
        {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          state: descriptorState.published,
        },
      ],
    };

    const delegatedEService3: EService = {
      ...mockEService,
      id: generateId(),
      name: "delegated eservice 3 test",
      producerId: organizationId1,
      descriptors: [
        {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.draft,
        },
      ],
    };

    const delegatedEService4: EService = {
      ...mockEService,
      id: generateId(),
      name: "delegated eservice 4 test",
      producerId: organizationId1,
      descriptors: [
        {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.published,
        },
      ],
    };

    const delegatedEService5: EService = {
      ...mockEService,
      id: generateId(),
      name: "delegated eservice 5 test",
      producerId: organizationId1,
      descriptors: [
        {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.published,
        },
      ],
    };

    await addOneEService(delegatedEService1);
    await addOneEService(delegatedEService2);
    await addOneEService(delegatedEService3);
    await addOneEService(delegatedEService4);
    await addOneEService(delegatedEService5);

    const delegation1 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: delegatedEService1.id,
      delegateId: delegatedOrganization1,
      state: delegationState.active,
    });
    await addOneDelegation(delegation1);

    const delegation2 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: delegatedEService2.id,
      delegateId: delegatedOrganization1,
      state: delegationState.active,
    });

    await addOneDelegation(delegation2);

    const delegation3 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: delegatedEService3.id,
      delegateId: delegatedOrganization1,
      state: delegationState.active,
    });

    await addOneDelegation(delegation3);

    const delegation4 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: delegatedEService4.id,
      delegateId: delegatedOrganization2,
      state: delegationState.active,
    });

    await addOneDelegation(delegation4);

    const delegation5 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: delegatedEService5.id,
      delegateId: delegatedOrganization2,
      state: delegationState.waitingForApproval,
    });

    await addOneDelegation(delegation5);

    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [
          organizationId2,
          delegatedOrganization1,
          delegatedOrganization2,
        ],
        states: ["Published"],
        agreementStates: [],
        name: "test",
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(3);
    expect(result.results).toEqual([
      delegatedEService1,
      delegatedEService4,
      eservice5,
    ]);
  });
  it("should not get the eServices if they don't exist (parameters: producersIds, states, name)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [organizationId2],
        states: ["Published"],
        agreementStates: [],
        name: "not-existing",
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(0);
    expect(result.results).toEqual([]);
  });
  it("should get the eServices if they exist (pagination: limit)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: [],
        attributesIds: [],
      },
      0,
      5,
      genericLogger
    );
    expect(result.totalCount).toBe(6);
    expect(result.results.length).toBe(5);
  });
  it("should get the eServices if they exist (pagination: offset, limit)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: [],
        attributesIds: [],
      },
      5,
      5,
      genericLogger
    );
    expect(result.totalCount).toBe(6);
    expect(result.results.length).toBe(1);
  });
  it("should get the eServices if they exist (parameters: attributesIds)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: [],
        attributesIds: [
          attributesForDescriptor1and2.certified[0][0].id,
          attributesForDescriptor3.declared[0][1].id,
          attributesForDescriptor4.verified[0][1].id,
        ],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(4);
    expect(result.results).toEqual([
      eservice1,
      eservice2,
      eservice3,
      eservice4,
    ]);
  });

  it("should get the eServices if they exist (parameters: mode)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: [],
        attributesIds: [],
        mode: eserviceMode.receive,
      },
      0,
      50,
      genericLogger
    );
    expect(result).toEqual({
      totalCount: 1,
      results: [eservice6],
    });
  });

  it("should get the eServices if they exist (parameters: isDelegable)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: [],
        attributesIds: [],
        isDelegable: true,
      },
      0,
      50,
      genericLogger
    );
    expect(result).toEqual({
      totalCount: 2,
      results: [eservice1, eservice4],
    });
  });

  it("should get the eServices if they exist (parameters: producersIds, mode)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [organizationId2],
        states: [],
        agreementStates: [],
        attributesIds: [],
        mode: eserviceMode.deliver,
      },
      0,
      50,
      genericLogger
    );
    expect(result).toEqual({
      totalCount: 2,
      results: [eservice4, eservice5],
    });
  });

  it("should get the eServices if they exist (parameters: producersIds, mode, delegated = true)", async () => {
    const delegation1 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice4.id,
      delegateId: organizationId3,
      state: delegationState.active,
    });
    await addOneDelegation(delegation1);

    const delegation2 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice4.id,
      delegateId: organizationId3,
      state: delegationState.active,
    });

    await addOneDelegation(delegation2);

    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [organizationId2],
        states: [],
        agreementStates: [],
        attributesIds: [],
        mode: eserviceMode.deliver,
        delegated: true,
      },
      0,
      50,
      genericLogger
    );
    expect(result).toEqual({
      totalCount: 1,
      results: [eservice4],
    });
  });

  it("should get the eServices, including the ones with an active delegation, if they exist (parameters: producersIds, mode)", async () => {
    const delegatedOrganization1: TenantId = generateId();
    const delegatedOrganization2: TenantId = generateId();

    const delegatedEService1: EService = {
      ...mockEService,
      id: generateId(),
      name: "delegated eservice 1",
      producerId: organizationId1,
      mode: eserviceMode.deliver,
      descriptors: [
        {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.published,
        },
      ],
    };

    const delegatedEService2: EService = {
      ...mockEService,
      id: generateId(),
      name: "delegated eservice 2",
      producerId: organizationId1,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.published,
        },
      ],
    };

    const delegatedEService3: EService = {
      ...mockEService,
      id: generateId(),
      name: "delegated eservice 3",
      producerId: organizationId1,
      mode: eserviceMode.deliver,
      descriptors: [
        {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.published,
        },
      ],
    };

    const delegatedEService4: EService = {
      ...mockEService,
      id: generateId(),
      name: "delegated eservice 4",
      producerId: organizationId1,
      mode: eserviceMode.deliver,
      descriptors: [
        {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.published,
        },
      ],
    };

    await addOneEService(delegatedEService1);
    await addOneEService(delegatedEService2);
    await addOneEService(delegatedEService3);
    await addOneEService(delegatedEService4);

    const delegation1 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: delegatedEService1.id,
      delegateId: delegatedOrganization1,
      state: delegationState.active,
    });
    await addOneDelegation(delegation1);

    const delegation2 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: delegatedEService2.id,
      delegateId: delegatedOrganization1,
      state: delegationState.active,
    });
    await addOneDelegation(delegation2);

    const delegation3 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: delegatedEService3.id,
      delegateId: delegatedOrganization2,
      state: delegationState.active,
    });
    await addOneDelegation(delegation3);

    const delegation4 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: delegatedEService4.id,
      delegateId: delegatedOrganization2,
      state: delegationState.rejected,
    });
    await addOneDelegation(delegation4);

    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [
          organizationId2,
          delegatedOrganization1,
          delegatedOrganization2,
        ],
        states: [],
        agreementStates: [],
        attributesIds: [],
        mode: eserviceMode.deliver,
      },
      0,
      50,
      genericLogger
    );
    expect(result).toEqual({
      totalCount: 4,
      results: [delegatedEService1, delegatedEService3, eservice4, eservice5],
    });
  });

  it("should not get the eServices if they don't exist  (parameters: attributesIds)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: [],
        attributesIds: [generateId()],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(0);
    expect(result.results).toEqual([]);
  });

  it("should get the eServices if they exist (parameters: attributesIds, name)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: [],
        name: eservice1.name.slice(-6),
        attributesIds: [attributesForDescriptor1and2.verified[0][1].id],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([eservice1]);
  });

  it("should get the eServices if they exist (parameters: attributesIds, states)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(),
      {
        eservicesIds: [],
        producersIds: [],
        states: ["Archived"],
        agreementStates: [],
        attributesIds: [
          attributesForDescriptor1and2.certified[0][0].id,
          attributesForDescriptor4.verified[0][1].id,
        ],
      },
      0,
      50,
      genericLogger
    );

    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([eservice4]);
  });

  it("should get the eServices if they exist (parameters: attributesIdstates, producersIds)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(organizationId3),
      {
        eservicesIds: [],
        producersIds: [organizationId1],
        states: [],
        agreementStates: ["Active"],
        attributesIds: [attributesForDescriptor1and2.certified[0][0].id],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([eservice1]);
  });

  it("should get the eServices if they exist (parameters: attributesIdstates, eservicesIds)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(organizationId3),
      {
        eservicesIds: [eservice1.id, eservice4.id],
        producersIds: [organizationId1, organizationId2],
        states: [],
        agreementStates: ["Active", "Draft"],
        attributesIds: [
          attributesForDescriptor1and2.certified[0][0].id,
          attributesForDescriptor4.verified[0][1].id,
        ],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([eservice1, eservice4]);
  });

  it("should not get the eServices if they don't exist (parameters: attributesIdstates)", async () => {
    const result = await catalogService.getEServices(
      getMockAuthData(organizationId3),
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: ["Draft"],
        attributesIds: [attributesForDescriptor1and2.certified[0][0].id],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(0);
    expect(result.results).toEqual([]);
  });

  it("should include eservices with no descriptors (requester is the producer, admin)", async () => {
    const eservice7: EService = {
      ...mockEService,
      id: generateId(),
      name: "eservice 007",
      producerId: organizationId1,
      descriptors: [],
    };
    const authData: AuthData = {
      ...getMockAuthData(organizationId1),
      userRoles: [userRoles.ADMIN_ROLE],
    };
    await addOneEService(eservice7);
    const result = await catalogService.getEServices(
      authData,
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: [],
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(7);
    expect(result.results).toEqual([
      eservice1,
      eservice2,
      eservice3,
      eservice4,
      eservice5,
      eservice6,
      eservice7,
    ]);
  });
  it("should not include eservices with no descriptors (requester is the producer, not admin nor api, nor support)", async () => {
    const eservice7: EService = {
      ...mockEService,
      id: generateId(),
      name: "eservice 007",
      producerId: organizationId1,
      descriptors: [],
    };
    const authData: AuthData = {
      ...getMockAuthData(organizationId1),
      userRoles: [userRoles.SECURITY_ROLE],
    };
    await addOneEService(eservice7);
    const result = await catalogService.getEServices(
      authData,
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: [],
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(6);
    expect(result.results).toEqual([
      eservice1,
      eservice2,
      eservice3,
      eservice4,
      eservice5,
      eservice6,
    ]);
  });
  it("should not include eservices with no descriptors (requester is not the producer)", async () => {
    const eservice7: EService = {
      ...mockEService,
      id: generateId(),
      producerId: organizationId1,
      name: "eservice 007",
      descriptors: [],
    };
    const authData: AuthData = {
      ...getMockAuthData(),
      userRoles: [userRoles.ADMIN_ROLE],
    };
    await addOneEService(eservice7);
    const result = await catalogService.getEServices(
      authData,
      {
        eservicesIds: [],
        producersIds: [],
        states: [],
        agreementStates: [],
        attributesIds: [],
      },
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(6);
    expect(result.results).toEqual([
      eservice1,
      eservice2,
      eservice3,
      eservice4,
      eservice5,
      eservice6,
    ]);
  });
  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should include eservices whose only descriptor is %s (requester is the producer, admin)",
    async (state) => {
      const descriptor8: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        state,
      };
      const eservice8: EService = {
        ...mockEService,
        id: generateId(),
        name: "eservice 008",
        producerId: organizationId1,
        descriptors: [descriptor8],
      };
      const authData: AuthData = {
        ...getMockAuthData(organizationId1),
        userRoles: [userRoles.ADMIN_ROLE],
      };
      await addOneEService(eservice8);
      const result = await catalogService.getEServices(
        authData,
        {
          eservicesIds: [],
          producersIds: [],
          states: [],
          agreementStates: [],
          attributesIds: [],
        },
        0,
        50,
        genericLogger
      );
      expect(result.totalCount).toBe(7);
      expect(result.results).toEqual([
        eservice1,
        eservice2,
        eservice3,
        eservice4,
        eservice5,
        eservice6,
        eservice8,
      ]);
    }
  );
  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should include eservices whose only descriptor is %s (requester is delegate, admin)",
    async (state) => {
      const descriptor9: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        interface: mockDocument,
        publishedAt: new Date(),
        state,
      };
      const eservice9: EService = {
        ...mockEService,
        id: generateId(),
        name: "eservice 008",
        producerId: organizationId1,
        descriptors: [descriptor9],
      };
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegateId: organizationId2,
        eserviceId: eservice9.id,
        state: delegationState.active,
      });
      const authData: AuthData = {
        ...getMockAuthData(organizationId2),
        userRoles: [userRoles.ADMIN_ROLE],
      };
      await addOneEService(eservice9);
      await addOneDelegation(delegation);
      const result = await catalogService.getEServices(
        authData,
        {
          eservicesIds: [],
          producersIds: [],
          states: [],
          agreementStates: [],
          attributesIds: [],
        },
        0,
        50,
        genericLogger
      );
      expect(result.totalCount).toBe(7);
      expect(result.results).toEqual([
        eservice1,
        eservice2,
        eservice3,
        eservice4,
        eservice5,
        eservice6,
        eservice9,
      ]);
    }
  );
  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should not include eservices whose only descriptor is %s (requester is the producer, not admin nor api, nor support)",
    async (state) => {
      const descriptor8: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        state,
      };
      const eservice8: EService = {
        ...mockEService,
        id: generateId(),
        name: "eservice 008",
        producerId: organizationId1,
        descriptors: [descriptor8],
      };
      const authData: AuthData = {
        ...getMockAuthData(organizationId1),
        userRoles: [userRoles.SECURITY_ROLE],
      };
      await addOneEService(eservice8);
      const result = await catalogService.getEServices(
        authData,
        {
          eservicesIds: [],
          producersIds: [],
          states: [],
          agreementStates: [],
          attributesIds: [],
        },
        0,
        50,
        genericLogger
      );
      expect(result.totalCount).toBe(6);
      expect(result.results).toEqual([
        eservice1,
        eservice2,
        eservice3,
        eservice4,
        eservice5,
        eservice6,
      ]);
    }
  );
  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should not include eservices whose only descriptor is %s (requester is not the producer)",
    async (state) => {
      const descriptor8: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        state,
      };
      const eservice8: EService = {
        ...mockEService,
        id: generateId(),
        name: "eservice 008",
        producerId: organizationId1,
        descriptors: [descriptor8],
      };
      const authData: AuthData = {
        ...getMockAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };
      await addOneEService(eservice8);
      const result = await catalogService.getEServices(
        authData,
        {
          eservicesIds: [],
          producersIds: [],
          states: [],
          agreementStates: [],
          attributesIds: [],
        },
        0,
        50,
        genericLogger
      );
      expect(result.totalCount).toBe(6);
      expect(result.results).toEqual([
        eservice1,
        eservice2,
        eservice3,
        eservice4,
        eservice5,
        eservice6,
      ]);
    }
  );
  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should not filter out %s descriptors if the eservice has both of that state and not (requester is the producer, admin)",
    async (state) => {
      const descriptor9a: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        interface: mockDocument,
        publishedAt: new Date(),
        state: descriptorState.published,
      };
      const descriptor9b: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        version: "2",
        state,
      };
      const eservice9: EService = {
        ...mockEService,
        id: generateId(),
        name: "eservice 008",
        producerId: organizationId1,
        descriptors: [descriptor9a, descriptor9b],
      };
      const authData: AuthData = {
        ...getMockAuthData(organizationId1),
        userRoles: [userRoles.ADMIN_ROLE],
      };
      await addOneEService(eservice9);
      const result = await catalogService.getEServices(
        authData,
        {
          eservicesIds: [],
          producersIds: [],
          states: [],
          agreementStates: [],
          attributesIds: [],
        },
        0,
        50,
        genericLogger
      );
      expect(result.totalCount).toBe(7);
      expect(result.results).toEqual([
        eservice1,
        eservice2,
        eservice3,
        eservice4,
        eservice5,
        eservice6,
        eservice9,
      ]);
    }
  );
  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should filter out %s descriptors if the eservice has both of that state and not (requester is the producer, but not admin nor api, nor support)",
    async (state) => {
      const descriptor9a: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        interface: mockDocument,
        publishedAt: new Date(),
        state: descriptorState.published,
      };
      const descriptor9b: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        version: "2",
        state,
      };
      const eservice9: EService = {
        ...mockEService,
        id: generateId(),
        name: "eservice 008",
        producerId: organizationId1,
        descriptors: [descriptor9a, descriptor9b],
      };
      const authData: AuthData = {
        ...getMockAuthData(organizationId1),
        userRoles: [userRoles.SECURITY_ROLE],
      };
      await addOneEService(eservice9);
      const result = await catalogService.getEServices(
        authData,
        {
          eservicesIds: [],
          producersIds: [],
          states: [],
          agreementStates: [],
          attributesIds: [],
        },
        0,
        50,
        genericLogger
      );
      expect(result.totalCount).toBe(7);
      expect(result.results).toEqual([
        eservice1,
        eservice2,
        eservice3,
        eservice4,
        eservice5,
        eservice6,
        { ...eservice9, descriptors: [descriptor9a] },
      ]);
    }
  );
  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should filter out %s descriptors if the eservice has both of that state and not (requester is not the producer)",
    async (state) => {
      const descriptor9a: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        interface: mockDocument,
        publishedAt: new Date(),
        state: descriptorState.published,
      };
      const descriptor9b: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        version: "2",
        state,
      };
      const eservice9: EService = {
        ...mockEService,
        id: generateId(),
        name: "eservice 008",
        producerId: organizationId1,
        descriptors: [descriptor9a, descriptor9b],
      };
      const authData: AuthData = {
        ...getMockAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };
      await addOneEService(eservice9);
      const result = await catalogService.getEServices(
        authData,
        {
          eservicesIds: [],
          producersIds: [],
          states: [],
          agreementStates: [],
          attributesIds: [],
        },
        0,
        50,
        genericLogger
      );
      expect(result.totalCount).toBe(7);
      expect(result.results).toEqual([
        eservice1,
        eservice2,
        eservice3,
        eservice4,
        eservice5,
        eservice6,
        { ...eservice9, descriptors: [descriptor9a] },
      ]);
    }
  );
  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should not filter out %s descriptors if the eservice has both of that state and not (requester is delegate, admin)",
    async (state) => {
      const descriptor9a: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        interface: mockDocument,
        publishedAt: new Date(),
        state: descriptorState.published,
      };
      const descriptor9b: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        version: "2",
        state,
      };
      const eservice9: EService = {
        ...mockEService,
        id: generateId(),
        name: "eservice 008",
        producerId: organizationId1,
        descriptors: [descriptor9a, descriptor9b],
      };
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegateId: organizationId2,
        eserviceId: eservice9.id,
        state: delegationState.active,
      });
      const authData: AuthData = {
        ...getMockAuthData(organizationId2),
        userRoles: [userRoles.ADMIN_ROLE],
      };
      await addOneEService(eservice9);
      await addOneDelegation(delegation);
      const result = await catalogService.getEServices(
        authData,
        {
          eservicesIds: [],
          producersIds: [],
          states: [],
          agreementStates: [],
          attributesIds: [],
        },
        0,
        50,
        genericLogger
      );
      expect(result.totalCount).toBe(7);
      expect(result.results).toEqual([
        eservice1,
        eservice2,
        eservice3,
        eservice4,
        eservice5,
        eservice6,
        eservice9,
      ]);
    }
  );
});
