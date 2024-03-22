import {
  AuthData,
  CreateEvent,
  DB,
  eventRepository,
} from "pagopa-interop-commons";
import {
  Attribute,
  AttributeId,
  ExternalId,
  Tenant,
  TenantAttribute,
  TenantEvent,
  TenantFeature,
  TenantId,
  TenantKind,
  TenantMail,
  WithMetadata,
  generateId,
  tenantAttributeType,
  tenantEventToBinaryData,
} from "pagopa-interop-models";
import {
  toCreateEventTenantAdded,
  toCreateEventTenantUpdated,
} from "../model/domain/toEvent.js";
import { UpdateVerifiedTenantAttributeSeed } from "../model/domain/models.js";
import {
  ApiInternalTenantSeed,
  ApiM2MTenantSeed,
  ApiSelfcareTenantSeed,
} from "../model/types.js";
import { tenantDuplicate } from "../model/domain/errors.js";
import {
  assertOrganizationIsInAttributeVerifiers,
  assertTenantExists,
  assertValidExpirationDate,
  assertVerifiedAttributeExistsInTenant,
  assertResourceAllowed,
  evaluateNewSelfcareId,
  getTenantKind,
  getTenantKindLoadingCertifiedAttributes,
  assertOrganizationVerifierExist,
  assertExpirationDateExist,
} from "./validators.js";
import { ReadModelService } from "./readModelService.js";

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
      correlationId: string
    ): Promise<string> {
      const tenant = await readModelService.getTenantById(tenantId);

      return await repository.createEvent(
        await updateVerifiedAttributeExtensionDateLogic({
          tenantId,
          attributeId,
          verifierId,
          tenant,
          correlationId,
        })
      );
    },
    async createTenant(
      apiTenantSeed:
        | ApiSelfcareTenantSeed
        | ApiM2MTenantSeed
        | ApiInternalTenantSeed,
      attributesExternalIds: ExternalId[],
      kind: TenantKind,
      correlationId: string
    ): Promise<string> {
      const [attributes, tenant] = await Promise.all([
        readModelService.getAttributesByExternalIds(attributesExternalIds),
        readModelService.getTenantByName(apiTenantSeed.name),
      ]);

      return repository.createEvent(
        createTenantLogic({
          tenant,
          apiTenantSeed,
          kind,
          attributes,
          correlationId,
        })
      );
    },

    async updateTenantVerifiedAttribute({
      verifierId,
      tenantId,
      attributeId,
      updateVerifiedTenantAttributeSeed,
      correlationId,
    }: {
      verifierId: string;
      tenantId: TenantId;
      attributeId: AttributeId;
      updateVerifiedTenantAttributeSeed: UpdateVerifiedTenantAttributeSeed;
      correlationId: string;
    }): Promise<void> {
      const tenant = await readModelService.getTenantById(tenantId);

      await repository.createEvent(
        await updateTenantVerifiedAttributeLogic({
          verifierId,
          tenant,
          tenantId,
          attributeId,
          updateVerifiedTenantAttributeSeed,
          correlationId,
        })
      );
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
      const existingTenant = await readModelService.getTenantByExternalId(
        tenantSeed.externalId
      );
      if (existingTenant) {
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

        return await repository.createEvent(
          toCreateEventTenantUpdated(
            existingTenant.data.id,
            existingTenant.metadata.version,
            updatedTenant,
            correlationId
          )
        );
      } else {
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
          toCreateEventTenantAdded(newTenant, correlationId)
        );
      }
    },
  };
}

async function updateTenantVerifiedAttributeLogic({
  verifierId,
  tenant,
  tenantId,
  attributeId,
  updateVerifiedTenantAttributeSeed,
  correlationId,
}: {
  verifierId: string;
  tenant: WithMetadata<Tenant> | undefined;
  tenantId: TenantId;
  attributeId: AttributeId;
  updateVerifiedTenantAttributeSeed: UpdateVerifiedTenantAttributeSeed;
  correlationId: string;
}): Promise<CreateEvent<TenantEvent>> {
  assertTenantExists(tenantId, tenant);

  const expirationDate = updateVerifiedTenantAttributeSeed.expirationDate
    ? new Date(updateVerifiedTenantAttributeSeed.expirationDate)
    : undefined;

  assertValidExpirationDate(expirationDate);

  const attribute = tenant?.data.attributes.find(
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

  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    updatedTenant,
    correlationId
  );
}

export async function updateTenantLogic({
  tenant,
  selfcareId,
  features,
  mails,
  kind,
  correlationId,
}: {
  tenant: WithMetadata<Tenant>;
  selfcareId: string | undefined;
  features: TenantFeature[];
  mails: TenantMail[];
  kind: TenantKind;
  correlationId: string;
}): Promise<CreateEvent<TenantEvent>> {
  const newTenant: Tenant = {
    ...tenant.data,
    selfcareId,
    features,
    mails,
    kind,
    updatedAt: new Date(),
  };

  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    newTenant,
    correlationId
  );
}

export function createTenantLogic({
  tenant,
  apiTenantSeed,
  kind,
  attributes,
  correlationId,
}: {
  tenant: WithMetadata<Tenant> | undefined;
  apiTenantSeed:
    | ApiSelfcareTenantSeed
    | ApiM2MTenantSeed
    | ApiInternalTenantSeed;
  kind: TenantKind;
  attributes: Attribute[];
  correlationId: string;
}): CreateEvent<TenantEvent> {
  if (tenant) {
    throw tenantDuplicate(apiTenantSeed.name);
  }

  const tenantAttributes: TenantAttribute[] = attributes.map((attribute) => ({
    type: tenantAttributeType.CERTIFIED, // All attributes here are certified
    id: attribute.id,
    assignmentTimestamp: new Date(),
  }));

  const newTenant: Tenant = {
    id: generateId(),
    name: apiTenantSeed.name,
    attributes: tenantAttributes,
    externalId: apiTenantSeed.externalId,
    features: [],
    mails: [],
    createdAt: new Date(),
    kind,
  };

  return toCreateEventTenantAdded(newTenant, correlationId);
}
export type TenantService = ReturnType<typeof tenantServiceBuilder>;

export async function updateVerifiedAttributeExtensionDateLogic({
  tenantId,
  attributeId,
  verifierId,
  tenant,
  correlationId,
}: {
  tenantId: TenantId;
  attributeId: AttributeId;
  verifierId: string;
  tenant: WithMetadata<Tenant> | undefined;
  correlationId: string;
}): Promise<CreateEvent<TenantEvent>> {
  assertTenantExists(tenantId, tenant);

  const attribute = tenant?.data.attributes.find(
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

  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    updatedTenant,
    correlationId
  );
}
