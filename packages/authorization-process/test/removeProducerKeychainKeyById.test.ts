/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockProducerKeychain,
  getMockKey,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  ProducerKeychainKeyDeletedV2,
  Key,
  UserId,
  generateId,
  ProducerKeychain,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import { genericLogger, userRoles } from "pagopa-interop-commons";
import { getMockAuthData } from "pagopa-interop-commons-test";
import {
  producerKeychainNotFound,
  producerKeyNotFound,
  organizationNotAllowedOnProducerKeychain,
  userNotAllowedOnProducerKeychain,
  userNotAllowedToDeleteProducerKeychainKey,
} from "../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";
import { mockProducerKeyChainRouterRequest } from "./supertestSetup.js";

describe("remove producer keychain key", () => {
  it("should write on event-store for removing a key from a producer keychain", async () => {
    const mockProducer = getMockTenant();
    const keyToRemove = getMockKey();
    const keyToNotRemove = getMockKey();

    const authData = {
      ...getMockAuthData(mockProducer.id),
      userRoles: [userRoles.ADMIN_ROLE],
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      keys: [keyToRemove, keyToNotRemove],
      users: [authData.userId],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    await mockProducerKeyChainRouterRequest.delete({
      path: "/producerKeychains/:producerKeychainId/keys/:keyId",
      pathParams: {
        producerKeychainId: mockProducerKeychain.id,
        keyId: keyToRemove.kid,
      },
      authData,
    });

    const writtenEvent = await readLastAuthorizationEvent(
      mockProducerKeychain.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockProducerKeychain.id,
      version: "1",
      type: "ProducerKeychainKeyDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainKeyDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      kid: keyToRemove.kid,
      producerKeychain: toProducerKeychainV2({
        ...mockProducerKeychain,
        keys: [keyToNotRemove],
      }),
    });
  });
  it("should write on event-store for removing a key from a producer keychain (admin user deleting another user's key)", async () => {
    const mockProducer = getMockTenant();
    const mockUserId: UserId = generateId();
    const anotherUserId: UserId = generateId();

    const authData = {
      ...getMockAuthData(mockProducer.id),
      userRoles: [userRoles.ADMIN_ROLE],
      userId: mockUserId,
    };

    const keyToRemove: Key = {
      ...getMockKey(),
      userId: anotherUserId,
    };
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      keys: [keyToRemove],
      users: [authData.userId],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    await mockProducerKeyChainRouterRequest.delete({
      path: "/producerKeychains/:producerKeychainId/keys/:keyId",
      pathParams: {
        producerKeychainId: mockProducerKeychain.id,
        keyId: keyToRemove.kid,
      },
      authData,
    });

    const writtenEvent = await readLastAuthorizationEvent(
      mockProducerKeychain.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockProducerKeychain.id,
      version: "1",
      type: "ProducerKeychainKeyDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainKeyDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      kid: keyToRemove.kid,
      producerKeychain: toProducerKeychainV2({
        ...mockProducerKeychain,
        keys: [],
      }),
    });
  });
  it("should throw producerKeychainNotFound if the producer keychain doesn't exist", async () => {
    const mockProducer = getMockTenant();
    const keyToRemove = getMockKey();

    const authData = getMockAuthData(mockProducer.id);

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      keys: [keyToRemove],
      users: [authData.userId],
    };

    await addOneProducerKeychain(getMockProducerKeychain());

    expect(
      authorizationService.removeProducerKeychainKeyById({
        producerKeychainId: mockProducerKeychain.id,
        keyIdToRemove: keyToRemove.kid,
        authData,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(producerKeychainNotFound(mockProducerKeychain.id));
  });
  it("should throw producerKeyNotFound if the key doesn't exist in that producer keychain", async () => {
    const mockProducer = getMockTenant();
    const notExistingKeyId = generateId();
    const keyToNotRemove = getMockKey();

    const authData = getMockAuthData(mockProducer.id);

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      keys: [keyToNotRemove],
      users: [authData.userId],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.removeProducerKeychainKeyById({
        producerKeychainId: mockProducerKeychain.id,
        keyIdToRemove: notExistingKeyId,
        authData,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      producerKeyNotFound(notExistingKeyId, mockProducerKeychain.id)
    );
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    const mockProducer1 = getMockTenant();
    const mockProducer2 = getMockTenant();
    const keyToRemove = getMockKey();

    const authData = getMockAuthData(mockProducer2.id);

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer1.id,
      keys: [keyToRemove],
      users: [authData.userId],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.removeProducerKeychainKeyById({
        producerKeychainId: mockProducerKeychain.id,
        keyIdToRemove: keyToRemove.kid,
        authData,
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
  it("should throw userNotAllowedOnProducerKeychain if a security user tries to delete a key without being member of the producer keychain", async () => {
    const mockProducer = getMockTenant();
    const mockUserId: UserId = generateId();
    const keyToRemove: Key = {
      ...getMockKey(),
      userId: mockUserId,
    };
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      keys: [keyToRemove],
      users: [],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.removeProducerKeychainKeyById({
        producerKeychainId: mockProducerKeychain.id,
        keyIdToRemove: keyToRemove.kid,
        authData: {
          ...getMockAuthData(mockProducer.id),
          userRoles: [userRoles.SECURITY_ROLE],
          userId: mockUserId,
        },
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      userNotAllowedOnProducerKeychain(mockUserId, mockProducerKeychain.id)
    );
  });
  it("should throw userNotAllowedToDeleteClientKey if a security user tries to delete a key not uploaded by himself", async () => {
    const mockProducer = getMockTenant();
    const mockUserId: UserId = generateId();
    const keyToRemove: Key = { ...getMockKey(), userId: generateId() };
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      keys: [keyToRemove],
      users: [mockUserId],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.removeProducerKeychainKeyById({
        producerKeychainId: mockProducerKeychain.id,
        keyIdToRemove: keyToRemove.kid,
        authData: {
          ...getMockAuthData(mockProducer.id),
          userRoles: [userRoles.SECURITY_ROLE],
          userId: mockUserId,
        },
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      userNotAllowedToDeleteProducerKeychainKey(
        mockUserId,
        mockProducerKeychain.id,
        keyToRemove.kid
      )
    );
  });
});
