import {
  getMockDelegation,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import {
  DelegationEventEnvelopeV2,
  toDelegationV2,
  ProducerDelegationApprovedV2,
  ProducerDelegationRejectedV2,
  ProducerDelegationRevokedV2,
  ProducerDelegationSubmittedV2,
  delegationKind,
  ConsumerDelegationSubmittedV2,
  ConsumerDelegationApprovedV2,
  ConsumerDelegationRejectedV2,
  ConsumerDelegationRevokedV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { handleMessageV2 } from "../src/delegationConsumerServiceV2.js";
import { delegations } from "./utils.js";

describe("Events V2", async () => {
  const mockDelegation = getMockDelegation({
    kind: randomArrayItem(Object.values(delegationKind)),
  });
  const mockMessage: Omit<DelegationEventEnvelopeV2, "type" | "data"> = {
    event_version: 2,
    stream_id: mockDelegation.id,
    version: 1,
    sequence_num: 1,
    log_date: new Date(),
  };

  it("ProducerDelegationApproved", async () => {
    const payload: ProducerDelegationApprovedV2 = {
      delegation: toDelegationV2(mockDelegation),
    };

    const message: DelegationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ProducerDelegationApproved",
      data: payload,
    };

    await handleMessageV2(message, delegations);

    const retrievedDelegation = await delegations.findOne({
      "data.id": mockDelegation.id,
    });

    expect(retrievedDelegation?.data).toEqual(mockDelegation);

    expect(retrievedDelegation?.metadata).toEqual({
      version: 1,
    });
  });

  it("ProducerDelegationRejected", async () => {
    const payload: ProducerDelegationRejectedV2 = {
      delegation: toDelegationV2(mockDelegation),
    };

    const message: DelegationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ProducerDelegationRejected",
      data: payload,
    };

    await handleMessageV2(message, delegations);

    const retrievedDelegation = await delegations.findOne({
      "data.id": mockDelegation.id,
    });

    expect(retrievedDelegation?.data).toEqual(mockDelegation);

    expect(retrievedDelegation?.metadata).toEqual({
      version: 1,
    });
  });

  it("ProducerDelegationRevoked", async () => {
    const payload: ProducerDelegationRevokedV2 = {
      delegation: toDelegationV2(mockDelegation),
    };

    const message: DelegationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ProducerDelegationRevoked",
      data: payload,
    };

    await handleMessageV2(message, delegations);

    const retrievedDelegation = await delegations.findOne({
      "data.id": mockDelegation.id,
    });

    expect(retrievedDelegation?.data).toEqual(mockDelegation);

    expect(retrievedDelegation?.metadata).toEqual({
      version: 1,
    });
  });

  it("ProducerDelegationSubmitted", async () => {
    const payload: ProducerDelegationSubmittedV2 = {
      delegation: toDelegationV2(mockDelegation),
    };

    const message: DelegationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ProducerDelegationSubmitted",
      data: payload,
    };

    await handleMessageV2(message, delegations);

    const retrievedDelegation = await delegations.findOne({
      "data.id": mockDelegation.id,
    });

    expect(retrievedDelegation?.data).toEqual(mockDelegation);

    expect(retrievedDelegation?.metadata).toEqual({
      version: 1,
    });
  });

  it("ConsumerDelegationSubmitted", async () => {
    const payload: ConsumerDelegationSubmittedV2 = {
      delegation: toDelegationV2(mockDelegation),
    };

    const message: DelegationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ConsumerDelegationSubmitted",
      data: payload,
    };

    await handleMessageV2(message, delegations);

    const retrievedDelegation = await delegations.findOne({
      "data.id": mockDelegation.id,
    });

    expect(retrievedDelegation?.data).toEqual(mockDelegation);

    expect(retrievedDelegation?.metadata).toEqual({
      version: 1,
    });
  });

  it("ConsumerDelegationApproved", async () => {
    const payload: ConsumerDelegationApprovedV2 = {
      delegation: toDelegationV2(mockDelegation),
    };

    const message: DelegationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ConsumerDelegationApproved",
      data: payload,
    };

    await handleMessageV2(message, delegations);

    const retrievedDelegation = await delegations.findOne({
      "data.id": mockDelegation.id,
    });

    expect(retrievedDelegation?.data).toEqual(mockDelegation);

    expect(retrievedDelegation?.metadata).toEqual({
      version: 1,
    });
  });

  it("ConsumerDelegationRevoked", async () => {
    const payload: ConsumerDelegationRevokedV2 = {
      delegation: toDelegationV2(mockDelegation),
    };

    const message: DelegationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ConsumerDelegationRevoked",
      data: payload,
    };

    await handleMessageV2(message, delegations);

    const retrievedDelegation = await delegations.findOne({
      "data.id": mockDelegation.id,
    });

    expect(retrievedDelegation?.data).toEqual(mockDelegation);

    expect(retrievedDelegation?.metadata).toEqual({
      version: 1,
    });
  });

  it("ConsumerDelegationRejected", async () => {
    const payload: ConsumerDelegationRejectedV2 = {
      delegation: toDelegationV2(mockDelegation),
    };

    const message: DelegationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ConsumerDelegationRejected",
      data: payload,
    };

    await handleMessageV2(message, delegations);

    const retrievedDelegation = await delegations.findOne({
      "data.id": mockDelegation.id,
    });

    expect(retrievedDelegation?.data).toEqual(mockDelegation);

    expect(retrievedDelegation?.metadata).toEqual({
      version: 1,
    });
  });
});
