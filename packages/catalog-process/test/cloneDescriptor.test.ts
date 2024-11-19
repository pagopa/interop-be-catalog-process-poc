/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger, FileManagerError } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceClonedV2,
  Document,
  unsafeBrandId,
  toEServiceV2,
  generateId,
  operationForbidden,
  fromEServiceV2,
} from "pagopa-interop-models";
import { beforeAll, vi, afterAll, expect, describe, it } from "vitest";
import { formatDateddMMyyyyHHmmss } from "pagopa-interop-commons";
import {
  eServiceDuplicate,
  eServiceNotFound,
  eServiceDescriptorNotFound,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import { eServiceToApiEService } from "../src/model/domain/apiConverter.js";
import {
  fileManager,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
} from "./utils.js";
import { mockEserviceRouterRequest } from "./supertestSetup.js";

describe("clone descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it("should write on event-store for the cloning of a descriptor, and clone the descriptor docs and interface files", async () => {
    vi.spyOn(fileManager, "copy");

    const interfaceDocument = {
      ...mockDocument,
      name: `${mockDocument.name}_interface`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_interface`,
    };
    const document1 = {
      ...mockDocument,
      name: `${mockDocument.name}_1`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_1`,
    };
    const document2 = {
      ...mockDocument,
      name: `${mockDocument.name}_2`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_2`,
    };

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: interfaceDocument,
      docs: [document1, document2],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
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

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceDocumentsPath,
        resourceId: document1.id,
        name: document1.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceDocumentsPath,
        resourceId: document2.id,
        name: document2.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(interfaceDocument.path);
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(document1.path);
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(document2.path);

    const cloneTimestamp = new Date();

    const newEService = await mockEserviceRouterRequest.post({
      path: "/eservices/:eServiceId/descriptors/:descriptorId/clone",
      pathParams: { eServiceId: eservice.id, descriptorId: descriptor.id },
      authData: getMockAuthData(eservice.producerId),
    });

    const writtenEvent = await readLastEserviceEvent(
      unsafeBrandId(newEService.id)
    );
    expect(writtenEvent.stream_id).toBe(newEService.id);
    expect(writtenEvent.version).toBe("0");
    expect(writtenEvent.type).toBe("EServiceCloned");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceClonedV2,
      payload: writtenEvent.data,
    });

    const expectedInterface: Document = {
      ...interfaceDocument,
      id: unsafeBrandId(writtenPayload.eservice!.descriptors[0].interface!.id),
      uploadDate: new Date(
        writtenPayload.eservice!.descriptors[0].interface!.uploadDate
      ),
      path: writtenPayload.eservice!.descriptors[0].interface!.path,
    };

    const expectedDocument1: Document = {
      ...document1,
      id: unsafeBrandId(writtenPayload.eservice!.descriptors[0].docs[0].id),
      uploadDate: new Date(
        writtenPayload.eservice!.descriptors[0].docs[0].uploadDate
      ),
      path: writtenPayload.eservice!.descriptors[0].docs[0].path,
    };
    const expectedDocument2: Document = {
      ...document2,
      id: unsafeBrandId(writtenPayload.eservice!.descriptors[0].docs[1].id),
      uploadDate: new Date(
        writtenPayload.eservice!.descriptors[0].docs[1].uploadDate
      ),
      path: writtenPayload.eservice!.descriptors[0].docs[1].path,
    };

    const expectedDescriptor: Descriptor = {
      ...descriptor,
      id: unsafeBrandId(writtenPayload.eservice!.descriptors[0].id),
      version: "1",
      interface: expectedInterface,
      createdAt: new Date(
        Number(writtenPayload.eservice?.descriptors[0].createdAt)
      ),
      docs: [expectedDocument1, expectedDocument2],
    };

    const expectedEService: EService = {
      ...eservice,
      id: unsafeBrandId(writtenPayload.eservice!.id),
      name: `${eservice.name} - clone - ${formatDateddMMyyyyHHmmss(
        cloneTimestamp
      )}`,
      descriptors: [expectedDescriptor],
      createdAt: new Date(Number(writtenPayload.eservice?.createdAt)),
    };

    expect(fileManager.copy).toHaveBeenCalledWith(
      config.s3Bucket,
      interfaceDocument.path,
      config.eserviceDocumentsPath,
      expectedInterface.id,
      expectedInterface.name,
      expect.anything()
    );

    expect(fileManager.copy).toHaveBeenCalledWith(
      config.s3Bucket,
      document1.path,
      config.eserviceDocumentsPath,
      expectedDocument1.id,
      expectedDocument1.name,
      expect.anything()
    );

    expect(fileManager.copy).toHaveBeenCalledWith(
      config.s3Bucket,
      document2.path,
      config.eserviceDocumentsPath,
      expectedDocument2.id,
      expectedDocument2.name,
      expect.anything()
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(expectedInterface.path);
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(expectedDocument1.path);
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(expectedDocument2.path);

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
    expect(
      eServiceToApiEService(fromEServiceV2(writtenPayload.eservice!))
    ).toEqual(newEService);
  });
  it("should fail if one of the file copy fails", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
      docs: [mockDocument],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.cloneDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(FileManagerError);
  });
  it("should throw eServiceDuplicate if an eservice with the same name already exists, case insensitive", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
      docs: [mockDocument],
    };
    const eservice1: EService = {
      ...mockEService,
      name: mockEService.name.toUpperCase(),
      id: generateId(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice1);

    const cloneTimestamp = new Date();
    const conflictEServiceName = `${eservice1.name.toLowerCase()} - clone - ${formatDateddMMyyyyHHmmss(
      cloneTimestamp
    )}`;

    const eservice2: EService = {
      ...mockEService,
      id: generateId(),
      name: conflictEServiceName,
      descriptors: [descriptor],
    };
    await addOneEService(eservice2);

    expect(
      catalogService.cloneDescriptor(eservice1.id, descriptor.id, {
        authData: getMockAuthData(eservice1.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      eServiceDuplicate(
        `${eservice1.name} - clone - ${formatDateddMMyyyyHHmmss(
          cloneTimestamp
        )}`
      )
    );
  });
  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.cloneDescriptor(mockEService.id, mockDescriptor.id, {
        authData: getMockAuthData(),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });
  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.cloneDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);
    expect(
      catalogService.cloneDescriptor(mockEService.id, mockDescriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });
});
