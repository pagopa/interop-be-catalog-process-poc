/* eslint-disable functional/no-let */
import {
  decodeProtobufPayload,
  getMockDelegation,
  getMockTenant,
  getRandomAuthData,
} from "pagopa-interop-commons-test/index.js";
import { describe, expect, it, vi } from "vitest";
import {
  DelegationId,
  ProducerDelegationRejectedV2,
  delegationKind,
  generateId,
  toDelegationV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { delegationState } from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  delegationNotFound,
  operationRestrictedToDelegate,
  incorrectState,
} from "../src/model/domain/errors.js";
import {
  addOneDelegation,
  delegationService,
  readLastDelegationEvent,
} from "./utils.js";

describe("reject producer delegation", () => {
  it("should reject delegation if all validations succeed", async () => {
    const currentExecutionTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);

    const delegate = getMockTenant();
    const authData = getRandomAuthData(delegate.id);
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      state: "WaitingForApproval",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    const rejectionReason = "I don't like computers, please send me a pigeon";

    await delegationService.rejectProducerDelegation(
      delegation.id,
      rejectionReason,
      {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    const event = await readLastDelegationEvent(delegation.id);

    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType: ProducerDelegationRejectedV2,
      payload: event.data,
    });
    const expectedDelegation = toDelegationV2({
      ...delegation,
      state: delegationState.rejected,
      rejectedAt: currentExecutionTime,
      rejectionReason,
      stamps: {
        ...delegation.stamps,
        rejection: { who: authData.userId, when: currentExecutionTime },
      },
    });
    expect(actualDelegation).toEqual(expectedDelegation);
  });

  it("should throw delegationNotFound when delegation doesn't exist", async () => {
    const delegateId = getMockTenant().id;
    const nonExistentDelegationId =
      unsafeBrandId<DelegationId>("non-existent-id");

    await expect(
      delegationService.rejectProducerDelegation(nonExistentDelegationId, "", {
        authData: getRandomAuthData(delegateId),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrow(
      delegationNotFound(
        nonExistentDelegationId,
        delegationKind.delegatedProducer
      )
    );
  });

  it("should throw delegationNotFound when delegation kind is not DelegatedProducer", async () => {
    const delegate = getMockTenant();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      state: "WaitingForApproval",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    const rejectionReason = "I don't like computers, please send me a pigeon";

    await expect(
      delegationService.rejectProducerDelegation(
        delegation.id,
        rejectionReason,
        {
          authData: getRandomAuthData(delegate.id),
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrow(
      delegationNotFound(delegation.id, delegationKind.delegatedProducer)
    );
  });

  it("should throw operationRestrictedToDelegate when rejecter is not the delegate", async () => {
    const delegate = getMockTenant();
    const wrongDelegate = getMockTenant();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      state: "WaitingForApproval",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    await expect(
      delegationService.rejectProducerDelegation(delegation.id, "", {
        authData: getRandomAuthData(wrongDelegate.id),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrow(
      operationRestrictedToDelegate(wrongDelegate.id, delegation.id)
    );
  });

  it.each(
    Object.values(delegationState).filter(
      (state) => state !== delegationState.waitingForApproval
    )
  )(
    "should throw incorrectState when delegation is in %s state",
    async (state) => {
      const delegate = getMockTenant();
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        state,
        delegateId: delegate.id,
      });
      await addOneDelegation(delegation);

      await expect(
        delegationService.rejectProducerDelegation(delegation.id, "", {
          authData: getRandomAuthData(delegate.id),
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrow(
        incorrectState(delegation.id, state, delegationState.waitingForApproval)
      );
    }
  );
});
