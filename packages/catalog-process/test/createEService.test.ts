/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockDescriptor,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test/index.js";
import {
  EServiceAddedV2,
  EService,
  toEServiceV2,
  EServiceDescriptorAddedV2,
} from "pagopa-interop-models";
import { expect, describe, it, beforeAll, vi, afterAll } from "vitest";
import {
  eServiceDuplicate,
  originNotCompliant,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  buildDescriptorSeed,
  catalogService,
  getMockAuthData,
  getMockEService,
  postgresDB,
  readLastEserviceEvent,
} from "./utils.js";

describe("create eservice", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it("should write on event-store for the creation of an eservice", async () => {
    const eservice = await catalogService.createEService(
      {
        eservice: {
          name: mockEService.name,
          description: mockEService.description,
          technology: "REST",
          mode: "DELIVER",
        },
        descriptor: buildDescriptorSeed(mockDescriptor),
      },
      {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      }
    );

    expect(eservice).toBeDefined();

    const eserviceCreationEvent = await readEventByStreamIdAndVersion(
      eservice.id,
      0,
      "catalog",
      postgresDB
    );
    const descriptorCreationEvent = await readLastEserviceEvent(eservice.id);

    expect(eserviceCreationEvent).toMatchObject({
      stream_id: eservice.id,
      version: "0",
      type: "EServiceAdded",
      event_version: 2,
    });
    expect(descriptorCreationEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorAdded",
      event_version: 2,
    });

    const eserviceCreationPayload = decodeProtobufPayload({
      messageType: EServiceAddedV2,
      payload: descriptorCreationEvent.data,
    });
    const descriptorCreationPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: descriptorCreationEvent.data,
    });

    const expectedEservice: EService = {
      ...mockEService,
      createdAt: new Date(),
      id: eservice.id,
      descriptors: [],
    };
    const expectedEserviceWithDescriptor: EService = {
      ...mockEService,
      createdAt: new Date(),
      id: eservice.id,
      descriptors: [{ ...mockDescriptor }],
    };

    expect(eserviceCreationPayload.eservice).toEqual(
      toEServiceV2(expectedEservice)
    );
    expect(descriptorCreationPayload.eservice).toEqual(
      toEServiceV2(expectedEserviceWithDescriptor)
    );
  });

  it("should throw eServiceDuplicate if an eservice with the same name already exists", async () => {
    await addOneEService(mockEService);
    expect(
      catalogService.createEService(
        {
          eservice: {
            name: mockEService.name,
            description: mockEService.description,
            technology: "REST",
            mode: "DELIVER",
          },
          descriptor: buildDescriptorSeed(mockDescriptor),
        },
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceDuplicate(mockEService.name));
  });

  it("should throw originNotCompliant if the requester externalId origin is not allowed", async () => {
    expect(
      catalogService.createEService(
        {
          eservice: {
            name: mockEService.name,
            description: mockEService.description,
            technology: "REST",
            mode: "DELIVER",
          },
          descriptor: buildDescriptorSeed(mockDescriptor),
        },
        {
          authData: {
            ...getMockAuthData(mockEService.producerId),
            externalId: {
              value: "123456",
              origin: "not-allowed-origin",
            },
          },
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
  });
});

// todo add tests for inconsistentDailyCalls and attributeNotFound
