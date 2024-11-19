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
  ClientDeletedV2,
  generateId,
  toClientV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  clientNotFound,
  organizationNotAllowedOnClient,
} from "../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";
import { mockClientRouterRequest } from "./supertestSetup.js";

describe("delete client", () => {
  it("should write on event-store for the deletion of a client", async () => {
    const mockConsumer = getMockTenant();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
    };

    await addOneClient(mockClient);

    await mockClientRouterRequest.delete({
      path: "/clients/:clientId",
      pathParams: { clientId: mockClient.id },
      authData: getMockAuthData(mockConsumer.id),
    });

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      clientId: mockClient.id,
      client: toClientV2(mockClient),
    });
  });
  it("should throw clientNotFound if the client doesn't exist", async () => {
    const mockClient = getMockClient();
    const notExistingClient = getMockClient();

    await addOneClient(mockClient);

    expect(
      authorizationService.deleteClient({
        clientId: notExistingClient.id,
        organizationId: getMockTenant().id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(clientNotFound(notExistingClient.id));
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    const mockConsumer1 = getMockTenant();
    const mockConsumer2 = getMockTenant();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer1.id,
    };

    await addOneClient(mockClient);

    expect(
      authorizationService.deleteClient({
        clientId: mockClient.id,
        organizationId: mockConsumer2.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(mockConsumer2.id, mockClient.id)
    );
  });
});
