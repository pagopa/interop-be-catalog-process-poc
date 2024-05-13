import {
  AuthData,
  CreateEvent,
  DB,
  FileManager,
  Logger,
  WithLogger,
  AppContext,
  eventRepository,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementDocument,
  AgreementDocumentId,
  AgreementEvent,
  AgreementId,
  AttributeId,
  ListResult,
  WithMetadata,
  agreementEventToBinaryData,
  agreementState,
  descriptorState,
  generateId,
} from "pagopa-interop-models";
import { z } from "zod";
import {
  agreementAlreadyExists,
  agreementDocumentNotFound,
  descriptorNotFound,
  noNewerDescriptor,
  publishedDescriptorNotFound,
  unexpectedVersionFormat,
} from "../model/domain/errors.js";
import {
  CompactEService,
  CompactOrganization,
  CompactTenant,
} from "../model/domain/models.js";
import {
  toCreateEventAgreementAdded,
  toCreateEventAgreementArchivedByConsumer,
  toCreateEventAgreementArchivedByUpgrade,
  toCreateEventAgreementDeleted,
  toCreateEventAgreementRejected,
  toCreateEventAgreementUpgraded,
  toCreateEventDraftAgreementUpdated,
} from "../model/domain/toEvent.js";
import {
  agreementArchivableStates,
  agreementClonableStates,
  agreementCloningConflictingStates,
  agreementDeletableStates,
  agreementRejectableStates,
  agreementUpdatableStates,
  agreementUpgradableStates,
  assertAgreementExist,
  assertDescriptorExist,
  assertEServiceExist,
  assertExpectedState,
  assertRequesterIsConsumer,
  assertRequesterIsConsumerOrProducer,
  assertRequesterIsProducer,
  assertTenantExist,
  declaredAttributesSatisfied,
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  validateCertifiedAttributes,
  verifiedAttributesSatisfied,
  verifyConflictingAgreements,
} from "../model/domain/validators.js";
import {
  ApiAgreementDocumentSeed,
  ApiAgreementPayload,
  ApiAgreementSubmissionPayload,
  ApiAgreementUpdatePayload,
} from "../model/types.js";
import { config } from "../utilities/config.js";
import { activateAgreementLogic } from "./agreementActivationProcessor.js";
import {
  addConsumerDocumentLogic,
  removeAgreementConsumerDocumentLogic,
} from "./agreementConsumerDocumentProcessor.js";
import { contractBuilder } from "./agreementContractBuilder.js";
import { createAgreementLogic } from "./agreementCreationProcessor.js";
import { createStamp } from "./agreementStampUtils.js";
import { submitAgreementLogic } from "./agreementSubmissionProcessor.js";
import { suspendAgreementLogic } from "./agreementSuspensionProcessor.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";
import {
  AgreementEServicesQueryFilters,
  AgreementQueryFilters,
} from "./readmodel/readModelService.js";

import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";
import { computeAgreementStateByAttribute } from "./agreementStateProcessor.js";

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
      offset: number,
      logger: Logger
    ): Promise<ListResult<Agreement>> {
      logger.info("Retrieving agreements");
      return await agreementQuery.getAgreements(filters, limit, offset);
    },
    async getAgreementById(
      agreementId: AgreementId,
      logger: Logger
    ): Promise<Agreement> {
      logger.info(`Retrieving agreement by id ${agreementId}`);

      const agreement = await agreementQuery.getAgreementById(agreementId);
      assertAgreementExist(agreementId, agreement);
      return agreement.data;
    },
    async createAgreement(
      agreementPayload: ApiAgreementPayload,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(
        `Creating agreement for EService ${agreementPayload.eserviceId} and Descriptor ${agreementPayload.descriptorId}`
      );
      const [agreement, createAgreementEvent] = await createAgreementLogic(
        agreementPayload,
        authData,
        agreementQuery,
        eserviceQuery,
        tenantQuery,
        correlationId
      );
      await repository.createEvent(createAgreementEvent);

      return agreement;
    },
    async getAgreementProducers(
      producerName: string | undefined,
      limit: number,
      offset: number,
      logger: Logger
    ): Promise<ListResult<CompactOrganization>> {
      logger.info(
        `Retrieving producers from agreements with producer name ${producerName}`
      );
      return await agreementQuery.getProducers(producerName, limit, offset);
    },
    async getAgreementConsumers(
      consumerName: string | undefined,
      limit: number,
      offset: number,
      logger: Logger
    ): Promise<ListResult<CompactOrganization>> {
      logger.info(
        `Retrieving consumers from agreements with consumer name ${consumerName}`
      );
      return await agreementQuery.getConsumers(consumerName, limit, offset);
    },
    async updateAgreement(
      agreementId: AgreementId,
      agreement: ApiAgreementUpdatePayload,
      { authData, correlationId, logger }: WithLogger<AppContext>
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
      { authData, correlationId, logger }: WithLogger<AppContext>
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
          correlationId,
          logger
        )
      );
    },
    async submitAgreement(
      agreementId: AgreementId,
      payload: ApiAgreementSubmissionPayload,
      ctx: WithLogger<AppContext>
    ): Promise<Agreement> {
      ctx.logger.info(`Submitting agreement ${agreementId}`);
      const [agreement, updatesEvents] = await submitAgreementLogic(
        agreementId,
        payload,
        contractBuilder(
          ctx.authData.selfcareId,
          attributeQuery,
          fileManager.storeBytes,
          ctx.logger
        ),
        eserviceQuery,
        agreementQuery,
        tenantQuery,
        ctx
      );

      for (const event of updatesEvents) {
        await repository.createEvent(event);
      }

      return agreement;
    },
    async upgradeAgreement(
      agreementId: AgreementId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Upgrading agreement ${agreementId}`);
      const [agreement, events] = await upgradeAgreementLogic(
        {
          agreementId,
          authData,
          agreementQuery,
          eserviceQuery,
          tenantQuery,
          copyFile: fileManager.copy,
        },
        correlationId,
        logger
      );

      for (const event of events) {
        await repository.createEvent(event);
      }

      return agreement;
    },
    async cloneAgreement(
      agreementId: AgreementId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Cloning agreement ${agreementId}`);
      const [agreement, event] = await cloneAgreementLogic(
        {
          agreementId,
          authData,
          agreementQuery,
          eserviceQuery,
          tenantQuery,
          copyFile: fileManager.copy,
        },
        correlationId,
        logger
      );

      await repository.createEvent(event);

      return agreement;
    },
    async addConsumerDocument(
      agreementId: AgreementId,
      documentSeed: ApiAgreementDocumentSeed,
      ctx: WithLogger<AppContext>
    ): Promise<AgreementDocument> {
      ctx.logger.info(`Adding a consumer document to agreement ${agreementId}`);

      const [document, addDocumentEvent] = await addConsumerDocumentLogic(
        agreementId,
        documentSeed,
        agreementQuery,
        ctx
      );
      await repository.createEvent(addDocumentEvent);

      return document;
    },
    async getAgreementConsumerDocument(
      agreementId: AgreementId,
      documentId: AgreementDocumentId,
      { authData, logger }: WithLogger<AppContext>
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
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Suspending agreement ${agreementId}`);
      const [agreement, events] = await suspendAgreementLogic({
        agreementId,
        authData,
        agreementQuery,
        tenantQuery,
        eserviceQuery,
        correlationId,
      });
      await repository.createEvent(events);

      return agreement;
    },
    async getAgreementEServices(
      filters: AgreementEServicesQueryFilters,
      limit: number,
      offset: number,
      logger: Logger
    ): Promise<ListResult<CompactEService>> {
      logger.info(
        `Retrieving EServices with consumers ${filters.consumerIds}, producers ${filters.producerIds}, states ${filters.agreeementStates}, offset ${offset}, limit ${limit} and name matching ${filters.eserviceName}`
      );

      return await agreementQuery.getEServices(filters, limit, offset);
    },
    async removeAgreementConsumerDocument(
      agreementId: AgreementId,
      documentId: AgreementDocumentId,
      { authData, correlationId, logger }: WithLogger<AppContext>
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
        correlationId,
        logger
      );

      return await repository.createEvent(removeDocumentEvent);
    },
    async rejectAgreement(
      agreementId: AgreementId,
      rejectionReason: string,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Rejecting agreement ${agreementId}`);
      const [agreement, event] = await rejectAgreementLogic(
        {
          agreementId,
          rejectionReason,
          authData,
          agreementQuery,
          tenantQuery,
          eserviceQuery,
        },
        correlationId
      );
      await repository.createEvent(event);
      return agreement;
    },
    async activateAgreement(
      agreementId: Agreement["id"],
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Activating agreement ${agreementId}`);
      const [agreement, updatesEvents] = await activateAgreementLogic(
        agreementId,
        agreementQuery,
        eserviceQuery,
        tenantQuery,
        attributeQuery,
        authData,
        fileManager.storeBytes,
        correlationId,
        logger
      );

      for (const event of updatesEvents) {
        await repository.createEvent(event);
      }
      return agreement;
    },
    async archiveAgreement(
      agreementId: AgreementId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Archiving agreement ${agreementId}`);

      const [agreement, event] = await archiveAgreementLogic(
        agreementId,
        authData,
        agreementQuery,
        correlationId
      );
      await repository.createEvent(event);

      return agreement;
    },
    async computeAgreementState(
      attributeId: AttributeId,
      consumer: CompactTenant,
      { logger, correlationId }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Recalculating agreements state for attribute ${attributeId}`
      );

      const events = await computeAgreementStateByAttribute(
        attributeId,
        consumer,
        agreementQuery,
        eserviceQuery,
        correlationId
      );

      await Promise.all(events.map(repository.createEvent));
    },
  };
}

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;

async function createAndCopyDocumentsForClonedAgreement(
  newAgreementId: AgreementId,
  clonedAgreement: Agreement,
  copyFile: FileManager["copy"],
  logger: Logger
): Promise<AgreementDocument[]> {
  const docs = await Promise.all(
    clonedAgreement.consumerDocuments.map(async (d) => {
      const newId: AgreementDocumentId = generateId();
      const documentDestinationPath = `${config.consumerDocumentsPath}/${newAgreementId}`;

      return {
        newId,
        newPath: await copyFile(
          config.s3Bucket,
          d.path,
          documentDestinationPath,
          newId,
          d.name,
          logger
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
    deleteFile: FileManager["delete"];
    agreement: WithMetadata<Agreement> | undefined;
  },
  correlationId: string,
  logger: Logger
): Promise<CreateEvent<AgreementEvent>> {
  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumer(agreement.data, authData);

  assertExpectedState(
    agreementId,
    agreement.data.state,
    agreementDeletableStates
  );

  for (const d of agreement.data.consumerDocuments) {
    await deleteFile(config.s3Bucket, d.path, logger);
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
    copyFile: FileManager["copy"];
  },
  correlationId: string,
  logger: Logger
): Promise<[Agreement, Array<CreateEvent<AgreementEvent>>]> {
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

  if (eservice.producerId !== agreementToBeUpgraded.data.consumerId) {
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
    const newAgreementId = generateId<AgreementId>();
    const upgraded: Agreement = {
      ...agreementToBeUpgraded.data,
      id: newAgreementId,
      descriptorId: newDescriptor.id,
      createdAt: new Date(),
      updatedAt: undefined,
      rejectionReason: undefined,
      stamps: {
        ...agreementToBeUpgraded.data.stamps,
        upgrade: stamp,
      },
      consumerDocuments: await createAndCopyDocumentsForClonedAgreement(
        newAgreementId,
        agreementToBeUpgraded.data,
        copyFile,
        logger
      ),
    };

    return [
      upgraded,
      [
        toCreateEventAgreementArchivedByUpgrade(
          archived,
          agreementToBeUpgraded.metadata.version,
          correlationId
        ),
        toCreateEventAgreementUpgraded(upgraded, correlationId),
      ],
    ];
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
        copyFile,
        logger
      ),
      stamps: {},
    };

    const createEvent = toCreateEventAgreementAdded(
      newAgreement,
      correlationId
    );

    return [newAgreement, [createEvent]];
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
    copyFile: FileManager["copy"];
  },
  correlationId: string,
  logger: Logger
): Promise<[Agreement, CreateEvent<AgreementEvent>]> {
  const agreementToBeCloned = await agreementQuery.getAgreementById(
    agreementId
  );
  assertAgreementExist(agreementId, agreementToBeCloned);
  assertRequesterIsConsumer(agreementToBeCloned.data, authData);

  assertExpectedState(
    agreementId,
    agreementToBeCloned.data.state,
    agreementClonableStates
  );

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
      copyFile,
      logger
    ),
    stamps: {},
  };

  return [
    newAgreement,
    toCreateEventAgreementAdded(newAgreement, correlationId),
  ];
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
): Promise<[Agreement, CreateEvent<AgreementEvent>]> {
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

  return [
    rejected,
    toCreateEventAgreementRejected(
      rejected,
      agreementToBeRejected.metadata.version,
      correlationId
    ),
  ];
}

export async function archiveAgreementLogic(
  agreementId: Agreement["id"],
  authData: AuthData,
  agreementQuery: AgreementQuery,
  correlationId: string
): Promise<[Agreement, CreateEvent<AgreementEvent>]> {
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

  return [
    updatedAgreement,
    toCreateEventAgreementArchivedByConsumer(
      updatedAgreement,
      agreement.metadata.version,
      correlationId
    ),
  ];
}
