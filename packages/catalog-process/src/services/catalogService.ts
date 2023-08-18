import {
  AuthData,
  logger,
  authorizationManagementServiceMock,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { match } from "ts-pattern";
import {
  Document,
  Descriptor,
  EService,
  descriptorState,
  DescriptorState,
} from "pagopa-interop-models";
import {
  CatalogProcessError,
  ErrorTypes,
  draftDescriptorAlreadyExists,
  eServiceCannotBeDeleted,
  eServiceCannotBeUpdated,
  eServiceNotFound,
  notValidDescriptor,
  operationForbidden,
  eServiceDocumentNotFound,
} from "../model/domain/errors.js";
import {
  EServiceDescriptorSeed,
  UpdateEServiceDescriptorSeed,
  WithMetadata,
  convertToClientEServiceSeed,
} from "../model/domain/models.js";
import {
  ApiEServiceDescriptorDocumentSeed,
  ApiEServiceDescriptorDocumentUpdateSeed,
  ApiEServiceSeed,
} from "../model/types.js";
import { eventRepository } from "../repositories/EventRepository.js";
import {
  toCreateEventClonedEServiceAdded,
  toCreateEventEServiceAdded,
  toCreateEventEServiceDeleted,
  toCreateEventEServiceDescriptorAdded,
  toCreateEventEServiceDescriptorUpdated,
  toCreateEventEServiceDocumentDeleted,
  toCreateEventEServiceDocumentItemAdded,
  toCreateEventEServiceDocumentUpdated,
  toCreateEventEServiceUpdated,
  toCreateEventEServiceWithDescriptorsDeleted,
} from "../repositories/toEvent.js";
import { fileManager } from "../utilities/fileManager.js";
import { nextDescriptorVersion } from "../utilities/versionGenerator.js";
import {
  apiAgreementApprovalPolicyToAgreementApprovalPolicy,
  apiTechnologyToTechnology,
} from "../model/domain/apiConverter.js";
import { readModelService } from "./readModelService.js";

const assertRequesterAllowed = (
  producerId: string,
  requesterId: string
): void => {
  if (producerId !== requesterId) {
    throw operationForbidden;
  }
};

const retrieveEService = async (
  eServiceId: string
): Promise<WithMetadata<EService>> => {
  const eService = await readModelService.getEServiceById(eServiceId);
  if (eService === undefined) {
    throw eServiceNotFound(eServiceId);
  }
  return eService;
};

const retrieveDescriptor = async (
  descriptorId: string,
  eService: WithMetadata<EService>
): Promise<Descriptor> => {
  const descriptor = eService.data.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );

  if (descriptor === undefined) {
    throw new CatalogProcessError(
      `Descriptor with id ${descriptorId} of EService ${eService.data.id} not found`,
      ErrorTypes.EServiceDescriptorNotFound
    );
  }

  return descriptor;
};

const updateDescriptorState = (
  descriptor: Descriptor,
  newState: DescriptorState
): Descriptor => {
  const descriptorStateChange = [descriptor.state, newState];

  return match(descriptorStateChange)
    .with([descriptorState.draft, descriptorState.published], () => ({
      ...descriptor,
      state: newState,
      publishedAt: new Date(),
    }))
    .with([descriptorState.published, descriptorState.suspended], () => ({
      ...descriptor,
      state: newState,
      suspendedAt: new Date(),
    }))
    .with([descriptorState.suspended, descriptorState.published], () => ({
      ...descriptor,
      state: newState,
      suspendedAt: undefined,
    }))
    .with([descriptorState.suspended, descriptorState.deprecated], () => ({
      ...descriptor,
      state: newState,
      suspendedAt: undefined,
      deprecatedAt: new Date(),
    }))
    .with([descriptorState.suspended, descriptorState.archived], () => ({
      ...descriptor,
      state: newState,
      suspendedAt: undefined,
      archivedAt: new Date(),
    }))
    .with([descriptorState.published, descriptorState.archived], () => ({
      ...descriptor,
      state: newState,
      archivedAt: new Date(),
    }))
    .with([descriptorState.published, descriptorState.deprecated], () => ({
      ...descriptor,
      state: newState,
      deprecatedAt: new Date(),
    }))
    .otherwise(() => ({
      ...descriptor,
      state: newState,
    }));
};

const deprecateDescriptor = async (
  descriptor: Descriptor,
  eService: WithMetadata<EService>
): Promise<void> => {
  logger.info(
    `Deprecating Descriptor ${descriptor.id} of EService ${eService.data.id}`
  );

  const updatedDescriptor = updateDescriptorState(
    descriptor,
    descriptorState.deprecated
  );
  await eventRepository.createEvent1(
    toCreateEventEServiceDescriptorUpdated(
      eService.data.id,
      eService.metadata.version,
      updatedDescriptor
    )
  );
};

const hasNotDraftDescriptor = (eService: EService): boolean => {
  const hasNotDraftDescriptor = eService.descriptors.some(
    (d: Descriptor) => d.state === descriptorState.draft,
    0
  );
  if (!hasNotDraftDescriptor) {
    throw draftDescriptorAlreadyExists(eService.id);
  }
  return hasNotDraftDescriptor;
};

export const catalogService = {
  async createEService(
    apiEServicesSeed: ApiEServiceSeed,
    authData: AuthData
  ): Promise<string> {
    const eServiceSeed = convertToClientEServiceSeed(
      apiEServicesSeed,
      authData.organizationId
    );

    const eservice = await readModelService.getEServices(
      authData,
      {
        eservicesIds: [],
        producersIds: [eServiceSeed.producerId],
        states: [],
        agreementStates: [],
        name: { value: eServiceSeed.name, exactMatch: true },
      },
      0,
      1
    );

    if (eservice.results.length > 0) {
      throw new CatalogProcessError(
        `Error during EService creation with name ${eServiceSeed.name}`,
        ErrorTypes.DuplicateEserviceName
      );
    }

    return eventRepository.createEvent1(
      toCreateEventEServiceAdded(eServiceSeed)
    );
  },
  async updateEService(
    eServiceId: string,
    eServiceSeed: ApiEServiceSeed,
    authData: AuthData
  ): Promise<void> {
    const eService = await retrieveEService(eServiceId);
    assertRequesterAllowed(eService.data.producerId, authData.organizationId);

    if (
      !(
        eService.data.descriptors.length === 0 ||
        (eService.data.descriptors.length === 1 &&
          eService.data.descriptors[0].state === descriptorState.draft)
      )
    ) {
      throw eServiceCannotBeUpdated(eServiceId);
    }

    const updatedEService: EService = {
      ...eService.data,
      description: eServiceSeed.description,
      name: eServiceSeed.name,
      technology: apiTechnologyToTechnology(eServiceSeed.technology),
      producerId: authData.organizationId,
    };

    await eventRepository.createEvent1(
      toCreateEventEServiceUpdated(
        eServiceId,
        eService.metadata.version,
        updatedEService
      )
    );
  },
  async deleteEService(eServiceId: string, authData: AuthData): Promise<void> {
    const eService = await readModelService.getEServiceById(eServiceId);

    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.data.descriptors.length > 0) {
      throw eServiceCannotBeDeleted(eServiceId);
    }

    if (eService.data.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    await eventRepository.createEvent1(
      toCreateEventEServiceDeleted(eServiceId, eService.metadata.version)
    );
  },
  async uploadDocument(
    eServiceId: string,
    descriptorId: string,
    document: ApiEServiceDescriptorDocumentSeed,
    authData: AuthData
  ): Promise<string> {
    const eService = await readModelService.getEServiceById(eServiceId);

    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.data.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eService.data.descriptors.find(
      (d: Descriptor) => d.id === descriptorId
    );
    if (descriptor === undefined) {
      throw new CatalogProcessError(
        `Descriptor ${descriptorId} for EService ${eServiceId} not found`,
        ErrorTypes.EServiceDescriptorNotFound
      );
    }

    return await eventRepository.createEvent1(
      toCreateEventEServiceDocumentItemAdded(eServiceId, descriptorId, document)
    );
  },
  async deleteDocument(
    eServiceId: string,
    descriptorId: string,
    documentId: string,
    authData: AuthData
  ): Promise<void> {
    const eService = await readModelService.getEServiceById(eServiceId);

    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.data.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const document = await readModelService.getEServiceDescriptorDocumentById(
      documentId
    );

    if (document === undefined) {
      throw eServiceDocumentNotFound(eServiceId, descriptorId, documentId);
    }

    await fileManager.deleteFile(document.path);

    await eventRepository.createEvent1(
      toCreateEventEServiceDocumentDeleted(
        eServiceId,
        eService.metadata.version,
        descriptorId,
        documentId
      )
    );
  },
  async updateDocument(
    eServiceId: string,
    descriptorId: string,
    documentId: string,
    apiEServiceDescriptorDocumentUpdateSeed: ApiEServiceDescriptorDocumentUpdateSeed,
    authData: AuthData
  ): Promise<void> {
    const eService = await readModelService.getEServiceById(eServiceId);

    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.data.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eService.data.descriptors.find(
      (d: Descriptor) => d.id === descriptorId
    );
    if (descriptor === undefined) {
      throw new CatalogProcessError(
        `Descriptor ${descriptorId} for EService ${eServiceId} not found`,
        ErrorTypes.EServiceDescriptorNotFound
      );
    }

    const document = await readModelService.getEServiceDescriptorDocumentById(
      documentId
    );

    if (document === undefined) {
      throw eServiceDocumentNotFound(eServiceId, descriptorId, documentId);
    }

    const updatedDocument = {
      ...document,
      prettyName: apiEServiceDescriptorDocumentUpdateSeed.prettyName,
    };

    await eventRepository.createEvent1(
      toCreateEventEServiceDocumentUpdated({
        streamId: eServiceId,
        version: eService.metadata.version,
        descriptorId,
        documentId,
        updatedDocument,
        serverUrls: descriptor.serverUrls,
      })
    );
  },

  async createDescriptor(
    eServiceId: string,
    eserviceDescriptorSeed: EServiceDescriptorSeed,
    authData: AuthData
  ): Promise<string> {
    logger.info(`Creating Descriptor for EService ${eServiceId}`);

    const eService = await retrieveEService(eServiceId);
    assertRequesterAllowed(eService.data.producerId, authData.organizationId);
    hasNotDraftDescriptor(eService.data);

    const newVersion = nextDescriptorVersion(eService.data);

    return await eventRepository.createEvent1(
      toCreateEventEServiceDescriptorAdded(
        eserviceDescriptorSeed,
        newVersion.toString()
      )
    );
  },

  async deleteDraftDescriptor(
    eServiceId: string,
    descriptorId: string,
    authData: AuthData
  ): Promise<void> {
    logger.info(
      `Deleting draft Descriptor ${descriptorId} of EService ${eServiceId}`
    );

    const eService = await retrieveEService(eServiceId);
    assertRequesterAllowed(eService.data.producerId, authData.organizationId);

    const descriptor = eService.data.descriptors.find(
      (d: Descriptor) =>
        d.id === descriptorId && d.state === descriptorState.draft
    );

    if (descriptor === undefined) {
      throw new CatalogProcessError(
        `Descriptor with id ${descriptorId} of EService ${eServiceId} not found`,
        ErrorTypes.EServiceDescriptorNotFound
      );
    }

    const interfacePath = descriptor.docs.find(
      (doc: Document) => doc.id === descriptorId
    );
    if (interfacePath !== undefined) {
      await fileManager.deleteFile(interfacePath.path);
    }

    const deleteDescriptorDocs = descriptor.docs.map((doc: Document) =>
      fileManager.deleteFile(doc.path)
    );

    await Promise.all(deleteDescriptorDocs).catch((error) => {
      logger.error(
        `Error deleting documents for descriptor ${descriptorId} : ${error}`
      );
    });

    await eventRepository.createEvent1(
      toCreateEventEServiceWithDescriptorsDeleted(eService, descriptorId)
    );
  },

  async updateDescriptor(
    eServiceId: string,
    descriptorId: string,
    seed: UpdateEServiceDescriptorSeed,
    authData: AuthData
  ): Promise<void> {
    const eService = await readModelService.getEServiceById(eServiceId);
    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.data.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eService.data.descriptors.find(
      (d: Descriptor) => d.id === descriptorId
    );
    if (descriptor === undefined) {
      throw new CatalogProcessError(
        `Descriptor with id ${descriptorId} of EService ${eServiceId} not found`,
        ErrorTypes.EServiceDescriptorNotFound
      );
    }

    if (descriptor.state === descriptorState.draft) {
      throw notValidDescriptor(descriptorId, descriptor.state.toString());
    }

    const updatedDescriptor: Descriptor = {
      ...descriptor,
      description: seed.description,
      audience: seed.audience,
      voucherLifespan: seed.voucherLifespan,
      dailyCallsPerConsumer: seed.dailyCallsPerConsumer,
      state: "Draft",
      dailyCallsTotal: seed.dailyCallsTotal,
      agreementApprovalPolicy:
        apiAgreementApprovalPolicyToAgreementApprovalPolicy(
          seed.agreementApprovalPolicy
        ),
    };

    const filteredDescriptor = eService.data.descriptors.filter(
      (d: Descriptor) => d.id !== descriptorId
    );

    const updatedEService: EService = {
      ...eService.data,
      descriptors: [...filteredDescriptor, updatedDescriptor],
    };

    await eventRepository.createEvent1(
      toCreateEventEServiceUpdated(
        eServiceId,
        eService.metadata.version,
        updatedEService
      )
    );
  },

  async publishDescriptor(
    eServiceId: string,
    descriptorId: string,
    authData: AuthData
  ): Promise<void> {
    logger.info(
      `Publishing Descriptor $descriptorId of EService ${eServiceId}`
    );

    const eService = await retrieveEService(eServiceId);
    assertRequesterAllowed(eService.data.producerId, authData.organizationId);

    const descriptor = await retrieveDescriptor(descriptorId, eService);
    if (descriptor.state !== descriptorState.draft) {
      throw notValidDescriptor(descriptor.id, descriptor.state.toString());
    }

    const currentActiveDescriptor = eService.data.descriptors.find(
      (d: Descriptor) => d.state === descriptorState.published
    );

    const updatedDescriptor = updateDescriptorState(
      descriptor,
      descriptorState.published
    );
    if (currentActiveDescriptor !== undefined) {
      await deprecateDescriptor(currentActiveDescriptor, eService);
    }

    await eventRepository.createEvent1(
      toCreateEventEServiceDescriptorUpdated(
        eServiceId,
        eService.metadata.version,
        updatedDescriptor
      )
    );

    await authorizationManagementServiceMock.updateStateOnClients();
  },

  async suspendDescriptor(
    eServiceId: string,
    descriptorId: string,
    authData: AuthData
  ): Promise<void> {
    logger.info(
      `Suspending Descriptor ${descriptorId} of EService ${eServiceId}`
    );

    const eService = await retrieveEService(eServiceId);
    assertRequesterAllowed(eService.data.producerId, authData.organizationId);

    const descriptor = await retrieveDescriptor(descriptorId, eService);
    if (
      descriptor.state !== descriptorState.deprecated &&
      descriptor.state !== descriptorState.published
    ) {
      throw notValidDescriptor(descriptorId, descriptor.state.toString());
    }

    const updatedDescriptor = updateDescriptorState(
      descriptor,
      descriptorState.suspended
    );

    await eventRepository.createEvent1(
      toCreateEventEServiceDescriptorUpdated(
        eServiceId,
        eService.metadata.version,
        updatedDescriptor
      )
    );

    await authorizationManagementServiceMock.updateStateOnClients();
  },

  async activateDescriptor(
    eServiceId: string,
    descriptorId: string,
    authData: AuthData
  ): Promise<void> {
    logger.info(
      `Activating descriptor ${descriptorId} for EService ${eServiceId}`
    );

    const eService = await retrieveEService(eServiceId);
    assertRequesterAllowed(eService.data.producerId, authData.organizationId);

    const descriptor = await retrieveDescriptor(descriptorId, eService);
    if (descriptor.state !== descriptorState.suspended) {
      throw notValidDescriptor(descriptorId, descriptor.state.toString());
    }

    const updatedDescriptor = updateDescriptorState(
      descriptor,
      descriptorState.published
    );
    const descriptorVersions: number[] = eService.data.descriptors
      .filter(
        (d: Descriptor) =>
          d.state === descriptorState.suspended ||
          d.state === descriptorState.deprecated ||
          d.state === descriptorState.published
      )
      .map((d: Descriptor) => parseInt(d.version, 10));
    const recentDescriptorVersion = Math.max(...descriptorVersions);

    if (
      recentDescriptorVersion !== null &&
      parseInt(descriptor.version, 10) === recentDescriptorVersion
    ) {
      logger.info(
        `Publishing Descriptor ${descriptorId} of EService ${eServiceId}`
      );
      await eventRepository.createEvent1(
        toCreateEventEServiceDescriptorUpdated(
          eServiceId,
          eService.metadata.version,
          updatedDescriptor
        )
      );
    } else {
      await deprecateDescriptor(descriptor, eService);
    }

    await authorizationManagementServiceMock.updateStateOnClients();
  },

  async cloneDescriptor(
    eServiceId: string,
    descriptorId: string,
    authData: AuthData
  ): Promise<EService> {
    logger.info(`Cloning Descriptor ${descriptorId} of EService ${eServiceId}`);

    const eService = await retrieveEService(eServiceId);
    assertRequesterAllowed(eService.data.producerId, authData.organizationId);

    const descriptor = await retrieveDescriptor(descriptorId, eService);

    const sourceDocument = descriptor.docs[0];
    const clonedDocumentId = uuidv4();

    const clonedInterfacePath =
      descriptor.interface !== undefined
        ? await fileManager.copy(
            descriptor.interface.path,
            clonedDocumentId,
            descriptor.interface.name
          )
        : undefined;

    const clonedInterfaceDocument: Document | undefined =
      clonedInterfacePath !== undefined
        ? {
            id: clonedDocumentId,
            name: sourceDocument.name,
            contentType: sourceDocument.contentType,
            prettyName: sourceDocument.prettyName,
            path: clonedInterfacePath,
            checksum: sourceDocument.checksum,
            uploadDate: new Date(),
          }
        : undefined;

    const clonedDocuments = await Promise.all(
      descriptor.docs.map(async (doc: Document) => {
        const clonedDocumentId = uuidv4();
        const clonedPath = await fileManager.copy(
          doc.path,
          clonedDocumentId,
          doc.name
        );
        const clonedDocument: Document = {
          id: clonedDocumentId,
          name: doc.name,
          contentType: doc.contentType,
          prettyName: doc.prettyName,
          path: clonedPath,
          checksum: doc.checksum,
          uploadDate: new Date(),
        };
        return clonedDocument;
      })
    );

    const draftCatalogItem: EService = {
      id: uuidv4(),
      producerId: eService.data.producerId,
      name: `${eService.data.name} - clone`,
      description: eService.data.description,
      technology: eService.data.technology,
      attributes: eService.data.attributes,
      createdAt: new Date(),
      descriptors: [
        {
          ...descriptor,
          id: uuidv4(),
          version: "1",
          interface: clonedInterfaceDocument,
          docs: clonedDocuments,
          state: descriptorState.draft,
          createdAt: new Date(),
          publishedAt: undefined,
          suspendedAt: undefined,
          deprecatedAt: undefined,
          archivedAt: undefined,
        },
      ],
    };

    await eventRepository.createEvent1(
      toCreateEventClonedEServiceAdded(draftCatalogItem)
    );

    return draftCatalogItem;
  },

  async archiveDescriptor(
    eServiceId: string,
    descriptorId: string,
    authData: AuthData
  ): Promise<void> {
    logger.info(
      `Archiving descriptor ${descriptorId} of EService ${eServiceId}`
    );

    const eService = await retrieveEService(eServiceId);
    assertRequesterAllowed(eService.data.producerId, authData.organizationId);

    const descriptor = await retrieveDescriptor(descriptorId, eService);
    const updatedDescriptor = updateDescriptorState(
      descriptor,
      descriptorState.archived
    );

    await eventRepository.createEvent1(
      toCreateEventEServiceDescriptorUpdated(
        eServiceId,
        eService.metadata.version,
        updatedDescriptor
      )
    );

    await authorizationManagementServiceMock.updateStateOnClients();
  },
};
