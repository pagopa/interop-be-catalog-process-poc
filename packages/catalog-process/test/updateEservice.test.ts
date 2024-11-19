/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger, fileManagerDeleteError } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockValidRiskAnalysis,
  randomArrayItem,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  DraftEServiceUpdatedV2,
  toEServiceV2,
  eserviceMode,
  operationForbidden,
  generateId,
  fromEServiceV2,
} from "pagopa-interop-models";
import { vi, expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDuplicate,
  eserviceNotInDraftState,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import { eServiceToApiEService } from "../src/model/domain/apiConverter.js";
import {
  fileManager,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
} from "./utils.js";
import { mockEserviceRouterRequest } from "./supertestSetup.js";

describe("update eService", () => {
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it("should write on event-store for the update of an eService (no technology change)", async () => {
    vi.spyOn(fileManager, "delete");

    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const updatedName = "eservice new name";
    await addOneEService(eservice);

    const returnedEService = await mockEserviceRouterRequest.put({
      path: "/eservices/:eServiceId",
      pathParams: { eServiceId: eservice.id },
      body: {
        name: updatedName,
        description: mockEService.description,
        technology: "REST",
        mode: "DELIVER",
        isSignalHubEnabled,
      },
      authData: getMockAuthData(mockEService.producerId),
    });

    const updatedEService: EService = {
      ...eservice,
      name: updatedName,
      isSignalHubEnabled,
    };

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent.stream_id).toBe(mockEService.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("DraftEServiceUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(
      eServiceToApiEService(fromEServiceV2(writtenPayload.eservice!))
    ).toEqual(returnedEService);
    expect(fileManager.delete).not.toHaveBeenCalled();
  });

  it("should write on event-store for the update of an eService (technology change: interface has to be deleted)", async () => {
    vi.spyOn(fileManager, "delete");

    const interfaceDocument = {
      ...mockDocument,
      name: `${mockDocument.name}`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
    };

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      interface: interfaceDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const updatedName = "eservice new name";
    await addOneEService(eservice);

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceDocumentsPath,
        resourceId: interfaceDocument.id,
        name: interfaceDocument.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(interfaceDocument.path);

    const returnedEService = await mockEserviceRouterRequest.put({
      path: "/eservices/:eServiceId",
      pathParams: { eServiceId: eservice.id },
      body: {
        name: updatedName,
        description: eservice.description,
        technology: "SOAP",
        mode: "DELIVER",
      },
      authData: getMockAuthData(eservice.producerId),
    });

    const updatedEService: EService = {
      ...eservice,
      name: updatedName,
      technology: "Soap",
      descriptors: eservice.descriptors.map((d) => ({
        ...d,
        interface: undefined,
        serverUrls: [],
      })),
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "DraftEServiceUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      interfaceDocument.path,
      expect.anything()
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(interfaceDocument.path);
    expect(
      eServiceToApiEService(fromEServiceV2(writtenPayload.eservice!))
    ).toEqual(returnedEService);
  });

  it("should fail if the file deletion fails when interface file has to be deleted on technology change", async () => {
    config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const updatedName = "eService new name";
    await addOneEService(eservice);

    expect(
      catalogService.updateEService(
        mockEService.id,
        {
          name: updatedName,
          description: mockEService.description,
          technology: "SOAP",
          mode: "DELIVER",
        },
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      fileManagerDeleteError(
        mockDocument.path,
        config.s3Bucket,
        new Error("The specified bucket does not exist")
      )
    );
  });
  it("should write on event-store for the update of an eService (update description only)", async () => {
    const updatedDescription = "eservice new description";
    await addOneEService(mockEService);

    const returnedEService = await mockEserviceRouterRequest.put({
      path: "/eservices/:eServiceId",
      pathParams: { eServiceId: mockEService.id },
      body: {
        name: mockEService.name,
        description: updatedDescription,
        technology: "REST",
        mode: "DELIVER",
      },
      authData: getMockAuthData(mockEService.producerId),
    });

    const updatedEService: EService = {
      ...mockEService,
      description: updatedDescription,
    };

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent).toMatchObject({
      stream_id: mockEService.id,
      version: "1",
      type: "DraftEServiceUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(
      eServiceToApiEService(fromEServiceV2(writtenPayload.eservice!))
    ).toEqual(returnedEService);
  });

  it("should write on event-store for the update of an eService (update mode to DELIVER so risk analysis has to be deleted)", async () => {
    const riskAnalysis = getMockValidRiskAnalysis("PA");
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
      riskAnalysis: [riskAnalysis],
      mode: "Receive",
    };
    await addOneEService(eservice);

    const returnedEService = await mockEserviceRouterRequest.put({
      path: "/eservices/:eServiceId",
      pathParams: { eServiceId: eservice.id },
      body: {
        name: eservice.name,
        description: eservice.description,
        technology: "REST",
        mode: "DELIVER",
      },
      authData: getMockAuthData(eservice.producerId),
    });

    const expectedEservice: EService = {
      ...eservice,
      mode: eserviceMode.deliver,
      riskAnalysis: [],
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "DraftEServiceUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEservice));
    expect(
      eServiceToApiEService(fromEServiceV2(writtenPayload.eservice!))
    ).toEqual(returnedEService);
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    expect(
      catalogService.updateEService(
        mockEService.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    await addOneEService(mockEService);

    expect(
      catalogService.updateEService(
        mockEService.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eServiceDuplicate if the updated name is already in use, case insensitive", async () => {
    const eservice1: EService = {
      ...mockEService,
      id: generateId(),
      descriptors: [],
    };
    const eservice2: EService = {
      ...mockEService,
      id: generateId(),
      name: "eservice name already in use",
      descriptors: [],
    };
    await addOneEService(eservice1);
    await addOneEService(eservice2);

    expect(
      catalogService.updateEService(
        eservice1.id,
        {
          name: "ESERVICE NAME ALREADY IN USE",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        {
          authData: getMockAuthData(eservice1.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceDuplicate("ESERVICE NAME ALREADY IN USE"));
  });

  it("should throw eserviceNotInDraftState if the eservice descriptor is in published state", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.updateEService(
        eservice.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
  });

  it("should throw eserviceNotInDraftState if the eservice descriptor is in archived state", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: mockDocument,
      state: descriptorState.archived,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.updateEService(
        eservice.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
  });

  it("should throw eserviceNotInDraftState if the eservice descriptor is in suspended state", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: mockDocument,
      state: descriptorState.suspended,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.updateEService(
        eservice.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
  });

  it("should throw eserviceNotInDraftState if the eservice descriptor is in deprecated state", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: mockDocument,
      state: descriptorState.deprecated,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.updateEService(
        eservice.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
  });
});
