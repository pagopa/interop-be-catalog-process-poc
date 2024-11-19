/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it, vi } from "vitest";
import {
  getMockPurposeVersion,
  getMockPurpose,
  writeInReadmodel,
  decodeProtobufPayload,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  PurposeVersion,
  purposeVersionState,
  Purpose,
  toReadModelEService,
  generateId,
  PurposeVersionSuspendedByConsumerV2,
  toPurposeV2,
  PurposeVersionSuspendedByProducerV2,
  PurposeId,
  PurposeVersionId,
  TenantId,
  toPurposeVersionV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  purposeVersionNotFound,
  organizationNotAllowed,
  notValidVersionState,
} from "../src/model/domain/errors.js";
import { apiPurposeVersionToPurposeVersion } from "../src/model/domain/apiConverter.js";
import {
  addOnePurpose,
  eservices,
  getMockEService,
  purposeService,
  readLastPurposeEvent,
} from "./utils.js";
import { mockPurposeRouterRequest } from "./supertestSetup.js";

describe("suspendPurposeVersion", () => {
  it("should write on event-store for the suspension of a purpose version by the consumer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1],
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const returnedPurposeVersion = await mockPurposeRouterRequest.post({
      path: "/purposes/:purposeId/versions/:versionId/suspend",
      pathParams: {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
      },
      authData: getMockAuthData(mockPurpose.consumerId),
    });

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
    ).toEqual(
      toPurposeVersionV2(
        apiPurposeVersionToPurposeVersion(returnedPurposeVersion)
      )
    );

    vi.useRealTimers();
  });
  it("should write on event-store for the suspension of a purpose version by the producer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1],
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const returnedPurposeVersion = await mockPurposeRouterRequest.post({
      path: "/purposes/:purposeId/versions/:versionId/suspend",
      pathParams: {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
      },
      authData: getMockAuthData(mockEService.producerId),
    });

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
    ).toEqual(
      toPurposeVersionV2(
        apiPurposeVersionToPurposeVersion(returnedPurposeVersion)
      )
    );

    vi.useRealTimers();
  });
  it("should write on event-store for the suspension of a purpose version by the producer (self consumer)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: mockEService.producerId,
      versions: [mockPurposeVersion1],
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const returnedPurposeVersion = await mockPurposeRouterRequest.post({
      path: "/purposes/:purposeId/versions/:versionId/suspend",
      pathParams: {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
      },
      authData: getMockAuthData(mockEService.producerId),
    });

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
    ).toEqual(
      toPurposeVersionV2(
        apiPurposeVersionToPurposeVersion(returnedPurposeVersion)
      )
    );

    vi.useRealTimers();
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomPurposeId: PurposeId = generateId();
    const randomVersionId: PurposeVersionId = generateId();
    const mockPurpose = getMockPurpose();
    await addOnePurpose(mockPurpose);

    expect(
      purposeService.suspendPurposeVersion({
        purposeId: randomPurposeId,
        versionId: randomVersionId,
        organizationId: generateId(),
        correlationId: generateId(),
        logger: genericLogger,
      })
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
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.suspendPurposeVersion({
        purposeId: mockPurpose.id,
        versionId: randomVersionId,
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      purposeVersionNotFound(mockPurpose.id, randomVersionId)
    );
  });
  it("should throw organizationNotAllowed if the requester is not the producer nor the consumer", async () => {
    const mockEService = getMockEService();
    const randomId: TenantId = generateId();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.suspendPurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: randomId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(organizationNotAllowed(randomId));
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
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.suspendPurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
      );
    }
  );
});
