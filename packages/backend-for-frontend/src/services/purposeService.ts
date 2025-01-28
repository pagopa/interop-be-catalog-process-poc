import {
  WithLogger,
  FileManager,
  removeDuplicates,
} from "pagopa-interop-commons";
import {
  EServiceId,
  PurposeId,
  PurposeVersionDocumentId,
  PurposeVersionId,
  RiskAnalysisId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  bffApi,
  catalogApi,
  purposeApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  AgreementProcessClient,
  AuthorizationProcessClient,
  CatalogProcessClient,
  DelegationProcessClient,
  PurposeProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import {
  agreementNotFound,
  eserviceDescriptorNotFound,
  eServiceNotFound,
  purposeDraftVersionNotFound,
  purposeNotFound,
  tenantNotFound,
} from "../model/errors.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import { config } from "../config/config.js";
import { toBffApiCompactClient } from "../api/authorizationApiConverter.js";
import { toBffApiPurposeVersion } from "../api/purposeApiConverter.js";
import { getLatestTenantContactEmail } from "../model/modelMappingUtils.js";
import { getLatestAgreement } from "./agreementService.js";
import { getAllClients } from "./clientService.js";
import { isAgreementUpgradable } from "./validators.js";

const enrichPurposeDelegation = async (
  delegationId: string,
  delegationProcessClient: DelegationProcessClient,
  tenantProcessClient: TenantProcessClient,
  headers: Headers
): Promise<bffApi.DelegationWithCompactTenants> => {
  const delegation = await delegationProcessClient.delegation.getDelegation({
    headers,
    params: {
      delegationId,
    },
  });

  const [delegate, delegator] = await Promise.all(
    [delegation.delegateId, delegation.delegatorId].map((id) =>
      tenantProcessClient.tenant.getTenant({
        headers,
        params: { id },
      })
    )
  );

  if (!delegate) {
    throw tenantNotFound(delegation.delegateId);
  }
  if (!delegator) {
    throw tenantNotFound(delegation.delegatorId);
  }

  return {
    id: delegationId,
    delegate: {
      id: delegate.id,
      name: delegate.name,
      contactMail: getLatestTenantContactEmail(delegate),
      kind: delegate.kind,
    },
    delegator: {
      id: delegator.id,
      name: delegator.name,
      contactMail: getLatestTenantContactEmail(delegator),
      kind: delegator.kind,
    },
  };
};

export const getCurrentVersion = (
  purposeVersions: purposeApi.PurposeVersion[]
): purposeApi.PurposeVersion | undefined => {
  const statesToExclude: purposeApi.PurposeVersionState[] = [
    purposeApi.PurposeVersionState.Values.WAITING_FOR_APPROVAL,
    purposeApi.PurposeVersionState.Values.REJECTED,
  ];
  return purposeVersions
    .filter((v) => !statesToExclude.includes(v.state))
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .at(-1);
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-params
export function purposeServiceBuilder(
  purposeProcessClient: PurposeProcessClient,
  catalogProcessClient: CatalogProcessClient,
  tenantProcessClient: TenantProcessClient,
  agreementProcessClient: AgreementProcessClient,
  delegationProcessClient: DelegationProcessClient,
  authorizationClient: AuthorizationProcessClient,
  fileManager: FileManager
) {
  const enhancePurpose = async (
    requesterId: string,
    purpose: purposeApi.Purpose,
    eservices: catalogApi.EService[],
    producers: tenantApi.Tenant[],
    consumers: tenantApi.Tenant[],
    headers: Headers
    // eslint-disable-next-line max-params
  ): Promise<bffApi.Purpose> => {
    const eservice = eservices.find((e) => e.id === purpose.eserviceId);
    if (!eservice) {
      throw eServiceNotFound(unsafeBrandId(purpose.eserviceId));
    }

    const producer = producers.find((p) => p.id === eservice.producerId);
    if (!producer) {
      throw tenantNotFound(unsafeBrandId(eservice.producerId));
    }

    const consumer = consumers.find((c) => c.id === purpose.consumerId);
    if (!consumer) {
      throw tenantNotFound(unsafeBrandId(purpose.consumerId));
    }

    const latestAgreement = await getLatestAgreement(
      agreementProcessClient,
      purpose.consumerId,
      eservice,
      headers
    );
    if (!latestAgreement) {
      throw agreementNotFound(unsafeBrandId(purpose.consumerId));
    }

    const currentDescriptor = eservice.descriptors.find(
      (d) => d.id === latestAgreement.descriptorId
    );
    if (!currentDescriptor) {
      throw eserviceDescriptorNotFound(
        unsafeBrandId(eservice.id),
        unsafeBrandId(latestAgreement.descriptorId)
      );
    }

    const clients =
      requesterId === purpose.consumerId
        ? (
            await getAllClients(
              authorizationClient,
              purpose.consumerId,
              purpose.id,
              headers
            )
          ).map(toBffApiCompactClient)
        : [];

    const currentVersion = getCurrentVersion(purpose.versions);
    const waitingForApprovalVersion = purpose.versions.find(
      (v) =>
        v.state === purposeApi.PurposeVersionState.Values.WAITING_FOR_APPROVAL
    );
    const latestVersion = [...purpose.versions]
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .at(-1);

    const rejectedVersion =
      latestVersion?.state === purposeApi.PurposeVersionState.Values.REJECTED
        ? latestVersion
        : undefined;

    const delegation = purpose.delegationId
      ? await enrichPurposeDelegation(
          purpose.delegationId,
          delegationProcessClient,
          tenantProcessClient,
          headers
        )
      : undefined;

    return {
      id: purpose.id,
      title: purpose.title,
      description: purpose.description,
      consumer: { id: consumer.id, name: consumer.name },
      riskAnalysisForm: purpose.riskAnalysisForm,
      eservice: {
        id: eservice.id,
        name: eservice.name,
        producer: { id: producer.id, name: producer.name },
        descriptor: {
          id: currentDescriptor.id,
          state: currentDescriptor.state,
          version: currentDescriptor.version,
          audience: currentDescriptor.audience,
        },
        mode: eservice.mode,
      },
      agreement: {
        id: latestAgreement.id,
        state: latestAgreement.state,
        canBeUpgraded: isAgreementUpgradable(eservice, latestAgreement),
      },
      currentVersion: currentVersion && toBffApiPurposeVersion(currentVersion),
      versions: purpose.versions.map(toBffApiPurposeVersion),
      clients,
      waitingForApprovalVersion:
        waitingForApprovalVersion &&
        toBffApiPurposeVersion(waitingForApprovalVersion),
      suspendedByConsumer: purpose.suspendedByConsumer,
      suspendedByProducer: purpose.suspendedByProducer,
      freeOfChargeReason: purpose.freeOfChargeReason,
      isFreeOfCharge: purpose.isFreeOfCharge,
      dailyCallsPerConsumer: currentDescriptor.dailyCallsPerConsumer,
      dailyCallsTotal: currentDescriptor.dailyCallsTotal,
      rejectedVersion:
        rejectedVersion && toBffApiPurposeVersion(rejectedVersion),
      delegation,
    };
  };

  const getPurposes = async (
    requesterId: string,
    filters: {
      name?: string | undefined;
      eservicesIds?: string[];
      consumersIds?: string[];
      producersIds?: string[];
      states?: purposeApi.PurposeVersionState[];
      excludeDraft?: boolean | undefined;
    },
    offset: number,
    limit: number,
    headers: Headers
  ): Promise<bffApi.Purposes> => {
    const distinctFilters = {
      ...filters,
      eseviceIds:
        filters.eservicesIds && removeDuplicates(filters.eservicesIds),
      consumersIds:
        filters.consumersIds && removeDuplicates(filters.consumersIds),
      producersIds:
        filters.producersIds && removeDuplicates(filters.producersIds),
      states: filters.states && removeDuplicates(filters.states),
    };

    const purposes = await purposeProcessClient.getPurposes({
      queries: {
        ...distinctFilters,
        limit,
        offset,
      },
      headers,
    });

    const eservices = await Promise.all(
      removeDuplicates(purposes.results.map((p) => p.eserviceId)).map(
        (eServiceId) =>
          catalogProcessClient.getEServiceById({
            params: {
              eServiceId,
            },
            headers,
          })
      )
    );

    const getTenant = async (id: string): Promise<tenantApi.Tenant> =>
      tenantProcessClient.tenant.getTenant({
        params: {
          id,
        },
        headers,
      });
    const consumers = await Promise.all(
      removeDuplicates(purposes.results.map((p) => p.consumerId)).map(getTenant)
    );
    const producers = await Promise.all(
      removeDuplicates(eservices.map((e) => e.producerId)).map(getTenant)
    );

    const results = await Promise.all(
      purposes.results.map((p) =>
        enhancePurpose(requesterId, p, eservices, producers, consumers, headers)
      )
    );

    return {
      pagination: {
        offset,
        limit,
        totalCount: purposes.totalCount,
      },
      results,
    };
  };

  return {
    async createPurpose(
      createSeed: bffApi.PurposeSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      logger.info(
        `Creating purpose with eService ${createSeed.eserviceId} and consumer ${createSeed.consumerId}`
      );
      const result = await purposeProcessClient.createPurpose(createSeed, {
        headers,
      });
      return { id: result.id };
    },
    async createPurposeForReceiveEservice(
      createSeed: bffApi.PurposeEServiceSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      logger.info(
        `Creating purpose from ESErvice ${createSeed.eserviceId} and Risk Analysis ${createSeed.riskAnalysisId}`
      );
      const payload: purposeApi.EServicePurposeSeed = {
        eServiceId: createSeed.eserviceId,
        consumerId: createSeed.consumerId,
        riskAnalysisId: createSeed.riskAnalysisId,
        title: createSeed.title,
        description: createSeed.description,
        isFreeOfCharge: createSeed.isFreeOfCharge,
        freeOfChargeReason: createSeed.freeOfChargeReason,
        dailyCalls: createSeed.dailyCalls,
      };

      const { id } = await purposeProcessClient.createPurposeFromEService(
        payload,
        {
          headers,
        }
      );
      return { id };
    },
    async reversePurposeUpdate(
      id: PurposeId,
      updateSeed: bffApi.ReversePurposeUpdateContent,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeVersionResource> {
      logger.info(`Updating reverse purpose ${id}`);
      const updatedPurpose = await purposeProcessClient.updateReversePurpose(
        updateSeed,
        {
          headers,
          params: {
            id,
          },
        }
      );

      const versionId = getCurrentVersion(updatedPurpose.versions)?.id;

      if (versionId === undefined) {
        throw purposeNotFound(id);
      }

      return { purposeId: id, versionId: unsafeBrandId(versionId) };
    },
    async getProducerPurposes(
      filters: {
        name?: string | undefined;
        eservicesIds?: string[] | undefined;
        consumersIds?: string[] | undefined;
        states?: purposeApi.PurposeVersionState[] | undefined;
      },
      offset: number,
      limit: number,
      { headers, authData, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.Purposes> {
      logger.info(
        `Retrieving Purposes for name ${filters.name}, EServices ${filters.eservicesIds}, Consumers ${filters.consumersIds} offset ${offset}, limit ${limit}`
      );
      return await getPurposes(
        authData.organizationId,
        {
          ...filters,
          excludeDraft: true,
          producersIds: [authData.organizationId],
        },
        offset,
        limit,
        headers
      );
    },
    async getConsumerPurposes(
      filters: {
        name?: string | undefined;
        eservicesIds?: string[] | undefined;
        producersIds?: string[] | undefined;
        states?: purposeApi.PurposeVersionState[] | undefined;
      },
      offset: number,
      limit: number,
      { headers, authData, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.Purposes> {
      logger.info(
        `Retrieving Purposes for name ${filters.name}, EServices ${filters.eservicesIds}, Producers ${filters.producersIds} offset ${offset}, limit ${limit}`
      );
      return await getPurposes(
        authData.organizationId,
        {
          ...filters,
          excludeDraft: false,
          consumersIds: [authData.organizationId],
        },
        offset,
        limit,
        headers
      );
    },
    async clonePurpose(
      purposeId: PurposeId,
      seed: purposeApi.PurposeCloneSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeVersionResource> {
      logger.info(`Cloning purpose ${purposeId}`);

      const cloned = await purposeProcessClient.clonePurpose(seed, {
        params: {
          purposeId,
        },
        headers,
      });

      const draft = cloned.versions.find(
        (v) => v.state === purposeApi.PurposeVersionState.Values.DRAFT
      );
      if (!draft) {
        throw purposeDraftVersionNotFound(purposeId);
      }

      return {
        purposeId: cloned.id,
        versionId: draft.id,
      };
    },
    async createPurposeVersion(
      purposeId: PurposeId,
      seed: purposeApi.PurposeVersionSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeVersionResource> {
      logger.info(
        `Creating version for purpose ${purposeId} with dailyCalls ${seed.dailyCalls}`
      );

      const purposeVersion = await purposeProcessClient.createPurposeVersion(
        seed,
        {
          params: {
            purposeId,
          },
          headers,
        }
      );

      return {
        purposeId,
        versionId: purposeVersion.id,
      };
    },
    async getRiskAnalysisDocument(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      documentId: PurposeVersionDocumentId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<Uint8Array> {
      logger.info(
        `Downloading risk analysis document ${documentId} from purpose ${purposeId} with version ${versionId}`
      );

      const document = await purposeProcessClient.getRiskAnalysisDocument({
        params: {
          purposeId,
          versionId,
          documentId,
        },
        headers,
      });

      return await fileManager.get(
        config.riskAnalysisDocumentsContainer,
        document.path,
        logger
      );
    },
    async rejectPurposeVersion(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      seed: bffApi.RejectPurposeVersionPayload,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Rejecting version ${versionId} of purpose ${purposeId}`);

      await purposeProcessClient.rejectPurposeVersion(seed, {
        params: {
          purposeId,
          versionId,
        },
        headers,
      });
    },
    async archivePurposeVersion(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeVersionResource> {
      logger.info(`Archiving purpose ${purposeId} with version ${versionId}`);

      const result = await purposeProcessClient.archivePurposeVersion(
        undefined,
        {
          params: {
            purposeId,
            versionId,
          },
          headers,
        }
      );

      return {
        purposeId,
        versionId: result.id,
      };
    },
    async suspendPurposeVersion(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeVersionResource> {
      logger.info(`Suspending Version ${versionId} of Purpose ${purposeId}`);

      const result = await purposeProcessClient.suspendPurposeVersion(
        undefined,
        {
          params: {
            purposeId,
            versionId,
          },
          headers,
        }
      );

      return {
        purposeId,
        versionId: result.id,
      };
    },
    async activatePurposeVersion(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeVersionResource> {
      logger.info(`Activating Version ${versionId} of Purpose ${purposeId}`);

      const result = await purposeProcessClient.activatePurposeVersion(
        undefined,
        {
          params: {
            purposeId,
            versionId,
          },
          headers,
        }
      );

      return {
        purposeId,
        versionId: result.id,
      };
    },
    async deletePurpose(
      purposeId: PurposeId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Deleting purpose ${purposeId}`);

      await purposeProcessClient.deletePurpose(undefined, {
        params: {
          id: purposeId,
        },
        headers,
      });
    },
    async deletePurposeVersion(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Deleting version ${versionId} of purpose ${purposeId}`);

      await purposeProcessClient.deletePurposeVersion(undefined, {
        params: {
          purposeId,
          versionId,
        },
        headers,
      });
    },
    async updatePurpose(
      id: PurposeId,
      seed: bffApi.PurposeUpdateContent,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeVersionResource> {
      logger.info(`Updating Purpose ${id}`);

      const result = await purposeProcessClient.updatePurpose(seed, {
        params: {
          id,
        },
        headers,
      });

      return {
        purposeId: id,
        versionId: result.id,
      };
    },
    async getPurpose(
      id: PurposeId,
      { headers, authData, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.Purpose> {
      logger.info(`Retrieving Purpose ${id}`);

      const purpose = await purposeProcessClient.getPurpose({
        params: {
          id,
        },
        headers,
      });

      const eservice = await catalogProcessClient.getEServiceById({
        params: {
          eServiceId: purpose.eserviceId,
        },
        headers,
      });

      const agreement = await getLatestAgreement(
        agreementProcessClient,
        purpose.consumerId,
        eservice,
        headers
      );

      if (!agreement) {
        throw agreementNotFound(unsafeBrandId(purpose.consumerId));
      }

      const consumer = await tenantProcessClient.tenant.getTenant({
        params: {
          id: agreement.consumerId,
        },
        headers,
      });

      const producer = await tenantProcessClient.tenant.getTenant({
        params: {
          id: agreement.producerId,
        },
        headers,
      });

      return await enhancePurpose(
        authData.organizationId,
        purpose,
        [eservice],
        [producer],
        [consumer],
        headers
      );
    },
    async retrieveLatestRiskAnalysisConfiguration(
      tenantKind: bffApi.TenantKind | undefined,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.RiskAnalysisFormConfig> {
      logger.info(`Retrieving risk analysis latest configuration`);

      return await purposeProcessClient.retrieveLatestRiskAnalysisConfiguration(
        {
          queries: {
            tenantKind,
          },
          headers,
        }
      );
    },
    async retrieveRiskAnalysisConfigurationByVersion(
      eserviceId: EServiceId,
      riskAnalysisVersion: RiskAnalysisId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.RiskAnalysisFormConfig> {
      logger.info(
        `Retrieving risk analysis latest configuration for version ${riskAnalysisVersion}`
      );

      return await purposeProcessClient.retrieveRiskAnalysisConfigurationByVersion(
        {
          params: {
            riskAnalysisVersion,
          },
          queries: {
            eserviceId,
          },
          headers,
        }
      );
    },
  };
}
