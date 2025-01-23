/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  AppContext,
  DB,
  FileManager,
  WithLogger,
  eventRepository,
} from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  EServiceTemplateVersionId,
  EServiceTemplateVersionState,
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersion,
  WithMetadata,
  eserviceMode,
  eserviceTemplateEventToBinaryDataV2,
  eserviceTemplateVersionState,
  generateId,
} from "pagopa-interop-models";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  toCreateEventEServiceTemplateVersionActivated,
  toCreateEventEServiceTemplateVersionSuspended,
  toCreateEventEServiceTemplateNameUpdated,
} from "../model/domain/toEvent.js";
import {
  eServiceTemplateDuplicate,
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  eserviceTemplateWithoutPublishedVersion,
  notValidEServiceTemplateVersionState,
  inconsistentDailyCalls,
  originNotCompliant,
} from "../model/domain/errors.js";
import { config } from "../config/config.js";
import {
  toCreateEventEServiceTemplateAudienceDescriptionUpdated,
  toCreateEventEServiceTemplateEServiceDescriptionUpdated,
  toCreateEventEServiceTemplateVersionActivated,
  toCreateEventEServiceTemplateVersionSuspended,
  toCreateEventEServiceTemplateNameUpdated,
  apiAgreementApprovalPolicyToAgreementApprovalPolicy,
  apiEServiceModeToEServiceMode,
  apiTechnologyToTechnology,
} from "../model/domain/apiConverter.js";
import {
  toCreateEventEServiceTemplateAdded,
  toCreateEventEServiceTemplateDraftUpdated,
} from "../model/domain/toEvent.js";
import { assertRequesterEServiceTemplateCreator } from "./validators.js";
import { ReadModelService } from "./readModelService.js";
import { assertIsDraftEserviceTemplate } from "./validators.js";

const retrieveEServiceTemplate = async (
  eserviceTemplateId: EServiceTemplateId,
  readModelService: ReadModelService
): Promise<WithMetadata<EServiceTemplate>> => {
  const eserviceTemplate = await readModelService.getEServiceTemplateById(
    eserviceTemplateId
  );
  if (eserviceTemplate === undefined) {
    throw eServiceTemplateNotFound(eserviceTemplateId);
  }
  return eserviceTemplate;
};

const retrieveEServiceTemplateVersion = (
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplate: EServiceTemplate
): EServiceTemplateVersion => {
  const eserviceTemplateVersion = eserviceTemplate.versions.find(
    (v) => v.id === eserviceTemplateVersionId
  );

  if (eserviceTemplateVersion === undefined) {
    throw eServiceTemplateVersionNotFound(
      eserviceTemplate.id,
      eserviceTemplateVersionId
    );
  }

  return eserviceTemplateVersion;
};

const updateEServiceTemplateVersionState = (
  eserviceTemplateVersion: EServiceTemplateVersion,
  newState: EServiceTemplateVersionState
): EServiceTemplateVersion => {
  const eserviceTemplateVersionStateChange = [
    eserviceTemplateVersion.state,
    newState,
  ];

  return match(eserviceTemplateVersionStateChange)
    .with(
      [
        eserviceTemplateVersionState.draft,
        eserviceTemplateVersionState.published,
      ],
      () => ({
        ...eserviceTemplateVersion,
        state: newState,
        publishedAt: new Date(),
      })
    )
    .with(
      [
        eserviceTemplateVersionState.published,
        eserviceTemplateVersionState.suspended,
      ],
      () => ({
        ...eserviceTemplateVersion,
        state: newState,
        suspendedAt: new Date(),
      })
    )
    .with(
      [
        eserviceTemplateVersionState.suspended,
        eserviceTemplateVersionState.published,
      ],
      () => ({
        ...eserviceTemplateVersion,
        state: newState,
        suspendedAt: undefined,
      })
    )
    .with(
      [
        eserviceTemplateVersionState.suspended,
        eserviceTemplateVersionState.deprecated,
      ],
      () => ({
        ...eserviceTemplateVersion,
        state: newState,
        suspendedAt: undefined,
        deprecatedAt: new Date(),
      })
    )
    .with(
      [
        eserviceTemplateVersionState.published,
        eserviceTemplateVersionState.deprecated,
      ],
      () => ({
        ...eserviceTemplateVersion,
        state: newState,
        deprecatedAt: new Date(),
      })
    )
    .otherwise(() => ({
      ...eserviceTemplateVersion,
      state: newState,
    }));
};

const replaceEServiceTemplateVersion = (
  eserviceTemplate: EServiceTemplate,
  newEServiceTemplateVersion: EServiceTemplateVersion
): EServiceTemplate => {
  const updatedEServiceTemplateVersions = eserviceTemplate.versions.map((v) =>
    v.id === newEServiceTemplateVersion.id ? newEServiceTemplateVersion : v
  );

  return {
    ...eserviceTemplate,
    versions: updatedEServiceTemplateVersions,
  };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceTemplateServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  fileManager: FileManager
) {
  const repository = eventRepository(
    dbInstance,
    eserviceTemplateEventToBinaryDataV2
  );
  return {
    async suspendEServiceTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Suspending e-service template version ${eserviceTemplateVersionId} for EService ${eserviceTemplateId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );

      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      const eserviceTemplateVersion = retrieveEServiceTemplateVersion(
        eserviceTemplateVersionId,
        eserviceTemplate.data
      );

      if (
        eserviceTemplateVersion.state !== eserviceTemplateVersionState.published
      ) {
        throw notValidEServiceTemplateVersionState(
          eserviceTemplateVersionId,
          eserviceTemplateVersion.state
        );
      }

      const updatedEServiceTemplateVersion = updateEServiceTemplateVersionState(
        eserviceTemplateVersion,
        eserviceTemplateVersionState.suspended
      );

      const updatedEServiceTemplate = replaceEServiceTemplateVersion(
        eserviceTemplate.data,
        updatedEServiceTemplateVersion
      );

      const event = toCreateEventEServiceTemplateVersionSuspended(
        eserviceTemplateId,
        eserviceTemplate.metadata.version,
        eserviceTemplateVersionId,
        updatedEServiceTemplate,
        correlationId
      );

      await repository.createEvent(event);
    },

    async activateEServiceTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Activating e-service template version ${eserviceTemplateVersionId} for EService ${eserviceTemplateId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );

      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      const eserviceTemplateVersion = retrieveEServiceTemplateVersion(
        eserviceTemplateVersionId,
        eserviceTemplate.data
      );

      if (
        eserviceTemplateVersion.state !== eserviceTemplateVersionState.suspended
      ) {
        throw notValidEServiceTemplateVersionState(
          eserviceTemplateVersionId,
          eserviceTemplateVersion.state
        );
      }

      const updatedEServiceTemplateVersion = updateEServiceTemplateVersionState(
        eserviceTemplateVersion,
        eserviceTemplateVersionState.published
      );

      const updatedEServiceTemplate = replaceEServiceTemplateVersion(
        eserviceTemplate.data,
        updatedEServiceTemplateVersion
      );

      const event = toCreateEventEServiceTemplateVersionActivated(
        eserviceTemplateId,
        eserviceTemplate.metadata.version,
        eserviceTemplateVersionId,
        updatedEServiceTemplate,
        correlationId
      );

      await repository.createEvent(event);
    },

    async updateEServiceTemplateName(
      eserviceTemplateId: EServiceTemplateId,
      name: string,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(`Updating name of EService template ${eserviceTemplateId}`);

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );
      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      if (
        eserviceTemplate.data.versions.every(
          (version) => version.state === eserviceTemplateVersionState.draft
        )
      ) {
        throw eserviceTemplateWithoutPublishedVersion(eserviceTemplateId);
      }

      if (name !== eserviceTemplate.data.name) {
        const eserviceTemplateWithSameName =
          await readModelService.getEServiceTemplateByNameAndCreatorId({
            name,
            creatorId: eserviceTemplate.data.creatorId,
          });
        if (eserviceTemplateWithSameName !== undefined) {
          throw eServiceTemplateDuplicate(name);
        }
      }
      const updatedEserviceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        name,
      };
      await repository.createEvent(
        toCreateEventEServiceTemplateNameUpdated(
          eserviceTemplate.data.id,
          eserviceTemplate.metadata.version,
          updatedEserviceTemplate,
          correlationId
        )
      );
      return updatedEserviceTemplate;
    },
    async updateEServiceTemplateAudienceDescription(
      eserviceTemplateId: EServiceTemplateId,
      audienceDescription: string,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(
        `Updating audience description of EService template ${eserviceTemplateId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );
      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      if (
        eserviceTemplate.data.versions.every(
          (version) => version.state === eserviceTemplateVersionState.draft
        )
      ) {
        throw eserviceTemplateWithoutPublishedVersion(eserviceTemplateId);
      }

      const updatedEserviceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        audienceDescription,
      };
      await repository.createEvent(
        toCreateEventEServiceTemplateAudienceDescriptionUpdated(
          eserviceTemplate.data.id,
          eserviceTemplate.metadata.version,
          updatedEserviceTemplate,
          correlationId
        )
      );
      return updatedEserviceTemplate;
    },

    async updateEServiceTemplateEServiceDescription(
      eserviceTemplateId: EServiceTemplateId,
      eserviceDescription: string,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(
        `Updating e-service description of EService template ${eserviceTemplateId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );
      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      if (
        eserviceTemplate.data.versions.every(
          (version) => version.state === eserviceTemplateVersionState.draft
        )
      ) {
        throw eserviceTemplateWithoutPublishedVersion(eserviceTemplateId);
      }

      const updatedEserviceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        eserviceDescription,
      };
      await repository.createEvent(
        toCreateEventEServiceTemplateEServiceDescriptionUpdated(
          eserviceTemplate.data.id,
          eserviceTemplate.metadata.version,
          updatedEserviceTemplate,
          correlationId
        )
      );
      return updatedEserviceTemplate;
    },

    async createEServiceTemplate(
      seed: eserviceTemplateApi.EServiceTemplateSeed,
      { logger, authData, correlationId }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(`Creating EService template with name ${seed.name}`);

      if (!config.producerAllowedOrigins.includes(authData.externalId.origin)) {
        throw originNotCompliant(authData.externalId.origin);
      }

      const eserviceTemplateWithSameName =
        await readModelService.getEServiceTemplateByNameAndCreatorId({
          name: seed.name,
          creatorId: authData.organizationId,
        });
      if (eserviceTemplateWithSameName) {
        throw eServiceTemplateDuplicate(seed.name);
      }

      const { dailyCallsPerConsumer, dailyCallsTotal } = seed.version;

      if (
        dailyCallsPerConsumer !== undefined &&
        dailyCallsTotal !== undefined &&
        dailyCallsPerConsumer > dailyCallsTotal
      ) {
        throw inconsistentDailyCalls();
      }

      const creationDate = new Date();
      const draftVersion: EServiceTemplateVersion = {
        id: generateId(),
        description: seed.version.description,
        version: "1",
        interface: undefined,
        docs: [],
        state: eserviceTemplateVersionState.draft,
        voucherLifespan: seed.version.voucherLifespan,
        dailyCallsPerConsumer: seed.version.dailyCallsPerConsumer,
        dailyCallsTotal: seed.version.dailyCallsTotal,
        agreementApprovalPolicy:
          apiAgreementApprovalPolicyToAgreementApprovalPolicy(
            seed.version.agreementApprovalPolicy
          ),
        publishedAt: undefined,
        suspendedAt: undefined,
        deprecatedAt: undefined,
        createdAt: creationDate,
        attributes: { certified: [], declared: [], verified: [] },
      };

      const newEServiceTemplate: EServiceTemplate = {
        id: generateId(),
        creatorId: authData.organizationId,
        name: seed.name,
        audienceDescription: seed.audienceDescription,
        eserviceDescription: seed.eserviceDescription,
        technology: apiTechnologyToTechnology(seed.technology),
        versions: [draftVersion],
        mode: apiEServiceModeToEServiceMode(seed.mode),
        createdAt: creationDate,
        riskAnalysis: [],
        isSignalHubEnabled: seed.isSignalHubEnabled,
      };

      const eserviceTemplateCreationEvent = toCreateEventEServiceTemplateAdded(
        newEServiceTemplate,
        correlationId
      );

      await repository.createEvent(eserviceTemplateCreationEvent);

      return newEServiceTemplate;
    },

    async updateEServiceTemplate(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateSeed: eserviceTemplateApi.UpdateEServiceTemplateSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(`Updating EService template ${eserviceTemplateId}`);

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );
      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      assertIsDraftEserviceTemplate(eserviceTemplate.data);

      if (eserviceTemplateSeed.name !== eserviceTemplate.data.name) {
        const eserviceTemplateWithSameName =
          await readModelService.getEServiceTemplateByNameAndCreatorId({
            name: eserviceTemplateSeed.name,
            creatorId: eserviceTemplate.data.creatorId,
          });
        if (eserviceTemplateWithSameName !== undefined) {
          throw eServiceTemplateDuplicate(eserviceTemplateSeed.name);
        }
      }

      const updatedTechnology = apiTechnologyToTechnology(
        eserviceTemplateSeed.technology
      );
      const interfaceHasToBeDeleted =
        updatedTechnology !== eserviceTemplate.data.technology;

      if (interfaceHasToBeDeleted) {
        await Promise.all(
          eserviceTemplate.data.versions.map(async (d) => {
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

      const updatedMode = apiEServiceModeToEServiceMode(
        eserviceTemplateSeed.mode
      );

      const checkedRiskAnalysis =
        updatedMode === eserviceMode.receive
          ? eserviceTemplate.data.riskAnalysis
          : [];

      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        name: eserviceTemplateSeed.name,
        audienceDescription: eserviceTemplateSeed.audienceDescription,
        eserviceDescription: eserviceTemplateSeed.eserviceDescription,
        technology: updatedTechnology,
        mode: updatedMode,
        riskAnalysis: checkedRiskAnalysis,
        versions: interfaceHasToBeDeleted
          ? eserviceTemplate.data.versions.map((d) => ({
              ...d,
              interface: undefined,
            }))
          : eserviceTemplate.data.versions,
        isSignalHubEnabled: eserviceTemplateSeed.isSignalHubEnabled,
      };

      const event = toCreateEventEServiceTemplateDraftUpdated(
        eserviceTemplateId,
        eserviceTemplate.metadata.version,
        updatedEServiceTemplate,
        correlationId
      );
      await repository.createEvent(event);

      return updatedEServiceTemplate;
    },
  };
}

export type EServiceTemplateService = ReturnType<
  typeof eserviceTemplateServiceBuilder
>;
