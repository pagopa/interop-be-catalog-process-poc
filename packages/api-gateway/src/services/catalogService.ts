import { apiGatewayApi, catalogApi } from "pagopa-interop-api-clients";
import {
  getAllFromPaginated,
  Logger,
  removeDuplicates,
  WithLogger,
} from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  toApiGatewayCatalogEservice,
  toApiGatewayDescriptorIfIsValid,
  toApiGatewayEserviceAttributes,
  ValidCatalogApiDescriptor,
} from "../api/catalogApiConverter.js";
import { clientStatusCodeToError } from "../clients/catchClientError.js";
import {
  AttributeProcessClient,
  CatalogProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import {
  eserviceDescriptorNotFound,
  eserviceNotFound,
} from "../models/errors.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { getAllBulkAttributes } from "./attributeService.js";
import { getOrganization } from "./tenantService.js";
import {
  assertAvailableDescriptorExists,
  assertIsValidDescriptor,
} from "./validators.js";

export function getAllEservices(
  catalogProcessClient: CatalogProcessClient,
  headers: ApiGatewayAppContext["headers"],
  producerId: catalogApi.EService["producerId"],
  attributeId: catalogApi.Attribute["id"]
): Promise<catalogApi.EService[]> {
  return getAllFromPaginated<catalogApi.EService>(
    async (offset, limit) =>
      await catalogProcessClient.getEServices({
        headers,
        queries: {
          producersIds: [producerId],
          attributesIds: [attributeId],
          offset,
          limit,
        },
      })
  );
}

const retrieveEservice = async (
  catalogProcessClient: CatalogProcessClient,
  headers: ApiGatewayAppContext["headers"],
  eserviceId: catalogApi.EService["id"]
): Promise<catalogApi.EService> =>
  await catalogProcessClient
    .getEServiceById({
      headers,
      params: {
        eServiceId: eserviceId,
      },
    })
    .catch((res) => {
      throw clientStatusCodeToError(res, {
        404: eserviceNotFound(eserviceId),
      });
    });

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function catalogServiceBuilder(
  catalogProcessClient: CatalogProcessClient,
  tenantProcessClient: TenantProcessClient,
  attributeProcessClient: AttributeProcessClient
) {
  return {
    getEservices: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      { offset, limit }: apiGatewayApi.GetEServicesQueryParams
    ): Promise<apiGatewayApi.CatalogEServices> => {
      logger.info("Retrieving EServices");
      const paginatedEservices = await catalogProcessClient.getEServices({
        headers,
        queries: {
          offset,
          limit,
        },
      });

      return {
        results: paginatedEservices.results.map(toApiGatewayCatalogEservice),
        pagination: {
          offset,
          limit,
          totalCount: paginatedEservices.totalCount,
        },
      };
    },
    getEservice: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      eserviceId: catalogApi.EService["id"]
    ): Promise<apiGatewayApi.EService> => {
      logger.info(`Retrieving EService ${eserviceId}`);
      const eservice = await retrieveEservice(
        catalogProcessClient,
        headers,
        eserviceId
      );

      return enhanceEservice(
        tenantProcessClient,
        attributeProcessClient,
        headers,
        eservice,
        logger
      );
    },
    getEserviceDescriptor: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      eserviceId: catalogApi.EService["id"],
      descriptorId: catalogApi.EServiceDescriptor["id"]
    ): Promise<apiGatewayApi.EServiceDescriptor> => {
      logger.info(
        `Retrieving Descriptor ${descriptorId} of EService ${eserviceId}`
      );

      const eservice = await retrieveEservice(
        catalogProcessClient,
        headers,
        eserviceId
      );

      const descriptor = retrieveEserviceDescriptor(eservice, descriptorId);

      return toApiGatewayDescriptorIfIsValid(descriptor, eserviceId, logger);
    },
    getEserviceDescriptors: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      eserviceId: catalogApi.EService["id"]
    ): Promise<apiGatewayApi.EServiceDescriptors> => {
      logger.info(`Retrieving Descriptors of EService ${eserviceId}`);

      const eservice = await retrieveEservice(
        catalogProcessClient,
        headers,
        eserviceId
      );

      const descriptors = eservice.descriptors
        .filter(isValidDescriptorState)
        .map((d) => toApiGatewayDescriptorIfIsValid(d, eserviceId, logger));

      return { descriptors };
    },
  };
}

const isValidDescriptorState = (d: catalogApi.EServiceDescriptor): boolean =>
  match(d.state)
    .with(
      catalogApi.EServiceDescriptorState.Values.ARCHIVED,
      catalogApi.EServiceDescriptorState.Values.DEPRECATED,
      catalogApi.EServiceDescriptorState.Values.PUBLISHED,
      catalogApi.EServiceDescriptorState.Values.SUSPENDED,
      () => true
    )
    .with(
      catalogApi.EServiceDescriptorState.Values.DRAFT,
      catalogApi.EServiceDescriptorState.Values.WAITING_FOR_APPROVAL,
      () => false
    )
    .exhaustive();

function retrieveEserviceDescriptor(
  eservice: catalogApi.EService,
  descriptorId: catalogApi.EServiceDescriptor["id"]
): catalogApi.EServiceDescriptor {
  const descriptor = eservice.descriptors.find((e) => e.id === descriptorId);

  if (!descriptor) {
    throw eserviceDescriptorNotFound(eservice.id, descriptorId);
  }

  return descriptor;
}

function getLatestValidDescriptor(
  eservice: catalogApi.EService,
  logger: Logger
): ValidCatalogApiDescriptor {
  const latestValidDescriptor = eservice.descriptors
    .filter(isValidDescriptorState)
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);

  assertAvailableDescriptorExists(latestValidDescriptor, eservice.id, logger);
  assertIsValidDescriptor(latestValidDescriptor, eservice.id, logger);

  return latestValidDescriptor;
}

async function getDescriptorAttributes(
  attributeProcessClient: AttributeProcessClient,
  headers: ApiGatewayAppContext["headers"],
  descriptor: ValidCatalogApiDescriptor
): Promise<apiGatewayApi.EServiceAttributes> {
  const allDescriptorAttributesIds = removeDuplicates(
    [
      ...descriptor.attributes.certified.flat(),
      ...descriptor.attributes.verified.flat(),
      ...descriptor.attributes.declared.flat(),
    ].map((a) => a.id)
  );

  const allRegistryAttributes = await getAllBulkAttributes(
    attributeProcessClient,
    headers,
    allDescriptorAttributesIds
  );

  return toApiGatewayEserviceAttributes(
    descriptor.attributes,
    allRegistryAttributes
  );
}

export async function enhanceEservice(
  tenantProcessClient: TenantProcessClient,
  attributeProcessClient: AttributeProcessClient,
  headers: ApiGatewayAppContext["headers"],
  eservice: catalogApi.EService,
  logger: Logger
): Promise<apiGatewayApi.EService> {
  const latestValidDescriptor = getLatestValidDescriptor(eservice, logger);
  const descriptorAttributes = await getDescriptorAttributes(
    attributeProcessClient,
    headers,
    latestValidDescriptor
  );

  const producerOrganization = await getOrganization(
    tenantProcessClient,
    attributeProcessClient,
    headers,
    eservice.producerId
  );

  return {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    technology: eservice.technology,
    version: latestValidDescriptor.version,
    attributes: descriptorAttributes,
    state: latestValidDescriptor.state,
    serverUrls: latestValidDescriptor.serverUrls,
    producer: producerOrganization,
    isSignalHubEnabled: eservice.isSignalHubEnabled,
    isDelegable: eservice.isDelegable,
    isClientAccessDelegable: eservice.isClientAccessDelegable,
  };
}
