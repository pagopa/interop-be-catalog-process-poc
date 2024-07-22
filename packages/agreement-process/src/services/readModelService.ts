/* eslint-disable no-constant-condition */
/* eslint-disable functional/no-let */
import {
  AgreementCollection,
  MongoQueryKeys,
  ReadModelFilter,
  ReadModelRepository,
  RemoveDataPrefix,
  Metadata,
  AttributeCollection,
} from "pagopa-interop-commons";
import {
  Agreement,
  AttributeId,
  AgreementId,
  AgreementState,
  Attribute,
  DescriptorId,
  EService,
  ListResult,
  Tenant,
  WithMetadata,
  agreementState,
  descriptorState,
  EServiceId,
  AttributeReadmodel,
  TenantId,
  genericInternalError,
  EServiceReadModel,
  AgreementReadModel,
  DescriptorReadModel,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { z } from "zod";
import { Document, Filter } from "mongodb";
import {
  CompactEService,
  CompactOrganization,
} from "../model/domain/models.js";

export type AgreementQueryFilters = {
  producerId?: TenantId | TenantId[];
  consumerId?: TenantId | TenantId[];
  eserviceId?: EServiceId | EServiceId[];
  descriptorId?: DescriptorId | DescriptorId[];
  agreementStates?: AgreementState[];
  attributeId?: AttributeId | AttributeId[];
  showOnlyUpgradeable?: boolean;
};

export type AgreementEServicesQueryFilters = {
  eserviceName: string | undefined;
  consumerIds: TenantId[];
  producerIds: TenantId[];
  agreeementStates: AgreementState[];
};

type AgreementDataFields = RemoveDataPrefix<MongoQueryKeys<Agreement>>;

const makeFilter = (
  fieldName: Extract<
    AgreementDataFields,
    "producerId" | "consumerId" | "eserviceId" | "descriptorId" | "state"
  >,
  value: string | string[] | undefined
): ReadModelFilter<Agreement> | undefined =>
  match(value)
    .with(P.nullish, () => undefined)
    .with(P.string, () => ({
      [`data.${fieldName}`]: value,
    }))
    .with(P.array(P.string), (a) =>
      a.length === 0 ? undefined : { [`data.${fieldName}`]: { $in: value } }
    )
    .exhaustive();

const makeAttributesFilter = (
  fieldName: Extract<
    AgreementDataFields,
    "certifiedAttributes" | "declaredAttributes" | "verifiedAttributes"
  >,
  attributeIds: AttributeId | AttributeId[]
): ReadModelFilter<Agreement> | undefined =>
  match(attributeIds)
    .with(P.string, (id) => ({
      [`data.${fieldName}`]: { $elemMatch: { id } },
    }))
    .with(P.array(P.string), (ids) =>
      ids.length === 0
        ? undefined
        : {
            [`data.${fieldName}`]: {
              $elemMatch: { id: { $in: ids } },
            },
          }
    )
    .exhaustive();

const makeRegexFilter = (
  fieldName: string,
  value: string | undefined
): ReadModelFilter<Agreement> | undefined =>
  match(value)
    .with(P.nullish, () => undefined)
    .with("", () => undefined)
    .with(P.string, () => ({
      [fieldName]: {
        $regex: new RegExp(ReadModelRepository.escapeRegExp(value || ""), "i"),
      },
    }))
    .exhaustive();

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
        upgradeableStates.filter((s) => agreementStates.includes(s))
    )
    .otherwise((agreementStates) => agreementStates);

  const queryFilters = {
    ...makeFilter("producerId", producerId),
    ...makeFilter("consumerId", consumerId),
    ...makeFilter("eserviceId", eserviceId),
    ...makeFilter("descriptorId", descriptorId),
    ...makeFilter("state", agreementStatesFilters),
    ...(attributeId && {
      $or: [
        makeAttributesFilter("certifiedAttributes", attributeId),
        makeAttributesFilter("verifiedAttributes", attributeId),
        makeAttributesFilter("declaredAttributes", attributeId),
      ],
    }),
  };
  return { $match: queryFilters };
};

const getTenantsByNamePipeline = (
  tenantName: string | undefined,
  tenantIdField: Extract<AgreementDataFields, "producerId" | "consumerId">
): Document[] => [
  {
    $lookup: {
      from: "tenants",
      localField: `data.${tenantIdField}`,
      foreignField: "data.id",
      as: "tenants",
    },
  },
  {
    $unwind: {
      path: "$tenants",
      preserveNullAndEmptyArrays: false,
    },
  },
  {
    $match: {
      ...makeRegexFilter("tenants.data.name", tenantName),
    },
  },
  {
    $group: {
      _id: `$data.${tenantIdField}`,
      tenantId: { $first: `$data.${tenantIdField}` },
      tenantName: { $first: "$tenants.data.name" },
    },
  },
  {
    $project: {
      data: { id: "$tenantId", name: "$tenantName" },
      lowerName: { $toLower: "$tenantName" },
    },
  },
  {
    $sort: { lowerName: 1 },
  },
];

const getAllAgreements = async (
  agreements: AgreementCollection,
  filters: AgreementQueryFilters
): Promise<Array<WithMetadata<Agreement>>> => {
  const data = await agreements
    .aggregate([getAgreementsFilters(filters)])
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
    throw genericInternalError(
      `Unable to parse agreements items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
  }

  return result.data;
};

async function getAttribute(
  attributes: AttributeCollection,
  filter: Filter<{ data: AttributeReadmodel }>
): Promise<Attribute | undefined> {
  const data = await attributes.findOne(filter, {
    projection: { data: true },
  });
  if (data) {
    const result = Attribute.safeParse(data.data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse attribute item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
  return undefined;
}

// eslint-disable-next-line max-params
async function searchTenantsByName(
  agreements: AgreementCollection,
  tenantName: string | undefined,
  tenantIdField: "producerId" | "consumerId",
  limit: number,
  offset: number
): Promise<ListResult<CompactOrganization>> {
  const aggregationPipeline = getTenantsByNamePipeline(
    tenantName,
    tenantIdField
  );

  const data = await agreements
    .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
    .toArray();

  const result = z
    .array(CompactOrganization)
    .safeParse(data.map((d) => d.data));
  if (!result.success) {
    throw genericInternalError(
      `Unable to parse compact organization items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
  }

  return {
    results: result.data,
    totalCount: await ReadModelRepository.getTotalCount(
      agreements,
      aggregationPipeline,
      false
    ),
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const agreements = readModelRepository.agreements;
  const eservices = readModelRepository.eservices;
  const tenants = readModelRepository.tenants;
  const attributes = readModelRepository.attributes;
  return {
    async getAgreements(
      filters: AgreementQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<Agreement>> {
      const agreementFilter = getAgreementsFilters(filters);

      const agreementsData = await agreements
        .aggregate([agreementFilter])
        .toArray();

      const eserviceIds = agreementsData.map(
        (agreement) => agreement.data.eserviceId
      );

      const eservicesData = await eservices
        .find({ "data.id": { $in: eserviceIds } })
        .toArray();

      const eservicesMap = new Map(
        eservicesData.map((eservice) => [eservice.data.id, eservice.data])
      );

      const combinedData: Array<{
        agreement: AgreementReadModel;
        eservice: EServiceReadModel;
      }> = agreementsData.flatMap((agreement) => {
        const eservice = eservicesMap.get(agreement.data.eserviceId);
        return eservice ? [{ agreement: agreement.data, eservice }] : [];
      });

      const filteredData = filters.showOnlyUpgradeable
        ? combinedData.filter((cb) => {
            const currentDescriptor = cb.eservice.descriptors.find(
              (descr) => descr.id === cb.agreement.descriptorId
            );
            const upgradableDescriptor = cb.eservice.descriptors.filter(
              (upgradable: DescriptorReadModel) => {
                // Since the dates are optional, if they are undefined they are set to a very old date
                const currentPublishedAt =
                  currentDescriptor?.publishedAt ?? new Date(0);
                const upgradablePublishedAt =
                  upgradable.publishedAt ?? new Date(0);
                return (
                  upgradablePublishedAt > currentPublishedAt &&
                  (upgradable.state === descriptorState.published ||
                    upgradable.state === descriptorState.suspended)
                );
              }
            );
            return upgradableDescriptor.length > 0;
          })
        : combinedData;

      const sortedData = filteredData
        .slice(offset, offset + limit)
        .sort((a, b) =>
          a.eservice.name
            .toLowerCase()
            .localeCompare(b.eservice.name.toLowerCase())
        );

      const result = z
        .array(Agreement)
        .safeParse(sortedData.map((d) => d.agreement));
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse agreements items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(sortedData)} `
        );
      }
      return {
        results: result.data,
        totalCount: filteredData.length,
      };
    },
    async getAgreementById(
      agreementId: AgreementId
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
          throw genericInternalError(`Agreement ${agreementId} not found`);
        }
        return {
          data: result.data.data,
          metadata: { version: result.data.metadata.version },
        };
      }

      return undefined;
    },
    async getAllAgreements(
      filters: AgreementQueryFilters
    ): Promise<Array<WithMetadata<Agreement>>> {
      return getAllAgreements(agreements, filters);
    },
    async getEServiceById(id: string): Promise<EService | undefined> {
      const data = await eservices.findOne(
        { "data.id": id },
        { projection: { data: true } }
      );

      if (data) {
        const result = EService.safeParse(data.data);

        if (!result.success) {
          throw genericInternalError(
            `Unable to parse eservices item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }

        return result.data;
      }

      return undefined;
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
    async getAttributeById(id: AttributeId): Promise<Attribute | undefined> {
      return getAttribute(attributes, { "data.id": id });
    },
    async getConsumers(
      name: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      return searchTenantsByName(agreements, name, "consumerId", limit, offset);
    },
    async getProducers(
      name: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      return searchTenantsByName(agreements, name, "producerId", limit, offset);
    },
    async getAgreementsEServices(
      filters: AgreementEServicesQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactEService>> {
      const agreementFilter = {
        ...(filters.consumerIds.length === 0
          ? undefined
          : { "data.consumerId": { $in: filters.consumerIds } }),
        ...(filters.producerIds.length === 0
          ? undefined
          : { "data.producerId": { $in: filters.producerIds } }),
        ...(filters.agreeementStates.length === 0
          ? undefined
          : { "data.state": { $in: filters.agreeementStates } }),
      };

      const agreementEservicesIds = await agreements.distinct(
        "data.eserviceId",
        agreementFilter
      );

      const aggregationPipeline = [
        {
          $match: {
            ...{ "data.id": { $in: agreementEservicesIds } },
            ...makeRegexFilter("data.name", filters.eserviceName),
          },
        },
        {
          $project: {
            data: { id: "$data.id", name: "$data.name" },
            lowerName: { $toLower: "$data.name" },
          },
        },
        {
          $sort: { lowerName: 1 },
        },
      ];

      const data = await eservices
        .aggregate([
          ...aggregationPipeline,
          { $skip: offset },
          { $limit: limit },
        ])
        .toArray();

      const result = z
        .array(CompactEService)
        .safeParse(data.map((d) => d.data));
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse compact eservice items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          eservices,
          aggregationPipeline,
          false
        ),
      };
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
