import {
  getMockAuthData,
  getMockClient,
  getMockKey,
} from "pagopa-interop-commons-test/src/testUtils.js";
import {
  Client,
  ClientId,
  Key,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  clientNotFound,
  organizationNotAllowedOnClient,
} from "../src/model/domain/errors.js";
import { keyToApiKey } from "../src/model/domain/apiConverter.js";
import { addOneClient, authorizationService } from "./utils.js";
import { mockClientRouterRequest } from "./supertestSetup.js";

describe("getClientKeys", async () => {
  const consumerId: TenantId = generateId();
  const mockKey = getMockKey();
  const mockClient: Client = {
    ...getMockClient(),
    keys: [mockKey],
    consumerId,
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
    const clientWithKeyUser: Client = {
      ...mockClient,
      keys: [keyWithUser1, keyWithUser2, keyWithUser3],
      users: [keyUserId1, keyUserId2, keyUserId3],
    };
    await addOneClient(clientWithKeyUser);

    const keys = await mockClientRouterRequest.get({
      path: "/clients/:clientId/keys",
      pathParams: { clientId: mockClient.id },
      queryParams: { userIds: [keyUserId1, keyUserId2, keyUserId3] },
      authData: getMockAuthData(consumerId),
    });

    expect(keys).toEqual({
      keys: [
        keyToApiKey(keyWithUser1),
        keyToApiKey(keyWithUser2),
        keyToApiKey(keyWithUser3),
      ],
    });
  });
  it("should get the keys of the specified client, but only limited to the keys belonging to specific users", async () => {
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
    const clientWithKeyUser: Client = {
      ...mockClient,
      keys: [keyWithUser1, keyWithUser2, keyWithUser3],
      users: [userId, keyUserId1, keyUserId2, keyUserId3],
    };
    await addOneClient(clientWithKeyUser);

    const keys = await mockClientRouterRequest.get({
      path: "/clients/:clientId/keys",
      pathParams: { clientId: clientWithKeyUser.id },
      queryParams: { userIds: [keyUserId1] },
      authData: getMockAuthData(consumerId),
    });
    expect(keys).toEqual({
      keys: [keyToApiKey(keyWithUser1)],
    });
  });
  it("should throw clientNotFound if the client with the specified Id doesn't exist", async () => {
    await addOneClient(mockClient);
    const clientId: ClientId = generateId();
    await expect(
      authorizationService.getClientKeys({
        clientId,
        userIds: [],
        organizationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(clientNotFound(clientId));
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    await addOneClient(mockClient);
    const organizationId: TenantId = generateId();
    await expect(
      authorizationService.getClientKeys({
        clientId: mockClient.id,
        userIds: [],
        organizationId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(organizationId, mockClient.id)
    );
  });
});
