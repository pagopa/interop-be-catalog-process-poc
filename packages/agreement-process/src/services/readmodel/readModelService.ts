/* eslint-disable no-constant-condition */
/* eslint-disable functional/no-let */
import {
  AgreementCollection,
  MongoQueryKeys,
  ReadModelFilter,
  ReadModelRepository,
  RemoveDataPrefix,
  Metadata,
  logger,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementState,
  EService,
  ListResult,
  Tenant,
  WithMetadata,
  agreementState,
  descriptorState,
  genericError,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { z } from "zod";
import { AgreementProcessConfig } from "../../utilities/config.js";

export type AgreementQueryFilters = {
  producerId?: string | string[];
  consumerId?: string | string[];
  eserviceId?: string | string[];
  descriptorId?: string | string[];
  agreementStates?: AgreementState[];
  attributeId?: string | string[];
  showOnlyUpgradeable?: boolean;
};

type AgreementDataFields = RemoveDataPrefix<MongoQueryKeys<Agreement>>;

const makeFilter = (
  fieldName: AgreementDataFields,
  value: string | string[] | undefined
): ReadModelFilter<Agreement> | undefined =>
  match(value)
    .with(P.nullish, () => undefined)
    .with(P.string, () => ({
      [`data.${fieldName}`]: value,
    }))
    .with(P.array(P.string), () => ({ [`data.${fieldName}`]: { $in: value } }))
    .otherwise(() => {
      logger.error(
        `Unable to build filter for field ${fieldName} and value ${value}`
      );
      return undefined;
    });

const getAgreementsFilters = (
  filters: AgreementQueryFilters
): { $match: object } => {
  const upgradeableStates = [
    agreementState.draft,
    agreementState.active,
    agreementState.suspended,
  ];

  const {
    attributeId,
    producerId,
    consumerId,
    eserviceId,
    descriptorId,
    agreementStates,
    showOnlyUpgradeable,
  } = filters;

  const agreementStatesFilters = match(agreementStates)
    .with(P.nullish, () => (showOnlyUpgradeable ? upgradeableStates : []))
    .with(
      P.when(
        (agreementStates) => agreementStates.length === 0 && showOnlyUpgradeable
      ),
      () => upgradeableStates
    )
    .with(
      P.when(
        (agreementStates) => agreementStates.length > 0 && showOnlyUpgradeable
      ),
      (agreementStates) =>
        upgradeableStates.filter(
          (s1) => agreementStates.some((s2) => s1 === s2) !== undefined
        )
    )
    .otherwise((agreementStates) => agreementStates);

  const queryFilters = {
    ...makeFilter("producerId", producerId),
    ...makeFilter("consumerId", consumerId),
    ...makeFilter("eserviceId", eserviceId),
    ...makeFilter("descriptorId", descriptorId),
    ...(agreementStatesFilters &&
      agreementStatesFilters.length > 0 && {
        "data.state": {
          $in: agreementStatesFilters.map((s) => s.toString()),
        },
      }),
    ...(attributeId && {
      $or: [
        { "data.certifiedAttributes": { $elemMatch: { id: attributeId } } },
        { "data.declaredAttributes": { $elemMatch: { id: attributeId } } },
        { "data.verifiedAttributes": { $elemMatch: { id: attributeId } } },
      ],
    }),
  };
  return { $match: queryFilters };
};

export const getAllAgreements = async (
  agreements: AgreementCollection,
  filters: AgreementQueryFilters
): Promise<Array<WithMetadata<Agreement>>> => {
  const limit = 50;
  let offset = 0;
  let results: Array<WithMetadata<Agreement>> = [];

  while (true) {
    const agreementsChunk: Array<WithMetadata<Agreement>> = await getAgreements(
      agreements,
      filters,
      offset,
      limit
    );

    results = results.concat(agreementsChunk);

    if (agreementsChunk.length < limit) {
      break;
    }

    offset += limit;
  }

  return results;
};

const getAgreements = async (
  agreements: AgreementCollection,
  filters: AgreementQueryFilters,
  offset: number,
  limit: number
): Promise<Array<WithMetadata<Agreement>>> => {
  const data = await agreements
    .aggregate([
      getAgreementsFilters(filters),
      { $skip: offset },
      { $limit: limit },
    ])
    .toArray();

  const result = z
    .array(
      z.object({
        data: Agreement,
        metadata: Metadata,
      })
    )
    .safeParse(data);

  if (!result.success) {
    logger.error(
      `Unable to parse agreements items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
    throw genericError("Unable to parse agreements items");
  }

  return result.data;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(config: AgreementProcessConfig) {
  const readModelRepository = ReadModelRepository.init(config);
  const agreements = readModelRepository.agreements;
  const eservices = readModelRepository.eservices;
  const tenants = readModelRepository.tenants;
  return {
    async listAgreements(
      filters: AgreementQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<Agreement>> {
      const aggregationPipeline = [
        getAgreementsFilters(filters),
        {
          $lookup: {
            from: "eservices",
            localField: "data.eserviceId",
            foreignField: "data.id",
            as: "eservices",
          },
        },
        {
          $unwind: "$eservices",
        },
        ...(filters.showOnlyUpgradeable
          ? [
              {
                $addFields: {
                  currentDescriptor: {
                    $filter: {
                      input: "$eservices.data.descriptors",
                      as: "descr",
                      cond: {
                        $eq: ["$$descr.id", "$data.descriptorId"],
                      },
                    },
                  },
                },
              },
              {
                $unwind: "$currentDescriptor",
              },
              {
                $addFields: {
                  upgradableDescriptor: {
                    $filter: {
                      input: "$eservices.data.descriptors",
                      as: "upgradable",
                      cond: {
                        $and: [
                          {
                            $gt: [
                              "$$upgradable.activatedAt",
                              "$currentDescriptor.activatedAt",
                            ],
                          },
                          {
                            $in: [
                              "$$upgradable.state",
                              [
                                descriptorState.published,
                                descriptorState.suspended,
                              ],
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
              },
              {
                $match: {
                  upgradableDescriptor: { $ne: [] },
                },
              },
            ]
          : []),
        {
          $project: {
            data: 1,
            eservices: 1,
            lowerName: { $toLower: "$eservices.data.name" },
          },
        },
        {
          $sort: { lowerName: 1 },
        },
      ];

      const data = await agreements
        .aggregate([
          ...aggregationPipeline,
          { $skip: offset },
          { $limit: limit },
        ])
        .toArray();

      const result = z.array(Agreement).safeParse(data.map((d) => d.data));
      if (!result.success) {
        logger.error(
          `Unable to parse agreements items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw genericError("Unable to parse agreements items");
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          eservices,
          aggregationPipeline
        ),
      };
    },
    async readAgreementById(
      agreementId: string
    ): Promise<WithMetadata<Agreement> | undefined> {
      const data = await agreements.findOne(
        { "data.id": agreementId },
        { projection: { data: true, metadata: true } }
      );

      if (data) {
        const result = z
          .object({
            data: Agreement,
            metadata: z.object({ version: z.number() }),
          })
          .safeParse(data);
        if (!result.success) {
          logger.error(`Agreement ${agreementId} not found`);
          throw genericError(`Agreement ${agreementId} not found`);
        }
        return {
          data: result.data.data,
          metadata: { version: result.data.metadata.version },
        };
      }

      return undefined;
    },
    async getAgreements(
      filters: AgreementQueryFilters
    ): Promise<Array<WithMetadata<Agreement>>> {
      return getAllAgreements(agreements, filters);
    },
    async getEServiceById(
      id: string
    ): Promise<WithMetadata<EService> | undefined> {
      const data = await eservices.findOne(
        { "data.id": id },
        { projection: { data: true, metadata: true } }
      );

      if (data) {
        const result = z
          .object({
            metadata: z.object({ version: z.number() }),
            data: EService,
          })
          .safeParse(data);

        if (!result.success) {
          logger.error(
            `Unable to parse eservices item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );

          throw genericError(`Unable to parse eservice ${id}`);
        }

        return {
          data: result.data.data,
          metadata: { version: result.data.metadata.version },
        };
      }

      return undefined;
    },
    async getTenantById(
      tenantId: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      const data = await tenants.findOne(
        { "data.id": tenantId },
        { projection: { data: true, metadata: true } }
      );

      if (data) {
        const result = z
          .object({
            metadata: z.object({ version: z.number() }),
            data: Tenant,
          })
          .safeParse(data);

        if (!result.success) {
          logger.error(
            `Unable to parse tenant item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );

          throw genericError(`Unable to parse tenant ${tenantId}`);
        }

        return {
          data: result.data.data,
          metadata: { version: result.data.metadata.version },
        };
      }
      return undefined;
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
