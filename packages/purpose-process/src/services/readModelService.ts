import {
  ReadModelRepository,
  EServiceCollection,
  TenantCollection,
  PurposeCollection,
  ReadModelFilter,
  DelegationCollection,
} from "pagopa-interop-commons";
import {
  EService,
  genericError,
  WithMetadata,
  EServiceId,
  TenantId,
  Tenant,
  EServiceReadModel,
  Purpose,
  PurposeId,
  genericInternalError,
  PurposeReadModel,
  ListResult,
  purposeVersionState,
  Agreement,
  agreementState,
  PurposeVersionState,
  TenantReadModel,
  delegationState,
  Delegation,
  delegationKind,
  DelegationReadModel,
  DelegationId,
} from "pagopa-interop-models";
import { Document, Filter, WithId } from "mongodb";
import { z } from "zod";

export type GetPurposesFilters = {
  title?: string;
  eservicesIds: EServiceId[];
  consumersIds: TenantId[];
  producersIds: TenantId[];
  states: PurposeVersionState[];
  excludeDraft: boolean | undefined;
};

async function getPurpose(
  purposes: PurposeCollection,
  filter: Filter<WithId<WithMetadata<PurposeReadModel>>>
): Promise<WithMetadata<Purpose> | undefined> {
  const data = await purposes.findOne(filter, {
    projection: { data: true, metadata: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = z
      .object({
        data: Purpose,
        metadata: z.object({ version: z.number() }),
      })
      .safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse purpose item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
}

async function getEService(
  eservices: EServiceCollection,
  filter: Filter<WithId<WithMetadata<EServiceReadModel>>>
): Promise<EService | undefined> {
  const data = await eservices.findOne(filter, {
    projection: { data: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = EService.safeParse(data.data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse eService item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
}

async function getTenant(
  tenants: TenantCollection,
  filter: Filter<WithId<WithMetadata<TenantReadModel>>>
): Promise<Tenant | undefined> {
  const data = await tenants.findOne(filter, {
    projection: { data: true },
  });
  if (!data) {
    return undefined;
  } else {
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
}

async function getDelegation(
  delegations: DelegationCollection,
  filter: Filter<{ data: DelegationReadModel }>
): Promise<Delegation | undefined> {
  const data = await delegations.findOne(filter, {
    projection: { data: true },
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
    return result.data;
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getProducerDelegatePurposesFilters(producersIds: TenantId[]) {
  return producersIds && producersIds.length > 0
    ? [
        // the lookup on e-services is needed because unlike in agreements,
        // here we don't have the producerId in the purpose and need to get it from the e-service
        {
          $lookup: {
            from: "eservices",
            localField: "data.eserviceId",
            foreignField: "data.id",
            as: "eservices",
          },
        },
        {
          $match: {
            $or: [
              { "eservices.data.producerId": { $in: producersIds } },
              {
                $and: [
                  {
                    "delegations.data.kind": delegationKind.delegatedProducer,
                  },
                  {
                    "delegations.data.state": delegationState.active,
                  },
                  {
                    "delegations.data.delegateId": {
                      $in: producersIds,
                    },
                  },
                ],
              },
            ],
          },
        },
      ]
    : [];
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getConsumerDelegatePurposesFilters(consumersIds: TenantId[]) {
  return consumersIds && consumersIds.length > 0
    ? [
        {
          $match: {
            $or: [
              { "data.consumerId": { $in: consumersIds } },
              {
                $expr: {
                  $anyElementTrue: {
                    $map: {
                      input: "$delegations",
                      as: "del",
                      in: {
                        $and: [
                          {
                            $eq: [
                              "$$del.data.kind",
                              delegationKind.delegatedConsumer,
                            ],
                          },
                          { $eq: ["$$del.data.state", delegationState.active] },
                          {
                            // We must perform this equality to identify the right consumer delegation
                            // but an exact equality between the element
                            // of a lookup and the original data item is possible only inside an $expr,
                            // that's why we used an expression instead of normal filters
                            $eq: ["$$del.data.id", "$data.delegationId"],
                          },
                          {
                            $in: ["$$del.data.delegateId", consumersIds],
                          },
                        ],
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      ]
    : [];
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getDelegationsFilterPipeline(
  filters: Pick<GetPurposesFilters, "consumersIds" | "producersIds">
) {
  return filters.producersIds.length > 0 || filters.consumersIds.length > 0
    ? [
        {
          $lookup: {
            from: "delegations",
            localField: "data.eserviceId",
            foreignField: "data.eserviceId",
            as: "delegations",
          },
        },
        ...getProducerDelegatePurposesFilters(filters.producersIds),
        ...getConsumerDelegatePurposesFilters(filters.consumersIds),
      ]
    : [];
}

async function buildGetPurposesAggregation(
  filters: GetPurposesFilters
): Promise<Document[]> {
  const { title, eservicesIds, states, excludeDraft } = filters;

  const titleFilter: ReadModelFilter<Purpose> = title
    ? {
        "data.title": {
          $regex: ReadModelRepository.escapeRegExp(title),
          $options: "i",
        },
      }
    : {};

  const eservicesIdsFilter = ReadModelRepository.arrayToFilter<Purpose>(
    eservicesIds,
    {
      "data.eserviceId": {
        $in: eservicesIds,
      },
    }
  );

  const notArchivedStates = Object.values(PurposeVersionState.Values).filter(
    (state) => state !== purposeVersionState.archived
  );

  const versionStateFilter: ReadModelFilter<Purpose> =
    ReadModelRepository.arrayToFilter(states, {
      $or: states.map((state) =>
        state === purposeVersionState.archived
          ? {
              $and: [
                { "data.versions.state": { $eq: state } },
                ...notArchivedStates.map((otherState) => ({
                  "data.versions.state": { $ne: otherState },
                })),
              ],
            }
          : { "data.versions.state": { $eq: state } }
      ),
    });

  const draftFilter: ReadModelFilter<Purpose> = excludeDraft
    ? {
        $nor: [
          { "data.versions": { $size: 0 } },
          {
            $and: [
              { "data.versions": { $size: 1 } },
              {
                "data.versions.state": {
                  $eq: purposeVersionState.draft,
                },
              },
            ],
          },
        ],
      }
    : {};

  return [
    {
      $match: {
        ...titleFilter,
        ...eservicesIdsFilter,
        ...versionStateFilter,
        ...draftFilter,
      } satisfies ReadModelFilter<Purpose>,
    },
    ...getDelegationsFilterPipeline(filters),
    {
      $project: {
        data: 1,
        computedColumn: { $toLower: ["$data.title"] },
      },
    },
    {
      $sort: { computedColumn: 1 },
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { eservices, purposes, tenants, agreements, delegations } =
    readModelRepository;

  return {
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return getEService(eservices, { "data.id": id });
    },
    async getTenantById(id: TenantId): Promise<Tenant | undefined> {
      return getTenant(tenants, { "data.id": id });
    },
    async getPurposeById(
      id: PurposeId
    ): Promise<WithMetadata<Purpose> | undefined> {
      return getPurpose(purposes, { "data.id": id });
    },
    async getPurpose(
      eserviceId: EServiceId,
      consumerId: TenantId,
      title: string
    ): Promise<WithMetadata<Purpose> | undefined> {
      return getPurpose(purposes, {
        "data.eserviceId": eserviceId,
        "data.consumerId": consumerId,
        "data.title": {
          $regex: `^${ReadModelRepository.escapeRegExp(title)}$$`,
          $options: "i",
        },
      } satisfies ReadModelFilter<Purpose>);
    },
    async getPurposes(
      filters: GetPurposesFilters,
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ListResult<Purpose>> {
      const aggregationPipeline = await buildGetPurposesAggregation(filters);
      const data = await purposes
        .aggregate(
          [...aggregationPipeline, { $skip: offset }, { $limit: limit }],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z.array(Purpose).safeParse(data.map((d) => d.data));
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse purposes items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          purposes,
          aggregationPipeline
        ),
      };
    },
    async getActiveAgreement(
      eserviceId: EServiceId,
      consumerId: TenantId
    ): Promise<Agreement | undefined> {
      const data = await agreements.findOne({
        "data.eserviceId": eserviceId,
        "data.consumerId": consumerId,
        "data.state": agreementState.active,
      });
      if (!data) {
        return undefined;
      } else {
        const result = Agreement.safeParse(data.data);
        if (!result.success) {
          throw genericError("Unable to parse agreement item");
        }
        return result.data;
      }
    },
    async getAllPurposes(filters: GetPurposesFilters): Promise<Purpose[]> {
      const aggregationPipeline = await buildGetPurposesAggregation(filters);

      const data = await purposes
        .aggregate(aggregationPipeline, { allowDiskUse: true })
        .toArray();

      const result = z.array(Purpose).safeParse(data.map((d) => d.data));
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse purposes items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    },
    async getActiveProducerDelegationByEserviceId(
      eserviceId: EServiceId
    ): Promise<Delegation | undefined> {
      return getDelegation(delegations, {
        "data.eserviceId": eserviceId,
        "data.state": delegationState.active,
        "data.kind": delegationKind.delegatedProducer,
      } satisfies ReadModelFilter<Delegation>);
    },
    async getActiveConsumerDelegationByEserviceAndConsumerIds({
      eserviceId,
      consumerId,
    }: {
      eserviceId: EServiceId;
      consumerId: TenantId;
    }): Promise<Delegation | undefined> {
      return getDelegation(delegations, {
        "data.eserviceId": eserviceId,
        "data.delegatorId": consumerId,
        "data.state": delegationState.active,
        "data.kind": delegationKind.delegatedConsumer,
      } satisfies ReadModelFilter<Delegation>);
    },
    async getActiveConsumerDelegationByDelegationId(
      delegationId: DelegationId
    ): Promise<Delegation | undefined> {
      return getDelegation(delegations, {
        "data.id": delegationId,
        "data.state": delegationState.active,
        "data.kind": delegationKind.delegatedConsumer,
      } satisfies ReadModelFilter<Delegation>);
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
