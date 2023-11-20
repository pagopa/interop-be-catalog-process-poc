import { z } from "zod";
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  agreementState,
  ErrorTypes,
  ListResult,
  Tenant,
} from "pagopa-interop-models";
import { AggregationCursor, Document } from "mongodb";
import { config } from "../utilities/config.js";

const { tenants } = ReadModelRepository.init(config);

/*
function arrayToFilter<T, F extends object>(
  array: T[],
  f: (array: T[]) => F
): F | undefined {
  return array.length > 0 ? f(array) : undefined;
}
*/

async function getTotalCount(
  query: AggregationCursor<Document>
): Promise<number> {
  const data = await query.toArray();
  const result = z.array(z.object({ count: z.number() })).safeParse(data);

  if (result.success) {
    return result.data.length > 0 ? result.data[0].count : 0;
  }

  logger.error(
    `Unable to get total count from aggregation pipeline: result ${JSON.stringify(
      result
    )} - data ${JSON.stringify(data)} `
  );
  throw ErrorTypes.GenericError;
}

function listTenantsFilters(name: string | undefined): object[] {
  const nameFilter = name
    ? {
        "data.name": {
          $regex: name,
          $options: "i",
        },
      }
    : {};

  const withSelfcareIdFilter = {
    "data.selfcareId": {
      $exists: true,
    },
  };
  return [nameFilter, withSelfcareIdFilter];
}

export const getTenants = async ({
  aggregationPipeline,
  offset,
  limit,
}: {
  aggregationPipeline: Document[];
  offset: number;
  limit: number;
}): Promise<{
  results: Tenant[];
  totalCount: number;
}> => {
  const data = await tenants
    .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
    .toArray();

  const result = z.array(Tenant).safeParse(data.map((d) => d.data));

  if (!result.success) {
    logger.error(
      `Unable to parse tenants items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
    throw ErrorTypes.GenericError;
  }
  return {
    results: result.data,
    totalCount: await getTotalCount(
      tenants.aggregate([...aggregationPipeline, { $count: "count" }])
    ),
  };
};

export const readModelService = {
  async getConsumers({
    name,
    producerId,
    offset,
    limit,
  }: {
    name: string | undefined;
    producerId: string;
    offset: number;
    limit: number;
  }): Promise<ListResult<Tenant>> {
    const query = listTenantsFilters(name);

    const aggregationPipeline = [
      { $match: query },
      {
        $lookup: {
          from: "agreements",
          localField: "data.id",
          foreignField: "data.consumerId",
          as: "agreements",
        },
      },
      {
        $match: {
          $and: [
            { "agreements.data.producerId": producerId },
            {
              "agreements.data.state": {
                $in: [agreementState.active, agreementState.suspended],
              },
            },
          ],
        },
      },
      { $project: { data: 1, lowerName: { $toLower: "$data.name" } } },
      { $sort: { lowerName: 1 } },
    ];

    return getTenants({ aggregationPipeline, offset, limit });
  },
  async getProducers({
    name,
    offset,
    limit,
  }: {
    name: string | undefined;
    offset: number;
    limit: number;
  }): Promise<ListResult<Tenant>> {
    const query = listTenantsFilters(name);
    const aggregationPipeline = [
      { $match: query },
      {
        $lookup: {
          from: "eservices",
          localField: "data.id",
          foreignField: "data.producerId",
          as: "eservices",
        },
      },
      { $match: { eservices: { $not: { $size: 0 } } } },
      { $project: { data: 1, lowerName: { $toLower: "$data.name" } } },
      { $sort: { lowerName: 1 } },
    ];

    return getTenants({ aggregationPipeline, offset, limit });
  },
};
