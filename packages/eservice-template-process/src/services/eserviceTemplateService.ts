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
  EServiceTemplateVersion,
  eserviceTemplateEventToBinaryDataV2,
  eserviceTemplateVersionState,
  generateId,
} from "pagopa-interop-models";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";
import {
  eServiceTemplateDuplicate,
  inconsistentDailyCalls,
  originNotCompliant,
} from "../model/domain/errors.js";
import {
  apiAgreementApprovalPolicyToAgreementApprovalPolicy,
  apiEServiceModeToEServiceMode,
  apiTechnologyToTechnology,
} from "../model/domain/apiConverter.js";
import { toCreateEventEServiceTemplateAdded } from "../model/domain/toEvent.js";
import { ReadModelService } from "./readModelService.js";

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
  void repository;
  return {
    async createEServiceTemplate(
      seed: eserviceTemplateApi.EServiceTemplateSeed,
      { logger, authData, correlationId }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(`Creating EService template with name ${seed.name}`);

      if (!config.producerAllowedOrigins.includes(authData.externalId.origin)) {
        throw originNotCompliant(authData.externalId.origin);
      }

      const eserviceTemplateWithSameName =
        await readModelService.getEServiceTemplateByNameAndProducerId({
          name: seed.name,
          producerId: authData.organizationId,
        });
      if (eserviceTemplateWithSameName) {
        throw eServiceTemplateDuplicate(seed.name);
      }

      const { dailyCallsPerConsumer, dailyCallsTotal } = seed.version;

      if (
        dailyCallsPerConsumer &&
        dailyCallsTotal &&
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
  };
}

export type EServiceTemplateService = ReturnType<
  typeof eserviceTemplateServiceBuilder
>;
