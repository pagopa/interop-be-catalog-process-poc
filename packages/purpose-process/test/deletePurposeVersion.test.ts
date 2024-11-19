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
  purposeVersionState,
  Purpose,
  toReadModelEService,
  generateId,
  WaitingForApprovalPurposeVersionDeletedV2,
  toPurposeV2,
  PurposeId,
  PurposeVersionId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  purposeVersionNotFound,
  organizationIsNotTheConsumer,
  purposeVersionCannotBeDeleted,
} from "../src/model/domain/errors.js";
import {
  addOnePurpose,
  eservices,
  getMockEService,
  purposeService,
  readLastPurposeEvent,
} from "./utils.js";
import { mockPurposeRouterRequest } from "./supertestSetup.js";

describe("deletePurposeVersion", () => {
  it("should write in event-store for the deletion of a purpose version", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1 = getMockPurposeVersion(
      purposeVersionState.waitingForApproval
    );
    const mockPurposeVersion2 = getMockPurposeVersion(
      purposeVersionState.draft
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1, mockPurposeVersion2],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    await mockPurposeRouterRequest.delete({
      path: "/purposes/:purposeId/versions/:versionId",
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
      type: "WaitingForApprovalPurposeVersionDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: WaitingForApprovalPurposeVersionDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [mockPurposeVersion2],
      updatedAt: new Date(),
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

    vi.useRealTimers();
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomId: PurposeId = generateId();
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
      purposeService.deletePurposeVersion({
        purposeId: randomId,
        versionId: mockPurposeVersion.id,
        organizationId: mockEService.producerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(purposeNotFound(randomId));
  });
  it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
    const randomVersionId: PurposeVersionId = generateId();
    const mockEService = getMockEService();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [getMockPurposeVersion()],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.deletePurposeVersion({
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
  it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [
        mockPurposeVersion,
        getMockPurposeVersion(purposeVersionState.draft),
      ],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.deletePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockEService.producerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationIsNotTheConsumer(mockEService.producerId)
    );
  });
  it.each(
    Object.values(purposeVersionState).filter(
      (state) => state !== purposeVersionState.waitingForApproval
    )
  )(
    "should throw purposeVersionCannotBeDeleted if the purpose version is in %s state",
    async (state) => {
      const mockPurposeVersion = getMockPurposeVersion(state);
      const mockEService = getMockEService();
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [
          mockPurposeVersion,
          getMockPurposeVersion(purposeVersionState.draft),
        ],
      };

      await addOnePurpose(mockPurpose);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.deletePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        purposeVersionCannotBeDeleted(mockPurpose.id, mockPurposeVersion.id)
      );
    }
  );
  it("should throw purposeVersionCannotBeDeleted if the purpose has only that version", async () => {
    const mockPurposeVersion = getMockPurposeVersion(
      purposeVersionState.waitingForApproval
    );
    const mockEService = getMockEService();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.deletePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      purposeVersionCannotBeDeleted(mockPurpose.id, mockPurposeVersion.id)
    );
  });
});
