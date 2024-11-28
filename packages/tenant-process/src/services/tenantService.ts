import crypto from "crypto";
import {
  DB,
  eventRepository,
  Logger,
  WithLogger,
  AppContext,
  CreateEvent,
  AuthData,
} from "pagopa-interop-commons";
import {
  Attribute,
  AttributeId,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  ListResult,
  Tenant,
  TenantAttribute,
  TenantId,
  TenantVerifier,
  VerifiedTenantAttribute,
  WithMetadata,
  agreementState,
  attributeKind,
  generateId,
  tenantAttributeType,
  tenantEventToBinaryData,
  unsafeBrandId,
  TenantMail,
  TenantEvent,
  tenantMailKind,
  TenantFeatureCertifier,
  CorrelationId,
  tenantKind,
} from "pagopa-interop-models";
import { ExternalId } from "pagopa-interop-models";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  toCreateEventTenantVerifiedAttributeExpirationUpdated,
  toCreateEventTenantVerifiedAttributeExtensionUpdated,
  toCreateEventTenantOnboardDetailsUpdated,
  toCreateEventTenantOnboarded,
  toCreateEventMaintenanceTenantDeleted,
  toCreateEventTenantCertifiedAttributeAssigned,
  toCreateEventTenantDeclaredAttributeAssigned,
  toCreateEventTenantKindUpdated,
  toCreateEventTenantDeclaredAttributeRevoked,
  toCreateEventTenantCertifiedAttributeRevoked,
  toCreateEventTenantMailDeleted,
  toCreateEventTenantMailAdded,
  toCreateEventTenantVerifiedAttributeAssigned,
  toCreateEventMaintenanceTenantPromotedToCertifier,
  toCreateEventTenantVerifiedAttributeRevoked,
  toCreateEventMaintenanceTenantUpdated,
  toCreateEventTenantDelegatedProducerFeatureAdded,
  toCreateEventTenantDelegatedProducerFeatureRemoved,
} from "../model/domain/toEvent.js";
import {
  attributeAlreadyRevoked,
  attributeDoesNotBelongToCertifier,
  attributeNotFound,
  attributeNotFoundInTenant,
  attributeRevocationNotAllowed,
  attributeVerificationNotAllowed,
  certifiedAttributeAlreadyAssigned,
  certifierWithExistingAttributes,
  mailAlreadyExists,
  mailNotFound,
  tenantIsNotACertifier,
  tenantNotFoundByExternalId,
  tenantNotFoundBySelfcareId,
  tenantNotFound,
  tenantIsAlreadyACertifier,
  verifiedAttributeSelfRevocationNotAllowed,
  expirationDateCannotBeInThePast,
} from "../model/domain/errors.js";
import {
  assertOrganizationIsInAttributeVerifiers,
  assertValidExpirationDate,
  assertVerifiedAttributeExistsInTenant,
  assertResourceAllowed,
  evaluateNewSelfcareId,
  getTenantKindLoadingCertifiedAttributes,
  assertOrganizationVerifierExist,
  assertExpirationDateExist,
  assertRequesterAllowed,
  assertVerifiedAttributeOperationAllowed,
  retrieveCertifierId,
  assertRequesterIPAOrigin,
  assertDelegatedProducerFeatureNotAssigned,
  getTenantKind,
  assertDelegatedProducerFeatureAssigned,
} from "./validators.js";
import { ReadModelService } from "./readModelService.js";

const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelService
): Promise<WithMetadata<Tenant>> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

const retrieveTenantByExternalId = async ({
  tenantOrigin,
  tenantExternalId,
  readModelService,
}: {
  tenantOrigin: string;
  tenantExternalId: string;
  readModelService: ReadModelService;
}): Promise<WithMetadata<Tenant>> => {
  const tenant = await readModelService.getTenantByExternalId({
    origin: tenantOrigin,
    value: tenantExternalId,
  });
  if (!tenant) {
    throw tenantNotFoundByExternalId(tenantOrigin, tenantExternalId);
  }
  return tenant;
};

export async function retrieveAttribute(
  attributeId: AttributeId,
  readModelService: ReadModelService
): Promise<Attribute> {
  const attribute = await readModelService.getAttributeById(attributeId);
  if (!attribute) {
    throw attributeNotFound(attributeId);
  }
  return attribute;
}

async function retrieveCertifiedAttribute({
  attributeOrigin,
  attributeExternalId,
  readModelService,
}: {
  attributeOrigin: string;
  attributeExternalId: string;
  readModelService: ReadModelService;
}): Promise<Attribute> {
  const attribute = await readModelService.getAttributeByOriginAndCode({
    origin: attributeOrigin,
    code: attributeExternalId,
  });

  if (!attribute) {
    throw attributeNotFound(`${attributeOrigin}/${attributeExternalId}`);
  }
  return attribute;
}

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
      { correlationId, logger }: WithLogger<AppContext>
    ): Promise<Tenant> {
      logger.info(
        `Update extension date of attribute ${attributeId} for tenant ${tenantId}`
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

      const event = toCreateEventTenantVerifiedAttributeExtensionUpdated(
        tenant.data.id,
        tenant.metadata.version,
        updatedTenant,
        attributeId,
        correlationId
      );
      await repository.createEvent(event);
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
        updateVerifiedTenantAttributeSeed: tenantApi.UpdateVerifiedTenantAttributeSeed;
      },
      { correlationId, logger }: WithLogger<AppContext>
    ): Promise<Tenant> {
      logger.info(`Update attribute ${attributeId} to tenant ${tenantId}`);
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
      const event = toCreateEventTenantVerifiedAttributeExpirationUpdated(
        tenant.data.id,
        tenant.metadata.version,
        updatedTenant,
        attributeId,
        correlationId
      );
      await repository.createEvent(event);
      return updatedTenant;
    },

    async selfcareUpsertTenant(
      tenantSeed: tenantApi.SelfcareTenantSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<string> {
      logger.info(
        `Upsert tenant by selfcare with externalId: ${tenantSeed.externalId}`
      );
      const existingTenant = await readModelService.getTenantByExternalId(
        tenantSeed.externalId
      );
      if (existingTenant) {
        logger.info(
          `Updating tenant with external id ${tenantSeed.externalId} via SelfCare request"`
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
          `Creating tenant with external id ${tenantSeed.externalId} via SelfCare request"`
        );
        return await repository.createEvent(
          toCreateEventTenantOnboardDetailsUpdated(
            existingTenant.data.id,
            existingTenant.metadata.version,
            updatedTenant,
            correlationId
          )
        );
      } else {
        logger.info(
          `Creating tenant with external id ${tenantSeed.externalId} via SelfCare request"`
        );
        const mails = tenantSeed.digitalAddress
          ? [
              {
                id: crypto
                  .createHash("sha256")
                  .update(tenantSeed.digitalAddress.address)
                  .digest("hex"),
                kind: tenantMailKind.DigitalAddress,
                address: tenantSeed.digitalAddress.address,
                description: tenantSeed.digitalAddress.description,
                createdAt: new Date(),
              },
            ]
          : [];

        const newTenant: Tenant = {
          id: generateId(),
          name: tenantSeed.name,
          attributes: [],
          externalId: tenantSeed.externalId,
          features: [],
          mails,
          selfcareId: tenantSeed.selfcareId,
          onboardedAt: new Date(tenantSeed.onboardedAt),
          subUnitType: tenantSeed.subUnitType,
          createdAt: new Date(),
          kind:
            getTenantKind([], tenantSeed.externalId) === tenantKind.SCP
              ? tenantKind.SCP
              : undefined,
        };
        return await repository.createEvent(
          toCreateEventTenantOnboarded(newTenant, correlationId)
        );
      }
    },

    async revokeDeclaredAttribute(
      {
        attributeId,
        organizationId,
        correlationId,
      }: {
        attributeId: AttributeId;
        organizationId: TenantId;
        correlationId: CorrelationId;
      },
      logger: Logger
    ): Promise<Tenant> {
      logger.info(
        `Revoking declared attribute ${attributeId} to tenant ${organizationId}`
      );
      const requesterTenant = await retrieveTenant(
        organizationId,
        readModelService
      );

      const declaredTenantAttribute = requesterTenant.data.attributes.find(
        (attr): attr is DeclaredTenantAttribute =>
          attr.id === attributeId && attr.type === tenantAttributeType.DECLARED
      );

      if (!declaredTenantAttribute) {
        throw attributeNotFound(attributeId);
      }

      const updatedTenant: Tenant = {
        ...requesterTenant.data,
        updatedAt: new Date(),
        attributes: requesterTenant.data.attributes.map((declaredAttribute) =>
          declaredAttribute.id === attributeId
            ? {
                ...declaredAttribute,
                revocationTimestamp: new Date(),
              }
            : declaredAttribute
        ),
      };

      await repository.createEvent(
        toCreateEventTenantDeclaredAttributeRevoked(
          requesterTenant.metadata.version,
          updatedTenant,
          unsafeBrandId(attributeId),
          correlationId
        )
      );
      return updatedTenant;
    },

    async addCertifiedAttribute(
      {
        tenantId,
        tenantAttributeSeed,
        organizationId,
        correlationId,
      }: {
        tenantId: TenantId;
        tenantAttributeSeed: tenantApi.CertifiedTenantAttributeSeed;
        organizationId: TenantId;
        correlationId: CorrelationId;
      },
      logger: Logger
    ): Promise<Tenant> {
      logger.info(
        `Add certified attribute ${tenantAttributeSeed.id} to tenant ${tenantId}`
      );

      const requesterTenant = await retrieveTenant(
        organizationId,
        readModelService
      );

      const certifierId = retrieveCertifierId(requesterTenant.data);

      const attribute = await retrieveAttribute(
        unsafeBrandId(tenantAttributeSeed.id),
        readModelService
      );

      if (attribute.kind !== attributeKind.certified) {
        throw attributeNotFound(attribute.id);
      }

      if (!attribute.origin || attribute.origin !== certifierId) {
        throw attributeDoesNotBelongToCertifier(
          attribute.id,
          organizationId,
          tenantId
        );
      }

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const tenantWithNewAttribute = assignCertifiedAttribute({
        targetTenant: targetTenant.data,
        attribute,
      });

      const tenantCertifiedAttributeAssignedEvent =
        toCreateEventTenantCertifiedAttributeAssigned(
          targetTenant.metadata.version,
          tenantWithNewAttribute,
          attribute.id,
          correlationId
        );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithNewAttribute.attributes,
        tenantWithNewAttribute.externalId
      );

      const updatedTenant = {
        ...tenantWithNewAttribute,
        kind: tenantKind,
      };

      if (tenantWithNewAttribute.kind !== tenantKind) {
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          targetTenant.metadata.version + 1,
          targetTenant.data.kind,
          updatedTenant,
          correlationId
        );

        await repository.createEvents([
          tenantCertifiedAttributeAssignedEvent,
          tenantKindUpdatedEvent,
        ]);
      } else {
        await repository.createEvent(tenantCertifiedAttributeAssignedEvent);
      }

      return updatedTenant;
    },

    async addDeclaredAttribute(
      {
        tenantAttributeSeed,
        organizationId,
        correlationId,
      }: {
        tenantAttributeSeed: tenantApi.DeclaredTenantAttributeSeed;
        organizationId: TenantId;
        correlationId: CorrelationId;
      },
      logger: Logger
    ): Promise<Tenant> {
      logger.info(
        `Add declared attribute ${tenantAttributeSeed.id} to requester tenant ${organizationId}`
      );
      const targetTenant = await retrieveTenant(
        organizationId,
        readModelService
      );
      const attribute = await retrieveAttribute(
        unsafeBrandId(tenantAttributeSeed.id),
        readModelService
      );

      if (attribute.kind !== attributeKind.declared) {
        throw attributeNotFound(attribute.id);
      }

      const declaredTenantAttribute = targetTenant.data.attributes.find(
        (attr): attr is DeclaredTenantAttribute =>
          attr.type === tenantAttributeType.DECLARED && attr.id === attribute.id
      );

      const updatedTenant: Tenant = {
        ...targetTenant.data,
        attributes: declaredTenantAttribute
          ? reassignDeclaredAttribute(
              targetTenant.data.attributes,
              attribute.id
            )
          : assignDeclaredAttribute(targetTenant.data.attributes, attribute.id),

        updatedAt: new Date(),
      };

      await repository.createEvent(
        toCreateEventTenantDeclaredAttributeAssigned(
          targetTenant.metadata.version,
          updatedTenant,
          unsafeBrandId(tenantAttributeSeed.id),
          correlationId
        )
      );
      return updatedTenant;
    },

    async revokeCertifiedAttributeById(
      {
        tenantId,
        attributeId,
      }: {
        tenantId: TenantId;
        attributeId: AttributeId;
      },
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Revoke certified attribute ${attributeId} to tenantId ${tenantId}`
      );
      const requesterTenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      const certifierId = retrieveCertifierId(requesterTenant.data);

      const attribute = await retrieveAttribute(attributeId, readModelService);

      if (attribute.kind !== attributeKind.certified) {
        throw attributeNotFound(attribute.id);
      }

      if (!attribute.origin || attribute.origin !== certifierId) {
        throw attributeDoesNotBelongToCertifier(
          attribute.id,
          authData.organizationId,
          tenantId
        );
      }

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const certifiedTenantAttribute = targetTenant.data.attributes.find(
        (attr): attr is CertifiedTenantAttribute =>
          attr.type === tenantAttributeType.CERTIFIED && attr.id === attributeId
      );

      if (!certifiedTenantAttribute) {
        throw attributeNotFound(attributeId);
      }

      if (certifiedTenantAttribute.revocationTimestamp) {
        throw attributeAlreadyRevoked(
          tenantId,
          authData.organizationId,
          attributeId
        );
      }

      const tenantWithRevokedAttribute: Tenant = await revokeCertifiedAttribute(
        targetTenant.data,
        attributeId
      );

      const tenantCertifiedAttributeRevokedEvent =
        toCreateEventTenantCertifiedAttributeRevoked(
          targetTenant.metadata.version,
          tenantWithRevokedAttribute,
          attributeId,
          correlationId
        );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithRevokedAttribute.attributes,
        tenantWithRevokedAttribute.externalId
      );

      if (tenantWithRevokedAttribute.kind !== tenantKind) {
        const updatedTenant = {
          ...tenantWithRevokedAttribute,
          kind: tenantKind,
        };

        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          targetTenant.metadata.version + 1,
          targetTenant.data.kind,
          updatedTenant,
          correlationId
        );

        await repository.createEvents([
          tenantCertifiedAttributeRevokedEvent,
          tenantKindUpdatedEvent,
        ]);
      } else {
        await repository.createEvent(tenantCertifiedAttributeRevokedEvent);
      }
    },

    async verifyVerifiedAttribute(
      {
        tenantId,
        tenantAttributeSeed,
        organizationId,
        correlationId,
      }: {
        tenantId: TenantId;
        tenantAttributeSeed: tenantApi.VerifiedTenantAttributeSeed;
        organizationId: TenantId;
        correlationId: CorrelationId;
      },
      logger: Logger
    ): Promise<Tenant> {
      logger.info(
        `Verifying attribute ${tenantAttributeSeed.id} to tenant ${tenantId}`
      );

      const attributeId = unsafeBrandId<AttributeId>(tenantAttributeSeed.id);

      const allowedStatuses = [
        agreementState.pending,
        agreementState.active,
        agreementState.suspended,
      ];
      await assertVerifiedAttributeOperationAllowed({
        producerId: organizationId,
        consumerId: tenantId,
        attributeId,
        agreementStates: allowedStatuses,
        readModelService,
        error: attributeVerificationNotAllowed(tenantId, attributeId),
      });

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const attribute = await retrieveAttribute(attributeId, readModelService);

      if (attribute.kind !== attributeKind.verified) {
        throw attributeNotFound(attribute.id);
      }

      const verifiedTenantAttribute = targetTenant.data.attributes.find(
        (attr): attr is VerifiedTenantAttribute =>
          attr.type === tenantAttributeType.VERIFIED && attr.id === attribute.id
      );

      const updatedTenant: Tenant = {
        ...targetTenant.data,
        attributes: verifiedTenantAttribute
          ? reassignVerifiedAttribute(
              targetTenant.data.attributes,
              verifiedTenantAttribute,
              organizationId,
              tenantAttributeSeed
            )
          : assignVerifiedAttribute(
              targetTenant.data.attributes,
              organizationId,
              tenantAttributeSeed
            ),

        updatedAt: new Date(),
      };

      await repository.createEvent(
        toCreateEventTenantVerifiedAttributeAssigned(
          targetTenant.metadata.version,
          updatedTenant,
          unsafeBrandId(tenantAttributeSeed.id),
          correlationId
        )
      );
      return updatedTenant;
    },

    async revokeVerifiedAttribute(
      {
        tenantId,
        attributeId,
      }: {
        tenantId: TenantId;
        attributeId: AttributeId;
      },
      { logger, authData, correlationId }: WithLogger<AppContext>
    ): Promise<Tenant> {
      logger.info(
        `Revoking verified attribute ${attributeId} to tenant ${tenantId}`
      );

      if (authData.organizationId === tenantId) {
        throw verifiedAttributeSelfRevocationNotAllowed();
      }

      const allowedStatuses = [
        agreementState.pending,
        agreementState.active,
        agreementState.suspended,
      ];

      await assertVerifiedAttributeOperationAllowed({
        producerId: authData.organizationId,
        consumerId: tenantId,
        attributeId,
        agreementStates: allowedStatuses,
        readModelService,
        error: attributeRevocationNotAllowed(tenantId, attributeId),
      });

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const verifiedTenantAttribute = targetTenant.data.attributes.find(
        (attr): attr is VerifiedTenantAttribute =>
          attr.type === tenantAttributeType.VERIFIED && attr.id === attributeId
      );

      if (!verifiedTenantAttribute) {
        throw attributeNotFound(attributeId);
      }

      const verifier = verifiedTenantAttribute.verifiedBy.find(
        (a) => a.id === authData.organizationId
      );

      if (!verifier) {
        throw attributeRevocationNotAllowed(tenantId, attributeId);
      }

      const isInRevokedBy = verifiedTenantAttribute.revokedBy.some(
        (a) => a.id === authData.organizationId
      );

      if (isInRevokedBy) {
        throw attributeAlreadyRevoked(
          tenantId,
          authData.organizationId,
          attributeId
        );
      }

      const updatedTenant: Tenant = {
        ...targetTenant.data,
        updatedAt: new Date(),
        attributes: targetTenant.data.attributes.map((attr) =>
          attr.id === attributeId
            ? ({
                ...verifiedTenantAttribute,
                verifiedBy: verifiedTenantAttribute.verifiedBy.filter(
                  (v) => v.id !== authData.organizationId
                ),
                revokedBy: [
                  ...verifiedTenantAttribute.revokedBy,
                  {
                    ...verifier,
                    revocationDate: new Date(),
                  },
                ],
              } satisfies VerifiedTenantAttribute)
            : attr
        ),
      };
      await repository.createEvent(
        toCreateEventTenantVerifiedAttributeRevoked(
          targetTenant.metadata.version,
          updatedTenant,
          attributeId,
          correlationId
        )
      );
      return updatedTenant;
    },

    async internalAssignCertifiedAttribute(
      {
        tenantOrigin,
        tenantExternalId,
        attributeOrigin,
        attributeExternalId,
        correlationId,
      }: {
        tenantOrigin: string;
        tenantExternalId: string;
        attributeOrigin: string;
        attributeExternalId: string;
        correlationId: CorrelationId;
      },
      logger: Logger
    ): Promise<void> {
      logger.info(
        `Assigning certified attribute (${attributeOrigin}/${attributeExternalId}) to tenant (${tenantOrigin}/${tenantExternalId})`
      );

      const tenantToModify = await retrieveTenantByExternalId({
        tenantOrigin,
        tenantExternalId,
        readModelService,
      });

      const attributeToAssign = await retrieveCertifiedAttribute({
        attributeOrigin,
        attributeExternalId,
        readModelService,
      });

      const tenantWithNewAttribute = assignCertifiedAttribute({
        targetTenant: tenantToModify.data,
        attribute: attributeToAssign,
      });

      const tenantCertifiedAttributeAssignedEvent =
        toCreateEventTenantCertifiedAttributeAssigned(
          tenantToModify.metadata.version,
          tenantWithNewAttribute,
          attributeToAssign.id,
          correlationId
        );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithNewAttribute.attributes,
        tenantWithNewAttribute.externalId
      );

      if (tenantWithNewAttribute.kind !== tenantKind) {
        const updatedTenant: Tenant = {
          ...tenantWithNewAttribute,
          kind: tenantKind,
        };

        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          tenantToModify.metadata.version + 1,
          tenantToModify.data.kind,
          updatedTenant,
          correlationId
        );

        await repository.createEvents([
          tenantCertifiedAttributeAssignedEvent,
          tenantKindUpdatedEvent,
        ]);
      } else {
        await repository.createEvent(tenantCertifiedAttributeAssignedEvent);
      }
    },

    async internalRevokeCertifiedAttribute(
      {
        tenantOrigin,
        tenantExternalId,
        attributeOrigin,
        attributeExternalId,
        correlationId,
      }: {
        tenantOrigin: string;
        tenantExternalId: string;
        attributeOrigin: string;
        attributeExternalId: string;
        correlationId: CorrelationId;
      },
      logger: Logger
    ): Promise<void> {
      logger.info(
        `Revoking certified attribute (${attributeOrigin}/${attributeExternalId}) from tenant (${tenantOrigin}/${tenantExternalId})`
      );

      const tenantToModify = await retrieveTenantByExternalId({
        tenantOrigin,
        tenantExternalId,
        readModelService,
      });

      const attributeToRevoke = await retrieveCertifiedAttribute({
        attributeOrigin,
        attributeExternalId,
        readModelService,
      });

      const certifiedAttribute = tenantToModify.data.attributes.find(
        (attr): attr is CertifiedTenantAttribute =>
          attr.type === tenantAttributeType.CERTIFIED &&
          attr.id === attributeToRevoke.id
      );

      if (!certifiedAttribute) {
        throw attributeNotFoundInTenant(
          attributeToRevoke.id,
          tenantToModify.data.id
        );
      }

      const tenantWithRevokedAttribute = await revokeCertifiedAttribute(
        tenantToModify.data,
        attributeToRevoke.id
      );

      const tenantCertifiedAttributeRevokedEvent =
        toCreateEventTenantCertifiedAttributeRevoked(
          tenantToModify.metadata.version,
          tenantWithRevokedAttribute,
          attributeToRevoke.id,
          correlationId
        );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithRevokedAttribute.attributes,
        tenantWithRevokedAttribute.externalId
      );

      if (tenantWithRevokedAttribute.kind !== tenantKind) {
        const updatedTenant: Tenant = {
          ...tenantWithRevokedAttribute,
          kind: tenantKind,
        };
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          tenantToModify.metadata.version + 1,
          tenantToModify.data.kind,
          updatedTenant,
          correlationId
        );

        await repository.createEvents([
          tenantCertifiedAttributeRevokedEvent,
          tenantKindUpdatedEvent,
        ]);
      } else {
        await repository.createEvent(tenantCertifiedAttributeRevokedEvent);
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
    }): Promise<ListResult<tenantApi.CertifiedAttribute>> {
      const tenant = await retrieveTenant(organizationId, readModelService);

      const certifierId = retrieveCertifierId(tenant.data);

      return await readModelService.getCertifiedAttributes({
        certifierId,
        offset,
        limit,
      });
    },

    async maintenanceTenantDelete(
      {
        tenantId,
        version,
        correlationId,
      }: {
        tenantId: TenantId;
        version: number;
        correlationId: CorrelationId;
      },
      logger: Logger
    ): Promise<void> {
      logger.info(`Deleting Tenant ${tenantId}`);

      const tenant = await retrieveTenant(tenantId, readModelService);

      await repository.createEvent(
        toCreateEventMaintenanceTenantDeleted(
          version,
          tenant.data,
          correlationId
        )
      );
    },

    async maintenanceTenantUpdate(
      {
        tenantId,
        tenantUpdate,
        version,
        correlationId,
      }: {
        tenantId: TenantId;
        tenantUpdate: tenantApi.MaintenanceTenantUpdate;
        version: number;
        correlationId: CorrelationId;
      },
      logger: Logger
    ): Promise<void> {
      logger.info(`Maintenance update Tenant ${tenantId}`);

      const tenant = await retrieveTenant(tenantId, readModelService);

      const convertedTenantUpdate = {
        ...tenantUpdate,
        mails: tenantUpdate.mails.map((mail) => ({
          ...mail,
          createdAt: new Date(mail.createdAt),
        })),
        onboardedAt: new Date(tenantUpdate.onboardedAt),
      };

      const updatedTenant: Tenant = {
        ...tenant.data,
        ...convertedTenantUpdate,
        subUnitType: convertedTenantUpdate.subUnitType,
        updatedAt: new Date(),
      };

      await repository.createEvent(
        toCreateEventMaintenanceTenantUpdated(
          version,
          updatedTenant,
          correlationId
        )
      );
    },

    async deleteTenantMailById(
      {
        tenantId,
        mailId,
        organizationId,
        correlationId,
      }: {
        tenantId: TenantId;
        mailId: string;
        organizationId: TenantId;
        correlationId: CorrelationId;
      },
      logger: Logger
    ): Promise<void> {
      logger.info(`Deleting mail ${mailId} to Tenant ${tenantId}`);

      await assertRequesterAllowed(tenantId, organizationId);

      const tenant = await retrieveTenant(tenantId, readModelService);

      if (!tenant.data.mails.find((m) => m.id === mailId)) {
        throw mailNotFound(mailId);
      }

      const updatedTenant: Tenant = {
        ...tenant.data,
        mails: tenant.data.mails.filter((mail) => mail.id !== mailId),
        updatedAt: new Date(),
      };

      await repository.createEvent(
        toCreateEventTenantMailDeleted(
          tenant.metadata.version,
          updatedTenant,
          mailId,
          correlationId
        )
      );
    },

    async addTenantMail(
      {
        tenantId,
        mailSeed,
        organizationId,
        correlationId,
      }: {
        tenantId: TenantId;
        mailSeed: tenantApi.MailSeed;
        organizationId: TenantId;
        correlationId: CorrelationId;
      },
      logger: Logger
    ): Promise<void> {
      logger.info(`Adding mail of kind ${mailSeed.kind} to Tenant ${tenantId}`);

      await assertRequesterAllowed(tenantId, organizationId);

      const tenant = await retrieveTenant(tenantId, readModelService);

      if (tenant.data.mails.find((m) => m.address === mailSeed.address)) {
        throw mailAlreadyExists();
      }

      const newMail: TenantMail = {
        kind: mailSeed.kind,
        address: mailSeed.address,
        description: mailSeed.description,
        id: crypto.createHash("sha256").update(mailSeed.address).digest("hex"),
        createdAt: new Date(),
      };

      const updatedTenant: Tenant = {
        ...tenant.data,
        mails: [...tenant.data.mails, newMail],
        updatedAt: new Date(),
      };

      await repository.createEvent(
        toCreateEventTenantMailAdded(
          tenant.metadata.version,
          updatedTenant,
          newMail.id,
          correlationId
        )
      );
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
      logger: Logger
    ): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Producers with name = ${producerName}, limit = ${limit}, offset = ${offset}`
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
      logger: Logger
    ): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Consumers with name = ${consumerName}, limit = ${limit}, offset = ${offset}`
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
      logger: Logger
    ): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Tenants with name = ${name}, limit = ${limit}, offset = ${offset}`
      );
      return readModelService.getTenantsByName({ name, offset, limit });
    },
    async getTenantById(id: TenantId, logger: Logger): Promise<Tenant> {
      logger.info(`Retrieving tenant ${id}`);
      const tenant = await retrieveTenant(id, readModelService);

      return tenant.data;
    },
    async getTenantByExternalId(
      externalId: ExternalId,
      logger: Logger
    ): Promise<Tenant> {
      logger.info(
        `Retrieving tenant with origin ${externalId.origin} and code ${externalId.value}`
      );
      const tenant = await retrieveTenantByExternalId({
        tenantOrigin: externalId.origin,
        tenantExternalId: externalId.value,
        readModelService,
      });

      return tenant.data;
    },
    async getTenantBySelfcareId(
      selfcareId: string,
      logger: Logger
    ): Promise<Tenant> {
      logger.info(`Retrieving Tenant with Selfcare Id ${selfcareId}`);
      const tenant = await readModelService.getTenantBySelfcareId(selfcareId);
      if (!tenant) {
        throw tenantNotFoundBySelfcareId(selfcareId);
      }
      return tenant.data;
    },
    async internalUpsertTenant(
      internalTenantSeed: tenantApi.InternalTenantSeed,
      { correlationId, logger }: WithLogger<AppContext>
    ): Promise<Tenant> {
      logger.info(
        `Updating tenant with external id ${internalTenantSeed.externalId} via internal request`
      );

      const existingTenant = await retrieveTenantByExternalId({
        tenantOrigin: internalTenantSeed.externalId.origin,
        tenantExternalId: internalTenantSeed.externalId.value,
        readModelService,
      });

      const attributesExternalIds = internalTenantSeed.certifiedAttributes.map(
        (externalId) =>
          ({
            value: externalId.code,
            origin: externalId.origin,
          } satisfies ExternalId)
      );

      const existingAttributes =
        await readModelService.getAttributesByExternalIds(
          attributesExternalIds
        );

      attributesExternalIds.forEach((attributeToAssign) => {
        if (
          !existingAttributes.some(
            (a) =>
              a?.origin === attributeToAssign.origin &&
              a?.code === attributeToAssign.value
          )
        ) {
          throw attributeNotFound(
            `${attributeToAssign.origin}/${attributeToAssign.value}`
          );
        }
      });

      const { events, tenantWithNewAttributes } = existingAttributes.reduce(
        (
          acc: {
            events: Array<CreateEvent<TenantEvent>>;
            tenantWithNewAttributes: Tenant;
          },
          attribute: Attribute,
          index
        ) => {
          const tenantWithNewAttribute = assignCertifiedAttribute({
            targetTenant: acc.tenantWithNewAttributes,
            attribute,
          });

          const version = existingTenant.metadata.version + index;
          const attributeAssignmentEvent =
            toCreateEventTenantCertifiedAttributeAssigned(
              version,
              tenantWithNewAttribute,
              attribute.id,
              correlationId
            );
          return {
            events: [...acc.events, attributeAssignmentEvent],
            tenantWithNewAttributes: tenantWithNewAttribute,
          };
        },
        {
          events: [],
          tenantWithNewAttributes: existingTenant.data,
        }
      );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithNewAttributes.attributes,
        internalTenantSeed.externalId
      );

      const tenantWithUpdatedKind: Tenant = {
        ...tenantWithNewAttributes,
        kind: tenantKind,
      };

      if (existingTenant.data.kind !== tenantKind) {
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          existingTenant.metadata.version + events.length,
          existingTenant.data.kind,
          tenantWithUpdatedKind,
          correlationId
        );

        await repository.createEvents([...events, tenantKindUpdatedEvent]);
      } else {
        await repository.createEvents([...events]);
      }

      return tenantWithUpdatedKind;
    },
    async m2mUpsertTenant(
      m2mTenantSeed: tenantApi.M2MTenantSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Tenant> {
      logger.info(
        `Updating tenant with external id ${m2mTenantSeed.externalId} via m2m request`
      );

      const requesterTenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      const certifierId = retrieveCertifierId(requesterTenant.data);

      const existingTenant = await retrieveTenantByExternalId({
        tenantOrigin: m2mTenantSeed.externalId.origin,
        tenantExternalId: m2mTenantSeed.externalId.value,
        readModelService,
      });

      const attributesExternalIds = m2mTenantSeed.certifiedAttributes.map(
        (externalId) =>
          ({
            value: externalId.code,
            origin: certifierId,
          } satisfies ExternalId)
      );

      const existingAttributes =
        await readModelService.getAttributesByExternalIds(
          attributesExternalIds
        );

      attributesExternalIds.forEach((attributeToAssign) => {
        if (
          !existingAttributes.some(
            (attr) =>
              attr?.origin === attributeToAssign.origin &&
              attr?.code === attributeToAssign.value
          )
        ) {
          throw attributeNotFound(
            `${attributeToAssign.origin}/${attributeToAssign.value}`
          );
        }
      });
      const { events, tenantWithNewAttributes } = existingAttributes.reduce(
        (
          accumulator: {
            events: Array<CreateEvent<TenantEvent>>;
            tenantWithNewAttributes: Tenant;
          },
          attribute: Attribute,
          index
        ) => {
          const tenantWithNewAttribute = assignCertifiedAttribute({
            targetTenant: accumulator.tenantWithNewAttributes,
            attribute,
          });

          const version = existingTenant.metadata.version + index;
          const attributeAssignmentEvent =
            toCreateEventTenantCertifiedAttributeAssigned(
              version,
              tenantWithNewAttribute,
              attribute.id,
              correlationId
            );
          return {
            events: [...accumulator.events, attributeAssignmentEvent],
            tenantWithNewAttributes: tenantWithNewAttribute,
          };
        },
        {
          events: [],
          tenantWithNewAttributes: existingTenant.data,
        }
      );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithNewAttributes.attributes,
        m2mTenantSeed.externalId
      );

      const tenantWithUpdatedKind: Tenant = {
        ...tenantWithNewAttributes,
        kind: tenantKind,
      };

      if (existingTenant.data.kind !== tenantKind) {
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          existingTenant.metadata.version + events.length,
          existingTenant.data.kind,
          tenantWithUpdatedKind,
          correlationId
        );

        await repository.createEvents([...events, tenantKindUpdatedEvent]);
      } else {
        await repository.createEvents([...events]);
      }

      return tenantWithUpdatedKind;
    },

    async addCertifierId(
      {
        tenantId,
        certifierId,
        correlationId,
      }: {
        tenantId: TenantId;
        certifierId: string;
        correlationId: CorrelationId;
      },
      logger: Logger
    ): Promise<Tenant> {
      logger.info(`Adding certifierId to Tenant ${tenantId}`);

      const tenant = await retrieveTenant(tenantId, readModelService);

      const certifierFeature = tenant.data.features.find(
        (a): a is TenantFeatureCertifier => a.type === "PersistentCertifier"
      );

      if (certifierFeature) {
        if (certifierId === certifierFeature.certifierId) {
          throw tenantIsAlreadyACertifier(tenant.data.id, certifierId);
        }

        const certifiedAttribute =
          await readModelService.getOneCertifiedAttributeByCertifier({
            certifierId: certifierFeature.certifierId,
          });
        if (certifiedAttribute) {
          throw certifierWithExistingAttributes(
            tenant.data.id,
            certifierFeature.certifierId
          );
        }
      }

      const updatedTenant: Tenant = {
        ...tenant.data,
        features: [
          ...tenant.data.features.filter(
            (feature) => feature.type !== "PersistentCertifier"
          ),
          {
            type: "PersistentCertifier",
            certifierId,
          },
        ],
        updatedAt: new Date(),
      };

      await repository.createEvent(
        toCreateEventMaintenanceTenantPromotedToCertifier(
          tenant.metadata.version,
          updatedTenant,
          correlationId
        )
      );
      return updatedTenant;
    },
    async m2mRevokeCertifiedAttribute({
      organizationId,
      tenantOrigin,
      tenantExternalId,
      attributeExternalId,
      correlationId,
      logger,
    }: {
      organizationId: TenantId;
      tenantOrigin: string;
      tenantExternalId: string;
      attributeExternalId: string;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<void> {
      logger.info(
        `Revoking certified attribute ${attributeExternalId} to tenant (${tenantOrigin}/${tenantExternalId}) via m2m request`
      );
      const requesterTenant = await retrieveTenant(
        organizationId,
        readModelService
      );

      const certifierId = requesterTenant.data.features.find(
        (f): f is TenantFeatureCertifier => f.type === "PersistentCertifier"
      )?.certifierId;

      if (!certifierId) {
        throw tenantIsNotACertifier(requesterTenant.data.id);
      }
      const targetTenant = await retrieveTenantByExternalId({
        tenantOrigin,
        tenantExternalId,
        readModelService,
      });

      const attributeToRevoke = await retrieveCertifiedAttribute({
        attributeOrigin: certifierId,
        attributeExternalId,
        readModelService,
      });

      const attributePreviouslyAssigned = targetTenant.data.attributes.find(
        (attr): attr is CertifiedTenantAttribute =>
          attr.type === tenantAttributeType.CERTIFIED &&
          attr.id === attributeToRevoke.id
      );

      if (!attributePreviouslyAssigned) {
        throw attributeNotFoundInTenant(
          attributeToRevoke.id,
          targetTenant.data.id
        );
      }

      const tenantWithAttributeRevoked = await revokeCertifiedAttribute(
        targetTenant.data,
        attributeToRevoke.id
      );

      const attributeAssignmentEvent =
        toCreateEventTenantCertifiedAttributeRevoked(
          targetTenant.metadata.version,
          tenantWithAttributeRevoked,
          attributeToRevoke.id,
          correlationId
        );

      const updatedTenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithAttributeRevoked.attributes,
        tenantWithAttributeRevoked.externalId
      );

      if (updatedTenantKind !== tenantWithAttributeRevoked.kind) {
        const tenantWithUpdatedKind: Tenant = {
          ...tenantWithAttributeRevoked,
          kind: updatedTenantKind,
        };
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          targetTenant.metadata.version + 1,
          tenantWithAttributeRevoked.kind,
          tenantWithUpdatedKind,
          correlationId
        );

        await repository.createEvents([
          attributeAssignmentEvent,
          tenantKindUpdatedEvent,
        ]);
      } else {
        await repository.createEvent(attributeAssignmentEvent);
      }
    },
    async assignTenantDelegatedProducerFeature({
      organizationId,
      correlationId,
      authData,
      logger,
    }: {
      organizationId: TenantId;
      correlationId: CorrelationId;
      authData: AuthData;
      logger: Logger;
    }): Promise<void> {
      logger.info(
        `Assigning delegated producer feature to tenant ${organizationId}`
      );

      assertRequesterIPAOrigin(authData);

      const requesterTenant = await retrieveTenant(
        organizationId,
        readModelService
      );

      assertDelegatedProducerFeatureNotAssigned(requesterTenant.data);

      const updatedTenant: Tenant = {
        ...requesterTenant.data,
        features: [
          ...requesterTenant.data.features,
          { type: "DelegatedProducer", availabilityTimestamp: new Date() },
        ],
        updatedAt: new Date(),
      };

      await repository.createEvent(
        toCreateEventTenantDelegatedProducerFeatureAdded(
          requesterTenant.metadata.version,
          updatedTenant,
          correlationId
        )
      );
    },
    async removeTenantDelegatedProducerFeature({
      organizationId,
      correlationId,
      authData,
      logger,
    }: {
      organizationId: TenantId;
      correlationId: CorrelationId;
      authData: AuthData;
      logger: Logger;
    }): Promise<void> {
      logger.info(
        `Removing delegated producer feature to tenant ${organizationId}`
      );

      assertRequesterIPAOrigin(authData);

      const requesterTenant = await retrieveTenant(
        organizationId,
        readModelService
      );

      assertDelegatedProducerFeatureAssigned(requesterTenant.data);

      const updatedTenant: Tenant = {
        ...requesterTenant.data,
        features: requesterTenant.data.features.filter(
          (f) => f.type !== "DelegatedProducer"
        ),
        updatedAt: new Date(),
      };

      await repository.createEvent(
        toCreateEventTenantDelegatedProducerFeatureRemoved(
          requesterTenant.metadata.version,
          updatedTenant,
          correlationId
        )
      );
    },
  };
}

function assignCertifiedAttribute({
  targetTenant,
  attribute,
}: {
  targetTenant: Tenant;
  attribute: Attribute;
}): Tenant {
  const certifiedTenantAttribute = targetTenant.attributes.find(
    (attr): attr is CertifiedTenantAttribute =>
      attr.type === tenantAttributeType.CERTIFIED && attr.id === attribute.id
  );

  if (!certifiedTenantAttribute) {
    // assigning attribute for the first time
    return {
      ...targetTenant,
      attributes: [
        ...targetTenant.attributes,
        {
          id: attribute.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: undefined,
        },
      ],
      updatedAt: new Date(),
    };
  } else if (!certifiedTenantAttribute.revocationTimestamp) {
    throw certifiedAttributeAlreadyAssigned(attribute.id, targetTenant.id);
  } else {
    // re-assigning attribute if it was revoked
    return {
      ...targetTenant,
      attributes: targetTenant.attributes.map((a) =>
        a.id === attribute.id
          ? {
              ...a,
              assignmentTimestamp: new Date(),
              revocationTimestamp: undefined,
            }
          : a
      ),
      updatedAt: new Date(),
    };
  }
}

function buildVerifiedBy(
  verifiers: TenantVerifier[],
  organizationId: TenantId,
  expirationDate: string | undefined
): TenantVerifier[] {
  const hasPreviouslyVerified = verifiers.find((i) => i.id === organizationId);
  return hasPreviouslyVerified
    ? verifiers.map((verification) =>
        verification.id === organizationId
          ? {
              id: organizationId,
              verificationDate: new Date(),
              expirationDate: expirationDate
                ? validExpirationDate(new Date(expirationDate))
                : undefined,
              extensionDate: expirationDate
                ? new Date(expirationDate)
                : undefined,
            }
          : verification
      )
    : [
        ...verifiers,
        {
          id: organizationId,
          verificationDate: new Date(),
          expirationDate: expirationDate
            ? validExpirationDate(new Date(expirationDate))
            : undefined,
          extensionDate: expirationDate ? new Date(expirationDate) : undefined,
        },
      ];
}

function assignDeclaredAttribute(
  attributes: TenantAttribute[],
  attributeId: AttributeId
): TenantAttribute[] {
  return [
    ...attributes,
    {
      id: unsafeBrandId(attributeId),
      type: tenantAttributeType.DECLARED,
      assignmentTimestamp: new Date(),
      revocationTimestamp: undefined,
    },
  ];
}

function reassignDeclaredAttribute(
  attributes: TenantAttribute[],
  attributeId: AttributeId
): TenantAttribute[] {
  return attributes.map((attr) =>
    attr.id === attributeId
      ? {
          ...attr,
          assignmentTimestamp: new Date(),
          revocationTimestamp: undefined,
        }
      : attr
  );
}

function assignVerifiedAttribute(
  attributes: TenantAttribute[],
  organizationId: TenantId,
  tenantAttributeSeed: tenantApi.VerifiedTenantAttributeSeed
): TenantAttribute[] {
  return [
    ...attributes,
    {
      id: unsafeBrandId(tenantAttributeSeed.id),
      type: tenantAttributeType.VERIFIED,
      assignmentTimestamp: new Date(),
      verifiedBy: [
        {
          id: organizationId,
          verificationDate: new Date(),
          expirationDate: tenantAttributeSeed.expirationDate
            ? validExpirationDate(new Date(tenantAttributeSeed.expirationDate))
            : undefined,
          extensionDate: tenantAttributeSeed.expirationDate
            ? new Date(tenantAttributeSeed.expirationDate)
            : undefined,
        },
      ],
      revokedBy: [],
    },
  ];
}

function reassignVerifiedAttribute(
  attributes: TenantAttribute[],
  verifiedTenantAttribute: VerifiedTenantAttribute,
  organizationId: TenantId,
  tenantAttributeSeed: tenantApi.VerifiedTenantAttributeSeed
): TenantAttribute[] {
  return attributes.map((attr) =>
    attr.id === verifiedTenantAttribute.id
      ? {
          ...attr,
          verifiedBy: buildVerifiedBy(
            verifiedTenantAttribute.verifiedBy,
            organizationId,
            tenantAttributeSeed.expirationDate
          ),
          revokedBy: verifiedTenantAttribute.revokedBy.filter(
            (i) => i.id !== organizationId
          ),
        }
      : attr
  );
}

async function revokeCertifiedAttribute(
  tenant: Tenant,
  attributeId: AttributeId
): Promise<Tenant> {
  return {
    ...tenant,
    updatedAt: new Date(),
    attributes: tenant.attributes.map((attr) =>
      attr.id === attributeId
        ? {
            ...attr,
            revocationTimestamp: new Date(),
          }
        : attr
    ),
  } satisfies Tenant;
}

function validExpirationDate(expirationDate: Date): Date {
  if (expirationDate.getTime() < Date.now()) {
    throw expirationDateCannotBeInThePast(expirationDate);
  }
  return expirationDate;
}

export type TenantService = ReturnType<typeof tenantServiceBuilder>;
