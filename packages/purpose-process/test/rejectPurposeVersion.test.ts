/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockPurposeVersion,
  getMockPurpose,
  writeInReadmodel,
  decodeProtobufPayload,
  getMockAuthData,
  getMockDelegation,
  getRandomAuthData,
} from "pagopa-interop-commons-test";
import {
  purposeVersionState,
  Purpose,
  toReadModelEService,
  generateId,
  PurposeVersionRejectedV2,
  PurposeVersion,
  toPurposeV2,
  PurposeId,
  PurposeVersionId,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  eserviceNotFound,
  organizationIsNotTheProducer,
  purposeVersionNotFound,
  notValidVersionState,
  organizationIsNotTheDelegatedProducer,
} from "../src/model/domain/errors.js";
import {
  getMockEService,
  addOnePurpose,
  readLastPurposeEvent,
  eservices,
  purposeService,
  delegations,
} from "./utils.js";

describe("rejectPurposeVersion", () => {
  it("should write on event-store for the rejection of a purpose version ", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.waitingForApproval,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    await purposeService.rejectPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        rejectionReason: "test",
      },
      {
        authData: getRandomAuthData(mockEService.producerId),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionRejected",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionRejectedV2,
      payload: writtenEvent.data,
    });

    const expectedPurposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.rejected,
      rejectionReason: "test",
      updatedAt: new Date(),
    };
    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [expectedPurposeVersion],
      updatedAt: new Date(),
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

    vi.useRealTimers();
  });
  it("should write on event-store for the rejection of a purpose version when the requester is delegate", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.waitingForApproval,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const delegate = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId: delegate.organizationId,
      state: delegationState.active,
      delegatorId: mockEService.producerId,
    });

    await writeInReadmodel(delegation, delegations);

    await purposeService.rejectPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        rejectionReason: "test",
      },
      {
        authData: getRandomAuthData(delegate.organizationId),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionRejected",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionRejectedV2,
      payload: writtenEvent.data,
    });

    const expectedPurposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.rejected,
      rejectionReason: "test",
      updatedAt: new Date(),
    };
    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [expectedPurposeVersion],
      updatedAt: new Date(),
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

    vi.useRealTimers();
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    const randomId: PurposeId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.rejectPurposeVersion(
        {
          purposeId: randomId,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
        },
        {
          authData: getRandomAuthData(mockEService.producerId),
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(purposeNotFound(randomId));
  });
  it("Should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.rejectPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
        },
        {
          authData: getRandomAuthData(mockPurpose.consumerId),
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eserviceNotFound(mockEService.id));
  });
  it("should throw organizationIsNotTheProducer if the requester is not the producer nor delegate", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.rejectPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
        },
        {
          authData: getRandomAuthData(mockPurpose.consumerId),
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      organizationIsNotTheProducer(mockPurpose.consumerId)
    );
  });
  it("should throw organizationIsNotTheDelegatedProducer if the purpose e-service has an active delegation and the requester is the producer", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const delegate = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId: delegate.organizationId,
      state: delegationState.active,
    });

    await writeInReadmodel(delegation, delegations);

    expect(
      purposeService.rejectPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
        },
        {
          authData: getRandomAuthData(mockEService.producerId),
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      organizationIsNotTheDelegatedProducer(
        mockEService.producerId,
        delegation.id
      )
    );
  });
  it("should throw organizationIsNotTheDelegatedProducer if the purpose e-service has an active delegation and the requester is not the producer nor the delegate", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const delegate = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId: delegate.organizationId,
      state: delegationState.active,
    });

    await writeInReadmodel(delegation, delegations);

    const randomCaller = getMockAuthData();

    expect(
      purposeService.rejectPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
        },
        {
          authData: getRandomAuthData(randomCaller.organizationId),
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      organizationIsNotTheDelegatedProducer(
        randomCaller.organizationId,
        delegation.id
      )
    );
  });
  it.each(
    Object.values(delegationState).filter((s) => s !== delegationState.active)
  )(
    "should throw organizationIsNotTheProducer if the requester is the e-service delegate but the delegation is in %s state",
    async (delegationState) => {
      const mockEService = getMockEService();
      const mockPurposeVersion = getMockPurposeVersion();
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      const delegate = getMockAuthData();
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: mockEService.id,
        delegateId: delegate.organizationId,
        state: delegationState,
      });

      await writeInReadmodel(delegation, delegations);

      expect(
        purposeService.rejectPurposeVersion(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
            rejectionReason: "test",
          },
          {
            authData: getRandomAuthData(delegate.organizationId),
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(
        organizationIsNotTheProducer(delegate.organizationId)
      );
    }
  );
  it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    const randomVersionId: PurposeVersionId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.rejectPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: randomVersionId,
          rejectionReason: "test",
        },
        {
          authData: getRandomAuthData(mockEService.producerId),
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      purposeVersionNotFound(mockPurpose.id, randomVersionId)
    );
  });
  it.each(
    Object.values(purposeVersionState).filter(
      (state) => state !== purposeVersionState.waitingForApproval
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
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.rejectPurposeVersion(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
            rejectionReason: "test",
          },
          {
            authData: getRandomAuthData(mockEService.producerId),
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(
        notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
      );
    }
  );
});
