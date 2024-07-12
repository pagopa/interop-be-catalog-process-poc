/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi, catalogApi, tenantApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { CreatedResource } from "../../../api-clients/dist/bffApi.js";
import { toBffCatalogApiEServiceResponse } from "../model/api/apiConverter.js";
import { descriptorApiState } from "../model/api/catalogTypes.js";
import { catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied } from "../model/validators.js";
import {
  AgreementProcessClient,
  CatalogProcessClient,
  TenantProcessClient,
} from "../providers/clientProvider.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import { getLatestAgreement } from "./agreementService.js";

const ACTIVE_DESCRIPTOR_STATES_FILTER = [
  descriptorApiState.PUBLISHED,
  descriptorApiState.SUSPENDED,
  descriptorApiState.DEPRECATED,
];

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

    const latestActiveDescriptor: catalogApi.EServiceDescriptor | undefined =
      eservice.descriptors
        .filter((d) => ACTIVE_DESCRIPTOR_STATES_FILTER.includes(d.state))
        .sort((a, b) => Number(a.version) - Number(b.version))
        .at(-1);

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

    return toBffCatalogApiEServiceResponse(
      eservice,
      producerTenant,
      hasCertifiedAttributes,
      isRequesterEqProducer,
      latestActiveDescriptor,
      latestAgreement
    );
  };

export function catalogServiceBuilder(
  catalogProcessClient: CatalogProcessClient,
  tenantProcessClient: TenantProcessClient,
  agreementProcessClient: AgreementProcessClient
) {
  return {
    getCatalog: async (
      context: WithLogger<BffAppContext>,
      queries: catalogApi.GetCatalogQueryParam
    ): Promise<bffApi.CatalogEServices> => {
      const requesterId = context.authData.organizationId;
      const { offset, limit } = queries;
      const eservicesResponse: catalogApi.EServices =
        await catalogProcessClient.getEServices({
          headers: context.headers,
          queries: {
            ...queries,
            eservicesIds: queries.eservicesIds.join(","),
            producersIds: queries.producersIds.join(","),
            states: queries.states.join(","),
            attributesIds: queries.attributesIds.join(","),
            agreementStates: queries.agreementStates.join(","),
          },
        });

      const results = await Promise.all(
        eservicesResponse.results.map(
          enhanceCatalogEService(
            tenantProcessClient,
            agreementProcessClient,
            context.headers,
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
    activateDescriptor: async (
      eServiceId: string,
      descriptorId: string,
      headers: Headers
    ): Promise<void> => {
      await catalogProcessClient.activateDescriptor(undefined, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    updateDescriptor: async (
      eServiceId: string,
      descriptorId: string,
      seed: catalogApi.UpdateEServiceDescriptorQuotasSeed,
      headers: Headers
    ): Promise<CreatedResource> => {
      const { id } = await catalogProcessClient.updateDescriptor(seed, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
      return { id };
    },
    publishDescriptor: async (
      eServiceId: string,
      descriptorId: string,
      headers: Headers
    ): Promise<void> => {
      await catalogProcessClient.publishDescriptor(undefined, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    suspendDescriptor: async (
      eServiceId: string,
      descriptorId: string,
      headers: Headers
    ): Promise<void> => {
      await catalogProcessClient.suspendDescriptor(undefined, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
  };
}
