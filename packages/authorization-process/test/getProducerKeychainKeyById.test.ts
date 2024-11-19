/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { ProducerKeychain, TenantId, generateId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockProducerKeychain,
  getMockKey,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  producerKeychainNotFound,
  producerKeyNotFound,
  organizationNotAllowedOnProducerKeychain,
} from "../src/model/domain/errors.js";
import { keyToApiKey } from "../src/model/domain/apiConverter.js";
import { addOneProducerKeychain, authorizationService } from "./utils.js";
import { mockProducerKeyChainRouterRequest } from "./supertestSetup.js";

describe("getProducerKeychainKeyById", async () => {
  it("should get the producer keychain key if it exists", async () => {
    const producerId: TenantId = generateId();
    const mockKey1 = getMockKey();
    const mockKey2 = getMockKey();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      keys: [mockKey1, mockKey2],
    };
    await addOneProducerKeychain(mockProducerKeychain);

    const retrievedKey = await mockProducerKeyChainRouterRequest.get({
      path: "/producerKeychains/:producerKeychainId/keys/:keyId",
      pathParams: {
        producerKeychainId: mockProducerKeychain.id,
        keyId: mockKey1.kid,
      },
      authData: getMockAuthData(producerId),
    });

    expect(retrievedKey).toEqual(keyToApiKey(mockKey1));
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    const organizationId: TenantId = generateId();
    const mockKey = getMockKey();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: generateId(),
      keys: [mockKey],
    };
    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.getProducerKeychainKeyById({
        producerKeychainId: mockProducerKeychain.id,
        kid: mockKey.kid,
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
  it("should throw producerKeychainNotFound if the producer keychain doesn't exist", async () => {
    const producerId: TenantId = generateId();
    const mockKey = getMockKey();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      keys: [mockKey],
    };

    expect(
      authorizationService.getProducerKeychainKeyById({
        producerKeychainId: mockProducerKeychain.id,
        kid: mockKey.kid,
        organizationId: producerId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(producerKeychainNotFound(mockProducerKeychain.id));
  });
  it("should throw producerKeyNotFound if the key doesn't exist", async () => {
    const producerId: TenantId = generateId();
    const mockKey = getMockKey();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      keys: [getMockKey()],
    };
    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.getProducerKeychainKeyById({
        producerKeychainId: mockProducerKeychain.id,
        kid: mockKey.kid,
        organizationId: producerId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      producerKeyNotFound(mockKey.kid, mockProducerKeychain.id)
    );
  });
});
