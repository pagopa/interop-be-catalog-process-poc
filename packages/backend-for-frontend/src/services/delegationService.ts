/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  bffApi,
  catalogApi,
  delegationApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import { DelegationId, delegationKind } from "pagopa-interop-models";
import {
  DelegationsQueryParams,
  toBffDelegationApiCompactDelegation,
  toBffDelegationApiDelegation,
  toDelegationKind,
} from "../api/delegationApiConverter.js";
import {
  CatalogProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { delegationNotFound } from "../model/errors.js";
import { BffAppContext, Headers } from "../utilities/context.js";

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
    eservice: catalogApi.EService,
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

  const eservice: catalogApi.EService = await catalogClient.getEServiceById({
    params: { eServiceId: delegation.eserviceId },
    headers,
  });

  // NOTE: If the delegation kind is DELEGATED_PRODUCER, the producer is the same as the delegator tenant.
  // In the case of DELEGATED_CONSUMER, the producer can be different.
  const producer =
    delegation.kind === toDelegationKind(delegationKind.delegatedProducer)
      ? await getTenantById(
          tenantClient,
          headers,
          eservice.producerId,
          cachedTenants
        )
      : delegator;

  return toApiConverter(delegation, delegator, delegate, eservice, producer);
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
  catalogClient: CatalogProcessClient
) {
  return {
    async getDelegationById(
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
        delegatedIds,
        delegatorIds,
        eserviceIds,
      }: {
        limit: number;
        offset: number;
        states?: bffApi.DelegationState[];
        kind?: bffApi.DelegationKind;
        delegatedIds?: string[];
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
          delegateIds: delegatedIds,
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
    async createDelegation(
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
    async delegatorRevokeDelegation(
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
    async delegateRejectDelegation(
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
    async delegateApproveDelegation(
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
  };
}
