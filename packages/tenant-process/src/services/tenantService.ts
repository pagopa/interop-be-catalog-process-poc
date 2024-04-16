import {
  AuthData,
  DB,
  LoggerCtx,
  eventRepository,
  logger,
} from "pagopa-interop-commons";
import {
  AttributeId,
  ListResult,
  Tenant,
  TenantAttribute,
  TenantId,
  WithMetadata,
  generateId,
  tenantEventToBinaryData,
  ExternalId,
} from "pagopa-interop-models";
import {
  toCreateEventTenantAdded,
  toCreateEventTenantUpdated,
} from "../model/domain/toEvent.js";
import {
  CertifiedAttributeQueryResult,
  UpdateVerifiedTenantAttributeSeed,
} from "../model/domain/models.js";
import { ApiSelfcareTenantSeed } from "../model/types.js";
import { tenantNotFound } from "../model/domain/errors.js";
import {
  assertOrganizationIsInAttributeVerifiers,
  assertValidExpirationDate,
  assertVerifiedAttributeExistsInTenant,
  assertResourceAllowed,
  evaluateNewSelfcareId,
  getTenantKind,
  getTenantKindLoadingCertifiedAttributes,
  assertOrganizationVerifierExist,
  assertExpirationDateExist,
  getTenantCertifierId,
  assertTenantExists,
} from "./validators.js";
import { ReadModelService } from "./readModelService.js";

const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelService
): Promise<WithMetadata<Tenant>> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (tenant === undefined) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService
) {
  const repository = eventRepository(dbInstance, tenantEventToBinaryData);
  return {
    async updateVerifiedAttributeExtensionDate(
      tenantId: TenantId,
      attributeId: AttributeId,
      verifierId: string,
      correlationId: string,
      authData: AuthData
    ): Promise<Tenant> {
      const loggerCtx = {
        userId: authData.userId,
        organizationId: authData.organizationId,
        correlationId,
      };

      logger.info(
        `Update extension date of attribute ${attributeId} for tenant ${tenantId}`,
        loggerCtx
      );
      const tenant = await retrieveTenant(tenantId, readModelService);

      const attribute = tenant.data.attributes.find(
        (att) => att.id === attributeId
      );

      assertVerifiedAttributeExistsInTenant(attributeId, attribute, tenant);

      const oldVerifier = attribute.verifiedBy.find(
        (verifier) => verifier.id === verifierId
      );

      assertOrganizationVerifierExist(
        verifierId,
        tenantId,
        attributeId,
        oldVerifier
      );

      assertExpirationDateExist(
        tenantId,
        attributeId,
        verifierId,
        oldVerifier.expirationDate
      );

      const oldExtensionDate =
        oldVerifier.extensionDate ?? oldVerifier.expirationDate;

      const extensionDate = new Date(
        oldExtensionDate.getTime() +
          (oldVerifier.expirationDate.getTime() -
            oldVerifier.verificationDate.getTime())
      );

      const updatedAttribute: TenantAttribute = {
        ...attribute,
        verifiedBy: attribute.verifiedBy.map((v) =>
          v.id === verifierId
            ? {
                ...v,
                extensionDate,
              }
            : v
        ),
      };

      const updatedTenant: Tenant = {
        ...tenant.data,
        attributes: [
          updatedAttribute,
          ...tenant.data.attributes.filter((a) => a.id !== updatedAttribute.id),
        ],
        updatedAt: new Date(),
      };

      const event = toCreateEventTenantUpdated(
        tenant.data.id,
        tenant.metadata.version,
        updatedTenant,
        correlationId
      );
      await repository.createEvent(event, loggerCtx);
      return updatedTenant;
    },

    async updateTenantVerifiedAttribute(
      {
        verifierId,
        tenantId,
        attributeId,
        updateVerifiedTenantAttributeSeed,
      }: {
        verifierId: string;
        tenantId: TenantId;
        attributeId: AttributeId;
        updateVerifiedTenantAttributeSeed: UpdateVerifiedTenantAttributeSeed;
      },
      correlationId: string,
      authData: AuthData
    ): Promise<Tenant> {
      const loggerCtx = {
        userId: authData.userId,
        organizationId: authData.organizationId,
        correlationId,
      };

      logger.info(
        `Update attribute ${attributeId} to tenant ${tenantId}`,
        loggerCtx
      );
      const tenant = await retrieveTenant(tenantId, readModelService);

      const expirationDate = updateVerifiedTenantAttributeSeed.expirationDate
        ? new Date(updateVerifiedTenantAttributeSeed.expirationDate)
        : undefined;

      assertValidExpirationDate(expirationDate);

      const attribute = tenant.data.attributes.find(
        (att) => att.id === attributeId
      );

      assertVerifiedAttributeExistsInTenant(attributeId, attribute, tenant);
      assertOrganizationIsInAttributeVerifiers(verifierId, tenantId, attribute);

      const updatedAttribute: TenantAttribute = {
        ...attribute,
        verifiedBy: attribute.verifiedBy.map((v) =>
          v.id === verifierId
            ? {
                ...v,
                expirationDate,
              }
            : v
        ),
      };

      const updatedTenant: Tenant = {
        ...tenant.data,
        attributes: [
          updatedAttribute,
          ...tenant.data.attributes.filter((a) => a.id !== updatedAttribute.id),
        ],
        updatedAt: new Date(),
      };
      const event = toCreateEventTenantUpdated(
        tenant.data.id,
        tenant.metadata.version,
        updatedTenant,
        correlationId
      );
      await repository.createEvent(event, loggerCtx);
      return updatedTenant;
    },

    async selfcareUpsertTenant({
      tenantSeed,
      authData,
      correlationId,
    }: {
      tenantSeed: ApiSelfcareTenantSeed;
      authData: AuthData;
      correlationId: string;
    }): Promise<string> {
      const loggerCtx = {
        userId: authData.userId,
        organizationId: authData.organizationId,
        correlationId,
      };

      logger.info(
        `Upsert tenant by selfcare with externalId: ${tenantSeed.externalId}`,
        loggerCtx
      );
      const existingTenant = await readModelService.getTenantByExternalId(
        tenantSeed.externalId
      );
      if (existingTenant) {
        logger.info(
          `Updating tenant with external id ${tenantSeed.externalId} via SelfCare request"`,
          loggerCtx
        );
        await assertResourceAllowed(existingTenant.data.id, authData);

        evaluateNewSelfcareId({
          tenant: existingTenant.data,
          newSelfcareId: tenantSeed.selfcareId,
        });

        const tenantKind = await getTenantKindLoadingCertifiedAttributes(
          readModelService,
          existingTenant.data.attributes,
          existingTenant.data.externalId
        );

        const updatedTenant: Tenant = {
          ...existingTenant.data,
          kind: tenantKind,
          selfcareId: tenantSeed.selfcareId,
          updatedAt: new Date(),
        };

        logger.info(
          `Creating tenant with external id ${tenantSeed.externalId} via SelfCare request"`,
          loggerCtx
        );
        return await repository.createEvent(
          toCreateEventTenantUpdated(
            existingTenant.data.id,
            existingTenant.metadata.version,
            updatedTenant,
            correlationId
          ),
          loggerCtx
        );
      } else {
        logger.info(
          `Creating tenant with external id ${tenantSeed.externalId} via SelfCare request"`,
          loggerCtx
        );
        const newTenant: Tenant = {
          id: generateId(),
          name: tenantSeed.name,
          attributes: [],
          externalId: tenantSeed.externalId,
          features: [],
          mails: [],
          selfcareId: tenantSeed.selfcareId,
          kind: getTenantKind([], tenantSeed.externalId),
          createdAt: new Date(),
        };
        return await repository.createEvent(
          toCreateEventTenantAdded(newTenant, correlationId),
          loggerCtx
        );
      }
    },

    async getCertifiedAttributes({
      organizationId,
      offset,
      limit,
    }: {
      organizationId: TenantId;
      offset: number;
      limit: number;
    }): Promise<ListResult<CertifiedAttributeQueryResult>> {
      const tenant = await readModelService.getTenantById(organizationId);
      assertTenantExists(organizationId, tenant);

      const certifierId = getTenantCertifierId(tenant.data);

      return await readModelService.getCertifiedAttributes({
        certifierId,
        offset,
        limit,
      });
    },

    async getProducers(
      {
        producerName,
        offset,
        limit,
      }: {
        producerName: string | undefined;
        offset: number;
        limit: number;
      },
      loggerCtx: LoggerCtx
    ): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Producers with name = ${producerName}, limit = ${limit}, offset = ${offset}`,
        loggerCtx
      );
      return readModelService.getProducers({ producerName, offset, limit });
    },
    async getConsumers(
      {
        consumerName,
        producerId,
        offset,
        limit,
      }: {
        consumerName: string | undefined;
        producerId: TenantId;
        offset: number;
        limit: number;
      },
      loggerCtx: LoggerCtx
    ): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Consumers with name = ${consumerName}, limit = ${limit}, offset = ${offset}`,
        loggerCtx
      );
      return readModelService.getConsumers({
        consumerName,
        producerId,
        offset,
        limit,
      });
    },
    async getTenantsByName(
      {
        name,
        offset,
        limit,
      }: {
        name: string | undefined;
        offset: number;
        limit: number;
      },
      loggerCtx: LoggerCtx
    ): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Tenants with name = ${name}, limit = ${limit}, offset = ${offset}`,
        loggerCtx
      );
      return readModelService.getTenantsByName({ name, offset, limit });
    },
    async getTenantById(
      id: TenantId,
      loggerCtx: LoggerCtx
    ): Promise<WithMetadata<Tenant> | undefined> {
      logger.info(`Retrieving tenant ${id}`, loggerCtx);
      return readModelService.getTenantById(id);
    },
    async getTenantByExternalId(
      externalId: ExternalId,
      loggerCtx: LoggerCtx
    ): Promise<WithMetadata<Tenant> | undefined> {
      logger.info(
        `Retrieving tenant with origin ${externalId.origin} and code ${externalId.value}`,
        loggerCtx
      );
      return readModelService.getTenantByExternalId(externalId);
    },
    async getTenantBySelfcareId(
      selfcareId: string,
      loggerCtx: LoggerCtx
    ): Promise<WithMetadata<Tenant> | undefined> {
      logger.info(
        `Retrieving Tenant with Selfcare Id ${selfcareId}`,
        loggerCtx
      );
      return readModelService.getTenantBySelfcareId(selfcareId);
    },
  };
}
export type TenantService = ReturnType<typeof tenantServiceBuilder>;
