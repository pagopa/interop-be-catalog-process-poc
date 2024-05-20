/* eslint-disable sonarjs/no-identical-functions */
import {
  CreateEvent,
  DB,
  FileManager,
  Logger,
  eventRepository,
  riskAnalysisFormToRiskAnalysisFormToValidate,
} from "pagopa-interop-commons";
import {
  EService,
  EServiceId,
  TenantId,
  WithMetadata,
  Tenant,
  Purpose,
  PurposeId,
  TenantKind,
  Ownership,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionDocumentId,
  PurposeVersionId,
  ownership,
  purposeEventToBinaryData,
  purposeVersionState,
  PurposeRiskAnalysisForm,
  PurposeEvent,
  eserviceMode,
  ListResult,
  unsafeBrandId,
  generateId,
  Agreement,
  PurposeDocumentEServiceInfo,
  RiskAnalysisId,
  RiskAnalysis,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import {
  agreementNotFound,
  eserviceNotFound,
  eserviceRiskAnalysisNotFound,
  notValidVersionState,
  organizationIsNotTheConsumer,
  organizationIsNotTheProducer,
  organizationNotAllowed,
  purposeCannotBeDeleted,
  purposeNotFound,
  purposeVersionCannotBeDeleted,
  purposeVersionDocumentNotFound,
  purposeVersionNotFound,
  purposeVersionStateConflict,
  tenantNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventDraftPurposeDeleted,
  toCreateEventDraftPurposeUpdated,
  toCreateEventNewPurposeVersionActivated,
  toCreateEventNewPurposeVersionWaitingForApproval,
  toCreateEventPurposeAdded,
  toCreateEventPurposeArchived,
  toCreateEventPurposeSuspendedByConsumer,
  toCreateEventPurposeSuspendedByProducer,
  toCreateEventPurposeVersionRejected,
  toCreateEventWaitingForApprovalPurposeDeleted,
  toCreateEventWaitingForApprovalPurposeVersionDeleted,
} from "../model/domain/toEvent.js";
import {
  ApiPurposeUpdateContent,
  ApiReversePurposeUpdateContent,
  ApiPurposeSeed,
  ApiPurposeVersionSeed,
  ApiReversePurposeSeed,
} from "../model/domain/models.js";
import { GetPurposesFilters, ReadModelService } from "./readModelService.js";
import {
  assertOrganizationIsAConsumer,
  assertEserviceMode,
  assertConsistentFreeOfCharge,
  isRiskAnalysisFormValid,
  isDeletableVersion,
  purposeIsDraft,
  assertTenantKindExists,
  reverseValidateAndTransformRiskAnalysis,
  validateAndTransformRiskAnalysis,
  assertPurposeIsDraft,
  isRejectable,
  isDeletable,
  isArchivable,
  isSuspendable,
  assertDailyCallsIsDifferentThanBefore,
  validateRiskAnalysisOrThrow,
  assertPurposeTitleIsNotDuplicated,
  isOverQuota,
} from "./validators.js";
import { pdfGenerator } from "./pdfGenerator.js";

const retrievePurpose = async (
  purposeId: PurposeId,
  readModelService: ReadModelService
): Promise<WithMetadata<Purpose>> => {
  const purpose = await readModelService.getPurposeById(purposeId);
  if (purpose === undefined) {
    throw purposeNotFound(purposeId);
  }
  return purpose;
};

const retrievePurposeVersion = (
  versionId: PurposeVersionId,
  purpose: WithMetadata<Purpose>
): PurposeVersion => {
  const version = purpose.data.versions.find(
    (v: PurposeVersion) => v.id === versionId
  );

  if (version === undefined) {
    throw purposeVersionNotFound(purpose.data.id, versionId);
  }

  return version;
};

const retrievePurposeVersionDocument = (
  purposeId: PurposeId,
  purposeVersion: PurposeVersion,
  documentId: PurposeVersionDocumentId
): PurposeVersionDocument => {
  const document = purposeVersion.riskAnalysis;

  if (document === undefined || document.id !== documentId) {
    throw purposeVersionDocumentNotFound(
      purposeId,
      purposeVersion.id,
      documentId
    );
  }

  return document;
};

const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (eservice === undefined) {
    throw eserviceNotFound(eserviceId);
  }
  return eservice;
};

const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelService
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (tenant === undefined) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

export const retrieveActiveAgreement = async (
  eserviceId: EServiceId,
  consumerId: TenantId,
  readModelService: ReadModelService
): Promise<Agreement> => {
  const activeAgreement = await readModelService.getActiveAgreement(
    eserviceId,
    consumerId
  );
  if (activeAgreement === undefined) {
    throw agreementNotFound(eserviceId, consumerId);
  }
  return activeAgreement;
};

const retrieveRiskAnalysis = (
  riskAnalysisId: RiskAnalysisId,
  eservice: EService
): RiskAnalysis => {
  const riskAnalysis = eservice.riskAnalysis.find(
    (ra: RiskAnalysis) => ra.id === riskAnalysisId
  );

  if (riskAnalysis === undefined) {
    throw eserviceRiskAnalysisNotFound(eservice.id, riskAnalysisId);
  }

  return riskAnalysis;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  fileManager: FileManager
) {
  const repository = eventRepository(dbInstance, purposeEventToBinaryData);

  return {
    async getPurposeById(
      purposeId: PurposeId,
      organizationId: TenantId,
      logger: Logger
    ): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
      logger.info(`Retrieving Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);
      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );
      const tenant = await retrieveTenant(organizationId, readModelService);

      assertTenantKindExists(tenant);

      return authorizeRiskAnalysisForm({
        purpose: purpose.data,
        producerId: eservice.producerId,
        organizationId,
        tenantKind: tenant.kind,
      });
    },
    async getRiskAnalysisDocument({
      purposeId,
      versionId,
      documentId,
      organizationId,
      logger,
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      documentId: PurposeVersionDocumentId;
      organizationId: TenantId;
      logger: Logger;
    }): Promise<PurposeVersionDocument> {
      logger.info(
        `Retrieving Risk Analysis document ${documentId} in version ${versionId} of Purpose ${purposeId}`
      );

      const purpose = await retrievePurpose(purposeId, readModelService);
      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );
      getOrganizationRole({
        organizationId,
        producerId: eservice.producerId,
        consumerId: purpose.data.consumerId,
      });
      const version = retrievePurposeVersion(versionId, purpose);

      return retrievePurposeVersionDocument(purposeId, version, documentId);
    },
    async deletePurposeVersion({
      purposeId,
      versionId,
      organizationId,
      correlationId,
      logger,
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<void> {
      logger.info(`Deleting Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      if (organizationId !== purpose.data.consumerId) {
        throw organizationIsNotTheConsumer(organizationId);
      }

      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (!isDeletableVersion(purposeVersion, purpose.data)) {
        throw purposeVersionCannotBeDeleted(purposeId, versionId);
      }

      const updatedPurpose: Purpose = {
        ...purpose.data,
        versions: purpose.data.versions.filter(
          (v) => v.id !== purposeVersion.id
        ),
        updatedAt: new Date(),
      };

      const event = toCreateEventWaitingForApprovalPurposeVersionDeleted({
        purpose: updatedPurpose,
        version: purpose.metadata.version,
        versionId,
        correlationId,
      });
      await repository.createEvent(event);
    },
    async rejectPurposeVersion({
      purposeId,
      versionId,
      rejectionReason,
      organizationId,
      correlationId,
      logger,
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      rejectionReason: string;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<void> {
      logger.info(`Rejecting Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);
      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );
      if (organizationId !== eservice.producerId) {
        throw organizationIsNotTheProducer(organizationId);
      }

      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (!isRejectable(purposeVersion)) {
        throw notValidVersionState(purposeVersion.id, purposeVersion.state);
      }

      const updatedPurposeVersion: PurposeVersion = {
        ...purposeVersion,
        state: purposeVersionState.rejected,
        rejectionReason,
        updatedAt: new Date(),
      };

      const updatedPurpose = replacePurposeVersion(
        purpose.data,
        updatedPurposeVersion
      );

      const event = toCreateEventPurposeVersionRejected({
        purpose: updatedPurpose,
        version: purpose.metadata.version,
        versionId,
        correlationId,
      });
      await repository.createEvent(event);
    },
    async updatePurpose({
      purposeId,
      purposeUpdateContent,
      organizationId,
      correlationId,
      logger,
    }: {
      purposeId: PurposeId;
      purposeUpdateContent: ApiPurposeUpdateContent;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
      logger.info(`Updating Purpose ${purposeId}`);
      return await performUpdatePurpose(
        purposeId,
        {
          updateContent: purposeUpdateContent,
          mode: eserviceMode.deliver,
        },
        organizationId,
        readModelService,
        correlationId,
        repository
      );
    },
    async updateReversePurpose({
      purposeId,
      reversePurposeUpdateContent,
      organizationId,
      correlationId,
      logger,
    }: {
      purposeId: PurposeId;
      reversePurposeUpdateContent: ApiReversePurposeUpdateContent;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
      logger.info(`Updating Reverse Purpose ${purposeId}`);
      return await performUpdatePurpose(
        purposeId,
        {
          updateContent: reversePurposeUpdateContent,
          mode: eserviceMode.receive,
        },
        organizationId,
        readModelService,
        correlationId,
        repository
      );
    },
    async deletePurpose({
      purposeId,
      organizationId,
      correlationId,
      logger,
    }: {
      purposeId: PurposeId;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<void> {
      logger.info(`Deleting Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      assertOrganizationIsAConsumer(organizationId, purpose.data.consumerId);

      if (!isDeletable(purpose.data)) {
        throw purposeCannotBeDeleted(purpose.data.id);
      }

      const event = purposeIsDraft(purpose.data)
        ? toCreateEventDraftPurposeDeleted({
            purpose: purpose.data,
            version: purpose.metadata.version,
            correlationId,
          })
        : toCreateEventWaitingForApprovalPurposeDeleted({
            purpose: purpose.data,
            version: purpose.metadata.version,
            correlationId,
          });

      await repository.createEvent(event);
    },
    async archivePurposeVersion({
      purposeId,
      versionId,
      organizationId,
      correlationId,
      logger,
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<PurposeVersion> {
      logger.info(`Archiving Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      assertOrganizationIsAConsumer(organizationId, purpose.data.consumerId);
      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (!isArchivable(purposeVersion)) {
        throw notValidVersionState(versionId, purposeVersion.state);
      }

      const purposeWithoutWaitingForApproval: Purpose = {
        ...purpose.data,
        versions: purpose.data.versions.filter(
          (v) => v.state !== purposeVersionState.waitingForApproval
        ),
      };
      const archivedVersion: PurposeVersion = {
        ...purposeVersion,
        state: purposeVersionState.archived,
        updatedAt: new Date(),
      };
      const updatedPurpose = replacePurposeVersion(
        purposeWithoutWaitingForApproval,
        archivedVersion
      );

      const event = toCreateEventPurposeArchived({
        purpose: updatedPurpose,
        purposeVersionId: archivedVersion.id,
        version: purpose.metadata.version,
        correlationId,
      });

      await repository.createEvent(event);
      return archivedVersion;
    },
    async suspendPurposeVersion({
      purposeId,
      versionId,
      organizationId,
      correlationId,
      logger,
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<PurposeVersion> {
      logger.info(`Suspending Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);
      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (!isSuspendable(purposeVersion)) {
        throw notValidVersionState(purposeVersion.id, purposeVersion.state);
      }

      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      const suspender = getOrganizationRole({
        organizationId,
        producerId: eservice.producerId,
        consumerId: purpose.data.consumerId,
      });

      const suspendedPurposeVersion: PurposeVersion = {
        ...purposeVersion,
        state: purposeVersionState.suspended,
        suspendedAt: new Date(),
        updatedAt: new Date(),
      };

      const event = match(suspender)
        .with(ownership.CONSUMER, () => {
          const updatedPurpose: Purpose = {
            ...replacePurposeVersion(purpose.data, suspendedPurposeVersion),
            suspendedByConsumer: true,
          };
          return toCreateEventPurposeSuspendedByConsumer({
            purpose: updatedPurpose,
            purposeVersionId: versionId,
            version: purpose.metadata.version,
            correlationId,
          });
        })
        .with(ownership.PRODUCER, ownership.SELF_CONSUMER, () => {
          const updatedPurpose: Purpose = {
            ...replacePurposeVersion(purpose.data, suspendedPurposeVersion),
            suspendedByProducer: true,
          };
          return toCreateEventPurposeSuspendedByProducer({
            purpose: updatedPurpose,
            purposeVersionId: versionId,
            version: purpose.metadata.version,
            correlationId,
          });
        })
        .exhaustive();

      await repository.createEvent(event);
      return suspendedPurposeVersion;
    },
    async getPurposes(
      organizationId: TenantId,
      filters: GetPurposesFilters,
      { offset, limit }: { offset: number; limit: number },
      logger: Logger
    ): Promise<ListResult<Purpose>> {
      logger.info(
        `Getting Purposes with name = ${filters.title}, eservicesIds = ${filters.eservicesIds}, consumers = ${filters.consumersIds}, producers = ${filters.producersIds}, states = ${filters.states}, excludeDraft = ${filters.excludeDraft}, limit = ${limit}, offset = ${offset}`
      );

      const purposesList = await readModelService.getPurposes(filters, {
        offset,
        limit,
      });

      const mappingPurposeEservice = await Promise.all(
        purposesList.results.map(async (purpose) => {
          const eservice = await retrieveEService(
            purpose.eserviceId,
            readModelService
          );
          if (eservice === undefined) {
            throw eserviceNotFound(purpose.eserviceId);
          }
          return {
            purpose,
            eservice,
          };
        })
      );

      const purposesToReturn = mappingPurposeEservice.map(
        ({ purpose, eservice }) => {
          const isProducerOrConsumer =
            organizationId === purpose.consumerId ||
            organizationId === eservice.producerId;

          return {
            ...purpose,
            riskAnalysisForm: isProducerOrConsumer
              ? purpose.riskAnalysisForm
              : undefined,
          };
        }
      );

      return {
        results: purposesToReturn,
        totalCount: purposesList.totalCount,
      };
    },
    async createPurposeVersion({
      purposeId,
      seed,
      organizationId,
      correlationId,
      logger,
    }: {
      purposeId: PurposeId;
      seed: ApiPurposeVersionSeed;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<PurposeVersion> {
      logger.info(`Creating Version for Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      assertOrganizationIsAConsumer(organizationId, purpose.data.consumerId);
      assertDailyCallsIsDifferentThanBefore(purpose.data, seed.dailyCalls);

      const conflictVersion = purpose.data.versions.find(
        (v) =>
          v.state === purposeVersionState.draft ||
          v.state === purposeVersionState.waitingForApproval
      );

      if (conflictVersion !== undefined) {
        throw purposeVersionStateConflict(
          purposeId,
          conflictVersion.id,
          conflictVersion.state
        );
      }

      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      /**
       * If, with the given daily calls, the purpose goes in over quota,
       * we will create a new version in waiting for approval state
       */
      if (
        await isOverQuota(
          eservice,
          purpose.data,
          seed.dailyCalls,
          readModelService
        )
      ) {
        const newPurposeVersion: PurposeVersion = {
          id: generateId<PurposeVersionId>(),
          createdAt: new Date(),
          state: purposeVersionState.waitingForApproval,
          dailyCalls: seed.dailyCalls,
        };

        const updatedPurpose = {
          ...purpose.data,
          versions: [...purpose.data.versions, newPurposeVersion],
          updatedAt: new Date(),
        };

        await repository.createEvent(
          toCreateEventNewPurposeVersionWaitingForApproval({
            purpose: updatedPurpose,
            versionId: newPurposeVersion.id,
            version: purpose.metadata.version,
            correlationId,
          })
        );

        return newPurposeVersion;
      }

      /**
       * If the purpose is not over quota, we will create a new version directly in active state and
       * also generate the new risk analysis document
       */
      const riskAnalysisDocument = await generateRiskAnalysisDocument({
        eservice,
        purpose: purpose.data,
        dailyCalls: seed.dailyCalls,
        readModelService,
        storeFile: fileManager.storeBytes,
        logger,
      });

      const newPurposeVersion: PurposeVersion = {
        id: generateId(),
        state: purposeVersionState.active,
        riskAnalysis: riskAnalysisDocument,
        dailyCalls: seed.dailyCalls,
        firstActivationAt: new Date(),
        createdAt: new Date(),
      };

      // Archive all versions in active/suspended state
      const oldVersions = purpose.data.versions.map((v) =>
        match(v.state)
          .with(
            purposeVersionState.active,
            purposeVersionState.suspended,
            () => ({ ...v, state: purposeVersionState.archived })
          )
          .otherwise(() => v)
      );

      const updatedPurpose = {
        ...purpose.data,
        versions: [...oldVersions, newPurposeVersion],
        updatedAt: new Date(),
      };

      await repository.createEvent(
        toCreateEventNewPurposeVersionActivated({
          purpose: updatedPurpose,
          versionId: newPurposeVersion.id,
          version: purpose.metadata.version,
          correlationId,
        })
      );

      return newPurposeVersion;
    },

    async createPurpose(
      purposeSeed: ApiPurposeSeed,
      organizationId: TenantId,
      correlationId: string,
      logger: Logger
    ): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
      logger.info(
        `Creating Purpose for EService ${purposeSeed.eserviceId} and Consumer ${purposeSeed.consumerId}`
      );
      const eserviceId = unsafeBrandId<EServiceId>(purposeSeed.eserviceId);
      const consumerId = unsafeBrandId<TenantId>(purposeSeed.consumerId);
      assertOrganizationIsAConsumer(organizationId, consumerId);

      assertConsistentFreeOfCharge(
        purposeSeed.isFreeOfCharge,
        purposeSeed.freeOfChargeReason
      );

      const tenant = await retrieveTenant(organizationId, readModelService);

      assertTenantKindExists(tenant);

      const validatedFormSeed = validateAndTransformRiskAnalysis(
        purposeSeed.riskAnalysisForm,
        false,
        tenant.kind
      );

      await retrieveActiveAgreement(eserviceId, consumerId, readModelService);

      await assertPurposeTitleIsNotDuplicated({
        readModelService,
        eserviceId,
        consumerId,
        title: purposeSeed.title,
      });

      const purpose: Purpose = {
        ...purposeSeed,
        id: generateId(),
        createdAt: new Date(),
        eserviceId,
        consumerId,
        versions: [
          {
            id: generateId(),
            state: purposeVersionState.draft,
            dailyCalls: purposeSeed.dailyCalls,
            createdAt: new Date(),
          },
        ],
        riskAnalysisForm: validatedFormSeed,
      };

      await repository.createEvent(
        toCreateEventPurposeAdded(purpose, correlationId)
      );
      return { purpose, isRiskAnalysisValid: validatedFormSeed !== undefined };
    },
    async createReversePurpose(
      organizationId: TenantId,
      seed: ApiReversePurposeSeed,
      correlationId: string,
      logger: Logger
    ): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
      logger.info(
        `Creating Purpose for EService ${seed.eServiceId}, Consumer ${seed.consumerId}`
      );
      const eserviceId: EServiceId = unsafeBrandId(seed.eServiceId);
      const consumerId: TenantId = unsafeBrandId(seed.consumerId);

      assertOrganizationIsAConsumer(organizationId, consumerId);
      const eservice = await retrieveEService(eserviceId, readModelService);
      assertEserviceMode(eservice, eserviceMode.receive);

      const riskAnalysis = retrieveRiskAnalysis(
        unsafeBrandId(seed.riskAnalysisId),
        eservice
      );

      assertConsistentFreeOfCharge(
        seed.isFreeOfCharge,
        seed.freeOfChargeReason
      );

      const producer = await retrieveTenant(
        eservice.producerId,
        readModelService
      );

      assertTenantKindExists(producer);

      await retrieveActiveAgreement(eserviceId, consumerId, readModelService);

      await assertPurposeTitleIsNotDuplicated({
        readModelService,
        eserviceId,
        consumerId,
        title: seed.title,
      });

      validateRiskAnalysisOrThrow({
        riskAnalysisForm: riskAnalysisFormToRiskAnalysisFormToValidate(
          riskAnalysis.riskAnalysisForm
        ),
        schemaOnlyValidation: false,
        tenantKind: producer.kind,
      });

      const newVersion: PurposeVersion = {
        id: generateId(),
        createdAt: new Date(),
        state: purposeVersionState.draft,
        dailyCalls: seed.dailyCalls,
      };

      const purpose: Purpose = {
        title: seed.title,
        id: generateId(),
        createdAt: new Date(),
        eserviceId,
        consumerId,
        description: seed.description,
        versions: [newVersion],
        isFreeOfCharge: seed.isFreeOfCharge,
        freeOfChargeReason: seed.freeOfChargeReason,
        riskAnalysisForm: riskAnalysis.riskAnalysisForm,
      };

      await repository.createEvent(
        toCreateEventPurposeAdded(purpose, correlationId)
      );
      return {
        purpose,
        isRiskAnalysisValid: true,
      };
    },
  };
}

export type PurposeService = ReturnType<typeof purposeServiceBuilder>;

const authorizeRiskAnalysisForm = ({
  purpose,
  producerId,
  organizationId,
  tenantKind,
}: {
  purpose: Purpose;
  producerId: TenantId;
  organizationId: TenantId;
  tenantKind: TenantKind;
}): { purpose: Purpose; isRiskAnalysisValid: boolean } => {
  if (organizationId === purpose.consumerId || organizationId === producerId) {
    if (purposeIsDraft(purpose)) {
      const isRiskAnalysisValid = isRiskAnalysisFormValid(
        purpose.riskAnalysisForm,
        false,
        tenantKind
      );
      return { purpose, isRiskAnalysisValid };
    } else {
      return { purpose, isRiskAnalysisValid: true };
    }
  } else {
    return {
      purpose: { ...purpose, riskAnalysisForm: undefined },
      isRiskAnalysisValid: false,
    };
  }
};

const getOrganizationRole = ({
  organizationId,
  producerId,
  consumerId,
}: {
  organizationId: TenantId;
  producerId: TenantId;
  consumerId: TenantId;
}): Ownership => {
  if (producerId === consumerId && organizationId === producerId) {
    return ownership.SELF_CONSUMER;
  } else if (producerId !== consumerId && organizationId === consumerId) {
    return ownership.CONSUMER;
  } else if (producerId !== consumerId && organizationId === producerId) {
    return ownership.PRODUCER;
  } else {
    throw organizationNotAllowed(organizationId);
  }
};

const replacePurposeVersion = (
  purpose: Purpose,
  newVersion: PurposeVersion
): Purpose => {
  const updatedVersions = purpose.versions.map((v: PurposeVersion) =>
    v.id === newVersion.id ? newVersion : v
  );

  return {
    ...purpose,
    versions: updatedVersions,
    updatedAt: newVersion.updatedAt,
  };
};

const getInvolvedTenantByEServiceMode = async (
  eservice: EService,
  consumerId: TenantId,
  readModelService: ReadModelService
): Promise<Tenant> => {
  if (eservice.mode === eserviceMode.deliver) {
    return retrieveTenant(consumerId, readModelService);
  } else {
    return retrieveTenant(eservice.producerId, readModelService);
  }
};

const performUpdatePurpose = async (
  purposeId: PurposeId,
  {
    mode,
    updateContent,
  }:
    | { mode: "Deliver"; updateContent: ApiPurposeUpdateContent }
    | { mode: "Receive"; updateContent: ApiReversePurposeUpdateContent },
  organizationId: TenantId,
  readModelService: ReadModelService,
  correlationId: string,
  repository: {
    createEvent: (createEvent: CreateEvent<PurposeEvent>) => Promise<string>;
  }
  // eslint-disable-next-line max-params
): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> => {
  const purpose = await retrievePurpose(purposeId, readModelService);
  assertOrganizationIsAConsumer(organizationId, purpose.data.consumerId);
  assertPurposeIsDraft(purpose.data);

  if (updateContent.title !== purpose.data.title) {
    await assertPurposeTitleIsNotDuplicated({
      readModelService,
      eserviceId: purpose.data.eserviceId,
      consumerId: purpose.data.consumerId,
      title: updateContent.title,
    });
  }
  const eservice = await retrieveEService(
    purpose.data.eserviceId,
    readModelService
  );
  assertEserviceMode(eservice, mode);
  assertConsistentFreeOfCharge(
    updateContent.isFreeOfCharge,
    updateContent.freeOfChargeReason
  );

  const tenant = await getInvolvedTenantByEServiceMode(
    eservice,
    purpose.data.consumerId,
    readModelService
  );

  assertTenantKindExists(tenant);

  const newRiskAnalysis: PurposeRiskAnalysisForm | undefined =
    mode === eserviceMode.deliver
      ? validateAndTransformRiskAnalysis(
          updateContent.riskAnalysisForm,
          true,
          tenant.kind
        )
      : reverseValidateAndTransformRiskAnalysis(
          purpose.data.riskAnalysisForm,
          true,
          tenant.kind
        );

  const updatedPurpose: Purpose = {
    ...purpose.data,
    title: updateContent.title,
    description: updateContent.description,
    isFreeOfCharge: updateContent.isFreeOfCharge,
    freeOfChargeReason: updateContent.freeOfChargeReason,
    versions: [
      {
        ...purpose.data.versions[0],
        dailyCalls: updateContent.dailyCalls,
        updatedAt: new Date(),
      },
    ],
    updatedAt: new Date(),
    riskAnalysisForm: newRiskAnalysis,
  };

  const event = toCreateEventDraftPurposeUpdated({
    purpose: updatedPurpose,
    version: purpose.metadata.version,
    correlationId,
  });
  await repository.createEvent(event);

  return {
    purpose: updatedPurpose,
    isRiskAnalysisValid: isRiskAnalysisFormValid(
      updatedPurpose.riskAnalysisForm,
      false,
      tenant.kind
    ),
  };
};

async function generateRiskAnalysisDocument({
  eservice,
  purpose,
  dailyCalls,
  readModelService,
  storeFile,
  logger,
}: {
  eservice: EService;
  purpose: Purpose;
  dailyCalls: number;
  readModelService: ReadModelService;
  storeFile: FileManager["storeBytes"];
  logger: Logger;
}): Promise<PurposeVersionDocument> {
  const documentId = generateId<PurposeVersionDocumentId>();

  const [producer, consumer] = await Promise.all([
    retrieveTenant(eservice.producerId, readModelService),
    retrieveTenant(purpose.consumerId, readModelService),
  ]);

  const eserviceInfo: PurposeDocumentEServiceInfo = {
    name: eservice.name,
    mode: eservice.mode,
    producerName: producer.name,
    producerOrigin: producer.externalId.origin,
    producerIPACode: producer.externalId.value,
    consumerName: consumer.name,
    consumerOrigin: consumer.externalId.origin,
    consumerIPACode: consumer.externalId.value,
  };

  function getTenantKind(tenant: Tenant): TenantKind {
    assertTenantKindExists(tenant);
    return tenant.kind;
  }

  const tenantKind = match(eservice.mode)
    .with(eserviceMode.deliver, () => getTenantKind(consumer))
    .with(eserviceMode.receive, () => getTenantKind(producer))
    .exhaustive();

  return await pdfGenerator.createRiskAnalysisDocument(
    documentId,
    purpose,
    dailyCalls,
    eserviceInfo,
    tenantKind,
    storeFile,
    logger
  );
}
