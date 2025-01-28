/* eslint-disable functional/no-let */
import {
  decodeProtobufPayload,
  getMockDelegation,
  getMockTenant,
  getRandomAuthData,
} from "pagopa-interop-commons-test/index.js";
import { describe, expect, it, vi } from "vitest";
import {
  ConsumerDelegationRejectedV2,
  DelegationId,
  delegationKind,
  generateId,
  ProducerDelegationRejectedV2,
  TenantId,
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

describe.each([
  delegationKind.delegatedConsumer,
  delegationKind.delegatedProducer,
])("reject %s delegation", (kind) => {
  const rejectFn =
    kind === delegationKind.delegatedConsumer
      ? delegationService.rejectConsumerDelegation
      : delegationService.rejectProducerDelegation;

  it("should reject delegation if all validations succeed", async () => {
    const currentExecutionTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);

    const delegate = getMockTenant();
    const authData = getRandomAuthData(delegate.id);
    const delegation = getMockDelegation({
      kind,
      state: delegationState.waitingForApproval,
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    const rejectionReason = "I don't like computers, please send me a pigeon";

    await rejectFn(delegation.id, rejectionReason, {
      authData,
      serviceName: "",
      correlationId: generateId(),
      logger: genericLogger,
    });

    const event = await readLastDelegationEvent(delegation.id);

    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType:
        kind === delegationKind.delegatedConsumer
          ? ConsumerDelegationRejectedV2
          : ProducerDelegationRejectedV2,
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
    const nonExistentDelegationId =
      unsafeBrandId<DelegationId>("non-existent-id");

    await expect(
      rejectFn(nonExistentDelegationId, "", {
        authData: getRandomAuthData(),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrow(delegationNotFound(nonExistentDelegationId, kind));
  });

  it(`should throw delegationNotFound when delegation kind is not ${kind}`, async () => {
    const delegation = getMockDelegation({
      kind:
        kind === delegationKind.delegatedConsumer
          ? delegationKind.delegatedProducer
          : delegationKind.delegatedConsumer,
      state: delegationState.waitingForApproval,
    });
    await addOneDelegation(delegation);

    const rejectionReason = "I don't like computers, please send me a pigeon";

    await expect(
      rejectFn(delegation.id, rejectionReason, {
        authData: getRandomAuthData(delegation.delegateId),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrow(delegationNotFound(delegation.id, kind));
  });

  it("should throw operationRestrictedToDelegate when rejecter is not the delegate", async () => {
    const wrongDelegateId = generateId<TenantId>();
    const delegation = getMockDelegation({
      kind,
      state: delegationState.waitingForApproval,
    });
    await addOneDelegation(delegation);

    await expect(
      rejectFn(delegation.id, "", {
        authData: getRandomAuthData(wrongDelegateId),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrow(
      operationRestrictedToDelegate(wrongDelegateId, delegation.id)
    );
  });

  it.each(
    Object.values(delegationState).filter(
      (state) => state !== delegationState.waitingForApproval
    )
  )(
    "should throw incorrectState when delegation is in %s state",
    async (state) => {
      const delegation = getMockDelegation({
        kind,
        state,
      });
      await addOneDelegation(delegation);

      await expect(
        rejectFn(delegation.id, "", {
          authData: getRandomAuthData(delegation.delegateId),
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
