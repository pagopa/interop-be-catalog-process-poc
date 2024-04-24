import { z } from "zod";
import {
  AuthData,
  CreateEvent,
  DB,
  FileManager,
  eventRepository,
  logger,
} from "pagopa-interop-commons";
import {
  generateId,
  Agreement,
  AgreementDocument,
  AgreementEvent,
  ListResult,
  WithMetadata,
  agreementEventToBinaryData,
  agreementState,
  descriptorState,
  AgreementDocumentId,
  AgreementId,
} from "pagopa-interop-models";
import {
  agreementAlreadyExists,
  descriptorNotFound,
  noNewerDescriptor,
  unexpectedVersionFormat,
  publishedDescriptorNotFound,
  agreementDocumentNotFound,
} from "../model/domain/errors.js";

import {
  toCreateEventAgreementAdded,
  toCreateEventAgreementArchived,
  toCreateEventAgreementArchivedByUpgrade,
  toCreateEventAgreementDeleted,
  toCreateEventAgreementRejected,
  toCreateEventAgreementUpgraded,
  toCreateEventDraftAgreementUpdated,
} from "../model/domain/toEvent.js";
import {
  assertAgreementExist,
  assertEServiceExist,
  assertExpectedState,
  assertRequesterIsConsumer,
  assertRequesterIsConsumerOrProducer,
  assertRequesterIsProducer,
  assertTenantExist,
  assertDescriptorExist,
  declaredAttributesSatisfied,
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  validateCertifiedAttributes,
  verifiedAttributesSatisfied,
  verifyConflictingAgreements,
  agreementDeletableStates,
  agreementUpdatableStates,
  agreementUpgradableStates,
  agreementCloningConflictingStates,
  agreementRejectableStates,
  agreementArchivableStates,
} from "../model/domain/validators.js";
import {
  CompactEService,
  CompactOrganization,
} from "../model/domain/models.js";
import {
  ApiAgreementPayload,
  ApiAgreementSubmissionPayload,
  ApiAgreementUpdatePayload,
  ApiAgreementDocumentSeed,
} from "../model/types.js";
import { config } from "../utilities/config.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";
import {
  AgreementEServicesQueryFilters,
  AgreementQueryFilters,
} from "./readmodel/readModelService.js";
import { contractBuilder } from "./agreementContractBuilder.js";
import { submitAgreementLogic } from "./agreementSubmissionProcessor.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";
import { suspendAgreementLogic } from "./agreementSuspensionProcessor.js";
import { createStamp } from "./agreementStampUtils.js";
import {
  removeAgreementConsumerDocumentLogic,
  addConsumerDocumentLogic,
} from "./agreementConsumerDocumentProcessor.js";
import { activateAgreementLogic } from "./agreementActivationProcessor.js";
import { createAgreementLogic } from "./agreementCreationProcessor.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-params
export function agreementServiceBuilder(
  dbInstance: DB,
  agreementQuery: AgreementQuery,
  tenantQuery: TenantQuery,
  eserviceQuery: EserviceQuery,
  attributeQuery: AttributeQuery,
  fileManager: FileManager
) {
  const repository = eventRepository(dbInstance, agreementEventToBinaryData);
  return {
    async getAgreements(
      filters: AgreementQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<Agreement>> {
      logger.info("Retrieving agreements");
      return await agreementQuery.getAgreements(filters, limit, offset);
    },
    async getAgreementById(agreementId: AgreementId): Promise<Agreement> {
      logger.info(`Retrieving agreement by id ${agreementId}`);

      const agreement = await agreementQuery.getAgreementById(agreementId);
      assertAgreementExist(agreementId, agreement);
      return agreement.data;
    },
    async createAgreement(
      agreement: ApiAgreementPayload,
      authData: AuthData,
      correlationId: string
    ): Promise<string> {
      logger.info(
        `Creating agreement for EService ${agreement.eserviceId} and Descriptor ${agreement.descriptorId}`
      );
      const createAgreementEvent = await createAgreementLogic(
        agreement,
        authData,
        agreementQuery,
        eserviceQuery,
        tenantQuery,
        correlationId
      );
      return await repository.createEvent(createAgreementEvent);
    },
    async getAgreementProducers(
      producerName: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      logger.info(
        `Retrieving producers from agreements with producer name ${producerName}`
      );
      return await agreementQuery.getProducers(producerName, limit, offset);
    },
    async getAgreementConsumers(
      consumerName: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      logger.info(
        `Retrieving consumers from agreements with consumer name ${consumerName}`
      );
      return await agreementQuery.getConsumers(consumerName, limit, offset);
    },
    async updateAgreement(
      agreementId: AgreementId,
      agreement: ApiAgreementUpdatePayload,
      authData: AuthData,
      correlationId: string
    ): Promise<void> {
      logger.info(`Updating agreement ${agreementId}`);
      const agreementToBeUpdated = await agreementQuery.getAgreementById(
        agreementId
      );

      await repository.createEvent(
        await updateAgreementLogic(
          {
            agreementId,
            agreement,
            authData,
            agreementToBeUpdated,
          },
          correlationId
        )
      );
    },
    async deleteAgreementById(
      agreementId: AgreementId,
      authData: AuthData,
      correlationId: string
    ): Promise<void> {
      logger.info(`Deleting agreement ${agreementId}`);
      const agreement = await agreementQuery.getAgreementById(agreementId);

      await repository.createEvent(
        await deleteAgreementLogic(
          {
            agreementId,
            authData,
            deleteFile: fileManager.delete,
            agreement,
          },
          correlationId
        )
      );
    },
    async submitAgreement(
      agreementId: AgreementId,
      payload: ApiAgreementSubmissionPayload,
      correlationId: string
    ): Promise<Agreement> {
      logger.info(`Submitting agreement ${agreementId}`);
      const [agreement, updatesEvents] = await submitAgreementLogic(
        agreementId,
        payload,
        contractBuilder(attributeQuery, fileManager.storeBytes),
        eserviceQuery,
        agreementQuery,
        tenantQuery,
        correlationId
      );

      for (const event of updatesEvents) {
        await repository.createEvent(event);
      }

      return agreement;
    },
    async upgradeAgreement(
      agreementId: AgreementId,
      authData: AuthData,
      correlationId: string
    ): Promise<string> {
      logger.info(`Upgrading agreement ${agreementId}`);
      const { streamId, events } = await upgradeAgreementLogic(
        {
          agreementId,
          authData,
          agreementQuery,
          eserviceQuery,
          tenantQuery,
          copyFile: fileManager.copy,
        },
        correlationId
      );

      for (const event of events) {
        await repository.createEvent(event);
      }

      return streamId;
    },
    async cloneAgreement(
      agreementId: AgreementId,
      authData: AuthData,
      correlationId: string
    ): Promise<string> {
      logger.info(`Cloning agreement ${agreementId}`);
      const event = await cloneAgreementLogic(
        {
          agreementId,
          authData,
          agreementQuery,
          eserviceQuery,
          tenantQuery,
          copyFile: fileManager.copy,
        },
        correlationId
      );

      await repository.createEvent(event);

      return event.streamId;
    },
    async addConsumerDocument(
      agreementId: AgreementId,
      documentSeed: ApiAgreementDocumentSeed,
      authData: AuthData,
      correlationId: string
    ): Promise<string> {
      logger.info(`Adding a consumer document to agreement ${agreementId}`);

      const addDocumentEvent = await addConsumerDocumentLogic(
        agreementId,
        documentSeed,
        agreementQuery,
        authData,
        correlationId
      );
      return await repository.createEvent(addDocumentEvent);
    },
    async getAgreementConsumerDocument(
      agreementId: AgreementId,
      documentId: AgreementDocumentId,
      authData: AuthData
    ): Promise<AgreementDocument> {
      logger.info(
        `Retrieving consumer document ${documentId} from agreement ${agreementId}`
      );
      const agreement = await agreementQuery.getAgreementById(agreementId);
      assertAgreementExist(agreementId, agreement);
      assertRequesterIsConsumerOrProducer(agreement.data, authData);

      const document = agreement.data.consumerDocuments.find(
        (d) => d.id === documentId
      );

      if (!document) {
        throw agreementDocumentNotFound(documentId, agreementId);
      }

      return document;
    },
    async suspendAgreement(
      agreementId: AgreementId,
      authData: AuthData,
      correlationId: string
    ): Promise<AgreementId> {
      logger.info(`Suspending agreement ${agreementId}`);
      await repository.createEvent(
        await suspendAgreementLogic({
          agreementId,
          authData,
          agreementQuery,
          tenantQuery,
          eserviceQuery,
          correlationId,
        })
      );

      return agreementId;
    },
    async getAgreementEServices(
      filters: AgreementEServicesQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactEService>> {
      logger.info(
        `Retrieving EServices with consumers ${filters.consumerIds}, producers ${filters.producerIds}, states ${filters.agreeementStates}, offset ${offset}, limit ${limit} and name matching ${filters.eserviceName}`
      );

      return await agreementQuery.getEServices(filters, limit, offset);
    },
    async removeAgreementConsumerDocument(
      agreementId: AgreementId,
      documentId: AgreementDocumentId,
      authData: AuthData,
      correlationId: string
    ): Promise<string> {
      logger.info(
        `Removing consumer document ${documentId} from agreement ${agreementId}`
      );

      const removeDocumentEvent = await removeAgreementConsumerDocumentLogic(
        agreementId,
        documentId,
        agreementQuery,
        authData,
        fileManager.delete,
        correlationId
      );

      return await repository.createEvent(removeDocumentEvent);
    },
    async rejectAgreement(
      agreementId: AgreementId,
      rejectionReason: string,
      authData: AuthData,
      correlationId: string
    ): Promise<string> {
      logger.info(`Rejecting agreement ${agreementId}`);
      await repository.createEvent(
        await rejectAgreementLogic(
          {
            agreementId,
            rejectionReason,
            authData,
            agreementQuery,
            tenantQuery,
            eserviceQuery,
          },
          correlationId
        )
      );
      return agreementId;
    },
    async activateAgreement(
      agreementId: Agreement["id"],
      authData: AuthData,
      correlationId: string
    ): Promise<Agreement["id"]> {
      logger.info(`Activating agreement ${agreementId}`);
      const updatesEvents = await activateAgreementLogic(
        agreementId,
        agreementQuery,
        eserviceQuery,
        tenantQuery,
        attributeQuery,
        authData,
        fileManager.storeBytes,
        correlationId
      );

      for (const event of updatesEvents) {
        await repository.createEvent(event);
      }
      return agreementId;
    },
    async archiveAgreement(
      agreementId: AgreementId,
      authData: AuthData,
      correlationId: string
    ): Promise<Agreement["id"]> {
      logger.info(`Archiving agreement ${agreementId}`);

      await repository.createEvent(
        await archiveAgreementLogic(
          agreementId,
          authData,
          agreementQuery,
          correlationId
        )
      );

      return agreementId;
    },
  };
}

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;

async function createAndCopyDocumentsForClonedAgreement(
  newAgreementId: AgreementId,
  clonedAgreement: Agreement,
  copyFile: (
    bucket: string,
    sourcePath: string,
    destinationPath: string,
    destinationFileName: string,
    docName: string
  ) => Promise<string>
): Promise<AgreementDocument[]> {
  const docs = await Promise.all(
    clonedAgreement.consumerDocuments.map(async (d) => {
      const newId: AgreementDocumentId = generateId();
      return {
        newId,
        newPath: await copyFile(
          config.s3Bucket,
          `${config.consumerDocumentsPath}/${newAgreementId}`,
          d.path,
          newId,
          d.name
        ),
      };
    })
  );

  return docs.map((d, i) => ({
    id: d.newId,
    name: clonedAgreement.consumerDocuments[i].name,
    prettyName: clonedAgreement.consumerDocuments[i].prettyName,
    contentType: clonedAgreement.consumerDocuments[i].contentType,
    path: d.newPath,
    createdAt: new Date(),
  }));
}

export async function deleteAgreementLogic(
  {
    agreementId,
    authData,
    deleteFile,
    agreement,
  }: {
    agreementId: AgreementId;
    authData: AuthData;
    deleteFile: (bucket: string, path: string) => Promise<void>;
    agreement: WithMetadata<Agreement> | undefined;
  },
  correlationId: string
): Promise<CreateEvent<AgreementEvent>> {
  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumer(agreement.data, authData);

  assertExpectedState(
    agreementId,
    agreement.data.state,
    agreementDeletableStates
  );

  for (const d of agreement.data.consumerDocuments) {
    await deleteFile(config.s3Bucket, d.path);
  }

  return toCreateEventAgreementDeleted(
    agreement.data,
    agreement.metadata.version,
    correlationId
  );
}

export async function updateAgreementLogic(
  {
    agreementId,
    agreement,
    authData,
    agreementToBeUpdated,
  }: {
    agreementId: AgreementId;
    agreement: ApiAgreementUpdatePayload;
    authData: AuthData;
    agreementToBeUpdated: WithMetadata<Agreement> | undefined;
  },
  correlationId: string
): Promise<CreateEvent<AgreementEvent>> {
  assertAgreementExist(agreementId, agreementToBeUpdated);
  assertRequesterIsConsumer(agreementToBeUpdated.data, authData);

  assertExpectedState(
    agreementId,
    agreementToBeUpdated.data.state,
    agreementUpdatableStates
  );

  const agreementUpdated: Agreement = {
    ...agreementToBeUpdated.data,
    consumerNotes: agreement.consumerNotes,
  };

  return toCreateEventDraftAgreementUpdated(
    agreementUpdated,
    agreementToBeUpdated.metadata.version,
    correlationId
  );
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function upgradeAgreementLogic(
  {
    agreementId,
    authData,
    agreementQuery,
    eserviceQuery,
    tenantQuery,
    copyFile,
  }: {
    agreementId: AgreementId;
    authData: AuthData;
    agreementQuery: AgreementQuery;
    eserviceQuery: EserviceQuery;
    tenantQuery: TenantQuery;
    copyFile: (
      bucket: string,
      sourcePath: string,
      destinationPath: string,
      destinationFileName: string,
      docName: string
    ) => Promise<string>;
  },
  correlationId: string
): Promise<{ streamId: string; events: Array<CreateEvent<AgreementEvent>> }> {
  const agreementToBeUpgraded = await agreementQuery.getAgreementById(
    agreementId
  );
  const tenant = await tenantQuery.getTenantById(authData.organizationId);
  assertTenantExist(authData.organizationId, tenant);
  assertAgreementExist(agreementId, agreementToBeUpgraded);
  assertRequesterIsConsumer(agreementToBeUpgraded.data, authData);

  assertExpectedState(
    agreementId,
    agreementToBeUpgraded.data.state,
    agreementUpgradableStates
  );

  const eservice = await eserviceQuery.getEServiceById(
    agreementToBeUpgraded.data.eserviceId
  );
  assertEServiceExist(agreementToBeUpgraded.data.eserviceId, eservice);

  const newDescriptor = eservice.descriptors.find(
    (d) => d.state === descriptorState.published
  );
  if (newDescriptor === undefined) {
    throw publishedDescriptorNotFound(agreementToBeUpgraded.data.eserviceId);
  }
  const latestDescriptorVersion = z
    .preprocess((x) => Number(x), z.number())
    .safeParse(newDescriptor.version);
  if (!latestDescriptorVersion.success) {
    throw unexpectedVersionFormat(eservice.id, newDescriptor.id);
  }

  const currentDescriptor = eservice.descriptors.find(
    (d) => d.id === agreementToBeUpgraded.data.descriptorId
  );
  if (currentDescriptor === undefined) {
    throw descriptorNotFound(
      eservice.id,
      agreementToBeUpgraded.data.descriptorId
    );
  }

  const currentVersion = z
    .preprocess((x) => Number(x), z.number())
    .safeParse(currentDescriptor.version);
  if (!currentVersion.success) {
    throw unexpectedVersionFormat(eservice.id, currentDescriptor.id);
  }

  if (latestDescriptorVersion.data <= currentVersion.data) {
    throw noNewerDescriptor(eservice.id, currentDescriptor.id);
  }

  if (eservice.producerId !== authData.organizationId) {
    validateCertifiedAttributes(newDescriptor, tenant);
  }

  const verifiedValid = verifiedAttributesSatisfied(
    agreementToBeUpgraded.data.producerId,
    newDescriptor,
    tenant
  );

  const declaredValid = declaredAttributesSatisfied(newDescriptor, tenant);

  if (verifiedValid && declaredValid) {
    // upgradeAgreement
    const stamp = createStamp(authData);
    const archived: Agreement = {
      ...agreementToBeUpgraded.data,
      state: agreementState.archived,
      stamps: {
        ...agreementToBeUpgraded.data.stamps,
        archiving: stamp,
      },
    };
    const upgraded: Agreement = {
      ...agreementToBeUpgraded.data,
      id: generateId(),
      descriptorId: newDescriptor.id,
      createdAt: new Date(),
      updatedAt: undefined,
      rejectionReason: undefined,
      stamps: {
        ...agreementToBeUpgraded.data.stamps,
        upgrade: stamp,
      },
    };

    return {
      streamId: upgraded.id,
      events: [
        toCreateEventAgreementArchivedByUpgrade(
          archived,
          agreementToBeUpgraded.metadata.version,
          correlationId
        ),
        toCreateEventAgreementUpgraded(upgraded, correlationId),
      ],
    };
  } else {
    // createNewDraftAgreement
    await verifyConflictingAgreements(
      agreementToBeUpgraded.data.consumerId,
      agreementToBeUpgraded.data.eserviceId,
      [agreementState.draft],
      agreementQuery
    );

    const id = generateId<AgreementId>();
    const newAgreement: Agreement = {
      id,
      eserviceId: agreementToBeUpgraded.data.eserviceId,
      descriptorId: newDescriptor.id,
      producerId: agreementToBeUpgraded.data.producerId,
      consumerId: agreementToBeUpgraded.data.consumerId,
      verifiedAttributes: agreementToBeUpgraded.data.verifiedAttributes,
      certifiedAttributes: agreementToBeUpgraded.data.certifiedAttributes,
      declaredAttributes: agreementToBeUpgraded.data.declaredAttributes,
      consumerNotes: agreementToBeUpgraded.data.consumerNotes,
      state: agreementState.draft,
      createdAt: new Date(),
      consumerDocuments: await createAndCopyDocumentsForClonedAgreement(
        id,
        agreementToBeUpgraded.data,
        copyFile
      ),
      stamps: {},
    };

    const createEvent = toCreateEventAgreementAdded(
      newAgreement,
      correlationId
    );

    return {
      streamId: createEvent.streamId,
      events: [createEvent],
    };
  }
}

export async function cloneAgreementLogic(
  {
    agreementId,
    authData,
    agreementQuery,
    tenantQuery,
    eserviceQuery,
    copyFile,
  }: {
    agreementId: AgreementId;
    authData: AuthData;
    agreementQuery: AgreementQuery;
    tenantQuery: TenantQuery;
    eserviceQuery: EserviceQuery;
    copyFile: (
      bucket: string,
      sourcePath: string,
      destinationPath: string,
      destinationFileName: string,
      docName: string
    ) => Promise<string>;
  },
  correlationId: string
): Promise<CreateEvent<AgreementEvent>> {
  const agreementToBeCloned = await agreementQuery.getAgreementById(
    agreementId
  );
  assertAgreementExist(agreementId, agreementToBeCloned);
  assertRequesterIsConsumer(agreementToBeCloned.data, authData);

  assertExpectedState(agreementId, agreementToBeCloned.data.state, [
    agreementState.rejected,
  ]);

  const eservice = await eserviceQuery.getEServiceById(
    agreementToBeCloned.data.eserviceId
  );
  assertEServiceExist(agreementToBeCloned.data.eserviceId, eservice);

  const activeAgreement = await agreementQuery.getAllAgreements({
    consumerId: authData.organizationId,
    eserviceId: agreementToBeCloned.data.eserviceId,
    agreementStates: agreementCloningConflictingStates,
  });
  if (activeAgreement.length > 0) {
    throw agreementAlreadyExists(
      authData.organizationId,
      agreementToBeCloned.data.eserviceId
    );
  }

  const consumer = await tenantQuery.getTenantById(
    agreementToBeCloned.data.consumerId
  );
  assertTenantExist(agreementToBeCloned.data.consumerId, consumer);

  const descriptor = eservice.descriptors.find(
    (d) => d.id === agreementToBeCloned.data.descriptorId
  );
  assertDescriptorExist(
    eservice.id,
    agreementToBeCloned.data.descriptorId,
    descriptor
  );

  validateCertifiedAttributes(descriptor, consumer);

  const id = generateId<AgreementId>();
  const newAgreement: Agreement = {
    id,
    eserviceId: agreementToBeCloned.data.eserviceId,
    descriptorId: agreementToBeCloned.data.descriptorId,
    producerId: agreementToBeCloned.data.producerId,
    consumerId: agreementToBeCloned.data.consumerId,
    consumerNotes: agreementToBeCloned.data.consumerNotes,
    verifiedAttributes: [],
    certifiedAttributes: [],
    declaredAttributes: [],
    state: agreementState.draft,
    createdAt: new Date(),
    consumerDocuments: await createAndCopyDocumentsForClonedAgreement(
      id,
      agreementToBeCloned.data,
      copyFile
    ),
    stamps: {},
  };

  return toCreateEventAgreementAdded(newAgreement, correlationId);
}

export async function rejectAgreementLogic(
  {
    agreementId,
    rejectionReason,
    authData,
    agreementQuery,
    tenantQuery,
    eserviceQuery,
  }: {
    agreementId: AgreementId;
    rejectionReason: string;
    authData: AuthData;
    agreementQuery: AgreementQuery;
    tenantQuery: TenantQuery;
    eserviceQuery: EserviceQuery;
  },
  correlationId: string
): Promise<CreateEvent<AgreementEvent>> {
  const agreementToBeRejected = await agreementQuery.getAgreementById(
    agreementId
  );
  assertAgreementExist(agreementId, agreementToBeRejected);

  assertRequesterIsProducer(agreementToBeRejected.data, authData);

  assertExpectedState(
    agreementId,
    agreementToBeRejected.data.state,
    agreementRejectableStates
  );

  const eservice = await eserviceQuery.getEServiceById(
    agreementToBeRejected.data.eserviceId
  );
  assertEServiceExist(agreementToBeRejected.data.eserviceId, eservice);

  const consumer = await tenantQuery.getTenantById(
    agreementToBeRejected.data.consumerId
  );
  assertTenantExist(agreementToBeRejected.data.consumerId, consumer);

  const descriptor = eservice.descriptors.find(
    (d) => d.id === agreementToBeRejected.data.descriptorId
  );
  assertDescriptorExist(
    eservice.id,
    agreementToBeRejected.data.descriptorId,
    descriptor
  );

  const stamp = createStamp(authData);
  const rejected: Agreement = {
    ...agreementToBeRejected.data,
    state: agreementState.rejected,
    certifiedAttributes: matchingCertifiedAttributes(descriptor, consumer),
    declaredAttributes: matchingDeclaredAttributes(descriptor, consumer),
    verifiedAttributes: matchingVerifiedAttributes(
      eservice,
      descriptor,
      consumer
    ),
    rejectionReason,
    suspendedByConsumer: undefined,
    suspendedByProducer: undefined,
    suspendedByPlatform: undefined,
    stamps: {
      ...agreementToBeRejected.data.stamps,
      rejection: stamp,
    },
  };

  return toCreateEventAgreementRejected(
    rejected,
    agreementToBeRejected.metadata.version,
    correlationId
  );
}

export async function archiveAgreementLogic(
  agreementId: Agreement["id"],
  authData: AuthData,
  agreementQuery: AgreementQuery,
  correlationId: string
): Promise<CreateEvent<AgreementEvent>> {
  const agreement = await agreementQuery.getAgreementById(agreementId);
  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumer(agreement.data, authData);
  assertExpectedState(
    agreementId,
    agreement.data.state,
    agreementArchivableStates
  );

  const updateSeed = {
    ...agreement.data,
    state: agreementState.archived,
    stamps: {
      ...agreement.data.stamps,
      archiving: createStamp(authData),
    },
  };

  const updatedAgreement = {
    ...agreement.data,
    ...updateSeed,
  };

  return toCreateEventAgreementArchived(
    updatedAgreement,
    agreement.metadata.version,
    correlationId
  );
}
