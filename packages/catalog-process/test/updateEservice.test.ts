/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger, fileManagerDeleteError } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockDelegation,
  getMockValidRiskAnalysis,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  DraftEServiceUpdatedV2,
  toEServiceV2,
  eserviceMode,
  operationForbidden,
  generateId,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { vi, expect, describe, it } from "vitest";
import { match } from "ts-pattern";
import {
  eServiceNotFound,
  eServiceDuplicate,
  eserviceNotInDraftState,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import {
  fileManager,
  addOneEService,
  catalogService,
  getMockAuthData,
  readLastEserviceEvent,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
  addOneDelegation,
} from "./utils.js";

describe("update eService", () => {
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it("should write on event-store for the update of an eService (no technology change)", async () => {
    vi.spyOn(fileManager, "delete");

    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const isDelegable = randomArrayItem([false, true, undefined]);
    const isClientAccessDelegable = match(isDelegable)
      .with(undefined, () => undefined)
      .with(true, () => randomArrayItem([false, true, undefined]))
      .with(false, () => false)
      .exhaustive();

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
    const returnedEService = await catalogService.updateEService(
      mockEService.id,
      {
        name: updatedName,
        description: mockEService.description,
        technology: "REST",
        mode: "DELIVER",
        isSignalHubEnabled,
        isDelegable,
        isClientAccessDelegable,
      },
      {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    const updatedEService: EService = {
      ...eservice,
      name: updatedName,
      isSignalHubEnabled,
      isDelegable,
      isClientAccessDelegable,
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
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
    expect(fileManager.delete).not.toHaveBeenCalled();
  });

  it("should update an eservice correctly handling isClientAccessDelegable when isDelegable is not true", async () => {
    vi.spyOn(fileManager, "delete");

    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const isDelegable: false | undefined = randomArrayItem([false, undefined]);
    const isClientAccessDelegable = randomArrayItem([false, true, undefined]);
    const expectedIsClientAccessDelegable = match(isDelegable)
      .with(false, () => false)
      .with(undefined, () => undefined)
      .exhaustive();

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
    const returnedEService = await catalogService.updateEService(
      mockEService.id,
      {
        name: updatedName,
        description: mockEService.description,
        technology: "REST",
        mode: "DELIVER",
        isSignalHubEnabled,
        isDelegable,
        isClientAccessDelegable,
      },
      {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    const updatedEService: EService = {
      ...eservice,
      name: updatedName,
      isSignalHubEnabled,
      isDelegable,
      isClientAccessDelegable: expectedIsClientAccessDelegable,
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
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
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

    const returnedEService = await catalogService.updateEService(
      eservice.id,
      {
        name: updatedName,
        description: eservice.description,
        technology: "SOAP",
        mode: "DELIVER",
      },
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

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
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(interfaceDocument.path);
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
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
    const returnedEService = await catalogService.updateEService(
      mockEService.id,
      {
        name: mockEService.name,
        description: updatedDescription,
        technology: "REST",
        mode: "DELIVER",
      },
      {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

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
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });
  it("should write on event-store for the update of an eService (delegate)", async () => {
    const updatedDescription = "eservice new description";
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOneEService(mockEService);
    await addOneDelegation(delegation);
    const returnedEService = await catalogService.updateEService(
      mockEService.id,
      {
        name: mockEService.name,
        description: updatedDescription,
        technology: "REST",
        mode: "DELIVER",
      },
      {
        authData: getMockAuthData(delegation.delegateId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

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
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
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

    const returnedEService = await catalogService.updateEService(
      eservice.id,
      {
        name: eservice.name,
        description: eservice.description,
        technology: "REST",
        mode: "DELIVER",
      },
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

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
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
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

  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOneEService(mockEService);
    await addOneDelegation(delegation);

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
