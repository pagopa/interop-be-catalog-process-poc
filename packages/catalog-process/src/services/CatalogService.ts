import { logger } from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { AuthData } from "../../../commons/src/auth/authData.js";
import {
  CatalogProcessError,
  ErrorTypes,
  eServiceCannotBeDeleted,
  eServiceCannotBeUpdated,
  eServiceNotFound,
  notValidDescriptor,
  operationForbidden,
} from "../model/domain/errors.js";
import {
  EServiceDescriptorSeed,
  UpdateEServiceDescriptorSeed,
  convertToClientEServiceSeed,
} from "../model/domain/models.js";
import {
  ApiEServiceDescriptorDocumentSeed,
  ApiEServiceDescriptorDocumentUpdateSeed,
  ApiEServiceSeed,
} from "../model/types.js";
import {
  descriptorSeedToCreateEvent,
  eserviceDescriptorDocumentSeedToCreateEvent,
  eserviceSeedToCreateEvent,
} from "../repositories/adapters/adapters.js";
import { eventRepository } from "../repositories/events.js";
import { fileManager } from "../utilities/fileManager.js";
import { nextDescriptorVersion } from "../utilities/versionGenerator.js";
import { readModelGateway } from "./ReadModelGateway.js";

export const catalogService = {
  async createEService(
    apiEservicesSeed: ApiEServiceSeed,
    authData: AuthData
  ): Promise<string> {
    const eserviceSeed = convertToClientEServiceSeed(
      apiEservicesSeed,
      authData.organizationId
    );

    const eservice = await readModelGateway.getEServiceByName(
      eserviceSeed.name
    );

    if (eservice !== undefined) {
      throw new CatalogProcessError(
        `Error during EService creation with name ${eserviceSeed.name}`,
        ErrorTypes.DuplicateEserviceName
      );
    }

    return eventRepository.createEvent(eserviceSeedToCreateEvent(eserviceSeed));
  },
  async updateEService(
    eServiceId: string,
    eservicesSeed: ApiEServiceSeed,
    authData: AuthData
  ): Promise<void> {
    const eservice = await readModelGateway.getEServiceById(eServiceId);

    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    if (
      !(
        eservice.descriptors.length === 0 ||
        (eservice.descriptors.length === 1 &&
          eservice.descriptors[0].state === "DRAFT")
      )
    ) {
      throw eServiceCannotBeUpdated(eServiceId);
    }

    const eserviceSeed = convertToClientEServiceSeed(
      eservicesSeed,
      authData.organizationId
    );

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eservice.version,
      type: "EServiceUpdated",
      data: eserviceSeed,
    });
  },
  async deleteEService(eServiceId: string, authData: AuthData): Promise<void> {
    const eservice = await readModelGateway.getEServiceById(eServiceId);

    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.descriptors.length > 0) {
      throw eServiceCannotBeDeleted(eServiceId);
    }

    if (eservice.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eservice.version,
      type: "EServiceDeleted",
      data: {},
    });
  },
  async uploadDocument(
    eServiceId: string,
    descriptorId: string,
    document: ApiEServiceDescriptorDocumentSeed,
    authData: AuthData
  ): Promise<string> {
    const eservice = await readModelGateway.getEServiceById(eServiceId);

    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
    if (descriptor === undefined) {
      throw new CatalogProcessError(
        `Descriptor ${descriptorId} for EService ${eServiceId} not found`,
        ErrorTypes.EServiceDescriptorNotFound
      );
    }

    return await eventRepository.createEvent(
      eserviceDescriptorDocumentSeedToCreateEvent(
        eServiceId,
        descriptorId,
        document
      )
    );
  },
  async deleteDocument(
    eServiceId: string,
    descriptorId: string,
    documentId: string,
    authData: AuthData
  ): Promise<void> {
    const eservice = await readModelGateway.getEServiceById(eServiceId);

    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const document = await readModelGateway.getEServiceDescriptorDocumentById(
      documentId
    );

    if (document === undefined) {
      throw new CatalogProcessError(
        `Document with id ${documentId} not found in EService ${eServiceId} / Descriptor ${descriptorId}`,
        ErrorTypes.EServiceDocumentNotFound
      );
    }

    await fileManager.deleteFile(document.path);

    await eventRepository.createEvent({
      streamId: documentId,
      version: document.version,
      type: "DeleteCatalogItemDocument",
      data: {
        eServiceId,
        descriptorId,
        documentId,
      },
    });
  },
  async updateDocument(
    eServiceId: string,
    descriptorId: string,
    documentId: string,
    apiEServiceDescriptorDocumentUpdateSeed: ApiEServiceDescriptorDocumentUpdateSeed,
    authData: AuthData
  ): Promise<void> {
    const eservice = await readModelGateway.getEServiceById(eServiceId);

    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
    if (descriptor === undefined) {
      throw new CatalogProcessError(
        `Descriptor ${descriptorId} for EService ${eServiceId} not found`,
        ErrorTypes.EServiceDescriptorNotFound
      );
    }

    const document = await readModelGateway.getEServiceDescriptorDocumentById(
      documentId
    );

    if (document === undefined) {
      throw new CatalogProcessError(
        `Document with id ${documentId} not found in EService ${eServiceId} / Descriptor ${descriptorId}`,
        ErrorTypes.EServiceDocumentNotFound
      );
    }

    const updatedDocument = {
      ...document,
      prettyName: apiEServiceDescriptorDocumentUpdateSeed.prettyName,
    };

    await eventRepository.createEvent({
      streamId: documentId,
      version: document.version,
      type: "UpdateCatalogItemDocument",
      data: {
        eServiceId,
        descriptorId,
        document: updatedDocument,
      },
    });
  },

  async createDescriptor(
    eServiceId: string,
    eserviceDescriptorSeed: EServiceDescriptorSeed
  ): Promise<string> {
    const eservice = await readModelGateway.getEServiceById(eServiceId);
    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    const newVersion = nextDescriptorVersion(eservice);
    const descriptorId = uuidv4();
    const createCatalogDescriptor = descriptorSeedToCreateEvent(
      descriptorId,
      eserviceDescriptorSeed,
      newVersion.toString()
    );

    await eventRepository.createEvent(createCatalogDescriptor);
    return descriptorId;
  },

  async deleteDraftDescriptor(
    eServiceId: string,
    descriptorId: string
  ): Promise<void> {
    logger.info(
      `Deleting draft Descriptor ${descriptorId} of EService ${eServiceId}`
    );

    const eservice = await readModelGateway.getEServiceById(eServiceId);
    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    const descriptor = eservice.descriptors.find(
      (d) => d.id === descriptorId && d.state === "DRAFT"
    );

    if (descriptor === undefined) {
      throw new CatalogProcessError(
        `Descriptor with id ${descriptorId} of EService ${eServiceId} not found`,
        ErrorTypes.EServiceDescriptorNotFound
      );
    }

    const interfacePath = descriptor.docs.find(
      (doc) => doc.id === descriptorId
    );
    if (interfacePath !== undefined) {
      await fileManager.deleteFile(interfacePath.path);
    }

    const deletDescriptorDocs = descriptor.docs.map((doc) =>
      fileManager.deleteFile(doc.path)
    );

    try {
      await Promise.allSettled(deletDescriptorDocs);
    } catch (error) {
      logger.error(
        `Error deleting documents for descriptor ${descriptorId} : ${error}`
      );
    }

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eservice.version,
      type: "DeleteDraftDescriptor",
      data: {
        eServiceId,
        descriptorId,
      },
    });
  },

  async updateDescriptor(
    eServiceId: string,
    descriptorId: string,
    seed: UpdateEServiceDescriptorSeed,
    authData: AuthData
  ): Promise<void> {
    const eservice = await readModelGateway.getEServiceById(eServiceId);
    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
    if (descriptor === undefined) {
      throw new CatalogProcessError(
        `Descriptor with id ${descriptorId} of EService ${eServiceId} not found`,
        ErrorTypes.EServiceDescriptorNotFound
      );
    }

    if (descriptor.state === "DRAFT") {
      throw notValidDescriptor(descriptorId, descriptor.state.toString());
    }

    const updatedDescriptor = {
      ...descriptor,
      description: seed.description,
      audience: seed.audience,
      voucherLifeSpan: seed.voucherLifespan,
      dailyCallsPerConsumer: seed.dailyCallsPerConsumer,
      state: "DRAFT",
      dailyCallsTotal: seed.dailyCallsTotal,
      agreementApprovalPolicy: seed.agreementApprovalPolicy,
    };

    const filteredDescriptor = eservice.descriptors.filter(
      (d) => d.id !== descriptorId
    );

    const updatedEService = {
      ...eservice,
      descriptor: [...filteredDescriptor, updatedDescriptor],
    };

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eservice.version,
      type: "UpdateDraftDescriptor",
      data: updatedEService,
    });
  },
};
