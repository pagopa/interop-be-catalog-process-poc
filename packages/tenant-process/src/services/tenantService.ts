/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { CreateEvent, eventRepository, initDB } from "pagopa-interop-commons";
import {
  Attribute,
  ExternalId,
  Tenant,
  TenantAttribute,
  TenantEvent,
  TenantFeature,
  TenantKind,
  TenantMail,
  WithMetadata,
  tenantAttributeType,
  tenantEventToBinaryData,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { TenantProcessConfig } from "../utilities/config.js";
import {
  toCreateEventTenantAdded,
  toCreateEventTenantUpdated,
} from "../model/domain/toEvent.js";
import {
  ApiInternalTenantSeed,
  ApiM2MTenantSeed,
  ApiSelfcareTenantSeed,
} from "../model/types.js";
import {
  invalidAttributeStructure,
  tenantDuplicate,
} from "../model/domain/errors.js";
import {
  assertAttributeExists,
  assertExpirationDateExist,
  assertOrganizationVerifierExist,
  assertTenantExists,
  assertVerifiedAttributeExistsInTenant,
} from "./validators.js";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(
  config: TenantProcessConfig,
  readModelService: ReadModelService
) {
  const repository = eventRepository(
    initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    }),
    tenantEventToBinaryData
  );
  return {
    async updateVerifiedAttributeExtensionDate(
      tenantId: string,
      attributeId: string,
      verifierId: string
    ): Promise<string> {
      const tenant = await readModelService.getTenantById(tenantId);

      return await repository.createEvent(
        await updateVerifiedAttributeExtensionDateLogic({
          tenantId,
          attributeId,
          verifierId,
          tenant,
        })
      );
    },
  };
}

export async function updateVerifiedAttributeExtensionDateLogic({
  tenantId,
  attributeId,
  verifierId,
  tenant,
}: {
  tenantId: string;
  attributeId: string;
  verifierId: string;
  tenant: WithMetadata<Tenant> | undefined;
}): Promise<CreateEvent<TenantEvent>> {
  assertTenantExists(tenantId, tenant);

  const attribute = tenant?.data.attributes.find(
    (att) => att.id === attributeId
  );

  assertVerifiedAttributeExistsInTenant(tenantId, attribute, tenant);

  const tenantVerifier = attribute.verifiedBy.find(
    (verifier) => verifier.id === verifierId
  );

  assertOrganizationVerifierExist(
    verifierId,
    tenantId,
    attributeId,
    tenantVerifier
  );

  assertExpirationDateExist(tenantId, attributeId, verifierId, tenantVerifier);

  const extensionDate =
    tenantVerifier.extensionDate ?? tenantVerifier.expirationDate;

  const newAttribute: TenantAttribute = {
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

  const newTenant: Tenant = {
    ...tenant.data,
    attributes: [
      newAttribute,
      ...tenant.data.attributes.filter((a) => a.id !== newAttribute.id),
    ],
    updatedAt: new Date(),
  };

  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    newTenant
  );
}
