/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockProducerKeychain,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  ProducerKeychain,
  ProducerKeychainUserDeletedV2,
  UserId,
  generateId,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  producerKeychainNotFound,
  producerKeychainUserIdNotFound,
  organizationNotAllowedOnProducerKeychain,
} from "../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";
import { mockProducerKeyChainRouterRequest } from "./supertestSetup.js";

describe("remove producer keychain user", () => {
  it("should write on event-store for removing a user from a producer keychain", async () => {
    const mockProducer = getMockTenant();
    const userIdToRemove: UserId = generateId();
    const userIdToNotRemove: UserId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      users: [userIdToRemove, userIdToNotRemove],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    await mockProducerKeyChainRouterRequest.delete({
      path: "/producerKeychains/:producerKeychainId/users/:userId",
      pathParams: {
        producerKeychainId: mockProducerKeychain.id,
        userId: userIdToRemove,
      },
      authData: getMockAuthData(mockProducer.id),
    });

    const writtenEvent = await readLastAuthorizationEvent(
      mockProducerKeychain.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockProducerKeychain.id,
      version: "1",
      type: "ProducerKeychainUserDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainUserDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedProducerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      users: [userIdToNotRemove],
    };

    expect(writtenPayload).toEqual({
      userId: userIdToRemove,
      producerKeychain: toProducerKeychainV2(expectedProducerKeychain),
    });
  });
  it("should throw producerKeychainNotFound if the producer keychain doesn't exist", async () => {
    const mockProducer = getMockTenant();
    const userIdToRemove: UserId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      users: [userIdToRemove],
    };

    await addOneProducerKeychain(getMockProducerKeychain());

    expect(
      authorizationService.removeProducerKeychainUser({
        producerKeychainId: mockProducerKeychain.id,
        userIdToRemove,
        organizationId: mockProducer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(producerKeychainNotFound(mockProducerKeychain.id));
  });
  it("should throw producerKeychainUserIdNotFound if the user isn't related to that producer keychain", async () => {
    const mockProducer = getMockTenant();
    const notExistingUserId: UserId = generateId();
    const userIdToNotRemove: UserId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      users: [userIdToNotRemove],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.removeProducerKeychainUser({
        producerKeychainId: mockProducerKeychain.id,
        userIdToRemove: notExistingUserId,
        organizationId: mockProducer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      producerKeychainUserIdNotFound(notExistingUserId, mockProducerKeychain.id)
    );
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    const mockProducer1 = getMockTenant();
    const mockProducer2 = getMockTenant();
    const userIdToRemove: UserId = generateId();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer1.id,
      users: [userIdToRemove],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.removeProducerKeychainUser({
        producerKeychainId: mockProducerKeychain.id,
        userIdToRemove,
        organizationId: mockProducer2.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnProducerKeychain(
        mockProducer2.id,
        mockProducerKeychain.id
      )
    );
  });
});
