/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockPurposeVersion,
  getMockPurpose,
  decodeProtobufPayload,
  getMockDelegation,
} from "pagopa-interop-commons-test";
import {
  PurposeVersion,
  purposeVersionState,
  Purpose,
  generateId,
  toPurposeV2,
  PurposeId,
  PurposeVersionId,
  delegationKind,
  delegationState,
  PurposeVersionArchivedByRevokedDelegationV2,
  DelegationId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  purposeVersionNotFound,
  notValidVersionState,
  puroposeDelegationNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOnePurpose,
  purposeService,
  readLastPurposeEvent,
} from "./utils.js";

describe("internalArchivePurposeVersionAfterDelegationRevocation", () => {
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
      delegationId: generateId<DelegationId>(),
    };

    const mockDelegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      state: delegationState.active,
    });

    await addOneDelegation(mockDelegation);
    await addOnePurpose(mockPurpose);

    await purposeService.internalArchivePurposeVersionAfterDelegationRevocation(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        delegationId: mockDelegation.id,
      },
      generateId(),
      genericLogger
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionArchivedByRevokedDelegation",
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
      messageType: PurposeVersionArchivedByRevokedDelegationV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(expectedPurpose),
      versionId: mockPurposeVersion.id,
      delegationId: mockDelegation.id,
    });

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
      delegationId: generateId<DelegationId>(),
    };

    const mockDelegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      state: delegationState.active,
    });

    await addOneDelegation(mockDelegation);
    await addOnePurpose(mockPurpose);

    await purposeService.internalArchivePurposeVersionAfterDelegationRevocation(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
        delegationId: mockDelegation.id,
      },
      generateId(),
      genericLogger
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionArchivedByRevokedDelegation",
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
      messageType: PurposeVersionArchivedByRevokedDelegationV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(expectedPurpose),
      versionId: mockPurposeVersion1.id,
      delegationId: mockDelegation.id,
    });

    vi.useRealTimers();
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomPurposeId: PurposeId = generateId();

    const mockDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      state: delegationState.active,
    });

    await addOneDelegation(mockDelegation);

    expect(
      purposeService.internalArchivePurposeVersionAfterDelegationRevocation(
        {
          purposeId: randomPurposeId,
          versionId: generateId(),
          delegationId: mockDelegation.id,
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(purposeNotFound(randomPurposeId));
  });
  it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
    const randomVersionId: PurposeVersionId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      versions: [],
      delegationId: generateId<DelegationId>(),
    };

    const mockDelegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      state: delegationState.active,
    });

    await addOneDelegation(mockDelegation);
    await addOnePurpose(mockPurpose);

    expect(
      purposeService.internalArchivePurposeVersionAfterDelegationRevocation(
        {
          purposeId: mockPurpose.id,
          versionId: randomVersionId,
          delegationId: mockDelegation.id,
        },
        generateId(),
        genericLogger
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
        delegationId: generateId<DelegationId>(),
      };

      const mockDelegation = getMockDelegation({
        id: mockPurpose.delegationId,
        kind: delegationKind.delegatedConsumer,
        eserviceId: mockPurpose.eserviceId,
        delegatorId: mockPurpose.consumerId,
        state: delegationState.active,
      });

      await addOneDelegation(mockDelegation);
      await addOnePurpose(mockPurpose);

      expect(
        purposeService.internalArchivePurposeVersionAfterDelegationRevocation(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
            delegationId: mockDelegation.id,
          },
          generateId(),
          genericLogger
        )
      ).rejects.toThrowError(
        notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
      );
    }
  );
  it("should throw puroposeDelegationNotFound when the delegation cannot be found", async () => {
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    await addOnePurpose(mockPurpose);
    expect(
      purposeService.internalArchivePurposeVersionAfterDelegationRevocation(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: mockPurpose.delegationId!,
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      puroposeDelegationNotFound(mockPurpose.id, mockPurpose.delegationId!)
    );
  });
  it("should throw puroposeDelegationNotFound when the delegationId of the purpose is not the same of the one passed", async () => {
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    const mockDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      state: delegationState.active,
    });

    await addOneDelegation(mockDelegation);
    await addOnePurpose(mockPurpose);
    expect(
      purposeService.internalArchivePurposeVersionAfterDelegationRevocation(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: mockDelegation.id,
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      puroposeDelegationNotFound(mockPurpose.id, mockDelegation.id)
    );
  });
});
