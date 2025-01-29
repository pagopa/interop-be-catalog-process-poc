/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it, vi } from "vitest";
import {
  getMockPurposeVersion,
  getMockPurpose,
  decodeProtobufPayload,
  getMockDelegation,
  getRandomAuthData,
  addSomeRandomDelegations,
  getMockAgreement,
  getMockTenant,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  PurposeVersion,
  purposeVersionState,
  Purpose,
  generateId,
  PurposeVersionSuspendedByConsumerV2,
  toPurposeV2,
  PurposeVersionSuspendedByProducerV2,
  PurposeId,
  PurposeVersionId,
  TenantId,
  toPurposeVersionV2,
  delegationState,
  delegationKind,
  Agreement,
  EService,
  eserviceMode,
  tenantKind,
  agreementState,
  DelegationId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  purposeVersionNotFound,
  organizationNotAllowed,
  notValidVersionState,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  getMockEService,
  purposeService,
  readLastPurposeEvent,
} from "./utils.js";

describe("suspendPurposeVersion", () => {
  const isSuspendable = [
    purposeVersionState.active,
    purposeVersionState.suspended,
  ];
  it.each(isSuspendable)(
    "should write on event-store for the suspension of a purpose version by the consumer",
    async (s) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const mockEService = getMockEService();
      const mockPurposeVersion1: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: s,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion1],
      };
      await addOnePurpose(mockPurpose);
      await addOneEService(mockEService);

      const returnedPurposeVersion = await purposeService.suspendPurposeVersion(
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
        type: "PurposeVersionSuspendedByConsumer",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [
          {
            ...mockPurposeVersion1,
            state: purposeVersionState.suspended,
            suspendedAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        updatedAt: new Date(),
        suspendedByConsumer: true,
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeVersionSuspendedByConsumerV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
      expect(
        writtenPayload.purpose?.versions.find(
          (v) => v.id === returnedPurposeVersion.id
        )
      ).toEqual(toPurposeVersionV2(returnedPurposeVersion));

      vi.useRealTimers();
    }
  );
  it("should write on event-store for the suspension of a purpose version by the producer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1],
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
      },
      {
        authData: getRandomAuthData(mockEService.producerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionSuspendedByProducer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion1,
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      suspendedByProducer: true,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionSuspendedByProducerV2,
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
  it("should write on event-store for the suspension of a purpose version by the delegated producer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1],
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const delegation = getMockDelegation({
      delegatorId: mockEService.producerId,
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
      },
      {
        authData: getRandomAuthData(delegation.delegateId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionSuspendedByProducer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion1,
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      suspendedByProducer: true,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionSuspendedByProducerV2,
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
  it("should write on event-store for the suspension of a purpose version by the producer (self consumer)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: mockEService.producerId,
      versions: [mockPurposeVersion1],
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
      },
      {
        authData: getRandomAuthData(mockEService.producerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionSuspendedByProducer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion1,
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      suspendedByProducer: true,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionSuspendedByProducerV2,
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
  it("should succeed when requester is Consumer Delegate and the purpose version is suspended by the consumer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const authData = getRandomAuthData();
    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1],
      delegationId: generateId<DelegationId>(),
    };

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
    await addOneEService(mockEService);

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
      },
      {
        authData: getRandomAuthData(delegation.delegateId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionSuspendedByConsumer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion1,
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      updatedAt: new Date(),
      suspendedByConsumer: true,
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionSuspendedByConsumerV2,
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
  it("When there's a consumer delegation should succeed when requester is Producer and the purpose version is suspended by the producer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const authData = getRandomAuthData();
    const mockEService = {
      ...getMockEService(),
      producerId: authData.organizationId,
    };
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1],
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
    await addOneEService(mockEService);
    await addOneDelegation(delegation);

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
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
      type: "PurposeVersionSuspendedByProducer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion1,
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      suspendedByProducer: true,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionSuspendedByProducerV2,
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
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the purpose version is suspended by the consumer", async () => {
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

    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };

    const delegatePurpose: Purpose = {
      ...getMockPurpose(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      versions: [mockPurposeVersion1],
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

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion(
      {
        purposeId: delegatePurpose.id,
        versionId: mockPurposeVersion1.id,
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
      type: "PurposeVersionSuspendedByConsumer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...delegatePurpose,
      versions: [
        {
          ...mockPurposeVersion1,
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      updatedAt: new Date(),
      suspendedByConsumer: true,
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionSuspendedByConsumerV2,
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
      purposeService.suspendPurposeVersion(
        {
          purposeId: randomPurposeId,
          versionId: randomVersionId,
        },
        {
          authData: getRandomAuthData(),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(purposeNotFound(randomPurposeId));
  });
  it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
    const mockEService = getMockEService();
    const randomVersionId: PurposeVersionId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.suspendPurposeVersion(
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
  it("should throw organizationNotAllowed if the requester is not the producer nor the consumer", async () => {
    const mockEService = getMockEService();
    const randomAuthData = getRandomAuthData();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        {
          authData: randomAuthData,
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      organizationNotAllowed(randomAuthData.organizationId)
    );
  });
  it("should throw organizationNotAllowed if the requester is not the e-service active delegation delegate", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const delegateId = generateId<TenantId>();
    const delegation = getMockDelegation({
      delegatorId: mockEService.producerId,
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    const randomCaller = getRandomAuthData();

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        {
          authData: randomCaller,
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(organizationNotAllowed(randomCaller.organizationId));
  });
  it.each(
    Object.values(delegationState).filter((s) => s !== delegationState.active)
  )(
    "should throw organizationNotAllowed if the requester is the e-service delegate but the delegation is in %s state",
    async (delegationState) => {
      const mockEService = getMockEService();
      const mockPurposeVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: randomArrayItem(isSuspendable),
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };
      await addOnePurpose(mockPurpose);
      await addOneEService(mockEService);

      const delegateAuthData = getRandomAuthData();
      const delegation = getMockDelegation({
        delegatorId: mockEService.producerId,
        kind: delegationKind.delegatedProducer,
        eserviceId: mockEService.id,
        delegateId: delegateAuthData.organizationId,
        state: delegationState,
      });

      await addOneDelegation(delegation);

      expect(
        purposeService.suspendPurposeVersion(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
          },
          {
            authData: delegateAuthData,
            correlationId: generateId(),
            logger: genericLogger,
            serviceName: "",
          }
        )
      ).rejects.toThrowError(
        organizationNotAllowed(delegateAuthData.organizationId)
      );
    }
  );
  it("should throw organizationNotAllowed if the requester is the producer but the purpose e-service has an active delegation", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const delegateId = generateId<TenantId>();
    const delegation = getMockDelegation({
      delegatorId: mockEService.producerId,
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        {
          authData: getRandomAuthData(mockEService.producerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(organizationNotAllowed(mockEService.producerId));
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
      const mockEService = getMockEService();
      const mockPurposeVersion = getMockPurposeVersion(state);

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose);
      await addOneEService(mockEService);

      expect(
        purposeService.suspendPurposeVersion(
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
  it("should throw organizationNotAllowed when the requester is the Consumer and is suspending a purpose version created by the delegate", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const delegation = getMockDelegation({
      id: mockPurpose.delegationId,
      delegatorId: mockPurpose.consumerId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockEService.id,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    expect(
      purposeService.suspendPurposeVersion(
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
    ).rejects.toThrowError(organizationNotAllowed(mockPurpose.consumerId));
  });

  it("should throw organizationNotAllowed when the requester is the Consumer, is suspending a purpose version created by a delegate in suspendPurposeVersion, but the delegation cannot be found", async () => {
    const authData = getRandomAuthData();
    const mockEService = getMockEService();

    const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
      randomArrayItem(isSuspendable)
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
      purposeService.suspendPurposeVersion(
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
    ).rejects.toThrowError(organizationNotAllowed(authData.organizationId));
  });

  it("should throw organizationNotAllowed when the requester is the Delegate and is suspending a purpose version created by the Consumer", async () => {
    const authData = getRandomAuthData();
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
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
    await addOneEService(mockEService);
    await addOneDelegation(delegation);

    expect(
      purposeService.suspendPurposeVersion(
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
    ).rejects.toThrowError(organizationNotAllowed(delegation.delegateId));
  });
  it("should throw organizationNotAllowed when the requester is a delegate for the eservice and there is a delegationId in purpose but for a different delegationId (a different delegate) in suspendPurposeVersion", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: generateId<DelegationId>(),
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockEService.id,
      delegateId: generateId<TenantId>(),
      delegatorId: mockPurpose.consumerId,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneDelegation(delegation);

    expect(
      purposeService.suspendPurposeVersion(
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
    ).rejects.toThrowError(organizationNotAllowed(delegation.delegateId));
  });
});
