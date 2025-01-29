/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  bffApi,
  catalogApi,
  delegationApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  FileManager,
  getAllFromPaginated,
  WithLogger,
} from "pagopa-interop-commons";
import { DelegationContractId, DelegationId } from "pagopa-interop-models";
import { isAxiosError } from "axios";
import { match } from "ts-pattern";
import {
  DelegationsQueryParams,
  toBffDelegationApiCompactDelegation,
  toBffDelegationApiDelegation,
} from "../api/delegationApiConverter.js";
import {
  CatalogProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { delegationNotFound } from "../model/errors.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import { config } from "../config/config.js";
import { getLatestTenantContactEmail } from "../model/modelMappingUtils.js";

// eslint-disable-next-line max-params
async function enhanceDelegation<
  T extends bffApi.Delegation | bffApi.CompactDelegation
>(
  tenantClient: TenantProcessClient,
  catalogClient: CatalogProcessClient,
  delegation: delegationApi.Delegation,
  headers: Headers,
  toApiConverter: (
    delegation: delegationApi.Delegation,
    delegator: tenantApi.Tenant,
    delegate: tenantApi.Tenant,
    eservice: catalogApi.EService | undefined,
    producer: tenantApi.Tenant
  ) => T,
  cachedTenants: Map<string, tenantApi.Tenant> = new Map()
): Promise<T> {
  const delegator = await getTenantById(
    tenantClient,
    headers,
    delegation.delegatorId,
    cachedTenants
  );

  const delegate = await getTenantById(
    tenantClient,
    headers,
    delegation.delegateId,
    cachedTenants
  );

  return await match(delegation.kind)
    /**
     * NOTE:
     * If the delegation kind is DELEGATED_PRODUCER, the producer is the same as the delegator tenant.
     * Plus the eservice might not exist anymore, since the delegator can delegate a deletable eservice,
     * then revoke the delegation, and delete the e-service.
     */
    .with(bffApi.DelegationKind.Values.DELEGATED_PRODUCER, async () => {
      const eservice: catalogApi.EService | undefined = await (async () => {
        try {
          return await catalogClient.getEServiceById({
            params: { eServiceId: delegation.eserviceId },
            headers,
          });
        } catch (err) {
          if (isAxiosError(err) && err.response?.status === 404) {
            return undefined;
          }
          throw err;
        }
      })();
      return toApiConverter(
        delegation,
        delegator,
        delegate,
        eservice,
        delegator
      );
    })
    .with(bffApi.DelegationKind.Values.DELEGATED_CONSUMER, async () => {
      const eservice: catalogApi.EService = await catalogClient.getEServiceById(
        {
          params: { eServiceId: delegation.eserviceId },
          headers,
        }
      );

      const producer = await getTenantById(
        tenantClient,
        headers,
        eservice.producerId,
        cachedTenants
      );

      return toApiConverter(
        delegation,
        delegator,
        delegate,
        eservice,
        producer
      );
    })
    .exhaustive();
}

export async function getDelegation(
  delegationClient: DelegationProcessClient,
  headers: BffAppContext["headers"],
  delegationId: DelegationId
): Promise<delegationApi.Delegation> {
  const delegation: delegationApi.Delegation =
    await delegationClient.delegation.getDelegation({
      params: { delegationId },
      headers,
    });

  if (!delegation) {
    throw delegationNotFound(delegationId);
  }
  return delegation;
}

export async function getTenantsFromDelegation(
  tenantClient: TenantProcessClient,
  delegations: delegationApi.Delegation[],
  headers: BffAppContext["headers"]
): Promise<Map<string, tenantApi.Tenant>> {
  const tenantIds = delegations.reduce((acc, delegation) => {
    acc.add(delegation.delegateId);
    acc.add(delegation.delegatorId);
    return acc;
  }, new Set<string>());

  const tenants = await Promise.all(
    Array.from(tenantIds).map((tenantId) =>
      tenantClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      })
    )
  );

  return tenants.reduce((acc, tenant) => {
    acc.set(tenant.id, tenant);
    return acc;
  }, new Map<string, tenantApi.Tenant>());
}

export async function getTenantById(
  tenantClient: TenantProcessClient,
  headers: BffAppContext["headers"],
  tenantId: string,
  tenantMap: Map<string, tenantApi.Tenant> = new Map()
): Promise<tenantApi.Tenant> {
  return (
    tenantMap.get(tenantId) ??
    (await tenantClient.tenant.getTenant({
      params: { id: tenantId },
      headers,
    }))
  );
}

export async function getAllDelegations(
  delegationProcessClient: DelegationProcessClient,
  headers: BffAppContext["headers"],
  queryParams: DelegationsQueryParams
): Promise<delegationApi.Delegation[]> {
  return await getAllFromPaginated<delegationApi.Delegation>(
    async (offset, limit) =>
      await delegationProcessClient.delegation.getDelegations({
        headers,
        queries: {
          ...queryParams,
          offset,
          limit,
        },
      })
  );
}

export function delegationServiceBuilder(
  delegationClients: DelegationProcessClient,
  tenantClient: TenantProcessClient,
  catalogClient: CatalogProcessClient,
  fileManager: FileManager
) {
  return {
    async getDelegation(
      delegationId: DelegationId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.Delegation> {
      logger.info(`Retrieving delegation with id ${delegationId}`);

      const delegation = await getDelegation(
        delegationClients,
        headers,
        delegationId
      );

      return enhanceDelegation<bffApi.Delegation>(
        tenantClient,
        catalogClient,
        delegation,
        headers,
        toBffDelegationApiDelegation
      );
    },
    async getDelegations(
      {
        limit,
        offset,
        states,
        kind,
        delegateIds,
        delegatorIds,
        eserviceIds,
      }: {
        limit: number;
        offset: number;
        states?: bffApi.DelegationState[];
        kind?: bffApi.DelegationKind;
        delegateIds?: string[];
        delegatorIds?: string[];
        eserviceIds?: string[];
      },
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactDelegations> {
      logger.info("Retrieving all delegations");

      const delegations = await delegationClients.delegation.getDelegations({
        queries: {
          limit,
          offset,
          delegatorIds,
          delegateIds,
          delegationStates: states,
          kind,
          eserviceIds,
        },
        headers,
      });

      const involvedTenants = await getTenantsFromDelegation(
        tenantClient,
        delegations.results,
        headers
      );

      const delegationEnanched = await Promise.all(
        delegations.results.map((delegation) =>
          enhanceDelegation<bffApi.CompactDelegation>(
            tenantClient,
            catalogClient,
            delegation,
            headers,
            toBffDelegationApiCompactDelegation,
            involvedTenants
          )
        )
      );

      return {
        results: delegationEnanched,
        pagination: {
          limit,
          offset,
          totalCount: delegations.totalCount,
        },
      };
    },
    async getDelegationContract(
      delegationId: DelegationId,
      contractId: DelegationContractId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<Buffer> {
      logger.info(
        `Retrieving delegation contract ${contractId} from delegation ${delegationId}`
      );

      const contract = await delegationClients.delegation.getDelegationContract(
        {
          params: { delegationId, contractId },
          headers,
        }
      );

      const contractBytes = await fileManager.get(
        config.delegationContractsContainer,
        contract.path,
        logger
      );

      return Buffer.from(contractBytes);
    },

    async createProducerDelegation(
      createDelegationBody: bffApi.DelegationSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      const delegation =
        await delegationClients.producer.createProducerDelegation(
          createDelegationBody,
          { headers }
        );

      return { id: delegation.id };
    },
    async createConsumerDelegation(
      createDelegationBody: bffApi.DelegationSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      const delegation =
        await delegationClients.consumer.createConsumerDelegation(
          createDelegationBody,
          { headers }
        );

      return { id: delegation.id };
    },
    async revokeProducerDelegation(
      delegationId: DelegationId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      return delegationClients.producer.revokeProducerDelegation(undefined, {
        params: {
          delegationId,
        },
        headers,
      });
    },
    async revokeConsumerDelegation(
      delegationId: DelegationId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      return delegationClients.consumer.revokeConsumerDelegation(undefined, {
        params: {
          delegationId,
        },
        headers,
      });
    },
    async rejectProducerDelegation(
      delegationId: DelegationId,
      rejectBody: bffApi.RejectDelegationPayload,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      return delegationClients.producer.rejectProducerDelegation(rejectBody, {
        params: {
          delegationId,
        },
        headers,
      });
    },
    async rejectConsumerDelegation(
      delegationId: DelegationId,
      rejectBody: bffApi.RejectDelegationPayload,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      return delegationClients.consumer.rejectConsumerDelegation(rejectBody, {
        params: {
          delegationId,
        },
        headers,
      });
    },
    async approveProducerDelegation(
      delegationId: DelegationId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      return delegationClients.producer.approveProducerDelegation(undefined, {
        params: {
          delegationId,
        },
        headers,
      });
    },
    async approveConsumerDelegation(
      delegationId: DelegationId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      return delegationClients.consumer.approveConsumerDelegation(undefined, {
        params: {
          delegationId,
        },
        headers,
      });
    },
    async getConsumerDelegators(
      {
        q,
        eserviceIds,
        offset,
        limit,
      }: {
        q?: string;
        eserviceIds: string[];
        offset: number;
        limit: number;
      },
      { headers, authData, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.DelegationTenants> {
      logger.info(
        `Retrieving consumer delegators of requester ${authData.organizationId} with name ${q}, eserviceIds ${eserviceIds}, limit ${limit}, offset ${offset}`
      );

      const delegatorsData =
        await delegationClients.consumer.getConsumerDelegators({
          queries: {
            delegatorName: q,
            eserviceIds,
            offset,
            limit,
          },
          headers,
        });

      return {
        results: delegatorsData.results,
        pagination: {
          offset,
          limit,
          totalCount: delegatorsData.totalCount,
        },
      };
    },
    async getConsumerDelegatorsWithAgreements(
      {
        q,
        offset,
        limit,
      }: {
        q?: string;
        offset: number;
        limit: number;
      },
      { headers, authData, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.DelegationTenants> {
      logger.info(
        `Retrieving consumer delegators with active agreements of requester ${authData.organizationId} with name ${q}, limit ${limit}, offset ${offset}`
      );

      const delegatorsData =
        await delegationClients.consumer.getConsumerDelegatorsWithAgreements({
          queries: {
            delegatorName: q,
            offset,
            limit,
          },
          headers,
        });

      return {
        results: delegatorsData.results,
        pagination: {
          offset,
          limit,
          totalCount: delegatorsData.totalCount,
        },
      };
    },
    async getConsumerDelegatedEservices(
      {
        delegatorId,
        q,
        offset,
        limit,
      }: {
        delegatorId: string;
        q?: string;
        offset: number;
        limit: number;
      },
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactEServices> {
      logger.info(
        `Retrieving consumer delegated eservices of delegator ${delegatorId} with name ${q}, limit ${limit}, offset ${offset}`
      );

      const eservicesData =
        await delegationClients.consumer.getConsumerEservices({
          queries: {
            delegatorId,
            eserviceName: q,
            offset,
            limit,
          },
          headers,
        });

      const eservicesWithProducerData: bffApi.CompactEService[] =
        await Promise.all(
          eservicesData.results.map(async (eservice) => {
            const producer = await tenantClient.tenant.getTenant({
              params: { id: eservice.producerId },
              headers,
            });

            return {
              id: eservice.id,
              name: eservice.name,
              producer: {
                id: eservice.producerId,
                name: producer.name,
                kind: producer.kind,
                contactMail: getLatestTenantContactEmail(producer),
              },
            };
          })
        );

      return {
        results: eservicesWithProducerData,
        pagination: {
          offset,
          limit,
          totalCount: eservicesData.totalCount,
        },
      };
    },
  };
}
