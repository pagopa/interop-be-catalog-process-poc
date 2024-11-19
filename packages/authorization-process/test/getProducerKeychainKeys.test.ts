import {
  getMockAuthData,
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test/src/testUtils.js";
import {
  Key,
  ProducerKeychain,
  ProducerKeychainId,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  producerKeychainNotFound,
  organizationNotAllowedOnProducerKeychain,
} from "../src/model/domain/errors.js";
import { keyToApiKey } from "../src/model/domain/apiConverter.js";
import { addOneProducerKeychain, authorizationService } from "./utils.js";
import { mockProducerKeyChainRouterRequest } from "./supertestSetup.js";

describe("getProducerKeychainKeys", async () => {
  const producerId: TenantId = generateId();
  const mockKey = getMockKey();
  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    keys: [mockKey],
    producerId,
  };

  it("should get the keys in the specified client", async () => {
    const keyUserId1: UserId = generateId();
    const keyUserId2: UserId = generateId();
    const keyUserId3: UserId = generateId();

    const keyWithUser1: Key = {
      ...mockKey,
      userId: keyUserId1,
    };
    const keyWithUser2: Key = {
      ...mockKey,
      userId: keyUserId2,
    };
    const keyWithUser3: Key = {
      ...mockKey,
      userId: keyUserId3,
    };
    const producerKeychainWithKeyUser: ProducerKeychain = {
      ...mockProducerKeychain,
      keys: [keyWithUser1, keyWithUser2, keyWithUser3],
      users: [keyUserId1, keyUserId2, keyUserId3],
    };
    await addOneProducerKeychain(producerKeychainWithKeyUser);

    const keys = await mockProducerKeyChainRouterRequest.get({
      path: "/producerKeychains/:producerKeychainId/keys",
      pathParams: {
        producerKeychainId: mockProducerKeychain.id,
      },
      queryParams: { userIds: [keyUserId1, keyUserId2, keyUserId3] },
      authData: getMockAuthData(producerId),
    });

    expect(keys).toEqual({
      keys: [
        keyToApiKey(keyWithUser1),
        keyToApiKey(keyWithUser2),
        keyToApiKey(keyWithUser3),
      ],
    });
  });
  it("should get the keys of the specified producer keychain, but only limited to the keys belonging to specific users", async () => {
    const keyUserId1: UserId = generateId();
    const keyUserId2: UserId = generateId();
    const keyUserId3: UserId = generateId();

    const userId: UserId = generateId();

    const keyWithUser1: Key = {
      ...mockKey,
      userId: keyUserId1,
    };
    const keyWithUser2: Key = {
      ...mockKey,
      userId: keyUserId2,
    };
    const keyWithUser3: Key = {
      ...mockKey,
      userId: keyUserId3,
    };
    const producerKeychainWithKeyUser: ProducerKeychain = {
      ...mockProducerKeychain,
      keys: [keyWithUser1, keyWithUser2, keyWithUser3],
      users: [userId, keyUserId1, keyUserId2, keyUserId3],
    };
    await addOneProducerKeychain(producerKeychainWithKeyUser);

    const keys = await mockProducerKeyChainRouterRequest.get({
      path: "/producerKeychains/:producerKeychainId/keys",
      pathParams: {
        producerKeychainId: producerKeychainWithKeyUser.id,
      },
      queryParams: { userIds: [keyUserId1] },
      authData: getMockAuthData(producerId),
    });

    expect(keys).toEqual({
      keys: [keyToApiKey(keyWithUser1)],
    });
  });
  it("should throw producerKeychainNotFound if the producer keychain with the specified Id doesn't exist", async () => {
    await addOneProducerKeychain(mockProducerKeychain);
    const producerKeychainId: ProducerKeychainId = generateId();
    await expect(
      authorizationService.getProducerKeychainKeys({
        producerKeychainId,
        userIds: [],
        organizationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(producerKeychainNotFound(producerKeychainId));
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    await addOneProducerKeychain(mockProducerKeychain);
    const organizationId: TenantId = generateId();
    await expect(
      authorizationService.getProducerKeychainKeys({
        producerKeychainId: mockProducerKeychain.id,
        userIds: [],
        organizationId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnProducerKeychain(
        organizationId,
        mockProducerKeychain.id
      )
    );
  });
});
