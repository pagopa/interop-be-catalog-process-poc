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
import { addOneClient, readLastAuthorizationEvent } from "./utils.js";
import { mockClientRouterRequest } from "./supertestSetup.js";

describe("remove client purpose", () => {
  it("should write on event-store for removing a purpose from all clients", async () => {
    const mockConsumer = getMockTenant();
    const purposeIdToRemove: PurposeId = generateId();
    const purposeIdToNotRemove: PurposeId = generateId();

    const mockClient1: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      purposes: [purposeIdToRemove, purposeIdToNotRemove],
    };
    const mockClient2: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      purposes: [purposeIdToRemove, purposeIdToNotRemove],
    };
    const mockClient3: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      purposes: [purposeIdToRemove],
    };

    await addOneClient(mockClient1);
    await addOneClient(mockClient2);
    await addOneClient(mockClient3);

    await mockClientRouterRequest.delete({
      path: "/clients/purposes/:purposeId",
      pathParams: { purposeId: purposeIdToRemove },
      authData: getMockAuthData(mockConsumer.id),
    });

    const writtenEvent1 = await readLastAuthorizationEvent(mockClient1.id);
    const writtenEvent2 = await readLastAuthorizationEvent(mockClient2.id);
    const writtenEvent3 = await readLastAuthorizationEvent(mockClient3.id);

    expect(writtenEvent1).toMatchObject({
      stream_id: mockClient1.id,
      version: "1",
      type: "ClientPurposeRemoved",
      event_version: 2,
    });
    expect(writtenEvent2).toMatchObject({
      stream_id: mockClient2.id,
      version: "1",
      type: "ClientPurposeRemoved",
      event_version: 2,
    });
    expect(writtenEvent3).toMatchObject({
      stream_id: mockClient3.id,
      version: "1",
      type: "ClientPurposeRemoved",
      event_version: 2,
    });

    const writtenPayload1 = decodeProtobufPayload({
      messageType: ClientPurposeRemovedV2,
      payload: writtenEvent1.data,
    });
    const writtenPayload2 = decodeProtobufPayload({
      messageType: ClientPurposeRemovedV2,
      payload: writtenEvent2.data,
    });
    const writtenPayload3 = decodeProtobufPayload({
      messageType: ClientPurposeRemovedV2,
      payload: writtenEvent3.data,
    });

    expect(writtenPayload1).toEqual({
      purposeId: purposeIdToRemove,
      client: toClientV2({ ...mockClient1, purposes: [purposeIdToNotRemove] }),
    });
    expect(writtenPayload2).toEqual({
      purposeId: purposeIdToRemove,
      client: toClientV2({ ...mockClient2, purposes: [purposeIdToNotRemove] }),
    });
    expect(writtenPayload3).toEqual({
      purposeId: purposeIdToRemove,
      client: toClientV2({ ...mockClient3, purposes: [] }),
    });
  });
});
