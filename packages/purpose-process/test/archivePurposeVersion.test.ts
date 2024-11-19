/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockPurposeVersion,
  getMockPurpose,
  decodeProtobufPayload,
  getMockAuthData,
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
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  organizationIsNotTheConsumer,
  purposeVersionNotFound,
  notValidVersionState,
} from "../src/model/domain/errors.js";
import { apiPurposeVersionToPurposeVersion } from "../src/model/domain/apiConverter.js";
import {
  addOnePurpose,
  purposeService,
  readLastPurposeEvent,
} from "./utils.js";
import { mockPurposeRouterRequest } from "./supertestSetup.js";

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

    const returnedPurposeVersion = await mockPurposeRouterRequest.post({
      path: "/purposes/:purposeId/versions/:versionId/archive",
      pathParams: {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
      },
      authData: getMockAuthData(mockPurpose.consumerId),
    });

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
    ).toEqual(
      toPurposeVersionV2(
        apiPurposeVersionToPurposeVersion(returnedPurposeVersion)
      )
    );

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

    const returnedPurposeVersion = await mockPurposeRouterRequest.post({
      path: "/purposes/:purposeId/versions/:versionId/archive",
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
      purposeService.archivePurposeVersion({
        purposeId: randomPurposeId,
        versionId: randomVersionId,
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
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
      purposeService.archivePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: randomOrganizationId,
        correlationId: generateId(),
        logger: genericLogger,
      })
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
      purposeService.archivePurposeVersion({
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
        purposeService.archivePurposeVersion({
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
