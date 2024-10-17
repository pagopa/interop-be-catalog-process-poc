/* eslint-disable functional/no-let */
import {
  decodeProtobufPayload,
  getMockDelegationProducer,
  getMockTenant,
} from "pagopa-interop-commons-test/index.js";
import { describe, expect, it } from "vitest";
import {
  DelegationApprovedV2,
  DelegationId,
  DelegationStateV2,
  toDelegationV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { delegationState } from "pagopa-interop-models";
import {
  delegationNotFound,
  operationRestrictedToDelegate,
  incorrectState,
} from "../src/model/domain/errors.js";
import {
  addOneDelegation,
  delegationProducerService,
  readLastDelegationEvent,
} from "./utils.js";

describe("approve delegation", () => {
  it("should approve delegation in the happy path", async () => {
    const delegate = getMockTenant();
    const delegation = getMockDelegationProducer({
      state: "WaitingForApproval",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    await delegationProducerService.approveProducerDelegation(
      delegate.id,
      delegation.id,
      "9999"
    );

    const event = await readLastDelegationEvent(delegation.id);

    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType: DelegationApprovedV2,
      payload: event.data,
    });
    const expectedDelegation = {
      ...toDelegationV2(delegation),
      state: DelegationStateV2.ACTIVE,
    };

    expect(actualDelegation).toEqual(expectedDelegation);
  });

  it("should throw delegationNotFound when delegation doesn't exist", async () => {
    const delegateId = getMockTenant().id;
    const nonExistentDelegationId =
      unsafeBrandId<DelegationId>("non-existent-id");

    await expect(
      delegationProducerService.approveProducerDelegation(
        delegateId,
        nonExistentDelegationId,
        "9999"
      )
    ).rejects.toThrow(delegationNotFound(nonExistentDelegationId));
  });

  it("should throw operationRestrictedToDelegate when approver is not the delegate", async () => {
    const delegate = getMockTenant();
    const wrongDelegate = getMockTenant();
    const delegation = getMockDelegationProducer({
      state: "WaitingForApproval",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    await expect(
      delegationProducerService.approveProducerDelegation(
        wrongDelegate.id,
        delegation.id,
        "9999"
      )
    ).rejects.toThrow(
      operationRestrictedToDelegate(wrongDelegate.id, delegation.id)
    );
  });

  it("should throw incorrectState when delegation is not in WaitingForApproval state", async () => {
    const delegate = getMockTenant();
    const delegation = getMockDelegationProducer({
      state: "Active",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    await expect(
      delegationProducerService.approveProducerDelegation(
        delegate.id,
        delegation.id,
        "9999"
      )
    ).rejects.toThrow(
      incorrectState(
        delegation.id,
        delegationState.active,
        delegationState.waitingForApproval
      )
    );
  });
});
