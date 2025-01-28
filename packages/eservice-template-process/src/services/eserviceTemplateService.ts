/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  AppContext,
  DB,
  FileManager,
  WithLogger,
  eventRepository,
} from "pagopa-interop-commons";
import {
  EServiceTemplate,
  eserviceTemplateEventToBinaryDataV2,
  EServiceTemplateId,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  EServiceTemplateVersionState,
  eserviceTemplateVersionState,
  WithMetadata,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  eServiceTemplateDuplicate,
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  eserviceTemplateWithoutPublishedVersion,
  inconsistentDailyCalls,
  notValidEServiceTemplateVersionState,
} from "../model/domain/errors.js";
import {
  toCreateEventEServiceTemplateAudienceDescriptionUpdated,
  toCreateEventEServiceTemplateEServiceDescriptionUpdated,
  toCreateEventEServiceTemplateVersionActivated,
  toCreateEventEServiceTemplateVersionSuspended,
  toCreateEventEServiceTemplateNameUpdated,
  toCreateEventEServiceTemplateVersionQuotasUpdated,
} from "../model/domain/toEvent.js";
import { ReadModelService } from "./readModelService.js";
import { assertRequesterEServiceTemplateCreator } from "./validators.js";

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
  _fileManager: FileManager
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
          await readModelService.getEServiceTemplateByNameAndProducerId({
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

    async updateEServiceTemplateVersionQuotas(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      seed: eserviceTemplateApi.UpdateEServiceTemplateVersionQuotasSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(
        `Updating e-service template version quotas of EService template ${eserviceTemplateId} version ${eserviceTemplateVersionId}`
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
        eserviceTemplateVersion.state !==
          eserviceTemplateVersionState.published &&
        eserviceTemplateVersion.state !== eserviceTemplateVersionState.suspended
      ) {
        throw notValidEServiceTemplateVersionState(
          eserviceTemplateVersionId,
          eserviceTemplateVersion.state
        );
      }

      const dailyCallsPerConsumer =
        seed.dailyCallsPerConsumer ??
        eserviceTemplateVersion.dailyCallsPerConsumer;

      const dailyCallsTotal =
        seed.dailyCallsTotal ?? eserviceTemplateVersion.dailyCallsTotal;

      if (
        dailyCallsPerConsumer &&
        dailyCallsTotal &&
        dailyCallsPerConsumer > dailyCallsTotal
      ) {
        throw inconsistentDailyCalls();
      }

      const updatedEserviceTemplateVersion: EServiceTemplateVersion = {
        ...eserviceTemplateVersion,
        dailyCallsPerConsumer,
        dailyCallsTotal,
        voucherLifespan: seed.voucherLifespan,
      };

      const updatedEserviceTemplate: EServiceTemplate =
        replaceEServiceTemplateVersion(
          eserviceTemplate.data,
          updatedEserviceTemplateVersion
        );

      await repository.createEvent(
        toCreateEventEServiceTemplateVersionQuotasUpdated(
          eserviceTemplate.data.id,
          eserviceTemplate.metadata.version,
          eserviceTemplateVersionId,
          updatedEserviceTemplate,
          correlationId
        )
      );

      return updatedEserviceTemplate;
    },
  };
}

export type EServiceTemplateService = ReturnType<
  typeof eserviceTemplateServiceBuilder
>;
