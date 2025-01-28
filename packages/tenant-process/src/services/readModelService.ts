import {
  AttributeCollection,
  DelegationCollection,
  ReadModelRepository,
  TenantCollection,
} from "pagopa-interop-commons";
import {
  WithMetadata,
  Tenant,
  Attribute,
  ExternalId,
  EService,
  ListResult,
  agreementState,
  AttributeId,
  TenantId,
  EServiceId,
  attributeKind,
  AttributeReadmodel,
  Agreement,
  AgreementState,
  TenantReadModel,
  genericInternalError,
  TenantFeatureType,
  AgreementId,
  DelegationId,
  Delegation,
  DelegationReadModel,
  delegationKind,
  delegationState,
} from "pagopa-interop-models";
import { tenantApi } from "pagopa-interop-api-clients";
import { z } from "zod";
import { Document, Filter, WithId } from "mongodb";

function listTenantsFilters(
  name: string | undefined,
  features?: TenantFeatureType[]
): Filter<{ data: TenantReadModel }> {
  const nameFilter = name
    ? {
        "data.name": {
          $regex: ReadModelRepository.escapeRegExp(name),
          $options: "i",
        },
      }
    : {};

  const featuresFilter =
    features && features.length > 0
      ? {
          "data.features.type": {
            $in: features,
          },
        }
      : {};

  const withSelfcareIdFilter = {
    "data.selfcareId": {
      $exists: true,
    },
  };

  return {
    ...nameFilter,
    ...featuresFilter,
    ...withSelfcareIdFilter,
  };
}

export const getTenants = async ({
  tenants,
  aggregationPipeline,
  offset,
  limit,
}: {
  tenants: TenantCollection;
  aggregationPipeline: Array<Filter<TenantReadModel>>;
  offset: number;
  limit: number;
  allowDiskUse?: boolean;
}): Promise<{
  results: Tenant[];
  totalCount: number;
}> => {
  const data = await tenants
    .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }], {
      allowDiskUse: true,
    })
    .toArray();

  const result = z.array(Tenant).safeParse(data.map((d) => d.data));

  if (!result.success) {
    throw genericInternalError(
      `Unable to parse tenants items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
  }
  return {
    results: result.data,
    totalCount: await ReadModelRepository.getTotalCount(
      tenants,
      aggregationPipeline
    ),
  };
};

async function getAttribute(
  attributes: AttributeCollection,
  filter: Filter<WithId<WithMetadata<AttributeReadmodel>>>
): Promise<Attribute | undefined> {
  const data = await attributes.findOne(filter, {
    projection: { data: true, metadata: true },
  });
  if (!data) {
    return undefined;
  } else {
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
}

async function getTenant(
  tenants: TenantCollection,
  filter: Filter<WithId<WithMetadata<TenantReadModel>>>
): Promise<WithMetadata<Tenant> | undefined> {
  const data = await tenants.findOne(filter, {
    projection: { data: true, metadata: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = z
      .object({
        metadata: z.object({ version: z.number() }),
        data: Tenant,
      })
      .safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse tenant item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }

    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };
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
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { attributes, eservices, tenants, agreements, delegations } =
    readModelRepository;
  return {
    async getTenants({
      name,
      features,
      offset,
      limit,
    }: {
      name: string | undefined;
      features: TenantFeatureType[];
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      const query = listTenantsFilters(name, features);
      const aggregationPipeline = [
        { $match: query },
        { $project: { data: 1, lowerName: { $toLower: "$data.name" } } },
        { $sort: { lowerName: 1 } },
      ];

      return getTenants({
        tenants,
        aggregationPipeline,
        offset,
        limit,
      });
    },

    async getTenantById(
      id: TenantId
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, { "data.id": id });
    },

    async getTenantByName(
      name: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, {
        "data.name": {
          $regex: `^${ReadModelRepository.escapeRegExp(name)}$$`,
          $options: "i",
        },
      });
    },

    async getTenantByExternalId(
      externalId: ExternalId
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, {
        "data.externalId.value": externalId.value,
        "data.externalId.origin": externalId.origin,
      });
    },

    async getTenantBySelfcareId(
      selfcareId: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, { "data.selfcareId": selfcareId });
    },

    async getAttributeByOriginAndCode({
      origin,
      code,
    }: {
      origin: string;
      code: string;
    }): Promise<Attribute | undefined> {
      return getAttribute(attributes, {
        "data.origin": origin,
        "data.code": code,
      });
    },

    async getConsumers({
      consumerName,
      producerId,
      offset,
      limit,
    }: {
      consumerName: string | undefined;
      producerId: string;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      const query = listTenantsFilters(consumerName);

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

      return getTenants({
        tenants,
        aggregationPipeline,
        offset,
        limit,
        allowDiskUse: true,
      });
    },

    async getProducers({
      producerName,
      offset,
      limit,
    }: {
      producerName: string | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      const query = listTenantsFilters(producerName);
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

      return getTenants({
        tenants,
        aggregationPipeline,
        offset,
        limit,
        allowDiskUse: true,
      });
    },

    async getAttributesByExternalIds(
      externalIds: ExternalId[]
    ): Promise<Attribute[]> {
      const data = await attributes
        .find({
          $or: externalIds.map((externalId) => ({
            "data.origin": externalId.origin,
            "data.code": externalId.value,
          })),
        })
        .toArray();
      const result = z.array(Attribute).safeParse(data.map((d) => d.data));
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse attributes items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }
      return result.data;
    },

    async getAttributesById(attributeIds: AttributeId[]): Promise<Attribute[]> {
      const data = await attributes
        .aggregate([{ $match: { "data.id": { $in: attributeIds } } }], {
          allowDiskUse: true,
        })
        .toArray();
      const result = z.array(Attribute).safeParse(data.map((d) => d.data));
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse attributes items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }
      return result.data;
    },

    async getAttributeById(
      attributeId: AttributeId
    ): Promise<Attribute | undefined> {
      return getAttribute(attributes, { "data.id": attributeId });
    },

    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      const data = await eservices.findOne(
        { "data.id": id },
        { projection: { data: true } }
      );
      if (!data) {
        return undefined;
      } else {
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
    },

    async getAgreements({
      consumerId,
      producerId,
      states,
    }: {
      consumerId: TenantId;
      producerId: TenantId;
      states: AgreementState[];
    }): Promise<Agreement[]> {
      const data = await agreements
        .find({
          "data.consumerId": consumerId,
          "data.producerId": producerId,
          "data.state": { $in: states },
        })
        .toArray();

      const result = z.array(Agreement).safeParse(data.map((d) => d.data));

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse agreements item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }
      return result.data;
    },

    async getAgreementById(
      agreementId: AgreementId
    ): Promise<Agreement | undefined> {
      const data = await agreements.findOne({ "data.id": agreementId });
      if (data) {
        const result = Agreement.safeParse(data.data);
        if (!result.success) {
          throw genericInternalError(
            `Unable to parse agreement item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }
        return result.data;
      }
      return undefined;
    },

    async getCertifiedAttributes({
      certifierId,
      offset,
      limit,
    }: {
      certifierId: string;
      offset: number;
      limit: number;
    }): Promise<ListResult<tenantApi.CertifiedAttribute>> {
      const aggregationPipeline: Document[] = [
        {
          $match: {
            "data.kind": attributeKind.certified,
            "data.origin": certifierId,
          },
        },
        {
          $lookup: {
            from: "tenants",
            localField: "data.id",
            foreignField: "data.attributes.id",
            as: "tenants",
          },
        },
        { $unwind: "$tenants" },
        { $unwind: "$tenants.data.attributes" },
        {
          $addFields: {
            notRevoked: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ["$tenants.data.attributes.id", "$data.id"] },
                    { $not: ["$tenants.data.attributes.revocationTimestamp"] },
                  ],
                },
                then: true,
                else: false,
              },
            },
          },
        },
        {
          $match: {
            notRevoked: true,
          },
        },
        {
          $project: {
            _id: 0,
            id: "$tenants.data.id",
            name: "$tenants.data.name",
            attributeId: "$data.id",
            attributeName: "$data.name",
            lowerName: { $toLower: "$tenants.data.name" },
          },
        },
        {
          $sort: {
            lowerName: 1,
          },
        },
      ];

      const data = await attributes
        .aggregate(
          [...aggregationPipeline, { $skip: offset }, { $limit: limit }],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z
        .array(tenantApi.CertifiedAttribute.strip()) // "strip" used to remove "lowerName" field
        .safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse attributes items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          attributes,
          aggregationPipeline
        ),
      };
    },

    async getOneCertifiedAttributeByCertifier({
      certifierId,
    }: {
      certifierId: string;
    }): Promise<Attribute | undefined> {
      return getAttribute(attributes, {
        "data.kind": attributeKind.certified,
        "data.origin": certifierId,
      });
    },
    async getActiveProducerDelegationByEservice(
      eserviceId: EServiceId
    ): Promise<Delegation | undefined> {
      return getDelegation(delegations, {
        "data.eserviceId": eserviceId,
        "data.kind": delegationKind.delegatedProducer,
        "data.state": delegationState.active,
      });
    },
    async getActiveConsumerDelegation(
      delegationId: DelegationId
    ): Promise<Delegation | undefined> {
      return getDelegation(delegations, {
        "data.id": delegationId,
        "data.state": delegationState.active,
        "data.kind": delegationKind.delegatedConsumer,
      });
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
