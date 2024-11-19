/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockProducerKeychain,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  EServiceId,
  generateId,
  ProducerKeychain,
  ProducerKeychainEServiceRemovedV2,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  producerKeychainNotFound,
  organizationNotAllowedOnProducerKeychain,
  eserviceNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";
import { mockProducerKeyChainRouterRequest } from "./supertestSetup.js";

describe("remove producer keychain e-service", () => {
  it("should write on event-store for removing an e-service from a producer keychain", async () => {
    const mockProducer = getMockTenant();
    const eserviceIdToRemove: EServiceId = generateId();
    const eserviceIdToNotRemove: EServiceId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      eservices: [eserviceIdToRemove, eserviceIdToNotRemove],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    await mockProducerKeyChainRouterRequest.delete({
      path: "/producerKeychains/:producerKeychainId/eservices/:eserviceId",
      pathParams: {
        producerKeychainId: mockProducerKeychain.id,
        eserviceId: eserviceIdToRemove,
      },
      authData: getMockAuthData(mockProducer.id),
    });

    const writtenEvent = await readLastAuthorizationEvent(
      mockProducerKeychain.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockProducerKeychain.id,
      version: "1",
      type: "ProducerKeychainEServiceRemoved",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainEServiceRemovedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      producerKeychain: toProducerKeychainV2({
        ...mockProducerKeychain,
        eservices: [eserviceIdToNotRemove],
      }),
      eserviceId: eserviceIdToRemove,
    });
  });
  it("should throw producerKeychainNotFound if the producer keychain doesn't exist", async () => {
    const mockProducer = getMockTenant();
    const eserviceIdToRemove: EServiceId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      eservices: [eserviceIdToRemove],
    };

    await addOneProducerKeychain(getMockProducerKeychain());

    expect(
      authorizationService.removeProducerKeychainEService({
        producerKeychainId: mockProducerKeychain.id,
        eserviceIdToRemove,
        organizationId: mockProducer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(producerKeychainNotFound(mockProducerKeychain.id));
  });
  it("should throw eserviceNotFound if that eserviceId is not related to that producer keychain", async () => {
    const mockProducer = getMockTenant();
    const notExistingEServiceId: EServiceId = generateId();
    const eserviceIdToNotRemove: EServiceId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      eservices: [eserviceIdToNotRemove],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.removeProducerKeychainEService({
        producerKeychainId: mockProducerKeychain.id,
        eserviceIdToRemove: notExistingEServiceId,
        organizationId: mockProducer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(eserviceNotFound(notExistingEServiceId));
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    const mockProducer1 = getMockTenant();
    const mockProducer2 = getMockTenant();
    const eserviceIdToRemove: EServiceId = generateId();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer1.id,
      eservices: [eserviceIdToRemove],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.removeProducerKeychainEService({
        producerKeychainId: mockProducerKeychain.id,
        eserviceIdToRemove,
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
