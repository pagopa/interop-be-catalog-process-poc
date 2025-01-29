/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  addSomeRandomDelegations,
  decodeProtobufPayload,
  getMockAgreement,
  getMockAuthData,
  getMockDelegation,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
  getRandomAuthData,
} from "pagopa-interop-commons-test/index.js";
import {
  Purpose,
  PurposeClonedV2,
  agreementState,
  generateId,
  purposeVersionState,
  tenantKind,
  toPurposeV2,
  unsafeBrandId,
  DelegationId,
  delegationKind,
  delegationState,
  TenantId,
  EService,
  Agreement,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  formatDateddMMyyyyHHmmss,
  genericLogger,
} from "pagopa-interop-commons";
import {
  duplicatedPurposeTitle,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegatedConsumer,
  puroposeDelegationNotFound,
  purposeCannotBeCloned,
  purposeNotFound,
  tenantKindNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  purposeService,
  readLastPurposeEvent,
} from "./utils.js";

describe("clonePurpose", async () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it("should write on event-store for the cloning of a purpose", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };
    const mockEService = getMockEService();

    const mockAgreement = getMockAgreement(
      mockEService.id,
      mockTenant.id,
      agreementState.active
    );

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    await addOnePurpose(mockPurpose);
    await addOneTenant(mockTenant);
    await addOneAgreement(mockAgreement);

    const { purpose, isRiskAnalysisValid } = await purposeService.clonePurpose({
      purposeId: mockPurpose.id,
      seed: {
        eserviceId: mockEService.id,
      },
      ctx: {
        authData: getMockAuthData(mockTenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "test",
      },
    });

    const writtenEvent = await readLastPurposeEvent(purpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "0",
      type: "PurposeCloned",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeClonedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      id: unsafeBrandId(writtenPayload.purpose!.id),
      title: `${mockPurpose.title} - clone - ${formatDateddMMyyyyHHmmss(
        new Date()
      )}`,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          createdAt: new Date(),
          dailyCalls: mockPurpose.versions[0].dailyCalls,
        },
      ],
      createdAt: new Date(),
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(false);
  });
  it("should write on event-store for the cloning of a purpose, making sure the title is cut to 60 characters", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };
    const mockEService = getMockEService();

    const mockAgreement = getMockAgreement(
      mockEService.id,
      mockTenant.id,
      agreementState.active
    );

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      title: "Title exceeding the maximum length when the suffix is added",
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    await addOnePurpose(mockPurpose);
    await addOneTenant(mockTenant);
    await addOneAgreement(mockAgreement);

    const { purpose, isRiskAnalysisValid } = await purposeService.clonePurpose({
      purposeId: mockPurpose.id,
      seed: {
        eserviceId: mockEService.id,
      },
      ctx: {
        authData: getMockAuthData(mockTenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "test",
      },
    });

    const writtenEvent = await readLastPurposeEvent(purpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "0",
      type: "PurposeCloned",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeClonedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      id: unsafeBrandId(writtenPayload.purpose!.id),
      title: `Title exceeding the maximum... - clone - ${formatDateddMMyyyyHHmmss(
        new Date()
      )}`,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          createdAt: new Date(),
          dailyCalls: mockPurpose.versions[0].dailyCalls,
        },
      ],
      createdAt: new Date(),
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(expectedPurpose.title.length).toBe(60);
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(false);
  });
  it("should succeed when requester is Consumer Delegate and the Purpose is in a clonable state", async () => {
    const consumer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const consumerDelegate = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService = getMockEService();

    const mockAgreement = getMockAgreement(
      mockEService.id,
      consumer.id,
      agreementState.active
    );

    const purposeCreatedByDelegate: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: purposeCreatedByDelegate.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: purposeCreatedByDelegate.eserviceId,
      delegatorId: purposeCreatedByDelegate.consumerId,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOnePurpose(purposeCreatedByDelegate);
    await addOneTenant(consumer);
    await addOneTenant(consumerDelegate);
    await addOneAgreement(mockAgreement);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(purposeCreatedByDelegate, addOneDelegation);

    const { purpose, isRiskAnalysisValid } = await purposeService.clonePurpose({
      purposeId: purposeCreatedByDelegate.id,
      seed: {
        eserviceId: mockEService.id,
      },
      ctx: {
        authData: getMockAuthData(delegation.delegateId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "test",
      },
    });

    const writtenEvent = await readLastPurposeEvent(purpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "0",
      type: "PurposeCloned",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeClonedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = {
      ...purposeCreatedByDelegate,
      id: unsafeBrandId(writtenPayload.purpose!.id),
      consumerId: consumerDelegate.id,
      title: `${
        purposeCreatedByDelegate.title
      } - clone - ${formatDateddMMyyyyHHmmss(new Date())}`,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          createdAt: new Date(),
          dailyCalls: purposeCreatedByDelegate.versions[0].dailyCalls,
        },
      ],
      createdAt: new Date(),
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(false);
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the Purpose is in a clonable state", async () => {
    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const producerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
    };

    const mockPurposeVersion = getMockPurposeVersion(
      purposeVersionState.active
    );

    const delegatePurpose: Purpose = {
      ...getMockPurpose(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: producer.id,
      delegateId: producerDelegate.id,
      state: delegationState.active,
    });

    const consumerDelegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOneTenant(producerDelegate);
    await addOneTenant(producer);
    await addOneTenant(consumerDelegate);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOnePurpose(delegatePurpose);
    await addOneDelegation(producerDelegation);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(delegatePurpose, addOneDelegation);

    const { purpose, isRiskAnalysisValid } = await purposeService.clonePurpose({
      purposeId: delegatePurpose.id,
      seed: {
        eserviceId: eservice.id,
      },
      ctx: {
        authData: getMockAuthData(consumerDelegation.delegateId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "test",
      },
    });

    const writtenEvent = await readLastPurposeEvent(purpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "0",
      type: "PurposeCloned",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeClonedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = {
      ...delegatePurpose,
      id: unsafeBrandId(writtenPayload.purpose!.id),
      consumerId: consumerDelegate.id,
      title: `${delegatePurpose.title} - clone - ${formatDateddMMyyyyHHmmss(
        new Date()
      )}`,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          createdAt: new Date(),
          dailyCalls: delegatePurpose.versions[0].dailyCalls,
        },
      ],
      createdAt: new Date(),
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(false);
  });
  it("should throw purposeNotFound if the purpose to clone doesn't exist", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };
    const mockEService = getMockEService();

    const mockAgreement = getMockAgreement(
      mockEService.id,
      mockTenant.id,
      agreementState.active
    );

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    await addOneTenant(mockTenant);
    await addOneAgreement(mockAgreement);

    expect(
      purposeService.clonePurpose({
        purposeId: mockPurpose.id,
        seed: {
          eserviceId: mockEService.id,
        },
        ctx: {
          authData: getMockAuthData(mockTenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "test",
        },
      })
    ).rejects.toThrowError(purposeNotFound(mockPurpose.id));
  });
  it("should throw purposeCannotBeCloned if the purpose is in draft (no versions)", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };
    const mockEService = getMockEService();

    const mockAgreement = getMockAgreement(
      mockEService.id,
      mockTenant.id,
      agreementState.active
    );

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
      versions: [],
    };

    await addOnePurpose(mockPurpose);
    await addOneTenant(mockTenant);
    await addOneAgreement(mockAgreement);

    expect(
      purposeService.clonePurpose({
        purposeId: mockPurpose.id,
        seed: {
          eserviceId: mockEService.id,
        },
        ctx: {
          authData: getMockAuthData(mockTenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "test",
        },
      })
    ).rejects.toThrowError(purposeCannotBeCloned(mockPurpose.id));
  });
  it("should throw purposeCannotBeCloned if the purpose is in draft (draft version)", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };
    const mockEService = getMockEService();

    const mockAgreement = getMockAgreement(
      mockEService.id,
      mockTenant.id,
      agreementState.active
    );

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
      versions: [getMockPurposeVersion(purposeVersionState.draft)],
    };

    await addOnePurpose(mockPurpose);
    await addOneTenant(mockTenant);
    await addOneAgreement(mockAgreement);

    expect(
      purposeService.clonePurpose({
        purposeId: mockPurpose.id,
        seed: {
          eserviceId: mockEService.id,
        },
        ctx: {
          authData: getMockAuthData(mockTenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "test",
        },
      })
    ).rejects.toThrowError(purposeCannotBeCloned(mockPurpose.id));
  });
  it("should throw duplicatedPurposeTitle if a purpose with the same name already exists", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };
    const mockEService = getMockEService();

    const mockAgreement = getMockAgreement(
      mockEService.id,
      mockTenant.id,
      agreementState.active
    );

    const mockPurposeToClone: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockPurposeWithSameName: Purpose = {
      ...getMockPurpose(),
      title: `${mockPurposeToClone.title} - clone - ${formatDateddMMyyyyHHmmss(
        new Date()
      )}`,
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
    };

    await addOnePurpose(mockPurposeToClone);
    await addOnePurpose(mockPurposeWithSameName);
    await addOneTenant(mockTenant);
    await addOneAgreement(mockAgreement);

    expect(
      purposeService.clonePurpose({
        purposeId: mockPurposeToClone.id,
        seed: {
          eserviceId: mockEService.id,
        },
        ctx: {
          authData: getMockAuthData(mockTenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "test",
        },
      })
    ).rejects.toThrowError(
      duplicatedPurposeTitle(mockPurposeWithSameName.title)
    );
  });
  it("should throw tenantKindNotFound if the tenant kind doesn't exist", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: undefined,
    };
    const mockEService = getMockEService();

    const mockAgreement = getMockAgreement(
      mockEService.id,
      mockTenant.id,
      agreementState.active
    );

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    await addOnePurpose(mockPurpose);
    await addOneTenant(mockTenant);
    await addOneAgreement(mockAgreement);

    expect(
      purposeService.clonePurpose({
        purposeId: mockPurpose.id,
        seed: {
          eserviceId: mockEService.id,
        },
        ctx: {
          authData: getMockAuthData(mockTenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "test",
        },
      })
    ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
  });
  it("should throw organizationIsNotTheDelegatedConsumer when the requester is the Consumer and is cloning a purpose created by the delegate in clonePurpose", async () => {
    const consumer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const consumerDelegate = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService = getMockEService();

    const mockAgreement = getMockAgreement(
      mockEService.id,
      consumer.id,
      agreementState.active
    );

    const purposeCreatedByDelegate: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: purposeCreatedByDelegate.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: purposeCreatedByDelegate.eserviceId,
      delegatorId: purposeCreatedByDelegate.consumerId,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOnePurpose(purposeCreatedByDelegate);
    await addOneTenant(consumer);
    await addOneTenant(consumerDelegate);
    await addOneAgreement(mockAgreement);
    await addOneDelegation(delegation);

    expect(
      purposeService.clonePurpose({
        purposeId: purposeCreatedByDelegate.id,
        seed: {
          eserviceId: mockEService.id,
        },
        ctx: {
          authData: getRandomAuthData(consumer.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "test",
        },
      })
    ).rejects.toThrowError(
      organizationIsNotTheDelegatedConsumer(consumer.id, delegation.id)
    );
  });
  it("should throw puroposeDelegationNotFound when the requester is the Consumer, is cloning a purpose created by a delegate in clonePurpose, but the delegation cannot be found", async () => {
    const consumer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const consumerDelegate = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService = getMockEService();

    const mockAgreement = getMockAgreement(
      mockEService.id,
      consumer.id,
      agreementState.active
    );

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
      delegationId: generateId<DelegationId>(),
    };

    await addOnePurpose(purpose);
    await addOneTenant(consumer);
    await addOneTenant(consumerDelegate);
    await addOneAgreement(mockAgreement);

    expect(
      purposeService.clonePurpose({
        purposeId: purpose.id,
        seed: {
          eserviceId: mockEService.id,
        },
        ctx: {
          authData: getRandomAuthData(consumer.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "test",
        },
      })
    ).rejects.toThrowError(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      puroposeDelegationNotFound(purpose.id, purpose.delegationId!)
    );
  });
  it("should throw organizationIsNotTheConsumer if the requester is a delegate for the eservice and there is no delegationId in the purpose", async () => {
    const consumer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const consumerDelegate = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService = getMockEService();

    const mockAgreement = getMockAgreement(
      mockEService.id,
      consumer.id,
      agreementState.active
    );

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
      delegationId: undefined,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOnePurpose(purpose);
    await addOneTenant(consumer);
    await addOneTenant(consumerDelegate);
    await addOneAgreement(mockAgreement);
    await addOneDelegation(delegation);

    expect(
      purposeService.clonePurpose({
        purposeId: purpose.id,
        seed: {
          eserviceId: mockEService.id,
        },
        ctx: {
          authData: getRandomAuthData(delegation.delegateId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "test",
        },
      })
    ).rejects.toThrowError(organizationIsNotTheConsumer(delegation.delegateId));
  });
  it("should throw organizationIsNotTheDelegatedConsumer when the requester is a delegate for the eservice and there is a delegationId in purpose but for a different delegationId (a different delegate)", async () => {
    const consumer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const consumerDelegate = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService = getMockEService();

    const mockAgreement = getMockAgreement(
      mockEService.id,
      consumer.id,
      agreementState.active
    );

    const purpose: Purpose = {
      ...getMockPurpose(),
      consumerId: consumer.id,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: generateId<DelegationId>(),
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    const purposeDelegation = getMockDelegation({
      id: purpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(purpose);
    await addOneDelegation(delegation);
    await addOneDelegation(purposeDelegation);
    await addOneTenant(consumer);
    await addOneTenant(consumerDelegate);
    await addOneAgreement(mockAgreement);

    expect(
      purposeService.clonePurpose({
        purposeId: purpose.id,
        seed: {
          eserviceId: mockEService.id,
        },
        ctx: {
          authData: getRandomAuthData(consumerDelegate.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "test",
        },
      })
    ).rejects.toThrowError(
      organizationIsNotTheDelegatedConsumer(
        consumerDelegate.id,
        purpose.delegationId
      )
    );
  });
});
