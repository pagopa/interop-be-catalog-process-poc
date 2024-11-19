import { describe, it, vi, beforeAll, afterAll, expect } from "vitest";
import {
  Client,
  ClientAddedV2,
  ClientId,
  TenantId,
  UserId,
  clientKind,
  generateId,
  toClientV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  decodeProtobufPayload,
  getMockAuthData,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test/index.js";
import { authorizationApi } from "pagopa-interop-api-clients";
import { postgresDB } from "./utils.js";
import { mockClientRouterRequest } from "./supertestSetup.js";

describe("createConsumerClient", () => {
  const userId: UserId = generateId();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const clientSeed: authorizationApi.ClientSeed = {
    name: "Seed name",
    description: "Description",
    members: [userId],
  };
  it("should write on event-store for the creation of a api client", async () => {
    const organizationId: TenantId = generateId();

    const client = await mockClientRouterRequest.post({
      path: "/clientsApi",
      body: { ...clientSeed },
      authData: getMockAuthData(organizationId),
    });

    const writtenEvent = await readLastEventByStreamId(
      client.id as ClientId,
      '"authorization"',
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: client.id,
      version: "0",
      type: "ClientAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientAddedV2,
      payload: writtenEvent.data,
    });

    const expectedClient: Client = {
      id: client.id as ClientId,
      keys: [],
      name: clientSeed.name,
      createdAt: new Date(),
      consumerId: organizationId,
      kind: clientKind.api,
      purposes: [],
      users: [unsafeBrandId<UserId>(userId)],
      description: clientSeed.description,
    };

    expect(writtenPayload.client).toEqual(toClientV2(expectedClient));
  });
});
