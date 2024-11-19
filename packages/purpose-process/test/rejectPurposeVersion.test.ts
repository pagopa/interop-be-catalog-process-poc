/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockPurposeVersion,
  getMockPurpose,
  writeInReadmodel,
  decodeProtobufPayload,
  getMockAuthData,
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
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  eserviceNotFound,
  organizationIsNotTheProducer,
  purposeVersionNotFound,
  notValidVersionState,
} from "../src/model/domain/errors.js";
import {
  getMockEService,
  addOnePurpose,
  readLastPurposeEvent,
  eservices,
  purposeService,
} from "./utils.js";
import { mockPurposeRouterRequest } from "./supertestSetup.js";

describe("rejectPurposeVersion", () => {
  it("should write on event-store for the rejection of a purpose version", async () => {
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

    await mockPurposeRouterRequest.post({
      path: "/purposes/:purposeId/versions/:versionId/reject",
      pathParams: {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
      },
      body: {
        rejectionReason: "the reason for the rejection is because it is a test",
      },
      authData: getMockAuthData(mockEService.producerId),
    });

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
      rejectionReason: "the reason for the rejection is because it is a test",
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
      purposeService.rejectPurposeVersion({
        purposeId: randomId,
        versionId: mockPurposeVersion.id,
        rejectionReason: "test",
        organizationId: mockEService.producerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
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
      purposeService.rejectPurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        rejectionReason: "test",
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(eserviceNotFound(mockEService.id));
  });
  it("should throw organizationIsNotTheProducer if the requester is not the producer", async () => {
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
      purposeService.rejectPurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        rejectionReason: "test",
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationIsNotTheProducer(mockPurpose.consumerId)
    );
  });
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
      purposeService.rejectPurposeVersion({
        purposeId: mockPurpose.id,
        versionId: randomVersionId,
        rejectionReason: "test",
        organizationId: mockEService.producerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
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
        purposeService.rejectPurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
          organizationId: mockEService.producerId,
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
      );
    }
  );
});
