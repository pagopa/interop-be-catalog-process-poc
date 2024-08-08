/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import {
  agreementApi,
  attributeRegistryApi,
  bffApi,
  catalogApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import { DescriptorId, EServiceId } from "pagopa-interop-models";
import {
  toBffCatalogApiDescriptorAttributes,
  toBffCatalogApiDescriptorDoc,
  toBffCatalogApiEService,
  toBffCatalogApiEserviceRiskAnalysis,
  toBffCatalogApiProducerDescriptorEService,
} from "../model/api/converters/catalogClientApiConverter.js";

import { eserviceDescriptorNotFound } from "../model/domain/errors.js";
import { getLatestActiveDescriptor } from "../model/modelMappingUtils.js";
import {
  assertRequesterIsProducer,
  catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied,
} from "../model/validators.js";
import {
  AgreementProcessClient,
  AttributeProcessClient,
  CatalogProcessClient,
  TenantProcessClient,
} from "../providers/clientProvider.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import { catalogApiDescriptorState } from "../model/api/apiTypes.js";
import { getLatestAgreement } from "./agreementService.js";

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;

const enhanceCatalogEService =
  (
    tenantProcessClient: TenantProcessClient,
    agreementProcessClient: AgreementProcessClient,
    headers: Headers,
    requesterId: string
  ): ((eservice: catalogApi.EService) => Promise<bffApi.CatalogEService>) =>
  async (eservice: catalogApi.EService): Promise<bffApi.CatalogEService> => {
    const producerTenant = await tenantProcessClient.tenant.getTenant({
      headers,
      params: {
        id: eservice.producerId,
      },
    });

    const requesterTenant: tenantApi.Tenant =
      requesterId !== eservice.producerId
        ? await tenantProcessClient.tenant.getTenant({
            headers,
            params: {
              id: requesterId,
            },
          })
        : producerTenant;

    const latestActiveDescriptor = getLatestActiveDescriptor(eservice);

    const latestAgreement = await getLatestAgreement(
      agreementProcessClient,
      requesterId,
      eservice,
      headers
    );

    const isRequesterEqProducer = requesterId === eservice.producerId;
    const hasCertifiedAttributes =
      latestActiveDescriptor !== undefined &&
      catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied(
        latestActiveDescriptor,
        requesterTenant
      );

    return toBffCatalogApiEService(
      eservice,
      producerTenant,
      hasCertifiedAttributes,
      isRequesterEqProducer,
      latestActiveDescriptor,
      latestAgreement
    );
  };

const enhanceProducerEService = (
  eservice: catalogApi.EService
): bffApi.ProducerEService => ({
  id: eservice.id,
  name: eservice.name,
  mode: eservice.mode,
  activeDescriptor: getLatestActiveDescriptor(eservice),
  draftDescriptor: eservice.descriptors.find(
    (d) => d.state === catalogApiDescriptorState.DRAFT
  ),
});

const getBulkAttributes = async (
  attributeProcessClient: AttributeProcessClient,
  headers: Headers,
  descriptorAttributeIds: string[]
) => {
  // Fetch all attributes in a recursive way
  const attributesBulk = async (
    offset: number,
    result: attributeRegistryApi.Attribute[]
  ): Promise<attributeRegistryApi.Attribute[]> => {
    const attributes = await attributeProcessClient.getBulkedAttributes(
      descriptorAttributeIds,
      {
        headers,
        queries: {
          limit: 50,
          offset,
        },
      }
    );

    if (attributes.totalCount <= 50) {
      return result.concat(attributes.results);
    } else {
      return await attributesBulk(offset + 50, result);
    }
  };

  return await attributesBulk(0, []);
};

export const retrieveEserviceDescriptor = (
  eservice: catalogApi.EService,
  descriptorId: DescriptorId
): catalogApi.EServiceDescriptor => {
  const descriptor = eservice.descriptors.find((e) => e.id === descriptorId);

  if (!descriptor) {
    throw eserviceDescriptorNotFound(eservice.id, descriptorId);
  }

  return descriptor;
};

const getAttributeIds = (
  descriptor: catalogApi.EServiceDescriptor
): string[] => [
  ...descriptor.attributes.certified.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
  ...descriptor.attributes.declared.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
  ...descriptor.attributes.verified.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
];

export function catalogServiceBuilder(
  catalogProcessClient: CatalogProcessClient,
  tenantProcessClient: TenantProcessClient,
  agreementProcessClient: AgreementProcessClient,
  attributeProcessClient: AttributeProcessClient
) {
  return {
    getCatalog: async (
      { headers, authData }: WithLogger<BffAppContext>,
      queries: catalogApi.GetCatalogQueryParam
    ): Promise<bffApi.CatalogEServices> => {
      const requesterId = authData.organizationId;
      const { offset, limit } = queries;
      const eservicesResponse: catalogApi.EServices =
        await catalogProcessClient.getEServices({
          headers,
          queries: {
            ...queries,
            eservicesIds: queries.eservicesIds,
            producersIds: queries.producersIds,
            states: queries.states,
            attributesIds: queries.attributesIds,
            agreementStates: queries.agreementStates,
          },
        });

      const results = await Promise.all(
        eservicesResponse.results.map(
          enhanceCatalogEService(
            tenantProcessClient,
            agreementProcessClient,
            headers,
            requesterId
          )
        )
      );
      const response: bffApi.CatalogEServices = {
        results,
        pagination: {
          offset,
          limit,
          totalCount: eservicesResponse.totalCount,
        },
      };
      return response;
    },
    getProducerEServiceDescriptor: async (
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { headers, authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceDescriptor> => {
      const requesterId = authData.organizationId;

      const eservice: catalogApi.EService =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId: eserviceId,
          },
          headers,
        });

      assertRequesterIsProducer(requesterId, eservice);

      const descriptor = retrieveEserviceDescriptor(eservice, descriptorId);

      const descriptorAttributeIds = getAttributeIds(descriptor);

      const attributes = await getBulkAttributes(
        attributeProcessClient,
        headers,
        descriptorAttributeIds
      );

      const descriptorAttributes = toBffCatalogApiDescriptorAttributes(
        attributes,
        descriptor
      );

      const requesterTenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: requesterId,
        },
      });

      return {
        id: descriptor.id,
        version: descriptor.version,
        description: descriptor.description,
        interface:
          descriptor.interface &&
          toBffCatalogApiDescriptorDoc(descriptor.interface),
        docs: descriptor.docs.map(toBffCatalogApiDescriptorDoc),
        state: descriptor.state,
        audience: descriptor.audience,
        voucherLifespan: descriptor.voucherLifespan,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
        dailyCallsTotal: descriptor.dailyCallsTotal,
        agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
        attributes: descriptorAttributes,
        eservice: toBffCatalogApiProducerDescriptorEService(
          eservice,
          requesterTenant
        ),
      };
    },
    getProducerEServiceDetails: async (
      eServiceId: string,
      { headers, authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceDetails> => {
      const requesterId = authData.organizationId;

      const eservice: catalogApi.EService =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId,
          },
          headers,
        });

      assertRequesterIsProducer(requesterId, eservice);

      return {
        id: eservice.id,
        name: eservice.name,
        description: eservice.description,
        technology: eservice.technology,
        mode: eservice.mode,
        riskAnalysis: eservice.riskAnalysis.map(
          toBffCatalogApiEserviceRiskAnalysis
        ),
      };
    },
    updateEServiceDescription: async (
      { headers }: WithLogger<BffAppContext>,
      eServiceId: EServiceId,
      updateSeed: bffApi.EServiceDescriptionSeed
    ): Promise<bffApi.CreatedResource> => {
      const updatedEservice =
        await catalogProcessClient.updateEServiceDescription(updateSeed, {
          headers,
          params: {
            eServiceId,
          },
        });

      return {
        id: updatedEservice.id,
      };
    },
    getProducerEServices: async (
      eserviceName: string | undefined,
      consumersIds: string[],
      offset: number,
      limit: number,
      { headers, authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServices> => {
      const producerId = authData.organizationId;
      const response: {
        results: catalogApi.EService[];
        totalCount: number;
      } = {
        results: [],
        totalCount: 0,
      };

      if (consumersIds.length === 0) {
        const { results, totalCount } = await catalogProcessClient.getEServices(
          {
            headers,
            queries: {
              name: eserviceName,
              producersIds: producerId,
              offset,
              limit,
            },
          }
        );

        response.results = results;
        response.totalCount = totalCount;
      } else {
        const eserviceIds: Set<string> = new Set<string>(
          (
            await getAllFromPaginated(async (offset: number, limit: number) =>
              agreementProcessClient.getAgreements({
                headers,
                queries: {
                  consumersIds,
                  producersIds: [producerId],
                  eservicesIds: [],
                  states: [],
                  offset,
                  limit,
                },
              })
            )
          ).map((agreement: agreementApi.Agreement) => agreement.eserviceId)
        );

        if (eserviceIds.size === 0) {
          return {
            results: [],
            pagination: {
              offset,
              limit,
              totalCount: 0,
            },
          };
        }

        const { results, totalCount } = await catalogProcessClient.getEServices(
          {
            headers,
            queries: {
              name: eserviceName,
              eservicesIds: Array.from(eserviceIds),
              producersIds: producerId,
              offset,
              limit,
            },
          }
        );

        response.results = results;
        response.totalCount = totalCount;
      }

      return {
        results: response.results.map(enhanceProducerEService),
        pagination: {
          offset,
          limit,
          totalCount: response.totalCount,
        },
      };
    },
  };
}
