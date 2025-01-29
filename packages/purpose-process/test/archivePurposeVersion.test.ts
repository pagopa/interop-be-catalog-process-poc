/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockPurposeVersion,
  getMockPurpose,
  decodeProtobufPayload,
  getRandomAuthData,
  getMockDelegation,
  addSomeRandomDelegations,
  getMockAgreement,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  PurposeVersion,
  purposeVersionState,
  Purpose,
  generateId,
  PurposeArchivedV2,
  toPurposeV2,
  PurposeId,
  PurposeVersionId,
  TenantId,
  toPurposeVersionV2,
  delegationKind,
  delegationState,
  Agreement,
  EService,
  eserviceMode,
  tenantKind,
  agreementState,
  DelegationId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  organizationIsNotTheConsumer,
  purposeVersionNotFound,
  notValidVersionState,
  organizationIsNotTheDelegatedConsumer,
  puroposeDelegationNotFound,
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

describe("archivePurposeVersion", () => {
  it("should write on event-store for the archiving of a purpose version", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      versions: [mockPurposeVersion],
    };
    await addOnePurpose(mockPurpose);

    const returnedPurposeVersion = await purposeService.archivePurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
      },
      {
        authData: getRandomAuthData(mockPurpose.consumerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeArchived",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion,
          state: purposeVersionState.archived,
          updatedAt: new Date(),
        },
      ],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeArchivedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(
      writtenPayload.purpose?.versions.find(
        (v) => v.id === returnedPurposeVersion.id
      )
    ).toEqual(toPurposeVersionV2(returnedPurposeVersion));

    vi.useRealTimers();
  });
  it("should write on event-store for the archiving of a purpose version, and delete waitingForApproval versions", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurposeVersion2: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.waitingForApproval,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      versions: [mockPurposeVersion1, mockPurposeVersion2],
    };
    await addOnePurpose(mockPurpose);

    const returnedPurposeVersion = await purposeService.archivePurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
      },
      {
        authData: getRandomAuthData(mockPurpose.consumerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeArchived",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion1,
          state: purposeVersionState.archived,
          updatedAt: new Date(),
        },
      ],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeArchivedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(
      writtenPayload.purpose?.versions.find(
        (v) => v.id === returnedPurposeVersion.id
      )
    ).toEqual(toPurposeVersionV2(returnedPurposeVersion));

    vi.useRealTimers();
  });
  it("should write on event-store for the archiving of a purpose version when requester is Consumer Delegate", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    const authData = getRandomAuthData();

    const delegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(mockPurpose, addOneDelegation);

    const returnedPurposeVersion = await purposeService.archivePurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
      },
      {
        authData,
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeArchived",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion,
          state: purposeVersionState.archived,
          updatedAt: new Date(),
        },
      ],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeArchivedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(
      writtenPayload.purpose?.versions.find(
        (v) => v.id === returnedPurposeVersion.id
      )
    ).toEqual(toPurposeVersionV2(returnedPurposeVersion));

    vi.useRealTimers();
  });
  it("should write on event-store for the archiving of a purpose version when requester is Consumer Delegate and the eservice was created by a delegated tenant", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

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
      mode: eserviceMode.receive,
      producerId: producer.id,
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
      state: agreementState.active,
    };

    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };

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

    const returnedPurposeVersion = await purposeService.archivePurposeVersion(
      {
        purposeId: delegatePurpose.id,
        versionId: mockPurposeVersion.id,
      },
      {
        authData: getRandomAuthData(consumerDelegate.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(delegatePurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "PurposeArchived",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...delegatePurpose,
      versions: [
        {
          ...mockPurposeVersion,
          state: purposeVersionState.archived,
          updatedAt: new Date(),
        },
      ],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeArchivedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(
      writtenPayload.purpose?.versions.find(
        (v) => v.id === returnedPurposeVersion.id
      )
    ).toEqual(toPurposeVersionV2(returnedPurposeVersion));

    vi.useRealTimers();
  });

  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomPurposeId: PurposeId = generateId();
    const randomVersionId: PurposeVersionId = generateId();
    const mockPurpose = getMockPurpose();
    await addOnePurpose(mockPurpose);

    expect(
      purposeService.archivePurposeVersion(
        {
          purposeId: randomPurposeId,
          versionId: randomVersionId,
        },
        {
          authData: getRandomAuthData(mockPurpose.consumerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(purposeNotFound(randomPurposeId));
  });
  it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
    const randomOrganizationId: TenantId = generateId();

    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.archivePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        {
          authData: getRandomAuthData(randomOrganizationId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(organizationIsNotTheConsumer(randomOrganizationId));
  });
  it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
    const randomVersionId: PurposeVersionId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      versions: [],
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.archivePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: randomVersionId,
        },
        {
          authData: getRandomAuthData(mockPurpose.consumerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      purposeVersionNotFound(mockPurpose.id, randomVersionId)
    );
  });
  it.each(
    Object.values(purposeVersionState).filter(
      (state) =>
        state !== purposeVersionState.active &&
        state !== purposeVersionState.suspended
    )
  )(
    "should throw notValidVersionState if the purpose version is in %s state",
    async (state) => {
      const mockPurposeVersion = getMockPurposeVersion(state);

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose);

      expect(
        purposeService.archivePurposeVersion(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
          },
          {
            authData: getRandomAuthData(mockPurpose.consumerId),
            correlationId: generateId(),
            logger: genericLogger,
            serviceName: "",
          }
        )
      ).rejects.toThrowError(
        notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
      );
    }
  );
  it("should throw organizationIsNotTheDelegatedConsumer when the requester is the Consumer and is archiving a purpose version created by the delegate in archivePurposeVersion", async () => {
    const authData = getRandomAuthData();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      versions: [mockPurposeVersion],
      consumerId: authData.organizationId,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });
    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);

    expect(
      purposeService.archivePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        {
          authData,
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      organizationIsNotTheDelegatedConsumer(
        authData.organizationId,
        mockPurpose.delegationId
      )
    );
  });
  it("should throw puroposeDelegationNotFound when the requester is the Consumer, is archiving a purpose created by a delegate, but the delegation cannot be found", async () => {
    const authData = getRandomAuthData();
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
      purposeVersionState.draft
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
      consumerId: authData.organizationId,
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    expect(
      purposeService.archivePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        {
          authData,
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      puroposeDelegationNotFound(mockPurpose.id, mockPurpose.delegationId!)
    );
  });

  it("should throw organizationIsNotTheConsumer when the requester is a delegate for the eservice and there is no delegationId in the purpose in archivePurposeVersion", async () => {
    const authData = getRandomAuthData();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      versions: [mockPurposeVersion],
      consumerId: authData.organizationId,
      delegationId: undefined,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });
    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);

    expect(
      purposeService.archivePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        {
          authData: getRandomAuthData(delegation.delegateId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(organizationIsNotTheConsumer(delegation.delegateId));
  });

  it("should throw organizationIsNotTheDelegatedConsumer if the the requester is a delegate for the eservice and there is a delegationId in purpose but for a different delegationId (a different delegate)", async () => {
    const authData = getRandomAuthData();
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      versions: [mockPurposeVersion],
      consumerId: authData.organizationId,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: generateId<DelegationId>(),
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    const purposeDelegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);
    await addOneDelegation(purposeDelegation);
    await addOneEService(mockEService);

    expect(
      purposeService.archivePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        {
          authData: getRandomAuthData(delegation.delegateId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      organizationIsNotTheDelegatedConsumer(
        delegation.delegateId,
        mockPurpose.delegationId
      )
    );
  });
});
