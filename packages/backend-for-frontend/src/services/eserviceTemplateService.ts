/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { FileManager, WithLogger } from "pagopa-interop-commons";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
} from "pagopa-interop-models";
import { bffApi, eserviceTemplateApi } from "pagopa-interop-api-clients";
import { EServiceTemplateProcessClient } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { config } from "../config/config.js";
import { cloneEServiceDocument } from "../utilities/fileUtils.js";
import { noVersionInEServiceTemplate } from "../model/errors.js";

export function eserviceTemplateServiceBuilder(
  eserviceTemplateClient: EServiceTemplateProcessClient,
  fileManager: FileManager
) {
  return {
    suspendEServiceTemplateVersion: async (
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Suspending version ${eServiceTemplateVersionId} of EService template ${eServiceTemplateId}`
      );
      await eserviceTemplateClient.suspendTemplateVersion(undefined, {
        headers,
        params: {
          eServiceTemplateId,
          eServiceTemplateVersionId,
        },
      });
    },
    activateEServiceTemplateVersion: async (
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Activating version ${eServiceTemplateVersionId} of EService template ${eServiceTemplateId}`
      );
      await eserviceTemplateClient.activateTemplateVersion(undefined, {
        headers,
        params: {
          eServiceTemplateId,
          eServiceTemplateVersionId,
        },
      });
    },
    updateEServiceTemplateName: async (
      eServiceTemplateId: EServiceTemplateId,
      seed: bffApi.EServiceTemplateNameUpdateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Updating EService template ${eServiceTemplateId} name`);
      await eserviceTemplateClient.updateEServiceTemplateName(seed, {
        headers,
        params: {
          eServiceTemplateId,
        },
      });
    },
    updateEServiceTemplateAudienceDescription: async (
      eServiceTemplateId: EServiceTemplateId,
      seed: bffApi.EServiceTemplateDescriptionUpdateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${eServiceTemplateId} audience description`
      );
      await eserviceTemplateClient.updateEServiceTemplateAudienceDescription(
        seed,
        {
          headers,
          params: {
            eServiceTemplateId,
          },
        }
      );
    },
    updateEServiceTemplateEServiceDescription: async (
      eServiceTemplateId: EServiceTemplateId,
      seed: bffApi.EServiceTemplateDescriptionUpdateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${eServiceTemplateId} e-service description`
      );
      await eserviceTemplateClient.updateEServiceTemplateEServiceDescription(
        seed,
        {
          headers,
          params: {
            eServiceTemplateId,
          },
        }
      );
    },
    updateEServiceTemplateVersionQuotas: async (
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      seed: bffApi.EServiceTemplateVersionQuotasUpdateSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${eServiceTemplateId} version ${eServiceTemplateVersionId} quotas`
      );
      await eserviceTemplateClient.updateTemplateVersionQuotas(seed, {
        headers,
        params: {
          eServiceTemplateId,
          eServiceTemplateVersionId,
        },
      });
    },
    updateEServiceTemplateVersionAttributes: async (
      eServiceTemplateId: EServiceTemplateId,
      eServiceTemplateVersionId: EServiceTemplateVersionId,
      seed: bffApi.DescriptorAttributesSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating EService template ${eServiceTemplateId} version ${eServiceTemplateVersionId} attributes`
      );
      await eserviceTemplateClient.updateTemplateVersionAttributes(seed, {
        headers,
        params: {
          eServiceTemplateId,
          eServiceTemplateVersionId,
        },
      });
    },
    createEServiceTemplateVersion: async (
      eServiceTemplateId: EServiceTemplateId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Creating new version for EService template ${eServiceTemplateId}`
      );
      const eServiceTemplate =
        await eserviceTemplateClient.getEServiceTemplateById({
          params: { eServiceTemplateId },
          headers,
        });

      if (eServiceTemplate.versions.length === 0) {
        throw noVersionInEServiceTemplate(eServiceTemplateId);
      }

      const retrieveLatestEServiceTemplateVersion = (
        versions: eserviceTemplateApi.EServiceTemplateVersion[]
      ): eserviceTemplateApi.EServiceTemplateVersion =>
        versions.reduce(
          (latestVersions, curr) =>
            parseInt(curr.version, 10) > parseInt(latestVersions.version, 10)
              ? curr
              : latestVersions,
          versions[0]
        );

      const previousVersion = retrieveLatestEServiceTemplateVersion(
        eServiceTemplate.versions
      );

      const clonedDocumentsCalls = previousVersion.docs.map((doc) =>
        cloneEServiceDocument({
          doc,
          documentsContainer: config.eserviceDocumentsContainer,
          documentsPath: config.eserviceDocumentsPath,
          fileManager,
          logger,
        })
      );

      const clonedDocuments = await Promise.all(clonedDocumentsCalls);

      const { id } = await eserviceTemplateClient.createEServiceTemplateVersion(
        {
          description: previousVersion.description,
          voucherLifespan: previousVersion.voucherLifespan,
          dailyCallsPerConsumer: previousVersion.dailyCallsPerConsumer,
          dailyCallsTotal: previousVersion.dailyCallsTotal,
          agreementApprovalPolicy: previousVersion.agreementApprovalPolicy,
          attributes: previousVersion.attributes,
          docs: clonedDocuments,
        },
        {
          headers,
          params: {
            eServiceTemplateId,
          },
        }
      );

      return { id };
    },
  };
}
