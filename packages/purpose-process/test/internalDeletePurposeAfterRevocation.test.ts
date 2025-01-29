/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  DelegationId,
  Purpose,
  PurposeDeletedByRevokedDelegationV2,
  PurposeId,
  PurposeVersion,
  delegationKind,
  delegationState,
  generateId,
  purposeVersionState,
  toPurposeV2,
} from "pagopa-interop-models";
import {
  getMockPurpose,
  decodeProtobufPayload,
  getMockPurposeVersion,
  getMockDelegation,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  purposeCannotBeDeleted,
  puroposeDelegationNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOnePurpose,
  purposeService,
  readLastPurposeEvent,
} from "./utils.js";

describe("internalDeletePurposeAfterDelegationRevocation", () => {
  it("should write on event-store for the deletion of a purpose (no versions)", async () => {
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

    await purposeService.internalDeletePurposeAfterDelegationRevocation(
      mockPurpose.id,
      mockDelegation.id,
      generateId(),
      genericLogger
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeDeletedByRevokedDelegation",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeDeletedByRevokedDelegationV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(mockPurpose),
      delegationId: mockDelegation.id,
    });
  });
  it.each([purposeVersionState.draft, purposeVersionState.waitingForApproval])(
    "should write on event-store for the deletion of a purpose (%s version)",
    async (versionState) => {
      const mockPurposeVersion = getMockPurposeVersion(versionState);
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

      await purposeService.internalDeletePurposeAfterDelegationRevocation(
        mockPurpose.id,
        mockDelegation.id,
        generateId(),
        genericLogger
      );

      const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "1",
        type: "PurposeDeletedByRevokedDelegation",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeDeletedByRevokedDelegationV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload).toEqual({
        purpose: toPurposeV2(mockPurpose),
        delegationId: mockDelegation.id,
      });
    }
  );
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomId: PurposeId = generateId();

    const mockDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      state: delegationState.active,
    });

    await addOneDelegation(mockDelegation);

    expect(
      purposeService.internalDeletePurposeAfterDelegationRevocation(
        randomId,
        mockDelegation.id,
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(purposeNotFound(randomId));
  });
  it.each(
    Object.values(purposeVersionState).filter(
      (state) =>
        state !== purposeVersionState.waitingForApproval &&
        state !== purposeVersionState.draft
    )
  )(
    "should throw purposeCannotBeDeleted if the purpose has a %s version ",
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
        purposeService.internalDeletePurposeAfterDelegationRevocation(
          mockPurpose.id,
          mockDelegation.id,
          generateId(),
          genericLogger
        )
      ).rejects.toThrowError(purposeCannotBeDeleted(mockPurpose.id));
    }
  );
  it("should throw puroposeDelegationNotFound when the delegation cannot be found", async () => {
    const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
      purposeVersionState.draft
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.internalDeletePurposeAfterDelegationRevocation(
        mockPurpose.id,
        mockPurpose.delegationId!,
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      puroposeDelegationNotFound(mockPurpose.id, mockPurpose.delegationId!)
    );
  });
  it("should throw puroposeDelegationNotFound when the purpose delegationId is not equal to the one passed", async () => {
    const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
      purposeVersionState.draft
    );
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
      purposeService.internalDeletePurposeAfterDelegationRevocation(
        mockPurpose.id,
        mockDelegation.id,
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      puroposeDelegationNotFound(mockPurpose.id, mockDelegation.id)
    );
  });
});
