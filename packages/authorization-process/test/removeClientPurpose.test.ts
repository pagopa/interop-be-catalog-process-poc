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
  ClientPurposeRemovedV2,
  PurposeId,
  generateId,
  toClientV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  clientNotFound,
  organizationNotAllowedOnClient,
  purposeNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";
import { mockClientRouterRequest } from "./supertestSetup.js";

describe("remove client purpose", () => {
  it("should write on event-store for removing a purpose from a client", async () => {
    const mockConsumer = getMockTenant();
    const purposeIdToRemove: PurposeId = generateId();
    const purposeIdToNotRemove: PurposeId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      purposes: [purposeIdToRemove, purposeIdToNotRemove],
    };

    await addOneClient(mockClient);

    await mockClientRouterRequest.delete({
      path: "/clients/:clientId/purposes/:purposeId",
      pathParams: { clientId: mockClient.id, purposeId: purposeIdToRemove },
      authData: getMockAuthData(mockConsumer.id),
    });

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientPurposeRemoved",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientPurposeRemovedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      purposeId: purposeIdToRemove,
      client: toClientV2({ ...mockClient, purposes: [purposeIdToNotRemove] }),
    });
  });
  it("should throw clientNotFound if the client doesn't exist", async () => {
    const mockConsumer = getMockTenant();
    const purposeIdToRemove: PurposeId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      purposes: [purposeIdToRemove],
    };

    await addOneClient(getMockClient());

    expect(
      authorizationService.removeClientPurpose({
        clientId: mockClient.id,
        purposeIdToRemove,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it.skip("should throw purposeNotFound if that purposeId is not related to that client", async () => {
    const mockConsumer = getMockTenant();
    const notExistingPurposeId: PurposeId = generateId();
    const purposeIdToNotRemove: PurposeId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      purposes: [purposeIdToNotRemove],
    };

    await addOneClient(mockClient);

    expect(
      authorizationService.removeClientPurpose({
        clientId: mockClient.id,
        purposeIdToRemove: notExistingPurposeId,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(purposeNotFound(notExistingPurposeId));
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    const mockConsumer1 = getMockTenant();
    const mockConsumer2 = getMockTenant();
    const purposeIdToRemove: PurposeId = generateId();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer1.id,
      purposes: [purposeIdToRemove],
    };

    await addOneClient(mockClient);

    expect(
      authorizationService.removeClientPurpose({
        clientId: mockClient.id,
        purposeIdToRemove,
        organizationId: mockConsumer2.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(mockConsumer2.id, mockClient.id)
    );
  });
});
