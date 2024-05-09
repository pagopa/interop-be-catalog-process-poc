import {
  ReadModelRepository,
  EServiceCollection,
  TenantCollection,
  PurposeCollection,
  ReadModelFilter,
} from "pagopa-interop-commons";
import {
  EService,
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
  PurposeVersionState,
} from "pagopa-interop-models";
import { Filter, WithId } from "mongodb";
import { z } from "zod";

export type GetPurposesFilters = {
  name?: string;
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
  filter: Filter<WithId<WithMetadata<Tenant>>>
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { eservices, purposes, tenants } = readModelRepository;

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
      const {
        name,
        eservicesIds,
        consumersIds,
        producersIds,
        states,
        excludeDraft,
      } = filters;

      const nameFilter: ReadModelFilter<Purpose> = name
        ? {
            "data.title": {
              $regex: ReadModelRepository.escapeRegExp(name),
              $options: "i",
            },
          }
        : {};

      const eservicesIdsFilter: ReadModelFilter<Purpose> =
        ReadModelRepository.arrayToFilter(eservicesIds, {
          "data.eserviceId": { $in: eservicesIds },
        });

      const consumersIdsFilter: ReadModelFilter<Purpose> =
        ReadModelRepository.arrayToFilter(consumersIds, {
          "data.consumerId": { $in: consumersIds },
        });

      const versionStateFilter: ReadModelFilter<Purpose> =
        ReadModelRepository.arrayToFilter(states, {
          "data.versions.state": { $in: states },
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

      const eserviceIds =
        producersIds.length > 0
          ? await eservices
              .find({ "data.producerId": { $in: producersIds } })
              .toArray()
              .then((results) =>
                results.map((eservice) => eservice.data.id.toString())
              )
          : [];

      const producerIdsFilter: ReadModelFilter<Purpose> =
        ReadModelRepository.arrayToFilter(eserviceIds, {
          "data.eserviceId": { $in: eserviceIds },
        });

      const aggregationPipeline = [
        {
          $match: {
            ...nameFilter,
            ...eservicesIdsFilter,
            ...consumersIdsFilter,
            ...versionStateFilter,
            ...draftFilter,
            ...producerIdsFilter,
          } satisfies ReadModelFilter<Purpose>,
        },
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
          aggregationPipeline,
          false
        ),
      };
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
