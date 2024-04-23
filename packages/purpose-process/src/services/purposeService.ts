import {
  CreateEvent,
  DB,
  eventRepository,
  logger,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  validateRiskAnalysis,
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
  EServiceMode,
  ListResult,
  unsafeBrandId,
  generateId,
  eserviceMode,
  RiskAnalysisId,
  RiskAnalysis,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  agreementNotFound,
  duplicatedPurposeName,
  eserviceNotFound,
  eserviceRiskAnalysisNotFound,
  notValidVersionState,
  organizationIsNotTheConsumer,
  organizationIsNotTheProducer,
  organizationNotAllowed,
  purposeNotFound,
  purposeVersionCannotBeDeleted,
  purposeVersionDocumentNotFound,
  purposeVersionNotFound,
  riskAnalysisValidationFailed,
  tenantNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventDraftPurposeDeleted,
  toCreateEventDraftPurposeUpdated,
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
  ApiGetPurposesFilters,
  ApiPurposeSeed,
  ApiReversePurposeSeed,
} from "../model/domain/models.js";
import { ReadModelService } from "./readModelService.js";
import {
  assertOrganizationIsAConsumer,
  assertEserviceHasSpecificMode,
  assertConsistentFreeOfCharge,
  isRiskAnalysisFormValid,
  purposeIsDraft,
  assertTenantKindExists,
  reverseValidateAndTransformRiskAnalysis,
  validateAndTransformRiskAnalysis,
  assertPurposeIsDraft,
  assertPurposeIsDeletable,
} from "./validators.js";

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
  readModelService: ReadModelService
) {
  const repository = eventRepository(dbInstance, purposeEventToBinaryData);

  return {
    async getPurposeById(
      purposeId: PurposeId,
      organizationId: TenantId
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
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      documentId: PurposeVersionDocumentId;
      organizationId: TenantId;
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
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<void> {
      logger.info(`Deleting Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      if (organizationId !== purpose.data.consumerId) {
        throw organizationIsNotTheConsumer(organizationId);
      }

      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (
        purposeVersion.state !== purposeVersionState.waitingForApproval ||
        purpose.data.versions.length === 1
      ) {
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
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      rejectionReason: string;
      organizationId: TenantId;
      correlationId: string;
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

      if (purposeVersion.state !== purposeVersionState.waitingForApproval) {
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
    }: {
      purposeId: PurposeId;
      purposeUpdateContent: ApiPurposeUpdateContent;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
      logger.info(`Updating Purpose ${purposeId}`);
      return await updatePurposeInternal(
        purposeId,
        purposeUpdateContent,
        organizationId,
        "Deliver",
        { readModelService, correlationId, repository }
      );
    },
    async updateReversePurpose({
      purposeId,
      reversePurposeUpdateContent,
      organizationId,
      correlationId,
    }: {
      purposeId: PurposeId;
      reversePurposeUpdateContent: ApiReversePurposeUpdateContent;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
      logger.info(`Updating Reverse Purpose ${purposeId}`);
      return await updatePurposeInternal(
        purposeId,
        reversePurposeUpdateContent,
        organizationId,
        "Receive",
        { readModelService, correlationId, repository }
      );
    },
    async deletePurpose({
      purposeId,
      organizationId,
      correlationId,
    }: {
      purposeId: PurposeId;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<void> {
      logger.info(`Deleting Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      assertOrganizationIsAConsumer(organizationId, purpose.data.consumerId);

      assertPurposeIsDeletable(purpose.data);

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
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<PurposeVersion> {
      logger.info(`Archiving Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      assertOrganizationIsAConsumer(organizationId, purpose.data.consumerId);
      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (
        purposeVersion.state !== purposeVersionState.active &&
        purposeVersion.state !== purposeVersionState.suspended
      ) {
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
        state: purposeVersionState.rejected,
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
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<PurposeVersion> {
      logger.info(`Suspending Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      const suspender = getOrganizationRole({
        organizationId,
        producerId: eservice.producerId,
        consumerId: purpose.data.consumerId,
      });

      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (
        purposeVersion.state !== purposeVersionState.active &&
        purposeVersion.state !== purposeVersionState.suspended
      ) {
        throw notValidVersionState(purposeVersion.id, purposeVersion.state);
      }

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
        .with(ownership.PRODUCER, () => {
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
        .with(ownership.SELF_CONSUMER, () => {
          const updatedPurpose: Purpose = {
            ...replacePurposeVersion(purpose.data, suspendedPurposeVersion),
            suspendedByConsumer: true,
            suspendedByProducer: true,
          };
          return toCreateEventPurposeSuspendedByConsumer({
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
      filters: ApiGetPurposesFilters,
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ListResult<Purpose>> {
      logger.info(
        `Getting Purposes with name = ${filters.name}, eservicesIds = ${filters.eservicesIds}, consumers = ${filters.consumersIds}, producers = ${filters.producersIds}, states = ${filters.states}, excludeDraft = ${filters.excludeDraft}, limit = ${limit}, offset = ${offset}`
      );

      const purposesList = await readModelService.getPurposes(
        filters,
        offset,
        limit
      );

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
            versions: filters.excludeDraft
              ? purpose.versions.filter(
                  (version) => version.state !== purposeVersionState.draft
                )
              : purpose.versions,
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
    async createPurpose(
      purposeSeed: ApiPurposeSeed,
      organizationId: TenantId,
      correlationId: string
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
        tenant.kind
      );

      const agreement = await readModelService.getActiveAgreement(
        eserviceId,
        consumerId
      );

      if (agreement === undefined) {
        agreementNotFound(eserviceId, consumerId);
      }

      const purposeWithSameName = await readModelService.getSpecificPurpose(
        eserviceId,
        consumerId,
        purposeSeed.title
      );

      if (purposeWithSameName) {
        throw duplicatedPurposeName(purposeSeed.title);
      }

      const purpose: Purpose = {
        title: purposeSeed.title,
        id: generateId(),
        createdAt: new Date(),
        eserviceId,
        consumerId,
        description: purposeSeed.description,
        versions: [],
        isFreeOfCharge: purposeSeed.isFreeOfCharge,
        freeOfChargeReason: purposeSeed.freeOfChargeReason,
        riskAnalysisForm: validatedFormSeed,
      };

      const event = toCreateEventPurposeAdded(purpose, correlationId);
      await repository.createEvent(event);
      return { purpose, isRiskAnalysisValid: validatedFormSeed !== undefined };
    },
    async createPurposeFromEService(
      organizationId: TenantId,
      seed: ApiReversePurposeSeed,
      correlationId: string
    ): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
      logger.info(
        `Creating Purposes for EService ${seed.eServiceId}, Consumer ${seed.consumerId}`
      );
      const eserviceId: EServiceId = unsafeBrandId(seed.eServiceId);
      const consumerId: TenantId = unsafeBrandId(seed.consumerId);

      assertOrganizationIsAConsumer(organizationId, consumerId);
      const eservice = await retrieveEService(eserviceId, readModelService);
      assertEserviceHasSpecificMode(eservice, eserviceMode.receive);

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

      const agreement = await readModelService.getActiveAgreement(
        eserviceId,
        consumerId
      );

      if (agreement === undefined) {
        throw agreementNotFound(eserviceId, consumerId);
      }

      const purposeWithSameName = await readModelService.getSpecificPurpose(
        eserviceId,
        consumerId,
        seed.title
      );

      if (purposeWithSameName) {
        throw duplicatedPurposeName(seed.title);
      }

      const validationResult = validateRiskAnalysis(
        riskAnalysisFormToRiskAnalysisFormToValidate(
          riskAnalysis.riskAnalysisForm
        ),
        false,
        producer.kind
      );

      if (validationResult.type === "invalid") {
        throw riskAnalysisValidationFailed(validationResult.issues);
      }

      const purpose: Purpose = {
        title: seed.title,
        id: generateId(),
        createdAt: new Date(),
        eserviceId,
        consumerId,
        description: seed.description,
        versions: [],
        isFreeOfCharge: seed.isFreeOfCharge,
        freeOfChargeReason: seed.freeOfChargeReason,
        riskAnalysisForm: riskAnalysis.riskAnalysisForm,
      };

      const event = toCreateEventPurposeAdded(purpose, correlationId);
      await repository.createEvent(event);
      return {
        purpose,
        isRiskAnalysisValid: validationResult.type === "valid",
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
  if (eservice.mode === "Deliver") {
    return retrieveTenant(consumerId, readModelService);
  } else {
    return retrieveTenant(eservice.producerId, readModelService);
  }
};

const updatePurposeInternal = async (
  purposeId: PurposeId,
  updateContent: ApiPurposeUpdateContent | ApiReversePurposeUpdateContent,
  organizationId: TenantId,
  eserviceMode: EServiceMode,
  {
    readModelService,
    correlationId,
    repository,
  }: {
    readModelService: ReadModelService;
    correlationId: string;
    repository: {
      createEvent: (createEvent: CreateEvent<PurposeEvent>) => Promise<string>;
    };
  }
): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> => {
  const purpose = await retrievePurpose(purposeId, readModelService);
  assertOrganizationIsAConsumer(organizationId, purpose.data.consumerId);
  assertPurposeIsDraft(purpose.data);

  const eservice = await retrieveEService(
    purpose.data.eserviceId,
    readModelService
  );
  assertEserviceHasSpecificMode(eservice, eserviceMode);
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
    eserviceMode === "Deliver"
      ? validateAndTransformRiskAnalysis(
          (updateContent as ApiPurposeUpdateContent).riskAnalysisForm,
          tenant.kind
        )
      : reverseValidateAndTransformRiskAnalysis(
          purpose.data.riskAnalysisForm,
          tenant.kind
        );

  const updatedPurpose: Purpose = {
    ...purpose.data,
    ...updateContent,
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
