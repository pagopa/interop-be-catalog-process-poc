/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger, fileManagerDeleteError } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorDocumentDeletedV2,
  toEServiceV2,
  EServiceDescriptorInterfaceDeletedV2,
  operationForbidden,
  generateId,
} from "pagopa-interop-models";
import { vi, expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptor,
  eServiceDocumentNotFound,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import {
  fileManager,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  getMockDescriptor,
  getMockEService,
  getMockDocument,
} from "./utils.js";
import { mockEserviceRouterRequest } from "./supertestSetup.js";

describe("delete Document", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it.each(
    Object.values(descriptorState).filter(
      (state) => state !== descriptorState.archived
    )
  )(
    "should write on event-store for the deletion of a document, and delete the file from the bucket, for %s descriptor",
    async (state) => {
      vi.spyOn(fileManager, "delete");

      const document = {
        ...mockDocument,
        path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
      };
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        docs: [document],
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
          resourceId: document.id,
          name: document.name,
          content: Buffer.from("testtest"),
        },
        genericLogger
      );
      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toContain(document.path);

      await mockEserviceRouterRequest.delete({
        path: "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
        pathParams: {
          eServiceId: eservice.id,
          descriptorId: descriptor.id,
          documentId: document.id,
        },
        authData: getMockAuthData(eservice.producerId),
      });

      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent.stream_id).toBe(eservice.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceDescriptorDocumentDeleted");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorDocumentDeletedV2,
        payload: writtenEvent.data,
      });

      const expectedEservice = toEServiceV2({
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            docs: [],
          },
        ],
      });

      expect(writtenPayload.descriptorId).toEqual(descriptor.id);
      expect(writtenPayload.documentId).toEqual(document.id);
      expect(writtenPayload.eservice).toEqual(expectedEservice);

      expect(fileManager.delete).toHaveBeenCalledWith(
        config.s3Bucket,
        document.path,
        expect.anything()
      );
      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).not.toContain(document.path);
    }
  );

  it("should write on event-store for the deletion of a document that is the descriptor interface, and delete the file from the bucket", async () => {
    vi.spyOn(fileManager, "delete");

    const interfaceDocument = {
      ...mockDocument,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
    };
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: interfaceDocument,
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
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(interfaceDocument.path);

    await mockEserviceRouterRequest.delete({
      path: "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      pathParams: {
        eServiceId: eservice.id,
        descriptorId: descriptor.id,
        documentId: interfaceDocument.id,
      },
      authData: getMockAuthData(eservice.producerId),
    });

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorInterfaceDeleted");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorInterfaceDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          interface: undefined,
          serverUrls: [],
        },
      ],
    });

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.documentId).toEqual(interfaceDocument.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      interfaceDocument.path,
      expect.anything()
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(interfaceDocument.path);
  });

  it("should fail if the file deletion fails", async () => {
    config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      docs: [mockDocument],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };

    await addOneEService(eservice);
    await expect(
      catalogService.deleteDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
        {
          authData: getMockAuthData(eservice.producerId),
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
  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    expect(
      catalogService.deleteDocument(
        mockEService.id,
        mockDescriptor.id,
        mockDocument.id,
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });
  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      docs: [mockDocument],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.deleteDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    expect(
      catalogService.deleteDocument(
        eservice.id,
        mockDescriptor.id,
        mockDocument.id,
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });
  it.each(
    Object.values(descriptorState).filter(
      (state) => state === descriptorState.archived
    )
  )(
    "should throw notValidDescriptor if the descriptor is in s% state",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        docs: [mockDocument],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      expect(
        catalogService.deleteDocument(
          eservice.id,
          descriptor.id,
          mockDocument.id,
          {
            authData: getMockAuthData(eservice.producerId),
            correlationId: generateId(),
            serviceName: "",
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(notValidDescriptor(descriptor.id, state));
    }
  );
  it("should throw eServiceDocumentNotFound if the document doesn't exist", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      docs: [],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    expect(
      catalogService.deleteDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceDocumentNotFound(eservice.id, descriptor.id, mockDocument.id)
    );
  });
});
