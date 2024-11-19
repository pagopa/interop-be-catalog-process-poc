import { genericLogger } from "pagopa-interop-commons";
import {
  ProducerKeychain,
  ProducerKeychainId,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockAuthData,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { producerKeychainNotFound } from "../src/model/domain/errors.js";
import { producerKeychainToApiProducerKeychain } from "../src/model/domain/apiConverter.js";
import { addOneProducerKeychain, authorizationService } from "./utils.js";
import { mockProducerKeyChainRouterRequest } from "./supertestSetup.js";

describe("getProducerKeychainById", async () => {
  const organizationId: TenantId = generateId();

  it("should get from the readModel the producer keychain with the specified Id with users", async () => {
    const userId1: UserId = generateId();
    const userId2: UserId = generateId();

    const expectedProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: organizationId,
      users: [userId1, userId2],
    };
    await addOneProducerKeychain(expectedProducerKeychain);

    const producerKeychain = await mockProducerKeyChainRouterRequest.get({
      path: "/producerKeychains/:producerKeychainId",
      pathParams: {
        producerKeychainId: expectedProducerKeychain.id,
      },
      authData: getMockAuthData(organizationId),
    });
    expect(producerKeychain).toEqual(
      producerKeychainToApiProducerKeychain(expectedProducerKeychain, {
        showUsers: true,
      })
    );
  });
  it("should get from the readModel the producer keychain with the specified Id without users", async () => {
    const expectedProducerKeychainWithoutUser: ProducerKeychain = {
      ...getMockProducerKeychain(),
      users: [],
      producerId: organizationId,
    };

    await addOneProducerKeychain(expectedProducerKeychainWithoutUser);

    const producerKeychain = await mockProducerKeyChainRouterRequest.get({
      path: "/producerKeychains/:producerKeychainId",
      pathParams: {
        producerKeychainId: expectedProducerKeychainWithoutUser.id,
      },
      authData: getMockAuthData(organizationId),
    });

    expect(producerKeychain).toEqual(
      producerKeychainToApiProducerKeychain(
        expectedProducerKeychainWithoutUser,
        { showUsers: false }
      )
    );
  });
  it("should throw producerKeychainNotFound if the producerKeychain with the specified Id doesn't exist", async () => {
    await addOneProducerKeychain(getMockProducerKeychain());
    const producerKeychainId: ProducerKeychainId = generateId();
    await expect(
      authorizationService.getProducerKeychainById({
        producerKeychainId,
        organizationId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(producerKeychainNotFound(producerKeychainId));
  });
});
