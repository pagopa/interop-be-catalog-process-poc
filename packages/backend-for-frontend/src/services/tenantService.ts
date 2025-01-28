import {
  attributeRegistryApi,
  bffApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { isDefined, WithLogger } from "pagopa-interop-commons";
import {
  AgreementId,
  AttributeId,
  CorrelationId,
  TenantId,
} from "pagopa-interop-models";
import {
  AttributeProcessClient,
  SelfcareV2InstitutionClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  RegistryAttributesMap,
  toBffApiTenant,
  toBffApiCompactTenant,
  toBffApiRequesterCertifiedAttributes,
  toBffApiCertifiedTenantAttributes,
  toBffApiDeclaredTenantAttributes,
  toBffApiVerifiedTenantAttributes,
} from "../api/tenantApiConverter.js";
import { getAllBulkAttributes } from "./attributeService.js";

async function getRegistryAttributesMap(
  tenantAttributesIds: string[],
  attributeRegistryProcessClient: AttributeProcessClient,
  headers: WithLogger<BffAppContext>["headers"]
): Promise<RegistryAttributesMap> {
  const registryAttributes = await getAllBulkAttributes(
    attributeRegistryProcessClient,
    headers,
    tenantAttributesIds
  );

  return new Map(registryAttributes.map((a) => [a.id, a]));
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(
  tenantProcessClient: TenantProcessClient,
  attributeRegistryProcessClient: AttributeProcessClient,
  selfcareV2InstitutionClient: SelfcareV2InstitutionClient
) {
  async function getLogoUrl(
    selfcareId: tenantApi.Tenant["selfcareId"],
    correlationId: CorrelationId
  ): Promise<bffApi.CompactTenant["logoUrl"]> {
    if (!selfcareId) {
      return undefined;
    }

    const institution =
      await selfcareV2InstitutionClient.institution.retrieveInstitutionByIdUsingGET(
        {
          params: {
            id: selfcareId,
          },
          headers: {
            "X-Correlation-Id": correlationId,
          },
        }
      );

    return institution.logo;
  }

  return {
    async getTenant(
      tenantId: TenantId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.Tenant> {
      logger.info(`Getting tenant with id ${tenantId}`);
      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      const certifiedAttributes = tenant.attributes
        .map((v) => v.certified)
        .filter(isDefined);

      const declaredAttributes = tenant.attributes
        .map((v) => v.declared)
        .filter(isDefined);

      const verifiedAttributes = tenant.attributes
        .map((v) => v.verified)
        .filter(isDefined);

      const allAttributeIds = [
        ...certifiedAttributes,
        ...declaredAttributes,
        ...verifiedAttributes,
      ].map((v) => v.id);

      const registryAttributesMap = await getRegistryAttributesMap(
        allAttributeIds,
        attributeRegistryProcessClient,
        headers
      );

      return toBffApiTenant(
        tenant,
        certifiedAttributes,
        declaredAttributes,
        verifiedAttributes,
        registryAttributesMap
      );
    },
    async getTenants(
      name: string | undefined,
      features: tenantApi.TenantFeatureType[] | undefined,
      limit: number,
      { logger, headers, correlationId }: WithLogger<BffAppContext>
    ): Promise<bffApi.Tenants> {
      logger.info(`Getting tenants with name ${name}, limit ${limit}`);
      const offset = 0; // This BFF query gets only the limit as parameter, offset is always 0
      const pagedResults = await tenantProcessClient.tenant.getTenants({
        queries: {
          name,
          features,
          limit,
          offset,
        },
        headers,
      });

      const results = await Promise.all(
        pagedResults.results.map((tenant) =>
          toBffApiCompactTenant(tenant, (selfcareId) =>
            getLogoUrl(selfcareId, correlationId)
          )
        )
      );
      return {
        results,
        pagination: {
          offset,
          limit,
          totalCount: pagedResults.totalCount,
        },
      };
    },
    async getConsumers(
      name: string | undefined,
      offset: number,
      limit: number,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactOrganizations> {
      logger.info(
        `Getting consumers with name ${name}, limit ${limit}, offset ${offset}`
      );
      const { results, totalCount } =
        await tenantProcessClient.tenant.getConsumers({
          queries: {
            name,
            offset,
            limit,
          },
          headers,
        });

      return {
        results: results.map((t) => ({ id: t.id, name: t.name })),
        pagination: {
          offset,
          limit,
          totalCount,
        },
      };
    },
    async getProducers(
      name: string | undefined,
      offset: number,
      limit: number,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactOrganizations> {
      logger.info(
        `Getting producers with name ${name}, limit ${limit}, offset ${offset}`
      );
      const { results, totalCount } =
        await tenantProcessClient.tenant.getProducers({
          queries: {
            name,
            offset,
            limit,
          },
          headers,
        });

      return {
        results: results.map((t) => ({ id: t.id, name: t.name })),
        pagination: {
          offset,
          limit,
          totalCount,
        },
      };
    },
    async getRequesterCertifiedAttributes(
      offset: number,
      limit: number,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.RequesterCertifiedAttributes> {
      logger.info(
        `Getting requester certified attributes with limit ${limit}, offset ${offset}`
      );
      const { results, totalCount } =
        await tenantProcessClient.tenant.getCertifiedAttributes({
          queries: {
            offset,
            limit,
          },
          headers,
        });

      return {
        results: results.map(toBffApiRequesterCertifiedAttributes),
        pagination: {
          offset,
          limit,
          totalCount,
        },
      };
    },
    async getCertifiedAttributes(
      tenantId: TenantId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CertifiedAttributesResponse> {
      logger.info(`Getting certified attributes for tenant ${tenantId}`);
      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      const certifiedAttributes = tenant.attributes
        .map((v) => v.certified)
        .filter(isDefined);

      const registryAttributesMap = await getRegistryAttributesMap(
        certifiedAttributes.map((v) => v.id),
        attributeRegistryProcessClient,
        headers
      );

      const attributes = toBffApiCertifiedTenantAttributes(
        certifiedAttributes,
        registryAttributesMap
      );

      return { attributes };
    },
    async getDeclaredAttributes(
      tenantId: TenantId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.DeclaredAttributesResponse> {
      logger.info(`Getting declared attributes for tenant ${tenantId}`);
      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      const declaredAttributes = tenant.attributes
        .map((v) => v.declared)
        .filter(isDefined);

      const registryAttributesMap = await getRegistryAttributesMap(
        declaredAttributes.map((v) => v.id),
        attributeRegistryProcessClient,
        headers
      );

      const attributes = toBffApiDeclaredTenantAttributes(
        declaredAttributes,
        registryAttributesMap
      );

      return { attributes };
    },
    async getVerifiedAttributes(
      tenantId: TenantId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.VerifiedAttributesResponse> {
      logger.info(`Getting verified attributes for tenant ${tenantId}`);
      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      const verifiedAttributes = tenant.attributes
        .map((v) => v.verified)
        .filter(isDefined);

      const registryAttributesMap = await getRegistryAttributesMap(
        verifiedAttributes.map((v) => v.id),
        attributeRegistryProcessClient,
        headers
      );

      const attributes = toBffApiVerifiedTenantAttributes(
        verifiedAttributes,
        registryAttributesMap
      );

      return { attributes };
    },
    async addCertifiedAttribute(
      tenantId: TenantId,
      seed: bffApi.CertifiedTenantAttributeSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Adding certified attribute ${seed.id} to tenant ${tenantId}`
      );
      await tenantProcessClient.tenantAttribute.addCertifiedAttribute(seed, {
        params: { tenantId },
        headers,
      });
    },
    async addDeclaredAttribute(
      seed: bffApi.DeclaredTenantAttributeSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Adding declared attribute ${seed.id} to requester Tenant`);
      await tenantProcessClient.tenantAttribute.addDeclaredAttribute(seed, {
        headers,
      });
    },
    async verifyVerifiedAttribute(
      tenantId: TenantId,
      seed: bffApi.VerifiedTenantAttributeSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Verifying verified attribute ${seed.id} for tenant ${tenantId}`
      );
      await tenantProcessClient.tenantAttribute.verifyVerifiedAttribute(seed, {
        params: { tenantId },
        headers,
      });
    },
    async updateVerifiedAttribute(
      tenantId: TenantId,
      attributeId: AttributeId,
      seed: bffApi.UpdateVerifiedTenantAttributeSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Updating verified attribute ${attributeId} for tenant ${tenantId}`
      );
      await tenantProcessClient.tenant.updateVerifiedAttribute(seed, {
        params: { tenantId, attributeId },
        headers,
      });
    },
    async revokeDeclaredAttribute(
      attributeId: AttributeId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Revoking declared attribute ${attributeId} for requester Tenant`
      );
      await tenantProcessClient.tenantAttribute.revokeDeclaredAttribute(
        undefined,
        {
          params: { attributeId },
          headers,
        }
      );
    },
    async revokeCertifiedAttribute(
      tenantId: TenantId,
      attributeId: AttributeId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Revoking certified attribute ${attributeId} for tenant ${tenantId}`
      );
      await tenantProcessClient.tenantAttribute.revokeCertifiedAttributeById(
        undefined,
        {
          params: { tenantId, attributeId },
          headers,
        }
      );
    },
    async revokeVerifiedAttribute(
      tenantId: TenantId,
      attributeId: AttributeId,
      agreementId: AgreementId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Revoking verified attribute ${attributeId} for tenant ${tenantId}`
      );
      await tenantProcessClient.tenantAttribute.revokeVerifiedAttribute(
        { agreementId },
        {
          params: { tenantId, attributeId },
          headers,
        }
      );
    },
    async addTenantMail(
      tenantId: TenantId,
      seed: bffApi.MailSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Adding mail ${seed.address} to tenant ${tenantId}`);
      await tenantProcessClient.tenant.addTenantMail(seed, {
        params: { tenantId },
        headers,
      });
    },
    async deleteTenantMail(
      tenantId: TenantId,
      mailId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Deleting mail ${mailId} from tenant ${tenantId}`);
      await tenantProcessClient.tenant.deleteTenantMail(undefined, {
        params: { tenantId, mailId },
        headers,
      });
    },
    async assignTenantDelegatedProducerFeature(
      tenantId: TenantId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Assigning delegated producer feature to tenant ${tenantId}`);
      await tenantProcessClient.tenant.assignTenantDelegatedProducerFeature(
        undefined,
        { headers }
      );
    },
    async removeTenantDelegatedProducerFeature(
      tenantId: TenantId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Removing delegated producer feature to tenant ${tenantId}`);
      await tenantProcessClient.tenant.removeTenantDelegatedProducerFeature(
        undefined,
        { headers }
      );
    },
    async assignTenantDelegatedConsumerFeature(
      tenantId: TenantId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Assigning delegated consumer feature to tenant ${tenantId}`);
      await tenantProcessClient.tenant.assignTenantDelegatedConsumerFeature(
        undefined,
        { headers }
      );
    },
    async removeTenantDelegatedConsumerFeature(
      tenantId: TenantId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Removing delegated consumer feature to tenant ${tenantId}`);
      await tenantProcessClient.tenant.removeTenantDelegatedConsumerFeature(
        undefined,
        { headers }
      );
    },
  };
}

export function enhanceTenantAttributes(
  tenantAttributes: tenantApi.TenantAttribute[],
  registryAttributes: attributeRegistryApi.Attribute[]
): bffApi.TenantAttributes {
  const registryAttributesMap: Map<string, bffApi.Attribute> = new Map(
    registryAttributes.map((attribute) => [attribute.id, attribute])
  );

  const declared = tenantAttributes
    .map((attr) => getDeclaredTenantAttribute(attr, registryAttributesMap))
    .filter(isDefined);

  const certified = tenantAttributes
    .map((attr) => getCertifiedTenantAttribute(attr, registryAttributesMap))
    .filter(isDefined);

  const verified = tenantAttributes
    .map((attr) => toApiVerifiedTenantAttribute(attr, registryAttributesMap))
    .filter(isDefined);

  return {
    certified,
    declared,
    verified,
  };
}

export function getDeclaredTenantAttribute(
  attribute: tenantApi.TenantAttribute,
  registryAttributeMap: Map<string, attributeRegistryApi.Attribute>
): bffApi.DeclaredTenantAttribute | undefined {
  if (!attribute.declared) {
    return undefined;
  }
  const registryAttribute = registryAttributeMap.get(attribute.declared.id);
  if (!registryAttribute) {
    return undefined;
  }

  return {
    id: attribute.declared.id,
    name: registryAttribute.name,
    description: registryAttribute.description,
    assignmentTimestamp: attribute.declared.assignmentTimestamp,
    revocationTimestamp: attribute.declared.revocationTimestamp,
    delegationId: attribute.declared.delegationId,
  };
}

export function getCertifiedTenantAttribute(
  attribute: tenantApi.TenantAttribute,
  registryAttributeMap: Map<string, attributeRegistryApi.Attribute>
): bffApi.CertifiedTenantAttribute | undefined {
  if (!attribute.certified) {
    return undefined;
  }
  const registryAttribute = registryAttributeMap.get(attribute.certified.id);
  if (!registryAttribute) {
    return undefined;
  }

  return {
    id: attribute.certified.id,
    name: registryAttribute.name,
    description: registryAttribute.description,
    assignmentTimestamp: attribute.certified.assignmentTimestamp,
    revocationTimestamp: attribute.certified.revocationTimestamp,
  };
}

export function toApiVerifiedTenantAttribute(
  attribute: tenantApi.TenantAttribute,
  registryAttributeMap: Map<string, attributeRegistryApi.Attribute>
): bffApi.VerifiedTenantAttribute | undefined {
  if (!attribute.verified) {
    return undefined;
  }
  const registryAttribute = registryAttributeMap.get(attribute.verified.id);
  if (!registryAttribute) {
    return undefined;
  }

  return {
    id: attribute.verified.id,
    name: registryAttribute.name,
    description: registryAttribute.description,
    assignmentTimestamp: attribute.verified.assignmentTimestamp,
    verifiedBy: attribute.verified.verifiedBy,
    revokedBy: attribute.verified.revokedBy,
  };
}
