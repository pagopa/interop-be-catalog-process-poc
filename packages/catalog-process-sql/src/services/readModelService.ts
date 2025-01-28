import { ReadModelRepositorySQL } from "pagopa-interop-commons";
import {
  EService,
  WithMetadata,
  EServiceId,
  TenantId,
} from "pagopa-interop-models";
import * as poc from "pagopa-interop-poc-readmodel";

// async function getTenant(
//   tenants: TenantCollection,
//   filter: Filter<WithId<WithMetadata<TenantReadModel>>>
// ): Promise<Tenant | undefined> {
//   const data = await tenants.findOne(filter, {
//     projection: { data: true, metadata: true },
//   });

//   if (!data) {
//     return undefined;
//   }
//   const result = Tenant.safeParse(data.data);

//   if (!result.success) {
//     throw genericInternalError(
//       `Unable to parse tenant item: result ${JSON.stringify(
//         result
//       )} - data ${JSON.stringify(data)} `
//     );
//   }

//   return result.data;
// }

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepositorySQL: ReadModelRepositorySQL
) {
  // const eservices = readModelRepository.eservices;
  // const agreements = readModelRepository.agreements;
  // const attributes = readModelRepository.attributes;
  // const tenants = readModelRepository.tenants;
  // const delegations = readModelRepository.delegations;

  return {
    // TODO implement this
    // async getEServices(
    //   authData: AuthData,
    //   filters: ApiGetEServicesFilters,
    //   offset: number,
    //   limit: number
    // ): Promise<ListResult<EService>> {
    //   const {
    //     eservicesIds,
    //     producersIds,
    //     states,
    //     agreementStates,
    //     name,
    //     attributesIds,
    //     mode,
    //     delegated,
    //   } = filters;
    //   const ids = await match(agreementStates.length)
    //     .with(0, () => eservicesIds)
    //     .otherwise(async () =>
    //       (
    //         await this.listAgreements({
    //           eservicesIds,
    //           consumersIds: [authData.organizationId],
    //           producersIds: [],
    //           states: agreementStates,
    //         })
    //       ).map((a) => a.eserviceId)
    //     );

    //   if (agreementStates.length > 0 && ids.length === 0) {
    //     return emptyListResult;
    //   }

    //   const nameFilter: ReadModelFilter<EService> = name
    //     ? {
    //         "data.name": {
    //           $regex: ReadModelRepository.escapeRegExp(name),
    //           $options: "i",
    //         },
    //       }
    //     : {};

    //   const idsFilter: ReadModelFilter<EService> =
    //     ReadModelRepository.arrayToFilter(ids, {
    //       "data.id": { $in: ids },
    //     });

    //   const delegationLookup =
    //     producersIds.length > 0 || delegated !== undefined
    //       ? [
    //           {
    //             $lookup: {
    //               from: "delegations",
    //               localField: "data.id",
    //               foreignField: "data.eserviceId",
    //               as: "delegations",
    //             },
    //           },
    //         ]
    //       : [];

    //   const producersIdsFilter = ReadModelRepository.arrayToFilter(
    //     producersIds,
    //     {
    //       $or: [
    //         { "data.producerId": { $in: producersIds } },
    //         {
    //           "delegations.data.delegateId": { $in: producersIds },
    //           "delegations.data.state": { $eq: delegationState.active },
    //           "delegations.data.kind": {
    //             $eq: delegationKind.delegatedProducer,
    //           },
    //         },
    //       ],
    //     }
    //   );

    //   const descriptorsStateFilter: ReadModelFilter<EService> =
    //     ReadModelRepository.arrayToFilter(states, {
    //       "data.descriptors.state": { $in: states },
    //     });

    //   const attributesFilter: ReadModelFilter<EService> =
    //     ReadModelRepository.arrayToFilter(attributesIds, {
    //       $or: [
    //         {
    //           "data.descriptors.attributes.certified": {
    //             $elemMatch: {
    //               $elemMatch: { id: { $in: attributesIds } },
    //             },
    //           },
    //         },
    //         {
    //           "data.descriptors.attributes.declared": {
    //             $elemMatch: {
    //               $elemMatch: { id: { $in: attributesIds } },
    //             },
    //           },
    //         },
    //         {
    //           "data.descriptors.attributes.verified": {
    //             $elemMatch: {
    //               $elemMatch: { id: { $in: attributesIds } },
    //             },
    //           },
    //         },
    //       ],
    //     });

    //   const visibilityFilter: ReadModelFilter<EService> = hasPermission(
    //     [userRoles.ADMIN_ROLE, userRoles.API_ROLE, userRoles.SUPPORT_ROLE],
    //     authData
    //   )
    //     ? {
    //         $nor: [
    //           {
    //             $and: [
    //               { "data.producerId": { $ne: authData.organizationId } },
    //               { "data.descriptors": { $size: 0 } },
    //             ],
    //           },
    //           {
    //             $and: [
    //               { "data.producerId": { $ne: authData.organizationId } },
    //               { "data.descriptors": { $size: 1 } },
    //               {
    //                 "data.descriptors.state": {
    //                   $in: [
    //                     descriptorState.draft,
    //                     descriptorState.waitingForApproval,
    //                   ],
    //                 },
    //               },
    //             ],
    //           },
    //         ],
    //       }
    //     : {
    //         $nor: [
    //           { "data.descriptors": { $size: 0 } },
    //           {
    //             $and: [
    //               { "data.descriptors": { $size: 1 } },
    //               {
    //                 "data.descriptors.state": {
    //                   $in: [
    //                     descriptorState.draft,
    //                     descriptorState.waitingForApproval,
    //                   ],
    //                 },
    //               },
    //             ],
    //           },
    //         ],
    //       };

    //   const modeFilter: ReadModelFilter<EService> = mode
    //     ? { "data.mode": { $eq: mode } }
    //     : {};

    //   const delegatedFilter: ReadModelFilter<EService> = match(delegated)
    //     .with(true, () => ({
    //       "delegations.data.state": {
    //         $in: [delegationState.active, delegationState.waitingForApproval],
    //       },
    //       "delegations.data.kind": delegationKind.delegatedProducer,
    //     }))
    //     .with(false, () => ({
    //       delegations: {
    //         $not: {
    //           $elemMatch: {
    //             "data.state": {
    //               $in: [
    //                 delegationState.active,
    //                 delegationState.waitingForApproval,
    //               ],
    //             },
    //             "data.kind": delegationKind.delegatedProducer,
    //           },
    //         },
    //       },
    //     }))
    //     .otherwise(() => ({}));

    //   const aggregationPipeline = [
    //     ...delegationLookup,
    //     { $match: nameFilter },
    //     { $match: idsFilter },
    //     { $match: producersIdsFilter },
    //     { $match: descriptorsStateFilter },
    //     { $match: attributesFilter },
    //     { $match: visibilityFilter },
    //     { $match: modeFilter },
    //     { $match: delegatedFilter },
    //     {
    //       $project: {
    //         data: 1,
    //         computedColumn: { $toLower: ["$data.name"] },
    //       },
    //     },
    //     {
    //       $sort: { computedColumn: 1 },
    //     },
    //   ];

    //   const data = await eservices
    //     .aggregate(
    //       [...aggregationPipeline, { $skip: offset }, { $limit: limit }],
    //       { allowDiskUse: true }
    //     )
    //     .toArray();

    //   const result = z.array(EService).safeParse(data.map((d) => d.data));
    //   if (!result.success) {
    //     throw genericInternalError(
    //       `Unable to parse eservices items: result ${JSON.stringify(
    //         result
    //       )} - data ${JSON.stringify(data)} `
    //     );
    //   }

    //   return {
    //     results: result.data,
    //     totalCount: await ReadModelRepository.getTotalCount(
    //       eservices,
    //       aggregationPipeline
    //     ),
    //   };
    // },
    async getEServiceByNameAndProducerId({
      name,
      producerId,
    }: {
      name: string;
      producerId: TenantId;
    }): Promise<WithMetadata<EService> | undefined> {
      const res = await poc.getEServiceByNameAndProducerId({
        name,
        producerId,
        readModelRepositorySQL,
      });

      if (res) {
        return {
          data: res.data,
          metadata: res.metadata,
        };
      } else {
        return res;
      }
    },

    async getEServiceById(
      id: EServiceId
    ): Promise<WithMetadata<EService> | undefined> {
      console.log("getting eservice");
      const res = await poc.getEServiceById(id, readModelRepositorySQL);
      console.log(res);

      if (res) {
        return {
          data: res.data,
          metadata: res.metadata,
        };
      } else {
        return res;
      }
    },

    // async getEServiceConsumers(
    //   eserviceId: EServiceId,
    //   offset: number,
    //   limit: number
    // ): Promise<ListResult<Consumer>> {
    //   const aggregationPipeline = [
    //     {
    //       $match: {
    //         "data.id": eserviceId,
    //         "data.descriptors": {
    //           $elemMatch: {
    //             state: {
    //               $in: [
    //                 descriptorState.published,
    //                 descriptorState.deprecated,
    //                 descriptorState.suspended,
    //               ],
    //             },
    //           },
    //         },
    //       } satisfies ReadModelFilter<EService>,
    //     },
    //     {
    //       $lookup: {
    //         from: "agreements",
    //         localField: "data.id",
    //         foreignField: "data.eserviceId",
    //         as: "agreements",
    //       },
    //     },
    //     {
    //       $unwind: "$agreements",
    //     },
    //     {
    //       $lookup: {
    //         from: "tenants",
    //         localField: "agreements.data.consumerId",
    //         foreignField: "data.id",
    //         as: "tenants",
    //       },
    //     },
    //     { $unwind: "$tenants" },
    //     {
    //       $match: {
    //         "agreements.data.state": {
    //           $in: [agreementState.active, agreementState.suspended],
    //         },
    //       },
    //     },
    //     {
    //       $addFields: {
    //         validDescriptor: {
    //           $filter: {
    //             input: "$data.descriptors",
    //             as: "fd",
    //             cond: {
    //               $eq: ["$$fd.id", "$agreements.data.descriptorId"],
    //             },
    //           },
    //         },
    //       },
    //     },
    //     {
    //       $unwind: "$validDescriptor",
    //     },
    //     {
    //       $match: {
    //         validDescriptor: { $exists: true },
    //       },
    //     },
    //     {
    //       $project: {
    //         descriptorVersion: "$validDescriptor.version",
    //         descriptorState: "$validDescriptor.state",
    //         agreementState: "$agreements.data.state",
    //         consumerName: "$tenants.data.name",
    //         consumerExternalId: "$tenants.data.externalId.value",
    //         lowerName: { $toLower: ["$tenants.data.name"] },
    //       },
    //     },
    //     {
    //       $sort: { lowerName: 1 },
    //     },
    //   ];

    //   const data = await eservices
    //     .aggregate(
    //       [...aggregationPipeline, { $skip: offset }, { $limit: limit }],
    //       { allowDiskUse: true }
    //     )
    //     .toArray();

    //   const result = z.array(consumer).safeParse(data);
    //   if (!result.success) {
    //     throw genericInternalError(
    //       `Unable to parse consumers: result ${JSON.stringify(
    //         result
    //       )} - data ${JSON.stringify(data)} `
    //     );
    //   }

    //   return {
    //     results: result.data,
    //     totalCount: await ReadModelRepository.getTotalCount(
    //       eservices,
    //       aggregationPipeline
    //     ),
    //   };
    // },
    // TODO implement  this
    // async listAgreements({
    //   eservicesIds,
    //   consumersIds,
    //   producersIds,
    //   states,
    //   limit,
    //   descriptorId,
    // }: {
    //   eservicesIds: EServiceId[];
    //   consumersIds: TenantId[];
    //   producersIds: TenantId[];
    //   states: AgreementState[];
    //   limit?: number;
    //   descriptorId?: DescriptorId;
    // }): Promise<Agreement[]> {
    //   const descriptorFilter: ReadModelFilter<Agreement> = descriptorId
    //     ? { "data.descriptorId": { $eq: descriptorId } }
    //     : {};

    //   const aggregationPipeline = [
    //     {
    //       $match: {
    //         ...ReadModelRepository.arrayToFilter(eservicesIds, {
    //           "data.eserviceId": { $in: eservicesIds },
    //         }),
    //         ...descriptorFilter,
    //         ...ReadModelRepository.arrayToFilter(consumersIds, {
    //           "data.consumerId": { $in: consumersIds },
    //         }),
    //         ...ReadModelRepository.arrayToFilter(producersIds, {
    //           "data.producerId": { $in: producersIds },
    //         }),
    //         ...ReadModelRepository.arrayToFilter(states, {
    //           "data.state": { $in: states },
    //         }),
    //       } satisfies ReadModelFilter<Agreement>,
    //     },
    //     {
    //       $project: {
    //         data: 1,
    //       },
    //     },
    //   ];

    //   const aggregationWithLimit = limit
    //     ? [...aggregationPipeline, { $limit: limit }]
    //     : aggregationPipeline;
    //   const data = await agreements
    //     .aggregate(aggregationWithLimit, { allowDiskUse: true })
    //     .toArray();
    //   const result = z.array(Agreement).safeParse(data.map((a) => a.data));

    //   if (!result.success) {
    //     throw genericInternalError(
    //       `Unable to parse agreements: result ${JSON.stringify(
    //         result
    //       )} - data ${JSON.stringify(data)} `
    //     );
    //   }

    //   return result.data;
    // },

    // async getAttributesByIds(
    //   attributesIds: AttributeId[]
    // ): Promise<Attribute[]> {
    //   const data = await attributes
    //     .find({
    //       "data.id": { $in: attributesIds },
    //     })
    //     .toArray();

    //   const result = z.array(Attribute).safeParse(data.map((d) => d.data));
    //   if (!result.success) {
    //     throw genericInternalError(
    //       `Unable to parse attributes items: result ${JSON.stringify(
    //         result
    //       )} - data ${JSON.stringify(data)} `
    //     );
    //   }

    //   return result.data;
    // },

    // async getTenantById(id: TenantId): Promise<Tenant | undefined> {
    //   return getTenant(tenants, { "data.id": id });
    // },

    // async getLatestDelegation({
    //   eserviceId,
    //   kind,
    //   states,
    //   delegateId,
    // }: {
    //   eserviceId: EServiceId;
    //   kind: DelegationKind;
    //   states?: DelegationState[];
    //   delegateId?: TenantId;
    // }): Promise<Delegation | undefined> {
    //   const data = await delegations.findOne(
    //     {
    //       "data.eserviceId": eserviceId,
    //       "data.kind": kind,
    //       ...(states && states.length > 0
    //         ? { "data.state": { $in: states } }
    //         : {}),
    //       ...(delegateId ? { "data.delegateId": delegateId } : {}),
    //     },
    //     {
    //       projection: { data: true },
    //       sort: { "data.createdAt": -1 },
    //     }
    //   );

    //   if (!data) {
    //     return undefined;
    //   }
    //   const result = Delegation.safeParse(data.data);

    //   if (!result.success) {
    //     throw genericInternalError(
    //       `Unable to parse delegation item: result ${JSON.stringify(
    //         result
    //       )} - data ${JSON.stringify(data)} `
    //     );
    //   }

    //   return result.data;
    // },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
