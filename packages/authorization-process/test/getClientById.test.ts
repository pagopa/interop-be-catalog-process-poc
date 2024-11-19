import { genericLogger } from "pagopa-interop-commons";
import {
  Client,
  ClientId,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { getMockAuthData, getMockClient } from "pagopa-interop-commons-test";
import { clientNotFound } from "../src/model/domain/errors.js";
import { clientToApiClient } from "../src/model/domain/apiConverter.js";
import { addOneClient, authorizationService } from "./utils.js";
import { mockClientRouterRequest } from "./supertestSetup.js";

describe("getClientById", async () => {
  const organizationId: TenantId = generateId();

  it("should get from the readModel the client with the specified Id with users", async () => {
    const userId1: UserId = generateId();
    const userId2: UserId = generateId();

    const expectedClient: Client = {
      ...getMockClient(),
      consumerId: organizationId,
      users: [userId1, userId2],
    };
    await addOneClient(expectedClient);

    const client = await mockClientRouterRequest.get({
      path: "/clients/:clientId",
      pathParams: { clientId: expectedClient.id },
      authData: getMockAuthData(organizationId),
    });

    expect(client).toEqual(
      clientToApiClient(expectedClient, { showUsers: true })
    );
  });
  it("should get from the readModel the client with the specified Id without users", async () => {
    const expectedClientWithoutUser: Client = {
      ...getMockClient(),
      users: [],
      consumerId: organizationId,
    };

    await addOneClient(expectedClientWithoutUser);

    const client = await mockClientRouterRequest.get({
      path: "/clients/:clientId",
      pathParams: { clientId: expectedClientWithoutUser.id },
      authData: getMockAuthData(organizationId),
    });

    expect(client).toEqual(
      clientToApiClient(expectedClientWithoutUser, { showUsers: false })
    );
  });
  it("should throw clientNotFound if the client with the specified Id doesn't exist", async () => {
    await addOneClient(getMockClient());
    const clientId: ClientId = generateId();
    await expect(
      authorizationService.getClientById({
        clientId,
        organizationId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(clientNotFound(clientId));
  });
});
