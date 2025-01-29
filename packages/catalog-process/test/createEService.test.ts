/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockDescriptor,
  randomArrayItem,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test/index.js";
import {
  EServiceAddedV2,
  EService,
  toEServiceV2,
  EServiceDescriptorAddedV2,
  generateId,
} from "pagopa-interop-models";
import { expect, describe, it, beforeAll, vi, afterAll } from "vitest";
import {
  eServiceDuplicate,
  inconsistentDailyCalls,
  originNotCompliant,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import {
  addOneEService,
  buildDescriptorSeedForEserviceCreation,
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
    config.featureFlagSignalhubWhitelist = true;
    config.signalhubWhitelist = [mockEService.producerId];

    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const eservice = await catalogService.createEService(
      {
        name: mockEService.name,
        description: mockEService.description,
        technology: "REST",
        mode: "DELIVER",
        descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        isSignalHubEnabled,
      },
      {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: generateId(),
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
      payload: eserviceCreationEvent.data,
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
      isSignalHubEnabled,
    };
    const expectedEserviceWithDescriptor: EService = {
      ...mockEService,
      createdAt: new Date(),
      id: eservice.id,
      isSignalHubEnabled,
      descriptors: [
        {
          ...mockDescriptor,
          id: eservice.descriptors[0].id,
          createdAt: new Date(),
          serverUrls: [],
        },
      ],
    };

    expect(eserviceCreationPayload.eservice).toEqual(
      toEServiceV2(expectedEservice)
    );
    expect(descriptorCreationPayload.eservice).toEqual(
      toEServiceV2(expectedEserviceWithDescriptor)
    );
  });
  it("should assign value inherit from request to isSignalhubEnabled field if signalhub whitelist feature flag is not enabled", async () => {
    config.featureFlagSignalhubWhitelist = false;
    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const eservice = await catalogService.createEService(
      {
        name: mockEService.name,
        description: mockEService.description,
        technology: "REST",
        mode: "DELIVER",
        descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        isSignalHubEnabled,
      },
      {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    expect(eservice).toBeDefined();
    expect(eservice.isSignalHubEnabled).toBe(isSignalHubEnabled);
  });

  it("should assign false to isSignalhubEnabled field if signalhub whitelist feature flag is enabled but the organization is not in whitelist", async () => {
    config.featureFlagSignalhubWhitelist = true;
    config.signalhubWhitelist = [generateId()];
    const isSignalHubEnabled = true;

    const eservice = await catalogService.createEService(
      {
        name: mockEService.name,
        description: mockEService.description,
        technology: "REST",
        mode: "DELIVER",
        descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        isSignalHubEnabled,
      },
      {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    expect(eservice).toBeDefined();
    expect(eservice.isSignalHubEnabled).toBe(false);
  });

  it("should assign value inherit from request to isSignalhubEnabled field if signalhub whitelist feature flag is enabled and the organization is in whitelist", async () => {
    config.featureFlagSignalhubWhitelist = true;
    config.signalhubWhitelist = [mockEService.producerId];
    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);

    const eservice = await catalogService.createEService(
      {
        name: mockEService.name,
        description: mockEService.description,
        technology: "REST",
        mode: "DELIVER",
        descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        isSignalHubEnabled,
      },
      {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    expect(eservice).toBeDefined();
    expect(eservice.isSignalHubEnabled).toBe(isSignalHubEnabled);
  });

  it("should throw eServiceDuplicate if an eservice with the same name already exists", async () => {
    await addOneEService(mockEService);
    expect(
      catalogService.createEService(
        {
          name: mockEService.name,
          description: mockEService.description,
          technology: "REST",
          mode: "DELIVER",
          descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        },
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: generateId(),
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
          name: mockEService.name,
          description: mockEService.description,
          technology: "REST",
          mode: "DELIVER",
          descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        },
        {
          authData: {
            ...getMockAuthData(mockEService.producerId),
            externalId: {
              value: "123456",
              origin: "not-allowed-origin",
            },
          },
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
  });

  it("should throw inconsistentDailyCalls if the descriptor seed has dailyCallsPerConsumer > dailyCallsTotal", async () => {
    expect(
      catalogService.createEService(
        {
          name: mockEService.name,
          description: mockEService.description,
          technology: "REST",
          mode: "DELIVER",
          descriptor: {
            ...buildDescriptorSeedForEserviceCreation(mockDescriptor),
            dailyCallsPerConsumer: 100,
            dailyCallsTotal: 99,
          },
        },
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
});
