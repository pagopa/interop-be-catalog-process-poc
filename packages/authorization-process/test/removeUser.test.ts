/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockTenant,
  writeInReadmodel,
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
  userIdNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  getMockClient,
  readLastAuthorizationEvent,
  tenants,
} from "./utils.js";

describe("remove user", () => {
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
    await writeInReadmodel(mockConsumer, tenants);

    await authorizationService.removeUser({
      clientId: mockClient.id,
      userIdToRemove,
      organizationId: mockConsumer.id,
      correlationId: generateId(),
      logger: genericLogger,
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
    await writeInReadmodel(mockConsumer, tenants);

    expect(
      authorizationService.removeUser({
        clientId: mockClient.id,
        userIdToRemove,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw userNotFound if the user isn't related to that client", async () => {
    const mockConsumer = getMockTenant();
    const notExistingUserId: UserId = generateId();
    const userIdToNotRemove: UserId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      users: [userIdToNotRemove],
    };

    await addOneClient(mockClient);
    await writeInReadmodel(mockConsumer, tenants);

    expect(
      authorizationService.removeUser({
        clientId: mockClient.id,
        userIdToRemove: notExistingUserId,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(userIdNotFound(notExistingUserId, mockClient.id));
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
    await writeInReadmodel(mockConsumer1, tenants);
    await writeInReadmodel(mockConsumer2, tenants);

    expect(
      authorizationService.removeUser({
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
