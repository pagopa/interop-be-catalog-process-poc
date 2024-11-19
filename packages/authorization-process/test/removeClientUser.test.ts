/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockClient,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Client,
  ClientUserDeletedV2,
  UserId,
  generateId,
  toClientV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  clientNotFound,
  organizationNotAllowedOnClient,
  clientUserIdNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";
import { mockClientRouterRequest } from "./supertestSetup.js";

describe("remove client user", () => {
  it("should write on event-store for removing a user from a client", async () => {
    const mockConsumer = getMockTenant();
    const userIdToRemove: UserId = generateId();
    const userIdToNotRemove: UserId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      users: [userIdToRemove, userIdToNotRemove],
    };

    await addOneClient(mockClient);

    await mockClientRouterRequest.delete({
      path: "/clients/:clientId/users/:userId",
      pathParams: { clientId: mockClient.id, userId: userIdToRemove },
      authData: getMockAuthData(mockConsumer.id),
    });

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientUserDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientUserDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      userId: userIdToRemove,
      client: toClientV2({ ...mockClient, users: [userIdToNotRemove] }),
    });
  });
  it("should throw clientNotFound if the client doesn't exist", async () => {
    const mockConsumer = getMockTenant();
    const userIdToRemove: UserId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      users: [userIdToRemove],
    };

    await addOneClient(getMockClient());

    expect(
      authorizationService.removeClientUser({
        clientId: mockClient.id,
        userIdToRemove,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw clientUserNotFound if the user isn't related to that client", async () => {
    const mockConsumer = getMockTenant();
    const notExistingUserId: UserId = generateId();
    const userIdToNotRemove: UserId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      users: [userIdToNotRemove],
    };

    await addOneClient(mockClient);

    expect(
      authorizationService.removeClientUser({
        clientId: mockClient.id,
        userIdToRemove: notExistingUserId,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      clientUserIdNotFound(notExistingUserId, mockClient.id)
    );
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    const mockConsumer1 = getMockTenant();
    const mockConsumer2 = getMockTenant();
    const userIdToRemove: UserId = generateId();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer1.id,
      users: [userIdToRemove],
    };

    await addOneClient(mockClient);

    expect(
      authorizationService.removeClientUser({
        clientId: mockClient.id,
        userIdToRemove,
        organizationId: mockConsumer2.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(mockConsumer2.id, mockClient.id)
    );
  });
});
