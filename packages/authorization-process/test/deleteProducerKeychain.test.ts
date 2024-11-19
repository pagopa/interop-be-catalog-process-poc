/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockProducerKeychain,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  generateId,
  ProducerKeychain,
  ProducerKeychainDeletedV2,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  organizationNotAllowedOnProducerKeychain,
  producerKeychainNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";
import { mockProducerKeyChainRouterRequest } from "./supertestSetup.js";

describe("delete producer keychain", () => {
  it("should write on event-store for the deletion of a producer keychain", async () => {
    const mockProducer = getMockTenant();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
    };

    await addOneProducerKeychain(mockProducerKeychain);

    await mockProducerKeyChainRouterRequest.delete({
      path: "/producerKeychains/:producerKeychainId",
      pathParams: { producerKeychainId: mockProducerKeychain.id },
      authData: getMockAuthData(mockProducer.id),
    });

    const writtenEvent = await readLastAuthorizationEvent(
      mockProducerKeychain.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockProducerKeychain.id,
      version: "1",
      type: "ProducerKeychainDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      producerKeychainId: mockProducerKeychain.id,
      producerKeychain: toProducerKeychainV2(mockProducerKeychain),
    });
  });
  it("should throw producerKeychainNotFound if the producer keychain doesn't exist", async () => {
    const mockProducerKeychain = getMockProducerKeychain();
    const notExistingProducerKeychain = getMockProducerKeychain();

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.deleteProducerKeychain({
        producerKeychainId: notExistingProducerKeychain.id,
        organizationId: getMockTenant().id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      producerKeychainNotFound(notExistingProducerKeychain.id)
    );
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    const mockProducer1 = getMockTenant();
    const mockProducer2 = getMockTenant();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer1.id,
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.deleteProducerKeychain({
        producerKeychainId: mockProducerKeychain.id,
        organizationId: mockProducer2.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnProducerKeychain(
        mockProducer2.id,
        mockProducerKeychain.id
      )
    );
  });
});
