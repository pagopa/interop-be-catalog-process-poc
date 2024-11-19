import {
  getMockAuthData,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test/src/testUtils.js";
import {
  ProducerKeychain,
  ProducerKeychainId,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  organizationNotAllowedOnProducerKeychain,
  producerKeychainNotFound,
} from "../src/model/domain/errors.js";
import { addOneProducerKeychain, authorizationService } from "./utils.js";
import { mockProducerKeyChainRouterRequest } from "./supertestSetup.js";

describe("getProducerKeychainUsers", async () => {
  it("should get from the readModel the users in the specified producer keychain", async () => {
    const organizationId: TenantId = generateId();
    const userId1: UserId = generateId();
    const userId2: UserId = generateId();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      users: [userId1, userId2],
      producerId: organizationId,
    };

    await addOneProducerKeychain(mockProducerKeychain);

    const users = await mockProducerKeyChainRouterRequest.get({
      path: "/producerKeychains/:producerKeychainId/users",
      pathParams: { producerKeychainId: mockProducerKeychain.id },
      authData: getMockAuthData(organizationId),
    });

    expect(users).toEqual([userId1, userId2]);
  });
  it("should throw producerKeychainNotFound if the producer keychain with the specified Id doesn't exist", async () => {
    await addOneProducerKeychain(getMockProducerKeychain());
    const producerKeychainId: ProducerKeychainId = generateId();
    await expect(
      authorizationService.getProducerKeychainUsers({
        producerKeychainId,
        organizationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(producerKeychainNotFound(producerKeychainId));
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    const mockProducerKeychain: ProducerKeychain = getMockProducerKeychain();
    await addOneProducerKeychain(mockProducerKeychain);
    const organizationIdNotMatchWithProducer: TenantId = generateId();
    await expect(
      authorizationService.getProducerKeychainUsers({
        producerKeychainId: mockProducerKeychain.id,
        organizationId: organizationIdNotMatchWithProducer,
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnProducerKeychain(
        organizationIdNotMatchWithProducer,
        mockProducerKeychain.id
      )
    );
  });
});
