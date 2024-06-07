/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockClient,
  getMockKey,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Client,
  ClientKeyDeletedV2,
  Key,
  UserId,
  generateId,
  toClientV2,
} from "pagopa-interop-models";
import { genericLogger, userRoles } from "pagopa-interop-commons";
import { getMockAuthData } from "pagopa-interop-commons-test";
import {
  clientNotFound,
  keyNotFound,
  organizationNotAllowedOnClient,
  userNotAllowedOnClient,
} from "../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";

describe("remove client key", () => {
  it("should write on event-store for removing a key from a client", async () => {
    const mockConsumer = getMockTenant();
    const keyToRemove = getMockKey();
    const keyToNotRemove = getMockKey();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      keys: [keyToRemove, keyToNotRemove],
    };

    await addOneClient(mockClient);

    await authorizationService.deleteClientKeyById({
      clientId: mockClient.id,
      keyIdToRemove: keyToRemove.kid,
      authData: getMockAuthData(mockConsumer.id),
      correlationId: generateId(),
      logger: genericLogger,
    });

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientKeyDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientKeyDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      kid: keyToRemove.kid,
      client: toClientV2({ ...mockClient, keys: [keyToNotRemove] }),
    });
  });
  it("should throw clientNotFound if the client doesn't exist", async () => {
    const mockConsumer = getMockTenant();
    const keyToRemove = getMockKey();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      keys: [keyToRemove],
    };

    await addOneClient(getMockClient());

    expect(
      authorizationService.deleteClientKeyById({
        clientId: mockClient.id,
        keyIdToRemove: keyToRemove.kid,
        authData: getMockAuthData(mockConsumer.id),
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw keyNotFound if the key doesn't exist in that client", async () => {
    const mockConsumer = getMockTenant();
    const notExistingKeyId = generateId();
    const keyToNotRemove = getMockKey();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      keys: [keyToNotRemove],
    };

    await addOneClient(mockClient);

    expect(
      authorizationService.deleteClientKeyById({
        clientId: mockClient.id,
        keyIdToRemove: notExistingKeyId,
        authData: getMockAuthData(mockConsumer.id),
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(keyNotFound(notExistingKeyId, mockClient.id));
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    const mockConsumer1 = getMockTenant();
    const mockConsumer2 = getMockTenant();
    const keyToRemove = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer1.id,
      keys: [keyToRemove],
    };

    await addOneClient(mockClient);

    expect(
      authorizationService.deleteClientKeyById({
        clientId: mockClient.id,
        keyIdToRemove: keyToRemove.kid,
        authData: getMockAuthData(mockConsumer2.id),
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(mockConsumer2.id, mockClient.id)
    );
  });
  it("should throw userNotAllowedOnClient if a security user tries to delete another user's key", async () => {
    const mockConsumer = getMockTenant();
    const mockUserId: UserId = generateId();
    const keyToRemove: Key = { ...getMockKey(), userId: generateId() };
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      keys: [keyToRemove],
    };

    await addOneClient(mockClient);

    expect(
      authorizationService.deleteClientKeyById({
        clientId: mockClient.id,
        keyIdToRemove: keyToRemove.kid,
        authData: {
          ...getMockAuthData(mockConsumer.id),
          userRoles: [userRoles.SECURITY_ROLE],
          userId: mockUserId,
        },
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(userNotAllowedOnClient(mockUserId, mockClient.id));
  });
});
