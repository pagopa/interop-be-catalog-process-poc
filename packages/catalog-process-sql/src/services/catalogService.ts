/* eslint-disable max-params */
import { catalogApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  AuthData,
  DB,
  FileManager,
  Logger,
  WithLogger,
  eventRepository,
  formatDateddMMyyyyHHmmss,
  hasPermission,
  riskAnalysisValidatedFormToNewRiskAnalysis,
  riskAnalysisValidatedFormToNewRiskAnalysisForm,
  userRoles,
} from "pagopa-interop-commons";
import {
  Descriptor,
  DescriptorId,
  DescriptorRejectionReason,
  DescriptorState,
  Document,
  EService,
  EServiceDocumentId,
  EServiceId,
  EserviceAttributes,
  RiskAnalysis,
  RiskAnalysisId,
  WithMetadata,
  catalogEventToBinaryData,
  descriptorState,
  eserviceMode,
  generateId,
  tenantKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { RejectDelegatedEServiceDescriptorSeed } from "../../../api-clients/dist/catalogApi.js";
import { config } from "../config/config.js";
import {
  apiAgreementApprovalPolicyToAgreementApprovalPolicy,
  apiEServiceModeToEServiceMode,
  apiTechnologyToTechnology,
} from "../model/domain/apiConverter.js";
import {
  audienceCannotBeEmpty,
  eServiceDescriptorNotFound,
  eServiceDescriptorWithoutInterface,
  eServiceDocumentNotFound,
  eServiceDuplicate,
  eServiceNotFound,
  eServiceRiskAnalysisNotFound,
  eserviceWithoutValidDescriptors,
  inconsistentDailyCalls,
  interfaceAlreadyExists,
  notValidDescriptorState,
  originNotCompliant,
  prettyNameDuplicate,
  riskAnalysisDuplicated,
} from "../model/domain/errors.js";
import {
  toCreateEventClonedEServiceAdded,
  toCreateEventEServiceAdded,
  toCreateEventEServiceDeleted,
  toCreateEventEServiceDescriptionUpdated,
  toCreateEventEServiceDescriptorActivated,
  toCreateEventEServiceDescriptorAdded,
  toCreateEventEServiceDescriptorArchived,
  toCreateEventEServiceDescriptorDelegateSubmitted,
  toCreateEventEServiceDescriptorDelegatorApproved,
  toCreateEventEServiceDescriptorDelegatorRejected,
  toCreateEventEServiceDescriptorPublished,
  toCreateEventEServiceDescriptorQuotasUpdated,
  toCreateEventEServiceDescriptorSuspended,
  toCreateEventEServiceDocumentAdded,
  toCreateEventEServiceDocumentDeleted,
  toCreateEventEServiceDocumentUpdated,
  toCreateEventEServiceDraftDescriptorDeleted,
  toCreateEventEServiceDraftDescriptorUpdated,
  toCreateEventEServiceInterfaceAdded,
  toCreateEventEServiceInterfaceDeleted,
  toCreateEventEServiceInterfaceUpdated,
  toCreateEventEServiceRiskAnalysisAdded,
  toCreateEventEServiceRiskAnalysisDeleted,
  toCreateEventEServiceRiskAnalysisUpdated,
  toCreateEventEServiceUpdated,
} from "../model/domain/toEvent.js";
import { nextDescriptorVersion } from "../utilities/versionGenerator.js";
import { ReadModelService } from "./readModelService.js";
import {
  assertDocumentDeletableDescriptorState,
  assertHasNoDraftOrWaitingForApprovalDescriptor,
  assertInterfaceDeletableDescriptorState,
  assertIsDraftEservice,
  assertIsReceiveEservice,
  assertNoExistingProducerDelegationInActiveOrPendingState,
  assertRequesterIsDelegateProducerOrProducer,
  assertRequesterIsProducer,
  validateRiskAnalysisSchemaOrThrow,
} from "./validators.js";

const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<WithMetadata<EService>> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (eservice === undefined) {
    throw eServiceNotFound(eserviceId);
  }
  return eservice;
};

const retrieveDescriptor = (
  descriptorId: DescriptorId,
  eservice: WithMetadata<EService>
): Descriptor => {
  const descriptor = eservice.data.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );

  if (descriptor === undefined) {
    throw eServiceDescriptorNotFound(eservice.data.id, descriptorId);
  }

  return descriptor;
};

const retrieveDocument = (
  eserviceId: EServiceId,
  descriptor: Descriptor,
  documentId: EServiceDocumentId
): Document => {
  const document = [...descriptor.docs, descriptor.interface].find(
    (doc) => doc != null && doc.id === documentId
  );
  if (document === undefined) {
    throw eServiceDocumentNotFound(eserviceId, descriptor.id, documentId);
  }
  return document;
};

// REMOVED FOR THE POC
// const retrieveTenant = async (
//   tenantId: TenantId,
//   readModelService: ReadModelService
// ): Promise<Tenant> => {
//   const tenant = await readModelService.getTenantById(tenantId);
//   if (tenant === undefined) {
//     throw tenantNotFound(tenantId);
//   }
//   return tenant;
// };

const retrieveRiskAnalysis = (
  riskAnalysisId: RiskAnalysisId,
  eservice: WithMetadata<EService>
): RiskAnalysis => {
  const riskAnalysis = eservice.data.riskAnalysis.find(
    (ra: RiskAnalysis) => ra.id === riskAnalysisId
  );

  if (riskAnalysis === undefined) {
    throw eServiceRiskAnalysisNotFound(eservice.data.id, riskAnalysisId);
  }

  return riskAnalysis;
};

// const assertRequesterCanPublish = (
//   producerDelegation: Delegation | undefined,
//   eservice: EService,
//   authData: AuthData
// ): void => {
//   if (producerDelegation) {
//     if (
//       producerDelegation.kind !== delegationKind.delegatedProducer ||
//       authData.organizationId !== producerDelegation.delegateId
//     ) {
//       throw operationForbidden;
//     }
//   } else {
//     assertRequesterIsProducer(eservice.producerId, authData);
//   }
// };

// const retrieveActiveProducerDelegation = async (
//   eservice: EService,
//   readModelService: ReadModelService
// ): Promise<Delegation | undefined> =>
//   await readModelService.getLatestDelegation({
//     eserviceId: eservice.id,
//     kind: delegationKind.delegatedProducer,
//     states: [delegationState.active],
//   });

const updateDescriptorState = (
  descriptor: Descriptor,
  newState: DescriptorState
): Descriptor => {
  const descriptorStateChange = [descriptor.state, newState];

  return match(descriptorStateChange)
    .with(
      [descriptorState.draft, descriptorState.published],
      [descriptorState.waitingForApproval, descriptorState.published],
      () => ({
        ...descriptor,
        state: newState,
        publishedAt: new Date(),
      })
    )
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

const deprecateDescriptor = (
  eserviceId: EServiceId,
  descriptor: Descriptor,
  logger: Logger
): Descriptor => {
  logger.info(
    `Deprecating Descriptor ${descriptor.id} of EService ${eserviceId}`
  );

  return updateDescriptorState(descriptor, descriptorState.deprecated);
};

const archiveDescriptor = (
  streamId: string,
  descriptor: Descriptor,
  logger: Logger
): Descriptor => {
  logger.info(`Archiving Descriptor ${descriptor.id} of EService ${streamId}`);

  return updateDescriptorState(descriptor, descriptorState.archived);
};

const replaceDescriptor = (
  eservice: EService,
  newDescriptor: Descriptor
): EService => {
  const updatedDescriptors = eservice.descriptors.map((d: Descriptor) =>
    d.id === newDescriptor.id ? newDescriptor : d
  );

  return {
    ...eservice,
    descriptors: updatedDescriptors,
  };
};

const replaceRiskAnalysis = (
  eservice: EService,
  newRiskAnalysis: RiskAnalysis
): EService => {
  const updatedRiskAnalysis = eservice.riskAnalysis.map((ra: RiskAnalysis) =>
    ra.id === newRiskAnalysis.id ? newRiskAnalysis : ra
  );

  return {
    ...eservice,
    riskAnalysis: updatedRiskAnalysis,
  };
};

async function parseAndCheckAttributes(
  attributesSeed: catalogApi.AttributesSeed,
  _readModelService: ReadModelService
): Promise<EserviceAttributes> {
  const certifiedAttributes = attributesSeed.certified;
  const declaredAttributes = attributesSeed.declared;
  const verifiedAttributes = attributesSeed.verified;

  // TODO REMOVED THIS FOR THE POC, OTHERWISE ATTRIBUTE HAS TO BE INCLUDED

  // const attributesSeeds = [
  //   ...certifiedAttributes.flat(),
  //   ...declaredAttributes.flat(),
  //   ...verifiedAttributes.flat(),
  // ];

  // if (attributesSeeds.length > 0) {
  //   const attributesSeedsIds: AttributeId[] = attributesSeeds.map((attr) =>
  //     unsafeBrandId(attr.id)
  //   );
  //   const attributes = await readModelService.getAttributesByIds(
  //     attributesSeedsIds
  //   );
  //   const attributesIds = attributes.map((attr) => attr.id);
  //   for (const attributeSeedId of attributesSeedsIds) {
  //     if (!attributesIds.includes(unsafeBrandId(attributeSeedId))) {
  //       throw attributeNotFound(attributeSeedId);
  //     }
  //   }
  // }

  return {
    certified: certifiedAttributes.map((a) =>
      a.map((a) => ({
        ...a,
        id: unsafeBrandId(a.id),
      }))
    ),
    // eslint-disable-next-line sonarjs/no-identical-functions
    declared: declaredAttributes.map((a) =>
      a.map((a) => ({
        ...a,
        id: unsafeBrandId(a.id),
      }))
    ),
    // eslint-disable-next-line sonarjs/no-identical-functions
    verified: verifiedAttributes.map((a) =>
      a.map((a) => ({
        ...a,
        id: unsafeBrandId(a.id),
      }))
    ),
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function catalogServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  fileManager: FileManager
) {
  const repository = eventRepository(dbInstance, catalogEventToBinaryData);
  return {
    async getEServiceById(
      eserviceId: EServiceId,
      { authData, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(`Retrieving EService ${eserviceId}`);
      const eservice = await retrieveEService(eserviceId, readModelService);

      return await applyVisibilityToEService(
        eservice.data,
        authData,
        readModelService
      );
    },

    // async getEServices(
    //   authData: AuthData,
    //   filters: ApiGetEServicesFilters,
    //   offset: number,
    //   limit: number,
    //   logger: Logger
    // ): Promise<ListResult<EService>> {
    //   logger.info(
    //     `Getting EServices with name = ${filters.name}, ids = ${filters.eservicesIds}, producers = ${filters.producersIds}, states = ${filters.states}, agreementStates = ${filters.agreementStates}, limit = ${limit}, offset = ${offset}`
    //   );
    //   const eservicesList = await readModelService.getEServices(
    //     authData,
    //     filters,
    //     offset,
    //     limit
    //   );

    //   const eservicesToReturn = await Promise.all(
    //     eservicesList.results.map((eservice) =>
    //       applyVisibilityToEService(eservice, authData, readModelService)
    //     )
    //   );

    //   return {
    //     results: eservicesToReturn,
    //     totalCount: eservicesList.totalCount,
    //   };
    // },

    // REMOVED FOR THE POC
    // async getEServiceConsumers(
    //   eserviceId: EServiceId,
    //   offset: number,
    //   limit: number,
    //   logger: Logger
    // ): Promise<ListResult<Consumer>> {
    //   logger.info(`Retrieving consumers for EService ${eserviceId}`);
    //   return await readModelService.getEServiceConsumers(
    //     eserviceId,
    //     offset,
    //     limit
    //   );
    // },

    async getDocumentById(
      {
        eserviceId,
        descriptorId,
        documentId,
      }: {
        eserviceId: EServiceId;
        descriptorId: DescriptorId;
        documentId: EServiceDocumentId;
      },
      { authData, logger }: WithLogger<AppContext>
    ): Promise<Document> {
      logger.info(
        `Retrieving EService document ${documentId} for EService ${eserviceId} and descriptor ${descriptorId}`
      );
      const eservice = await retrieveEService(eserviceId, readModelService);
      const descriptor = retrieveDescriptor(descriptorId, eservice);
      const document = retrieveDocument(eserviceId, descriptor, documentId);
      const checkedEService = await applyVisibilityToEService(
        eservice.data,
        authData,
        readModelService
      );
      if (!checkedEService.descriptors.find((d) => d.id === descriptorId)) {
        throw eServiceDocumentNotFound(eserviceId, descriptorId, documentId);
      }
      return document;
    },

    async createEService(
      seed: catalogApi.EServiceSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(`Creating EService with name ${seed.name}`);

      if (!config.producerAllowedOrigins.includes(authData.externalId.origin)) {
        throw originNotCompliant(authData.externalId.origin);
      }

      const eserviceWithSameName =
        await readModelService.getEServiceByNameAndProducerId({
          name: seed.name,
          producerId: authData.organizationId,
        });
      if (eserviceWithSameName) {
        throw eServiceDuplicate(seed.name);
      }

      const creationDate = new Date();
      const newEService: EService = {
        id: generateId(),
        producerId: authData.organizationId,
        name: seed.name,
        description: seed.description,
        technology: apiTechnologyToTechnology(seed.technology),
        mode: apiEServiceModeToEServiceMode(seed.mode),
        attributes: undefined,
        descriptors: [],
        createdAt: creationDate,
        riskAnalysis: [],
        isSignalHubEnabled: seed.isSignalHubEnabled,
      };

      const eserviceCreationEvent = toCreateEventEServiceAdded(
        newEService,
        correlationId
      );

      if (
        seed.descriptor.dailyCallsPerConsumer > seed.descriptor.dailyCallsTotal
      ) {
        throw inconsistentDailyCalls();
      }

      const draftDescriptor: Descriptor = {
        id: generateId(),
        description: seed.descriptor.description,
        version: "1",
        interface: undefined,
        docs: [],
        state: descriptorState.draft,
        voucherLifespan: seed.descriptor.voucherLifespan,
        audience: seed.descriptor.audience,
        dailyCallsPerConsumer: seed.descriptor.dailyCallsPerConsumer,
        dailyCallsTotal: seed.descriptor.dailyCallsTotal,
        agreementApprovalPolicy:
          apiAgreementApprovalPolicyToAgreementApprovalPolicy(
            seed.descriptor.agreementApprovalPolicy
          ),
        serverUrls: [],
        publishedAt: undefined,
        suspendedAt: undefined,
        deprecatedAt: undefined,
        archivedAt: undefined,
        createdAt: creationDate,
        attributes: { certified: [], declared: [], verified: [] },
      };

      const eserviceWithDescriptor: EService = {
        ...newEService,
        descriptors: [draftDescriptor],
      };

      const descriptorCreationEvent = toCreateEventEServiceDescriptorAdded(
        eserviceWithDescriptor,
        0,
        draftDescriptor.id,
        correlationId
      );

      await repository.createEvents([
        eserviceCreationEvent,
        descriptorCreationEvent,
      ]);

      return eserviceWithDescriptor;
    },

    async updateEService(
      eserviceId: EServiceId,
      eserviceSeed: catalogApi.UpdateEServiceSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(`Updating EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      assertIsDraftEservice(eservice.data);

      if (eserviceSeed.name !== eservice.data.name) {
        const eserviceWithSameName =
          await readModelService.getEServiceByNameAndProducerId({
            name: eserviceSeed.name,
            producerId: eservice.data.producerId,
          });
        if (eserviceWithSameName !== undefined) {
          throw eServiceDuplicate(eserviceSeed.name);
        }
      }

      const updatedTechnology = apiTechnologyToTechnology(
        eserviceSeed.technology
      );
      const interfaceHasToBeDeleted =
        updatedTechnology !== eservice.data.technology;

      if (interfaceHasToBeDeleted) {
        await Promise.all(
          eservice.data.descriptors.map(async (d) => {
            if (d.interface !== undefined) {
              return await fileManager.delete(
                config.s3Bucket,
                d.interface.path,
                logger
              );
            }
          })
        );
      }

      const updatedMode = apiEServiceModeToEServiceMode(eserviceSeed.mode);

      const checkedRiskAnalysis =
        updatedMode === eserviceMode.receive ? eservice.data.riskAnalysis : [];

      const updatedEService: EService = {
        ...eservice.data,
        description: eserviceSeed.description,
        name: eserviceSeed.name,
        technology: updatedTechnology,
        mode: updatedMode,
        riskAnalysis: checkedRiskAnalysis,
        descriptors: interfaceHasToBeDeleted
          ? eservice.data.descriptors.map((d) => ({
              ...d,
              interface: undefined,
              serverUrls: [],
            }))
          : eservice.data.descriptors,
        isSignalHubEnabled: eserviceSeed.isSignalHubEnabled,
      };

      const event = toCreateEventEServiceUpdated(
        eserviceId,
        eservice.metadata.version,
        updatedEService,
        correlationId
      );
      await repository.createEvent(event);

      return updatedEService;
    },

    async deleteEService(
      eserviceId: EServiceId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Deleting EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterIsProducer(eservice.data.producerId, authData);
      assertIsDraftEservice(eservice.data);

      await assertNoExistingProducerDelegationInActiveOrPendingState(
        eserviceId,
        readModelService
      );

      if (eservice.data.descriptors.length === 0) {
        const eserviceDeletionEvent = toCreateEventEServiceDeleted(
          eservice.metadata.version,
          eservice.data,
          correlationId
        );
        await repository.createEvent(eserviceDeletionEvent);
      } else {
        await deleteDescriptorInterfaceAndDocs(
          eservice.data.descriptors[0],
          fileManager,
          logger
        );

        const eserviceWithoutDescriptors: EService = {
          ...eservice.data,
          descriptors: [],
        };
        const descriptorDeletionEvent =
          toCreateEventEServiceDraftDescriptorDeleted(
            eservice.metadata.version,
            eserviceWithoutDescriptors,
            eservice.data.descriptors[0].id,
            correlationId
          );
        const eserviceDeletionEvent = toCreateEventEServiceDeleted(
          eservice.metadata.version + 1,
          eserviceWithoutDescriptors,
          correlationId
        );
        await repository.createEvents([
          descriptorDeletionEvent,
          eserviceDeletionEvent,
        ]);
      }
    },

    async uploadDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      document: catalogApi.CreateEServiceDescriptorDocumentSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(
        `Creating EService Document ${document.documentId.toString()} of kind ${
          document.kind
        }, name ${document.fileName}, path ${
          document.filePath
        } for EService ${eserviceId} and Descriptor ${descriptorId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (
        descriptor.state !== descriptorState.draft &&
        descriptor.state !== descriptorState.deprecated &&
        descriptor.state !== descriptorState.published &&
        descriptor.state !== descriptorState.suspended
      ) {
        throw notValidDescriptorState(descriptor.id, descriptor.state);
      }

      if (document.kind === "INTERFACE" && descriptor.interface !== undefined) {
        throw interfaceAlreadyExists(descriptor.id);
      }

      if (
        document.kind === "DOCUMENT" &&
        descriptor.docs.some(
          (d) =>
            d.prettyName.toLowerCase() === document.prettyName.toLowerCase()
        )
      ) {
        throw prettyNameDuplicate(document.prettyName, descriptor.id);
      }

      const isInterface = document.kind === "INTERFACE";
      const newDocument: Document = {
        id: unsafeBrandId(document.documentId),
        name: document.fileName,
        contentType: document.contentType,
        prettyName: document.prettyName,
        path: document.filePath,
        checksum: document.checksum,
        uploadDate: new Date(),
      };

      const updatedEService: EService = {
        ...eservice.data,
        descriptors: eservice.data.descriptors.map((d: Descriptor) =>
          d.id === descriptorId
            ? {
                ...d,
                interface: isInterface ? newDocument : d.interface,
                docs: isInterface ? d.docs : [...d.docs, newDocument],
                serverUrls: isInterface ? document.serverUrls : d.serverUrls,
              }
            : d
        ),
      };

      const event =
        document.kind === "INTERFACE"
          ? toCreateEventEServiceInterfaceAdded(
              eserviceId,
              eservice.metadata.version,
              {
                descriptorId,
                documentId: unsafeBrandId(document.documentId),
                eservice: updatedEService,
              },
              correlationId
            )
          : toCreateEventEServiceDocumentAdded(
              eservice.metadata.version,
              {
                descriptorId,
                documentId: unsafeBrandId(document.documentId),
                eservice: updatedEService,
              },
              correlationId
            );

      await repository.createEvent(event);

      return updatedEService;
    },

    async deleteDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Deleting Document ${documentId} of Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      const document = retrieveDocument(eserviceId, descriptor, documentId);
      const isInterface = document.id === descriptor?.interface?.id;

      if (isInterface) {
        assertInterfaceDeletableDescriptorState(descriptor);
      } else {
        assertDocumentDeletableDescriptorState(descriptor);
      }

      await fileManager.delete(config.s3Bucket, document.path, logger);

      const newEservice: EService = {
        ...eservice.data,
        descriptors: eservice.data.descriptors.map((d: Descriptor) =>
          d.id === descriptorId
            ? {
                ...d,
                interface:
                  d.interface?.id === documentId ? undefined : d.interface,
                serverUrls: isInterface ? [] : d.serverUrls,
                docs: d.docs.filter((doc) => doc.id !== documentId),
              }
            : d
        ),
      };

      const event = isInterface
        ? toCreateEventEServiceInterfaceDeleted(
            eserviceId,
            eservice.metadata.version,
            {
              descriptorId,
              documentId,
              eservice: newEservice,
            },
            correlationId
          )
        : toCreateEventEServiceDocumentDeleted(
            eserviceId,
            eservice.metadata.version,
            {
              descriptorId,
              documentId,
              eservice: newEservice,
            },
            correlationId
          );

      await repository.createEvent(event);
    },

    // eslint-disable-next-line max-params
    async updateDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      apiEServiceDescriptorDocumentUpdateSeed: catalogApi.UpdateEServiceDescriptorDocumentSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Document> {
      logger.info(
        `Updating Document ${documentId} of Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (
        descriptor.state !== descriptorState.draft &&
        descriptor.state !== descriptorState.deprecated &&
        descriptor.state !== descriptorState.published &&
        descriptor.state !== descriptorState.suspended
      ) {
        throw notValidDescriptorState(descriptor.id, descriptor.state);
      }

      const document = retrieveDocument(eserviceId, descriptor, documentId);

      if (
        descriptor.docs.some(
          (d) =>
            d.id !== documentId &&
            d.prettyName.toLowerCase() ===
              apiEServiceDescriptorDocumentUpdateSeed.prettyName.toLowerCase()
        )
      ) {
        throw prettyNameDuplicate(
          apiEServiceDescriptorDocumentUpdateSeed.prettyName,
          descriptor.id
        );
      }

      const updatedDocument = {
        ...document,
        prettyName: apiEServiceDescriptorDocumentUpdateSeed.prettyName,
      };

      const isInterface = document.id === descriptor?.interface?.id;
      const newEservice: EService = {
        ...eservice.data,
        descriptors: eservice.data.descriptors.map((d: Descriptor) =>
          d.id === descriptorId
            ? {
                ...d,
                interface: isInterface ? updatedDocument : d.interface,
                docs: d.docs.map((doc) =>
                  doc.id === documentId ? updatedDocument : doc
                ),
              }
            : d
        ),
      };

      const event = isInterface
        ? toCreateEventEServiceInterfaceUpdated(
            eserviceId,
            eservice.metadata.version,
            {
              descriptorId,
              documentId,
              eservice: newEservice,
            },
            correlationId
          )
        : toCreateEventEServiceDocumentUpdated(
            eserviceId,
            eservice.metadata.version,
            {
              descriptorId,
              documentId,
              eservice: newEservice,
            },
            correlationId
          );

      await repository.createEvent(event);
      return updatedDocument;
    },

    async createDescriptor(
      eserviceId: EServiceId,
      eserviceDescriptorSeed: catalogApi.EServiceDescriptorSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Descriptor> {
      logger.info(`Creating Descriptor for EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );
      assertHasNoDraftOrWaitingForApprovalDescriptor(eservice.data);

      const newVersion = nextDescriptorVersion(eservice.data);

      const parsedAttributes = await parseAndCheckAttributes(
        eserviceDescriptorSeed.attributes,
        readModelService
      );

      if (
        eserviceDescriptorSeed.dailyCallsPerConsumer >
        eserviceDescriptorSeed.dailyCallsTotal
      ) {
        throw inconsistentDailyCalls();
      }

      const descriptorId = generateId<DescriptorId>();

      const eserviceVersion = eservice.metadata.version;
      const newDescriptor: Descriptor = {
        id: descriptorId,
        description: eserviceDescriptorSeed.description,
        version: newVersion,
        interface: undefined,
        docs: [],
        state: "Draft",
        voucherLifespan: eserviceDescriptorSeed.voucherLifespan,
        audience: eserviceDescriptorSeed.audience,
        dailyCallsPerConsumer: eserviceDescriptorSeed.dailyCallsPerConsumer,
        dailyCallsTotal: eserviceDescriptorSeed.dailyCallsTotal,
        agreementApprovalPolicy:
          apiAgreementApprovalPolicyToAgreementApprovalPolicy(
            eserviceDescriptorSeed.agreementApprovalPolicy
          ),
        serverUrls: [],
        publishedAt: undefined,
        suspendedAt: undefined,
        deprecatedAt: undefined,
        archivedAt: undefined,
        createdAt: new Date(),
        attributes: parsedAttributes,
      };

      const newEservice: EService = {
        ...eservice.data,
        descriptors: [...eservice.data.descriptors, newDescriptor],
      };

      const descriptorCreationEvent = toCreateEventEServiceDescriptorAdded(
        newEservice,
        eserviceVersion,
        descriptorId,
        correlationId
      );

      const { events, descriptorWithDocs } = eserviceDescriptorSeed.docs.reduce(
        (acc, document, index) => {
          const newDocument: Document = {
            id: unsafeBrandId(document.documentId),
            name: document.fileName,
            contentType: document.contentType,
            prettyName: document.prettyName,
            path: document.filePath,
            checksum: document.checksum,
            uploadDate: new Date(),
          };

          const descriptorWithDocs: Descriptor = {
            ...acc.descriptorWithDocs,
            docs: [...acc.descriptorWithDocs.docs, newDocument],
          };
          const updatedEService = replaceDescriptor(
            newEservice,
            descriptorWithDocs
          );
          const version = eserviceVersion + index + 1;
          const documentEvent = toCreateEventEServiceDocumentAdded(
            version,
            {
              descriptorId,
              documentId: unsafeBrandId(document.documentId),
              eservice: updatedEService,
            },
            correlationId
          );
          return {
            events: [...acc.events, documentEvent],
            descriptorWithDocs,
          };
        },
        {
          events: [descriptorCreationEvent],
          descriptorWithDocs: newDescriptor,
        }
      );

      await repository.createEvents(events);
      return descriptorWithDocs;
    },

    async deleteDraftDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Deleting draft Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.state !== descriptorState.draft) {
        throw notValidDescriptorState(descriptorId, descriptor.state);
      }

      await deleteDescriptorInterfaceAndDocs(descriptor, fileManager, logger);

      const eserviceAfterDescriptorDeletion: EService = {
        ...eservice.data,
        descriptors: eservice.data.descriptors.filter(
          (d: Descriptor) => d.id !== descriptorId
        ),
      };

      const descriptorDeletionEvent =
        toCreateEventEServiceDraftDescriptorDeleted(
          eservice.metadata.version,
          eserviceAfterDescriptorDeletion,
          descriptorId,
          correlationId
        );

      if (eserviceAfterDescriptorDeletion.descriptors.length === 0) {
        const eserviceDeletionEvent = toCreateEventEServiceDeleted(
          eservice.metadata.version + 1,
          eserviceAfterDescriptorDeletion,
          correlationId
        );
        await repository.createEvents([
          descriptorDeletionEvent,
          eserviceDeletionEvent,
        ]);
      } else {
        await repository.createEvent(descriptorDeletionEvent);
      }
    },

    async updateDraftDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.UpdateEServiceDescriptorSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(
        `Updating draft Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.state !== descriptorState.draft) {
        throw notValidDescriptorState(
          descriptorId,
          descriptor.state.toString()
        );
      }

      if (seed.dailyCallsPerConsumer > seed.dailyCallsTotal) {
        throw inconsistentDailyCalls();
      }

      const parsedAttributes = await parseAndCheckAttributes(
        seed.attributes,
        readModelService
      );

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
        attributes: parsedAttributes,
      };

      const updatedEService = replaceDescriptor(
        eservice.data,
        updatedDescriptor
      );

      const event = toCreateEventEServiceDraftDescriptorUpdated(
        eserviceId,
        eservice.metadata.version,
        descriptorId,
        updatedEService,
        correlationId
      );
      await repository.createEvent(event);

      return updatedEService;
    },

    async publishDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Publishing Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      const producerDelegation = undefined;
      // const producerDelegation = await retrieveActiveProducerDelegation(
      //   eservice.data,
      //   readModelService
      // );

      // assertRequesterCanPublish(producerDelegation, eservice.data, authData);

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      if (descriptor.state !== descriptorState.draft) {
        throw notValidDescriptorState(
          descriptor.id,
          descriptor.state.toString()
        );
      }

      if (descriptor.interface === undefined) {
        throw eServiceDescriptorWithoutInterface(descriptor.id);
      }

      // TODO removed for the POC
      // if (eservice.data.mode === eserviceMode.receive) {
      //   const tenant = await retrieveTenant(
      //     eservice.data.producerId,
      //     readModelService
      //   );
      //   assertTenantKindExists(tenant);
      //   assertRiskAnalysisIsValidForPublication(eservice.data, tenant.kind);
      // }

      if (descriptor.audience.length === 0) {
        throw audienceCannotBeEmpty(descriptor.id);
      }

      if (producerDelegation) {
        const eserviceWithWaitingForApprovalDescriptor = replaceDescriptor(
          eservice.data,
          updateDescriptorState(descriptor, descriptorState.waitingForApproval)
        );
        await repository.createEvent(
          toCreateEventEServiceDescriptorDelegateSubmitted(
            eservice.metadata.version,
            descriptor.id,
            eserviceWithWaitingForApprovalDescriptor,
            correlationId
          )
        );
      } else {
        const updatedEService = await processDescriptorPublication(
          eservice.data,
          descriptor,
          readModelService,
          logger
        );

        await repository.createEvent(
          toCreateEventEServiceDescriptorPublished(
            eserviceId,
            eservice.metadata.version,
            descriptorId,
            updatedEService,
            correlationId
          )
        );
      }
    },

    async suspendDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Suspending Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      if (
        descriptor.state !== descriptorState.deprecated &&
        descriptor.state !== descriptorState.published
      ) {
        throw notValidDescriptorState(
          descriptorId,
          descriptor.state.toString()
        );
      }

      const updatedDescriptor = updateDescriptorState(
        descriptor,
        descriptorState.suspended
      );

      const newEservice = replaceDescriptor(eservice.data, updatedDescriptor);

      const event = toCreateEventEServiceDescriptorSuspended(
        eserviceId,
        eservice.metadata.version,
        descriptorId,
        newEservice,
        correlationId
      );
      await repository.createEvent(event);
    },

    async activateDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Activating descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      if (descriptor.state !== descriptorState.suspended) {
        throw notValidDescriptorState(
          descriptorId,
          descriptor.state.toString()
        );
      }

      const updatedDescriptor = updateDescriptorState(
        descriptor,
        descriptorState.published
      );
      const descriptorVersions: number[] = eservice.data.descriptors
        .filter(
          (d: Descriptor) =>
            d.state === descriptorState.suspended ||
            d.state === descriptorState.deprecated ||
            d.state === descriptorState.published
        )
        .map((d: Descriptor) => parseInt(d.version, 10));
      const recentDescriptorVersion = Math.max(...descriptorVersions);

      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      const event = () => {
        if (
          recentDescriptorVersion !== null &&
          parseInt(descriptor.version, 10) === recentDescriptorVersion
        ) {
          const newEservice = replaceDescriptor(
            eservice.data,
            updatedDescriptor
          );

          return toCreateEventEServiceDescriptorActivated(
            eserviceId,
            eservice.metadata.version,
            descriptorId,
            newEservice,
            correlationId
          );
        } else {
          const newEservice = replaceDescriptor(
            eservice.data,
            deprecateDescriptor(eserviceId, descriptor, logger)
          );

          return toCreateEventEServiceDescriptorActivated(
            eserviceId,
            eservice.metadata.version,
            descriptorId,
            newEservice,
            correlationId
          );
        }
      };

      await repository.createEvent(event());
    },

    async cloneDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(
        `Cloning Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertRequesterIsProducer(eservice.data.producerId, authData);
      await assertNoExistingProducerDelegationInActiveOrPendingState(
        eservice.data.id,
        readModelService
      );

      const clonedEServiceName = `${
        eservice.data.name
      } - clone - ${formatDateddMMyyyyHHmmss(new Date())}`;

      if (
        await readModelService.getEServiceByNameAndProducerId({
          name: clonedEServiceName,
          producerId: eservice.data.producerId,
        })
      ) {
        throw eServiceDuplicate(clonedEServiceName);
      }

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      const clonedInterfaceId = generateId<EServiceDocumentId>();
      const clonedInterfacePath =
        descriptor.interface !== undefined
          ? await fileManager.copy(
              config.s3Bucket,
              descriptor.interface.path,
              config.eserviceDocumentsPath,
              clonedInterfaceId,
              descriptor.interface.name,
              logger
            )
          : undefined;

      const clonedInterfaceDocument: Document | undefined =
        descriptor.interface !== undefined && clonedInterfacePath !== undefined
          ? {
              id: clonedInterfaceId,
              name: descriptor.interface.name,
              contentType: descriptor.interface.contentType,
              prettyName: descriptor.interface.prettyName,
              path: clonedInterfacePath,
              checksum: descriptor.interface.checksum,
              uploadDate: new Date(),
            }
          : undefined;

      const clonedDocuments = await Promise.all(
        descriptor.docs.map(async (doc: Document) => {
          const clonedDocumentId = generateId<EServiceDocumentId>();
          const clonedDocumentPath = await fileManager.copy(
            config.s3Bucket,
            doc.path,
            config.eserviceDocumentsPath,
            clonedDocumentId,
            doc.name,
            logger
          );
          const clonedDocument: Document = {
            id: clonedDocumentId,
            name: doc.name,
            contentType: doc.contentType,
            prettyName: doc.prettyName,
            path: clonedDocumentPath,
            checksum: doc.checksum,
            uploadDate: new Date(),
          };
          return clonedDocument;
        })
      );

      const clonedEservice: EService = {
        id: generateId(),
        producerId: eservice.data.producerId,
        name: clonedEServiceName,
        description: eservice.data.description,
        technology: eservice.data.technology,
        attributes: eservice.data.attributes,
        createdAt: new Date(),
        riskAnalysis: eservice.data.riskAnalysis,
        mode: eservice.data.mode,
        descriptors: [
          {
            ...descriptor,
            id: generateId(),
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
      const event = toCreateEventClonedEServiceAdded(
        descriptorId,
        eservice.data,
        clonedEservice,
        correlationId
      );
      await repository.createEvent(event);

      return clonedEservice;
    },

    async archiveDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Archiving Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      const updatedDescriptor = updateDescriptorState(
        descriptor,
        descriptorState.archived
      );

      const newEservice = replaceDescriptor(eservice.data, updatedDescriptor);

      const event = toCreateEventEServiceDescriptorArchived(
        eserviceId,
        eservice.metadata.version,
        descriptorId,
        newEservice,
        correlationId
      );

      await repository.createEvent(event);
    },
    async updateDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.UpdateEServiceDescriptorQuotasSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(
        `Updating Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (
        descriptor.state !== descriptorState.published &&
        descriptor.state !== descriptorState.suspended &&
        descriptor.state !== descriptorState.deprecated
      ) {
        throw notValidDescriptorState(
          descriptorId,
          descriptor.state.toString()
        );
      }

      if (seed.dailyCallsPerConsumer > seed.dailyCallsTotal) {
        throw inconsistentDailyCalls();
      }

      const updatedDescriptor: Descriptor = {
        ...descriptor,
        voucherLifespan: seed.voucherLifespan,
        dailyCallsPerConsumer: seed.dailyCallsPerConsumer,
        dailyCallsTotal: seed.dailyCallsTotal,
      };

      const updatedEService = replaceDescriptor(
        eservice.data,
        updatedDescriptor
      );

      const event = toCreateEventEServiceDescriptorQuotasUpdated(
        eserviceId,
        eservice.metadata.version,
        descriptorId,
        updatedEService,
        correlationId
      );
      await repository.createEvent(event);

      return updatedEService;
    },
    async createRiskAnalysis(
      eserviceId: EServiceId,
      eserviceRiskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Creating Risk Analysis for EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );
      assertIsDraftEservice(eservice.data);
      assertIsReceiveEservice(eservice.data);

      // const tenant = await retrieveTenant(
      //   eservice.data.producerId,
      //   readModelService
      // );
      // assertTenantKindExists(tenant);

      const isDuplicateRiskAnalysis = eservice.data.riskAnalysis.some(
        (ra: RiskAnalysis) =>
          ra.name.toLowerCase() === eserviceRiskAnalysisSeed.name.toLowerCase()
      );

      if (isDuplicateRiskAnalysis) {
        throw riskAnalysisDuplicated(
          eserviceRiskAnalysisSeed.name,
          eservice.data.id
        );
      }

      const validatedRiskAnalysisForm = validateRiskAnalysisSchemaOrThrow(
        eserviceRiskAnalysisSeed.riskAnalysisForm,
        tenantKind.PA // changed from tenant.kind (only for the POC TODO remind to test only PA)
      );

      const newRiskAnalysis: RiskAnalysis =
        riskAnalysisValidatedFormToNewRiskAnalysis(
          validatedRiskAnalysisForm,
          eserviceRiskAnalysisSeed.name
        );

      const newEservice: EService = {
        ...eservice.data,
        riskAnalysis: [...eservice.data.riskAnalysis, newRiskAnalysis],
      };

      const event = toCreateEventEServiceRiskAnalysisAdded(
        eservice.data.id,
        eservice.metadata.version,
        newRiskAnalysis.id,
        newEservice,
        correlationId
      );

      await repository.createEvent(event);
    },
    async updateRiskAnalysis(
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysis["id"],
      eserviceRiskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Updating Risk Analysis ${riskAnalysisId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );
      assertIsDraftEservice(eservice.data);
      assertIsReceiveEservice(eservice.data);

      // removed for the POC
      // const tenant = await retrieveTenant(
      //   eservice.data.producerId,
      //   readModelService
      // );
      // assertTenantKindExists(tenant);

      const riskAnalysisToUpdate = retrieveRiskAnalysis(
        riskAnalysisId,
        eservice
      );

      const isDuplicateRiskAnalysis = eservice.data.riskAnalysis.some(
        (ra: RiskAnalysis) =>
          ra.id !== riskAnalysisId &&
          ra.name.toLowerCase() === eserviceRiskAnalysisSeed.name.toLowerCase()
      );

      if (isDuplicateRiskAnalysis) {
        throw riskAnalysisDuplicated(
          eserviceRiskAnalysisSeed.name,
          eservice.data.id
        );
      }

      const validatedRiskAnalysisForm = validateRiskAnalysisSchemaOrThrow(
        eserviceRiskAnalysisSeed.riskAnalysisForm,
        tenantKind.PA
      );

      const updatedRiskAnalysis: RiskAnalysis = {
        ...riskAnalysisToUpdate,
        name: eserviceRiskAnalysisSeed.name,
        riskAnalysisForm: riskAnalysisValidatedFormToNewRiskAnalysisForm(
          validatedRiskAnalysisForm
        ),
      };

      const newEservice = replaceRiskAnalysis(
        eservice.data,
        updatedRiskAnalysis
      );

      const event = toCreateEventEServiceRiskAnalysisUpdated(
        eservice.data.id,
        eservice.metadata.version,
        updatedRiskAnalysis.id,
        newEservice,
        correlationId
      );

      await repository.createEvent(event);
    },
    async deleteRiskAnalysis(
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysisId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Deleting Risk Analysis ${riskAnalysisId} for EService ${eserviceId}`
      );
      const eservice = await retrieveEService(eserviceId, readModelService);

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      assertIsDraftEservice(eservice.data);
      assertIsReceiveEservice(eservice.data);

      retrieveRiskAnalysis(riskAnalysisId, eservice);

      const eserviceWithRiskAnalysisDeleted: EService = {
        ...eservice.data,
        riskAnalysis: eservice.data.riskAnalysis.filter(
          (r) => r.id !== riskAnalysisId
        ),
      };
      const event = toCreateEventEServiceRiskAnalysisDeleted(
        eservice.data.id,
        eservice.metadata.version,
        riskAnalysisId,
        eserviceWithRiskAnalysisDeleted,
        correlationId
      );

      await repository.createEvent(event);
    },
    async updateEServiceDescription(
      eserviceId: EServiceId,
      description: string,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(`Updating EService ${eserviceId} description`);
      const eservice = await retrieveEService(eserviceId, readModelService);

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const hasValidDescriptor = eservice.data.descriptors.some(
        (descriptor) =>
          descriptor.state !== descriptorState.draft &&
          descriptor.state !== descriptorState.waitingForApproval &&
          descriptor.state !== descriptorState.archived
      );
      if (!hasValidDescriptor) {
        throw eserviceWithoutValidDescriptors(eserviceId);
      }

      const updatedEservice: EService = {
        ...eservice.data,
        description,
      };

      await repository.createEvent(
        toCreateEventEServiceDescriptionUpdated(
          eservice.metadata.version,
          updatedEservice,
          correlationId
        )
      );
      return updatedEservice;
    },
    async approveDelegatedEServiceDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Approving EService ${eserviceId} version ${descriptorId}`);
      const eservice = await retrieveEService(eserviceId, readModelService);

      assertRequesterIsProducer(eservice.data.producerId, authData);

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.state !== descriptorState.waitingForApproval) {
        throw notValidDescriptorState(
          descriptor.id,
          descriptor.state.toString()
        );
      }

      const updatedEService = await processDescriptorPublication(
        eservice.data,
        descriptor,
        readModelService,
        logger
      );

      await repository.createEvent(
        toCreateEventEServiceDescriptorDelegatorApproved(
          eservice.metadata.version,
          descriptor.id,
          updatedEService,
          correlationId
        )
      );
    },
    async rejectDelegatedEServiceDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      body: RejectDelegatedEServiceDescriptorSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Rejecting EService ${eserviceId} version ${descriptorId}`);
      const eservice = await retrieveEService(eserviceId, readModelService);

      assertRequesterIsProducer(eservice.data.producerId, authData);

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.state !== descriptorState.waitingForApproval) {
        throw notValidDescriptorState(
          descriptor.id,
          descriptor.state.toString()
        );
      }

      const newRejectionReason: DescriptorRejectionReason = {
        rejectionReason: body.rejectionReason,
        rejectedAt: new Date(),
      };

      const updatedDescriptor = updateDescriptorState(
        {
          ...descriptor,
          rejectionReasons: [
            ...(descriptor.rejectionReasons ?? []),
            newRejectionReason,
          ],
        },
        descriptorState.draft
      );

      const updatedEService = replaceDescriptor(
        eservice.data,
        updatedDescriptor
      );

      await repository.createEvent(
        toCreateEventEServiceDescriptorDelegatorRejected(
          eservice.metadata.version,
          descriptor.id,
          updatedEService,
          correlationId
        )
      );
    },
  };
}

function isRequesterEServiceProducer(
  eservice: EService,
  authData: AuthData
): boolean {
  return (
    hasPermission(
      [userRoles.ADMIN_ROLE, userRoles.API_ROLE, userRoles.SUPPORT_ROLE],
      authData
    ) && authData.organizationId === eservice.producerId
  );
}

async function applyVisibilityToEService(
  eservice: EService,
  authData: AuthData,
  _readModelService: ReadModelService
): Promise<EService> {
  if (isRequesterEServiceProducer(eservice, authData)) {
    return eservice;
  }

  // const producerDelegation = await readModelService.getLatestDelegation({
  //   eserviceId: eservice.id,
  //   delegateId: authData.organizationId,
  //   kind: delegationKind.delegatedProducer,
  // });

  // if (producerDelegation?.state === delegationState.active) {
  //   return eservice;
  // }

  // const hasNoActiveDescriptor = eservice.descriptors.every(
  //   (descriptor) =>
  //     descriptor.state === descriptorState.draft ||
  //     descriptor.state === delegationState.waitingForApproval
  // );

  // if (!producerDelegation && hasNoActiveDescriptor) {
  //   throw eServiceNotFound(eservice.id);
  // }

  return {
    ...eservice,
    descriptors: eservice.descriptors.filter(
      (d) =>
        d.state !== descriptorState.draft &&
        d.state !== descriptorState.waitingForApproval
    ),
  };
}

const deleteDescriptorInterfaceAndDocs = async (
  descriptor: Descriptor,
  fileManager: FileManager,
  logger: Logger
): Promise<void> => {
  const descriptorInterface = descriptor.interface;
  if (descriptorInterface !== undefined) {
    await fileManager.delete(config.s3Bucket, descriptorInterface.path, logger);
  }

  const deleteDescriptorDocs = descriptor.docs.map((doc: Document) =>
    fileManager.delete(config.s3Bucket, doc.path, logger)
  );

  await Promise.all(deleteDescriptorDocs);
};

const processDescriptorPublication = async (
  eservice: EService,
  descriptor: Descriptor,
  _readModelService: ReadModelService,
  logger: Logger
): Promise<EService> => {
  const currentActiveDescriptor = eservice.descriptors.find(
    (d: Descriptor) => d.state === descriptorState.published
  );

  const publishedDescriptor = updateDescriptorState(
    descriptor,
    descriptorState.published
  );

  const eserviceWithPublishedDescriptor = replaceDescriptor(
    eservice,
    publishedDescriptor
  );

  if (!currentActiveDescriptor) {
    return eserviceWithPublishedDescriptor;
  }

  // const currentEServiceAgreements = await readModelService.listAgreements({
  //   eservicesIds: [eservice.id],
  //   consumersIds: [],
  //   producersIds: [],
  //   states: [agreementState.active, agreementState.suspended],
  //   limit: 1,
  //   descriptorId: currentActiveDescriptor.id,
  // });

  const currentEServiceAgreements = [];

  return replaceDescriptor(
    eserviceWithPublishedDescriptor,
    currentEServiceAgreements.length === 0
      ? archiveDescriptor(eservice.id, currentActiveDescriptor, logger)
      : deprecateDescriptor(eservice.id, currentActiveDescriptor, logger)
  );
};

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;
