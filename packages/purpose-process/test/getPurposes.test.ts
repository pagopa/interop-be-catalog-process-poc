import {
  EService,
  EServiceId,
  Purpose,
  TenantId,
  delegationKind,
  delegationState,
  generateId,
  purposeVersionState,
  tenantKind,
  toReadModelEService,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getMockPurposeVersion,
  getMockPurpose,
  writeInReadmodel,
  getMockValidRiskAnalysisForm,
  getMockDelegation,
  getMockTenant,
} from "pagopa-interop-commons-test/index.js";
import { genericLogger } from "pagopa-interop-commons";
import {
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  eservices,
  getMockEService,
  purposeService,
  purposes,
} from "./utils.js";

describe("getPurposes", async () => {
  const producerId1: TenantId = generateId();
  const producerId2: TenantId = generateId();
  const consumerId1: TenantId = generateId();
  const delegateId: TenantId = generateId();

  const mockEService1ByTenant1: EService = {
    ...getMockEService(),
    producerId: producerId1,
    name: "eService 1",
  };

  const mockEService2ByTenant1: EService = {
    ...getMockEService(),
    producerId: producerId1,
    name: "eService 2",
  };

  const mockEService3ByTenant2: EService = {
    ...getMockEService(),
    producerId: producerId2,
    name: "eService 3",
  };

  const mockEService4 = getMockEService();

  const mockPurpose1: Purpose = {
    ...getMockPurpose(),
    title: "purpose 1 - test",
    consumerId: consumerId1,
    eserviceId: mockEService1ByTenant1.id,
    versions: [getMockPurposeVersion(purposeVersionState.draft)],
  };

  const mockPurpose2: Purpose = {
    ...getMockPurpose(),
    title: "purpose 2",
    eserviceId: mockEService1ByTenant1.id,
    versions: [getMockPurposeVersion(purposeVersionState.draft)],
  };

  const mockPurpose3: Purpose = {
    ...getMockPurpose(),
    title: "purpose 3",
    eserviceId: mockEService2ByTenant1.id,
    versions: [getMockPurposeVersion(purposeVersionState.active)],
  };

  const mockPurpose4: Purpose = {
    ...getMockPurpose(),
    title: "purpose 4",
    eserviceId: mockEService3ByTenant2.id,
    versions: [getMockPurposeVersion(purposeVersionState.rejected)],
  };

  const mockPurpose5: Purpose = {
    ...getMockPurpose(),
    title: "purpose 5",
    consumerId: consumerId1,
    eserviceId: mockEService4.id,
    versions: [getMockPurposeVersion(purposeVersionState.rejected)],
  };

  const mockPurpose6: Purpose = {
    ...getMockPurpose(),
    title: "purpose 6 - test",
    consumerId: consumerId1,
    eserviceId: mockEService3ByTenant2.id,
    versions: [
      getMockPurposeVersion(purposeVersionState.archived),
      getMockPurposeVersion(purposeVersionState.active),
    ],
  };

  const mockPurpose7: Purpose = {
    ...getMockPurpose(),
    title: "purpose 7 - test",
    versions: [],
    eserviceId: mockEService4.id,
  };

  beforeEach(async () => {
    await addOnePurpose(mockPurpose1);
    await addOnePurpose(mockPurpose2);
    await addOnePurpose(mockPurpose3);
    await addOnePurpose(mockPurpose4);
    await addOnePurpose(mockPurpose5);
    await addOnePurpose(mockPurpose6);
    await addOnePurpose(mockPurpose7);

    await writeInReadmodel(
      toReadModelEService(mockEService1ByTenant1),
      eservices
    );
    await writeInReadmodel(
      toReadModelEService(mockEService2ByTenant1),
      eservices
    );
    await writeInReadmodel(
      toReadModelEService(mockEService3ByTenant2),
      eservices
    );
    await writeInReadmodel(toReadModelEService(mockEService4), eservices);
  });

  it("should get the purposes if they exist (parameters: name)", async () => {
    const result = await purposeService.getPurposes(
      producerId1,
      {
        title: "test",
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(3);
    expect(result.results).toEqual([mockPurpose1, mockPurpose6, mockPurpose7]);
  });
  it("should get the purposes if they exist (parameters: eservicesIds)", async () => {
    const result = await purposeService.getPurposes(
      producerId1,
      {
        eservicesIds: [mockEService1ByTenant1.id],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([mockPurpose1, mockPurpose2]);
  });
  it("should get the purposes if they exist (parameters: consumersIds)", async () => {
    const result = await purposeService.getPurposes(
      producerId1,
      {
        eservicesIds: [],
        consumersIds: [consumerId1],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(3);
    expect(result.results).toEqual([mockPurpose1, mockPurpose5, mockPurpose6]);
  });
  it("should get the purposes if they exist (parameters: eservicesIds, producerIds)", async () => {
    const result = await purposeService.getPurposes(
      producerId1,
      {
        eservicesIds: [mockEService1ByTenant1.id],
        consumersIds: [],
        producersIds: [producerId1, producerId2],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([mockPurpose1, mockPurpose2]);
  });
  it("should get the purposes if they exist (parameters: producersIds)", async () => {
    const result = await purposeService.getPurposes(
      producerId1,
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [producerId2],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([mockPurpose4, mockPurpose6]);
  });
  it("should get the purposes if they exist (parameters: states)", async () => {
    const result = await purposeService.getPurposes(
      producerId1,
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [purposeVersionState.rejected, purposeVersionState.active],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(4);
    expect(result.results).toEqual([
      mockPurpose3,
      mockPurpose4,
      mockPurpose5,
      mockPurpose6,
    ]);
  });
  it("should get the purposes if they exist (parameters: states, archived and non-archived)", async () => {
    const result = await purposeService.getPurposes(
      producerId1,
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [
          purposeVersionState.archived,
          purposeVersionState.active,
          purposeVersionState.rejected,
        ],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(4);
    expect(result.results).toEqual([
      mockPurpose3,
      mockPurpose4,
      mockPurpose5,
      mockPurpose6,
    ]);
  });
  it("should get the purposes with only archived versions (and exclude the ones with both archived and non-archived versions)", async () => {
    const mockArchivedPurpose: Purpose = {
      ...getMockPurpose(),
      title: "archived purpose",
      eserviceId: mockEService1ByTenant1.id,
      versions: [getMockPurposeVersion(purposeVersionState.archived)],
    };

    const mockArchivedAndActivePurpose: Purpose = {
      ...getMockPurpose(),
      title: "archived and active purpose",
      eserviceId: mockEService1ByTenant1.id,
      versions: [
        getMockPurposeVersion(purposeVersionState.archived),
        getMockPurposeVersion(purposeVersionState.active),
      ],
    };

    await addOnePurpose(mockArchivedPurpose);
    await addOnePurpose(mockArchivedAndActivePurpose);

    const result = await purposeService.getPurposes(
      producerId1,
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [purposeVersionState.archived],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([mockArchivedPurpose]);
  });
  it("should not include purpose without versions or with one draft version (excludeDraft = true)", async () => {
    const result = await purposeService.getPurposes(
      producerId1,
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: true,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(4);
    expect(result.results).toEqual([
      mockPurpose3,
      mockPurpose4,
      mockPurpose5,
      mockPurpose6,
    ]);
  });
  it("should include purpose without versions or with one draft version (excludeDraft = false)", async () => {
    const result = await purposeService.getPurposes(
      producerId1,
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: false,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(7);
    expect(result.results).toEqual([
      mockPurpose1,
      mockPurpose2,
      mockPurpose3,
      mockPurpose4,
      mockPurpose5,
      mockPurpose6,
      mockPurpose7,
    ]);
  });
  it("should get the purposes if they exist (pagination: offset)", async () => {
    const result = await purposeService.getPurposes(
      producerId1,
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 5, limit: 50 },
      genericLogger
    );
    expect(result.results).toEqual([mockPurpose6, mockPurpose7]);
  });
  it("should get the purposes if they exist (pagination: limit)", async () => {
    const result = await purposeService.getPurposes(
      producerId1,
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 3 },
      genericLogger
    );
    expect(result.results).toEqual([mockPurpose1, mockPurpose2, mockPurpose3]);
  });
  it("should not get the purposes if they don't exist", async () => {
    const result = await purposeService.getPurposes(
      producerId1,
      {
        eservicesIds: [generateId()],
        consumersIds: [],
        producersIds: [generateId()],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(0);
    expect(result.results).toEqual([]);
  });
  it("should get the purposes if they exist (parameters: name, eservicesIds, consumersIds, producersIds, states; exlcudeDraft = true)", async () => {
    const result = await purposeService.getPurposes(
      producerId1,
      {
        title: "test",
        eservicesIds: [mockEService3ByTenant2.id],
        consumersIds: [consumerId1],
        producersIds: [producerId2],
        states: [purposeVersionState.active],
        excludeDraft: true,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([mockPurpose6]);
  });
  it("should get the purposes if they exist (parameters: name, eservicesIds, consumersIds, producersIds, states; exlcudeDraft = false)", async () => {
    const result = await purposeService.getPurposes(
      producerId1,
      {
        title: "test",
        eservicesIds: [mockEService1ByTenant1.id],
        consumersIds: [consumerId1],
        producersIds: [producerId1],
        states: [purposeVersionState.draft],
        excludeDraft: false,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([mockPurpose1]);
  });
  it("should not include the riskAnalysisForm if the requester is not the producer nor the consumer", async () => {
    const mockPurpose8: Purpose = {
      ...getMockPurpose(),
      title: "purpose 8",
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      eserviceId: mockEService4.id,
    };
    await addOnePurpose(mockPurpose8);

    const result = await purposeService.getPurposes(
      generateId(),
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: false,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(8);
    expect(result.results).toEqual(
      [
        mockPurpose1,
        mockPurpose2,
        mockPurpose3,
        mockPurpose4,
        mockPurpose5,
        mockPurpose6,
        mockPurpose7,
        mockPurpose8,
      ].map((p) => ({ ...p, riskAnalysisForm: undefined }))
    );
  });
  it("should only include the riskAnalysisForm for those purposes in which the requester is the producer or the consumer", async () => {
    await purposes.deleteMany({});

    const mockPurpose8: Purpose = {
      ...getMockPurpose(),
      title: "purpose 8",
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      eserviceId: mockEService2ByTenant1.id,
    };
    await addOnePurpose(mockPurpose8);

    const mockPurpose9: Purpose = {
      ...getMockPurpose(),
      title: "purpose 9",
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      eserviceId: mockEService4.id,
    };
    await addOnePurpose(mockPurpose9);

    const result = await purposeService.getPurposes(
      producerId1,
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: false,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([
      mockPurpose8,
      { ...mockPurpose9, riskAnalysisForm: undefined },
    ]);
  });
  it("should get the correct purpose if the producersIds param is passed but the caller has no e-service", async () => {
    await purposes.deleteMany({});
    await eservices.deleteMany({});

    await writeInReadmodel(toReadModelEService(mockEService4), eservices);

    const mockPurpose8: Purpose = {
      ...getMockPurpose(),
      title: "purpose 8",
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      eserviceId: mockEService4.id,
    };
    await addOnePurpose(mockPurpose8);

    const result = await purposeService.getPurposes(
      producerId1,
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [producerId1],
        states: [],
        excludeDraft: false,
      },
      { offset: 0, limit: 50 },
      genericLogger
    );
    expect(result.totalCount).toBe(0);
    expect(result.results).toEqual([]);
  });

  describe("Producer Delegation active for provided producerIds filter", async () => {
    it("should get the purposes if they exist (parameters: producersIds with only delegateId)", async () => {
      const organizationId = generateId<TenantId>();
      const delegate = getMockTenant(delegateId);
      await addOneTenant(delegate);

      const delegation = getMockDelegation({
        delegateId,
        state: delegationState.active,
        eserviceId: mockPurpose2.eserviceId,
        kind: delegationKind.delegatedProducer,
      });
      await addOneDelegation(delegation);

      const revokedDelegation = getMockDelegation({
        delegateId,
        state: delegationState.revoked,
        eserviceId: mockPurpose3.eserviceId,
        kind: delegationKind.delegatedProducer,
      });
      await addOneDelegation(revokedDelegation);

      const results = await purposeService.getPurposes(
        organizationId, // irrelevant to check retrieved purposes
        {
          eservicesIds: [],
          consumersIds: [],
          producersIds: [delegateId],
          states: [],
          excludeDraft: false,
        },
        { offset: 0, limit: 50 },
        genericLogger
      );

      expect(results.totalCount).toBe(2);
      expect(results.results).toEqual([mockPurpose1, mockPurpose2]);
    });
    it("should get the purposes if they exist (parameters: producersIds that contains delegateId and generic producerId)", async () => {
      const delegate = getMockTenant(delegateId);
      await addOneTenant(delegate);

      const delegation = getMockDelegation({
        delegateId,
        state: delegationState.active,
        eserviceId: mockPurpose2.eserviceId,
        kind: delegationKind.delegatedProducer,
      });
      await addOneDelegation(delegation);

      const revokedDelegation = getMockDelegation({
        delegateId,
        state: delegationState.revoked,
        eserviceId: mockPurpose3.eserviceId,
        kind: delegationKind.delegatedProducer,
      });
      await addOneDelegation(revokedDelegation);

      const results = await purposeService.getPurposes(
        generateId<TenantId>(),
        {
          eservicesIds: [],
          consumersIds: [],
          producersIds: [delegateId, producerId2],
          states: [],
          excludeDraft: false,
        },
        { offset: 0, limit: 50 },
        genericLogger
      );

      expect(results.totalCount).toBe(4);
      expect(results.results).toEqual([
        mockPurpose1,
        mockPurpose2,
        mockPurpose4,
        mockPurpose6,
      ]);
    });
  });

  describe("Producer Delegation active getPurposes return also risk analysis data", async () => {
    it("should get the purposes and also risk analysis if requester is a delegate", async () => {
      const riskAnalysisForm = getMockValidRiskAnalysisForm(tenantKind.PA);
      const producerId = generateId<TenantId>();
      await addOneTenant(getMockTenant(producerId));

      const eservice = {
        ...getMockEService(),
        id: unsafeBrandId<EServiceId>("6A7A8CC9-02B0-4AC3-862D-9CDFB102A181"),
        producerId,
      };
      await addOneEService(eservice);

      const mockPurpose10 = {
        ...getMockPurpose(),
        title: "purpose 10",
        riskAnalysisForm,
        eserviceId: eservice.id,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      await addOnePurpose(mockPurpose10);
      const mockPurpose11 = {
        ...getMockPurpose(),
        title: "purpose 11",
        riskAnalysisForm,
        eserviceId: eservice.id,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      await addOnePurpose(mockPurpose11);

      const delegate = getMockTenant(delegateId);
      await addOneTenant(delegate);

      const delegation = getMockDelegation({
        delegatorId: producerId,
        delegateId,
        state: delegationState.active,
        eserviceId: eservice.id,
        kind: delegationKind.delegatedProducer,
      });
      await addOneDelegation(delegation);

      const results = await purposeService.getPurposes(
        delegateId,
        {
          eservicesIds: [],
          consumersIds: [],
          producersIds: [producerId],
          states: [],
          excludeDraft: false,
        },
        { offset: 0, limit: 50 },
        genericLogger
      );

      expect(results.totalCount).toBe(2);
      expect(results.results).toEqual([mockPurpose10, mockPurpose11]);
    });
  });

  describe("Consumer Delegation active for provided consumetsIds filter", async () => {
    it("should get the purposes if they exist (parameters: consumetsIds with only delegateId)", async () => {
      const organizationId = generateId<TenantId>();
      const delegate = getMockTenant(delegateId);
      await addOneTenant(delegate);

      const delegation = getMockDelegation({
        delegateId,
        state: delegationState.active,
        eserviceId: mockPurpose2.eserviceId,
        kind: delegationKind.delegatedConsumer,
      });
      await addOneDelegation(delegation);

      const revokedDelegation = getMockDelegation({
        delegateId,
        state: delegationState.revoked,
        eserviceId: mockPurpose3.eserviceId,
        kind: delegationKind.delegatedConsumer,
      });
      await addOneDelegation(revokedDelegation);

      const results = await purposeService.getPurposes(
        organizationId, // irrelevant to check retrieved purposes
        {
          eservicesIds: [],
          consumersIds: [delegateId],
          producersIds: [],
          states: [],
          excludeDraft: false,
        },
        { offset: 0, limit: 50 },
        genericLogger
      );

      expect(results.totalCount).toBe(2);
      expect(results.results).toEqual([mockPurpose1, mockPurpose2]);
    });
    it("should get the purposes if they exist (parameters: consumetsIds that contains delegateId and generic consumerId)", async () => {
      const delegate = getMockTenant(delegateId);
      await addOneTenant(delegate);

      const delegation = getMockDelegation({
        delegateId,
        state: delegationState.active,
        eserviceId: mockPurpose2.eserviceId,
        kind: delegationKind.delegatedConsumer,
      });
      await addOneDelegation(delegation);

      const revokedDelegation = getMockDelegation({
        delegateId,
        state: delegationState.revoked,
        eserviceId: mockPurpose3.eserviceId,
        kind: delegationKind.delegatedConsumer,
      });
      await addOneDelegation(revokedDelegation);

      const results = await purposeService.getPurposes(
        generateId<TenantId>(),
        {
          eservicesIds: [],
          consumersIds: [delegateId, consumerId1],
          producersIds: [],
          states: [],
          excludeDraft: false,
        },
        { offset: 0, limit: 50 },
        genericLogger
      );

      expect(results.totalCount).toBe(4);
      expect(results.results).toEqual([
        mockPurpose1,
        mockPurpose2,
        mockPurpose5,
        mockPurpose6,
      ]);
    });
    it("should get the purposes if they exist (parameters: consumetsIds that contains delegatorId)", async () => {
      const delegatorId: TenantId = generateId();
      const delegator = getMockTenant(delegatorId);
      await addOneTenant(delegator);

      const delegation = getMockDelegation({
        delegatorId,
        state: delegationState.active,
        eserviceId: mockPurpose2.eserviceId,
        kind: delegationKind.delegatedConsumer,
      });
      await addOneDelegation(delegation);

      const revokedDelegation = getMockDelegation({
        delegatorId,
        state: delegationState.revoked,
        eserviceId: mockPurpose3.eserviceId,
        kind: delegationKind.delegatedConsumer,
      });
      await addOneDelegation(revokedDelegation);

      const results = await purposeService.getPurposes(
        generateId<TenantId>(),
        {
          eservicesIds: [],
          consumersIds: [delegatorId],
          producersIds: [],
          states: [],
          excludeDraft: false,
        },
        { offset: 0, limit: 50 },
        genericLogger
      );

      expect(results.totalCount).toBe(2);
      expect(results.results).toEqual([mockPurpose1, mockPurpose2]);
    });
  });
});
