/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockProducerKeychain,
  getMockEService,
  writeInReadmodel,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import {
  ProducerKeychain,
  ProducerKeychainEServiceAddedV2,
  EService,
  TenantId,
  generateId,
  toReadModelEService,
  EServiceId,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  eserviceNotFound,
  organizationNotAllowedOnProducerKeychain,
  organizationNotAllowedOnEService,
  eserviceAlreadyLinkedToProducerKeychain,
  producerKeychainNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  authorizationService,
  eservices,
  readLastAuthorizationEvent,
} from "./utils.js";
import { mockProducerKeyChainRouterRequest } from "./supertestSetup.js";

describe("addProducerKeychainEService", async () => {
  it("should write on event-store for the addition of a eservice into a producer keychain", async () => {
    const mockProducerId: TenantId = generateId();
    const mockEServiceId: EServiceId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      id: mockEServiceId,
      producerId: mockProducerId,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducerId,
    };

    await addOneProducerKeychain(mockProducerKeychain);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    await mockProducerKeyChainRouterRequest.post({
      path: "/producerKeychains/:producerKeychainId/eservices",
      body: { eserviceId: mockEService.id },
      pathParams: { producerKeychainId: mockProducerKeychain.id },
      authData: getMockAuthData(mockProducerId),
    });

    const writtenEvent = await readLastAuthorizationEvent(
      mockProducerKeychain.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockProducerKeychain.id,
      version: "1",
      type: "ProducerKeychainEServiceAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainEServiceAddedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      eserviceId: mockEService.id,
      producerKeychain: toProducerKeychainV2({
        ...mockProducerKeychain,
        eservices: [mockEService.id],
      }),
    });
  });
  it("should throw producerKeychainNotFound if the producer keychain does not exist", async () => {
    const mockProducerId: TenantId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      producerId: mockProducerId,
    };

    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const mockProducerKeychain = getMockProducerKeychain();

    expect(
      authorizationService.addProducerKeychainEService({
        producerKeychainId: mockProducerKeychain.id,
        seed: { eserviceId: mockEService.id },
        organizationId: mockProducerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(producerKeychainNotFound(mockProducerKeychain.id));
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the producer keychain producer", async () => {
    const mockProducerId: TenantId = generateId();
    const mockEServiceId: EServiceId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      id: mockEServiceId,
      producerId: mockProducerId,
    };

    const mockProducerKeychain = getMockProducerKeychain();

    await addOneProducerKeychain(mockProducerKeychain);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      authorizationService.addProducerKeychainEService({
        producerKeychainId: mockProducerKeychain.id,
        seed: { eserviceId: mockEService.id },
        organizationId: mockProducerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnProducerKeychain(
        mockProducerId,
        mockProducerKeychain.id
      )
    );
  });
  it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const mockProducerId: TenantId = generateId();
    const mockEServiceId: EServiceId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      id: mockEServiceId,
      producerId: mockProducerId,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducerId,
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.addProducerKeychainEService({
        producerKeychainId: mockProducerKeychain.id,
        seed: { eserviceId: mockEService.id },
        organizationId: mockProducerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(eserviceNotFound(mockEService.id));
  });
  it("should throw organizationNotAllowedOnEService if the requester is not the eservice producer", async () => {
    const mockProducerId: TenantId = generateId();
    const mockEServiceId: EServiceId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      id: mockEServiceId,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducerId,
    };

    await addOneProducerKeychain(mockProducerKeychain);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      authorizationService.addProducerKeychainEService({
        producerKeychainId: mockProducerKeychain.id,
        seed: { eserviceId: mockEService.id },
        organizationId: mockProducerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnEService(mockProducerId, mockEService.id)
    );
  });
  it("should throw eserviceAlreadyLinkedToProducerKeychain if the eservice is already linked to that producer keychain", async () => {
    const mockProducerId: TenantId = generateId();
    const mockEServiceId: EServiceId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      id: mockEServiceId,
      producerId: mockProducerId,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducerId,
      eservices: [mockEService.id],
    };

    await addOneProducerKeychain(mockProducerKeychain);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      authorizationService.addProducerKeychainEService({
        producerKeychainId: mockProducerKeychain.id,
        seed: { eserviceId: mockEService.id },
        organizationId: mockProducerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      eserviceAlreadyLinkedToProducerKeychain(
        mockEService.id,
        mockProducerKeychain.id
      )
    );
  });
});
