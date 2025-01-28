import { Filter, WithId } from "mongodb";
import {
  EServiceCollection,
  ReadModelFilter,
  ReadModelRepository,
} from "pagopa-interop-commons";
import {
  Agreement,
  agreementState,
  Delegation,
  DelegationId,
  delegationKind,
  DelegationKind,
  DelegationReadModel,
  delegationState,
  DelegationState,
  EService,
  EServiceId,
  EServiceReadModel,
  genericInternalError,
  ListResult,
  Tenant,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
import { z } from "zod";
import { delegationApi } from "pagopa-interop-api-clients";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { delegations, eservices, tenants, agreements } = readModelRepository;

  return {
    async getEService(
      eservices: EServiceCollection,
      filter: Filter<WithId<WithMetadata<EServiceReadModel>>>
    ): Promise<WithMetadata<EService> | undefined> {
      const data = await eservices.findOne(filter, {
        projection: { data: true, metadata: true },
      });
      if (!data) {
        return undefined;
      } else {
        const result = z
          .object({
            metadata: z.object({ version: z.number() }),
            data: EService,
          })
          .safeParse(data);
        if (!result.success) {
          throw genericInternalError(
            `Unable to parse eService item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }
        return {
          data: result.data.data,
          metadata: { version: result.data.metadata.version },
        };
      }
    },
    async getDelegation(
      filter: Filter<{ data: DelegationReadModel }>
    ): Promise<WithMetadata<Delegation> | undefined> {
      const data = await delegations.findOne(filter, {
        projection: { data: true, metadata: true },
      });
      if (data) {
        const result = Delegation.safeParse(data.data);
        if (!result.success) {
          throw genericInternalError(
            `Unable to parse delegation item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }
        return data;
      }
      return undefined;
    },
    async getDelegationById(
      id: DelegationId,
      kind: DelegationKind | undefined = undefined
    ): Promise<WithMetadata<Delegation> | undefined> {
      return this.getDelegation({
        "data.id": id,
        ...(kind ? { "data.kind": kind } : {}),
      });
    },
    async findDelegations(filters: {
      eserviceId?: EServiceId;
      delegatorId?: TenantId;
      delegateId?: TenantId;
      delegationKind: DelegationKind;
      states: DelegationState[];
    }): Promise<Delegation[]> {
      const results = await delegations
        .aggregate(
          [
            {
              $match: {
                ...(filters.delegatorId
                  ? { "data.delegatorId": filters.delegatorId }
                  : {}),
                ...(filters.eserviceId
                  ? { "data.eserviceId": filters.eserviceId }
                  : {}),
                ...(filters.delegateId
                  ? { "data.delegateId": filters.delegateId }
                  : {}),
                "data.kind": filters.delegationKind,
                ...ReadModelRepository.arrayToFilter(filters.states, {
                  "data.state": { $in: filters.states },
                }),
              } satisfies ReadModelFilter<Delegation>,
            },
          ],
          {
            allowDiskUse: true,
          }
        )
        .toArray();

      if (!results) {
        return [];
      }

      return results.map((res) => {
        const result = Delegation.safeParse(res.data);
        if (!result.success) {
          throw genericInternalError(
            `Unable to parse delegation item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(res)} `
          );
        }
        return result.data;
      });
    },
    async getEServiceById(
      id: EServiceId
    ): Promise<WithMetadata<EService> | undefined> {
      return this.getEService(eservices, { "data.id": id });
    },
    async getTenantById(tenantId: string): Promise<Tenant | undefined> {
      const data = await tenants.findOne(
        { "data.id": tenantId },
        { projection: { data: true } }
      );

      if (data) {
        const result = Tenant.safeParse(data.data);

        if (!result.success) {
          throw genericInternalError(
            `Unable to parse tenant item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }

        return result.data;
      }
      return undefined;
    },
    async getDelegations({
      delegateIds,
      delegatorIds,
      eserviceIds,
      delegationStates,
      kind,
      offset,
      limit,
    }: {
      delegateIds: TenantId[];
      delegatorIds: TenantId[];
      eserviceIds: EServiceId[];
      delegationStates: DelegationState[];
      kind: DelegationKind | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<Delegation>> {
      const aggregationPipeline = [
        {
          $match: {
            ...ReadModelRepository.arrayToFilter(delegateIds, {
              "data.delegateId": { $in: delegateIds },
            }),
            ...ReadModelRepository.arrayToFilter(delegatorIds, {
              "data.delegatorId": { $in: delegatorIds },
            }),
            ...ReadModelRepository.arrayToFilter(eserviceIds, {
              "data.eserviceId": { $in: eserviceIds },
            }),
            ...ReadModelRepository.arrayToFilter(delegationStates, {
              "data.state": { $in: delegationStates },
            }),
            ...(kind && {
              "data.kind": kind,
            }),
          } satisfies ReadModelFilter<Delegation>,
        },
        {
          $project: {
            data: 1,
          },
        },
      ];

      const aggregationWithOffsetLimit = [
        ...aggregationPipeline,
        { $skip: offset },
        { $limit: limit },
      ];

      const data = await delegations
        .aggregate(aggregationWithOffsetLimit, { allowDiskUse: true })
        .toArray();
      const result = z.array(Delegation).safeParse(data.map((a) => a.data));

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse delegations: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          delegations,
          aggregationPipeline
        ),
      };
    },
    async getConsumerDelegators(filters: {
      requesterId: TenantId;
      delegatorName?: string;
      eserviceIds: EServiceId[];
      limit: number;
      offset: number;
    }): Promise<delegationApi.CompactTenants> {
      const aggregationPipeline = [
        {
          $match: {
            "data.kind": delegationKind.delegatedConsumer,
            "data.state": delegationState.active,
            "data.delegateId": filters.requesterId,
            ...ReadModelRepository.arrayToFilter(filters.eserviceIds, {
              "data.eserviceId": { $in: filters.eserviceIds },
            }),
          } satisfies ReadModelFilter<Delegation>,
        },
        {
          $lookup: {
            from: "tenants",
            localField: "data.delegatorId",
            foreignField: "data.id",
            as: "delegator",
          },
        },
        {
          $unwind: "$delegator",
        },
        ...(filters.delegatorName
          ? [
              {
                $match: {
                  "delegator.data.name": {
                    $regex: ReadModelRepository.escapeRegExp(
                      filters.delegatorName
                    ),
                    $options: "i",
                  },
                },
              },
            ]
          : []),
        {
          $group: {
            _id: "$delegator.data.id",
            name: { $first: "$delegator.data.name" },
          },
        },
        {
          $project: {
            _id: 0,
            id: "$_id",
            name: 1,
          },
        },
        {
          $sort: { name: 1 },
        },
      ];

      const data = await delegations
        .aggregate(
          [
            ...aggregationPipeline,
            { $skip: filters.offset },
            { $limit: filters.limit },
          ],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z.array(delegationApi.CompactTenant).safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse compact delegation tenants: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)}`
        );
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          delegations,
          aggregationPipeline
        ),
      };
    },
    async getConsumerDelegatorsWithAgreements(filters: {
      requesterId: TenantId;
      delegatorName?: string;
      limit: number;
      offset: number;
    }): Promise<delegationApi.CompactTenants> {
      const aggregationPipeline = [
        {
          $match: {
            "data.kind": delegationKind.delegatedConsumer,
            "data.state": delegationState.active,
            "data.delegateId": filters.requesterId,
          } satisfies ReadModelFilter<Delegation>,
        },
        {
          $lookup: {
            from: "eservices",
            localField: "data.eserviceId",
            foreignField: "data.id",
            as: "eservice",
          },
        },
        {
          $unwind: "$eservice",
        },
        {
          $lookup: {
            from: "agreements",
            let: {
              producerId: "$eservice.data.producerId",
              consumerId: "$data.delegatorId",
              eserviceId: "$eservice.data.id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$data.producerId", "$$producerId"] },
                      { $eq: ["$data.consumerId", "$$consumerId"] },
                      { $eq: ["$data.eserviceId", "$$eserviceId"] },
                      { $eq: ["$data.state", agreementState.active] },
                    ],
                  },
                },
              },
            ],
            as: "activeAgreements",
          },
        },
        {
          $match: {
            activeAgreements: { $ne: [] }, // Keep only delegations with active agreements
          },
        },
        {
          $lookup: {
            from: "tenants",
            localField: "data.delegatorId",
            foreignField: "data.id",
            as: "delegator",
          },
        },
        {
          $unwind: "$delegator",
        },
        ...(filters.delegatorName
          ? [
              {
                $match: {
                  "delegator.data.name": {
                    $regex: ReadModelRepository.escapeRegExp(
                      filters.delegatorName
                    ),
                    $options: "i",
                  },
                },
              },
            ]
          : []),
        {
          $group: {
            _id: "$delegator.data.id",
            name: { $first: "$delegator.data.name" },
          },
        },
        {
          $project: {
            _id: 0,
            id: "$_id",
            name: 1,
          },
        },
        {
          $sort: { name: 1 },
        },
      ];

      const data = await delegations
        .aggregate(
          [
            ...aggregationPipeline,
            { $skip: filters.offset },
            { $limit: filters.limit },
          ],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z.array(delegationApi.CompactTenant).safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse compact delegation tenants: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)}`
        );
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          delegations,
          aggregationPipeline
        ),
      };
    },
    async getConsumerEservices(filters: {
      requesterId: TenantId;
      delegatorId: TenantId;
      limit: number;
      offset: number;
      eserviceName?: string;
    }): Promise<delegationApi.CompactEServices> {
      const aggregationPipeline = [
        {
          $match: {
            "data.kind": delegationKind.delegatedConsumer,
            "data.state": delegationState.active,
            "data.delegateId": filters.requesterId,
            "data.delegatorId": filters.delegatorId,
          } satisfies ReadModelFilter<Delegation>,
        },
        {
          $lookup: {
            from: "eservices",
            localField: "data.eserviceId",
            foreignField: "data.id",
            as: "eservice",
          },
        },
        {
          $unwind: "$eservice",
        },
        ...(filters.eserviceName
          ? [
              {
                $match: {
                  "eservice.data.name": {
                    $regex: ReadModelRepository.escapeRegExp(
                      filters.eserviceName
                    ),
                    $options: "i",
                  },
                },
              },
            ]
          : []),
        {
          $lookup: {
            from: "agreements",
            let: {
              producerId: "$eservice.data.producerId",
              consumerId: "$data.delegatorId",
              eserviceId: "$eservice.data.id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$data.producerId", "$$producerId"] },
                      { $eq: ["$data.consumerId", "$$consumerId"] },
                      { $eq: ["$data.eserviceId", "$$eserviceId"] },
                      { $eq: ["$data.state", agreementState.active] },
                    ],
                  },
                },
              },
            ],
            as: "activeAgreements",
          },
        },
        {
          $match: {
            activeAgreements: { $ne: [] }, // Keep only delegations with active agreements
          },
        },
        {
          $group: {
            _id: "$eservice.data.id",
            name: { $first: "$eservice.data.name" },
            producerId: { $first: "$eservice.data.producerId" },
          },
        },
        {
          $project: {
            _id: 0,
            id: "$_id",
            name: 1,
            producerId: 1,
          },
        },
        {
          $sort: { name: 1 },
        },
      ];

      const data = await delegations
        .aggregate(
          [
            ...aggregationPipeline,
            { $skip: filters.offset },
            { $limit: filters.limit },
          ],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z.array(delegationApi.CompactEService).safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse compact delegation eservices: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)}`
        );
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          delegations,
          aggregationPipeline
        ),
      };
    },
    async getDelegationRelatedAgreement(
      eserviceId: EServiceId,
      consumerId: TenantId
    ): Promise<Agreement | null> {
      const data = await agreements.findOne({
        "data.eserviceId": eserviceId,
        "data.consumerId": consumerId,
        "data.state": {
          $in: [
            agreementState.active,
            agreementState.suspended,
            agreementState.pending,
          ],
        },
      });

      if (!data) {
        return null;
      }

      const result = Agreement.safeParse(data.data);
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse agreement: ${JSON.stringify(result)}`
        );
      }

      return result.data;
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
