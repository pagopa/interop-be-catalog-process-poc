import { describe, it, vi, beforeAll, afterAll, expect } from "vitest";
import {
  ProducerKeychain,
  ProducerKeychainAddedV2,
  ProducerKeychainId,
  TenantId,
  UserId,
  generateId,
  toProducerKeychainV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  decodeProtobufPayload,
  getMockAuthData,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test/index.js";
import { authorizationApi } from "pagopa-interop-api-clients";
import { postgresDB } from "./utils.js";
import { mockProducerKeyChainRouterRequest } from "./supertestSetup.js";

describe("createProducerKeychain", () => {
  const organizationId: TenantId = generateId();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const producerKeychainSeed: authorizationApi.ProducerKeychainSeed = {
    name: "Seed name",
    description: "Description",
    members: [organizationId],
  };
  it("should write on event-store for the creation of a producer keychain", async () => {
    const producerKeychain = await mockProducerKeyChainRouterRequest.post({
      path: "/producerKeychains",
      body: { ...producerKeychainSeed },
      authData: getMockAuthData(organizationId),
    });

    const writtenEvent = await readLastEventByStreamId(
      producerKeychain.id as ProducerKeychainId,
      '"authorization"',
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: producerKeychain.id,
      version: "0",
      type: "ProducerKeychainAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainAddedV2,
      payload: writtenEvent.data,
    });

    const expectedProducerKeychain: ProducerKeychain = {
      id: producerKeychain.id as ProducerKeychainId,
      keys: [],
      name: producerKeychain.name,
      createdAt: new Date(),
      producerId: organizationId,
      eservices: [],
      users: producerKeychain.users.map(unsafeBrandId<UserId>),
      description: producerKeychain.description,
    };

    expect(writtenPayload.producerKeychain).toEqual(
      toProducerKeychainV2(expectedProducerKeychain)
    );
  });
});
