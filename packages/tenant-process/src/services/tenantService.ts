import { AuthData, DB, eventRepository, logger } from "pagopa-interop-commons";
import {
  Attribute,
  AttributeId,
  AttributeKind,
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
} from "pagopa-interop-models";
import { ExternalId } from "pagopa-interop-models";
import {
  toCreateEventTenantVerifiedAttributeAssigned,
  toCreateEventTenantCertifiedAttributeAssigned,
  toCreateEventTenantDeclaredAttributeAssigned,
} from "../model/domain/toEvent.js";
import {
  ApiCertifiedTenantAttributeSeed,
  ApiSelfcareTenantSeed,
  ApiDeclaredTenantAttributeSeed,
  ApiVerifiedTenantAttributeSeed,
} from "../model/types.js";
import {
  attributeNotFound,
  attributeVerificationNotAllowed,
  certifiedAttributeAlreadyAssigned,
  certifiedAttributeOriginIsNotCompliantWithCertifier,
  tenantIsNotACertifier,
  verifiedAttributeSelfVerification,
} from "../model/domain/errors.js";
import {
  CertifiedAttributeQueryResult,
  UpdateVerifiedTenantAttributeSeed,
} from "../model/domain/models.js";
import { tenantNotFound } from "../model/domain/errors.js";
import {
  toCreateEventTenantVerifiedAttributeExpirationUpdated,
  toCreateEventTenantVerifiedAttributeExtensionUpdated,
  toCreateEventTenantOnboardDetailsUpdated,
  toCreateEventTenantOnboarded,
} from "../model/domain/toEvent.js";
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
  assertTenantExists,
  getTenantCertifierId,
  assertVerifiedAttributeOperationAllowed,
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

export async function retrieveAttribute(
  attributeId: AttributeId,
  readModelService: ReadModelService,
  kind: AttributeKind
): Promise<Attribute> {
  const attribute = await readModelService.getAttributeById(attributeId);
  if (!attribute || attribute.kind !== kind) {
    throw attributeNotFound(attributeId);
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
      correlationId: string
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
    }): Promise<Tenant> {
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
    async selfcareUpsertTenant({
      tenantSeed,
      authData,
      correlationId,
    }: {
      tenantSeed: ApiSelfcareTenantSeed;
      authData: AuthData;
      correlationId: string;
    }): Promise<string> {
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
          toCreateEventTenantOnboarded(newTenant, correlationId)
        );
      }
    },

    async addCertifiedAttribute(
      tenantId: TenantId,
      {
        tenantAttributeSeed,
        authData,
        correlationId,
      }: {
        tenantAttributeSeed: ApiCertifiedTenantAttributeSeed;
        authData: AuthData;
        correlationId: string;
      }
    ): Promise<Tenant> {
      logger.info(
        `Add certified attribute ${tenantAttributeSeed.id} to tenant ${tenantId}`
      );
      const organizationId = authData.organizationId;

      const requesterTenant = await retrieveTenant(
        organizationId,
        readModelService
      );

      const certifierId = getTenantCertifierId(requesterTenant.data);

      if (!certifierId) {
        throw tenantIsNotACertifier(organizationId);
      }

      const attribute = await retrieveAttribute(
        unsafeBrandId(tenantAttributeSeed.id),
        readModelService,
        attributeKind.certified
      );

      if (!attribute.origin || attribute.origin !== certifierId) {
        throw certifiedAttributeOriginIsNotCompliantWithCertifier(
          attribute.origin || "",
          organizationId,
          tenantId,
          certifierId
        );
      }

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const updatedTenant = await assignCertifiedAttribute({
        targetTenant: targetTenant.data,
        attribute,
        organizationId,
        readModelService,
      });

      await repository.createEvent(
        toCreateEventTenantCertifiedAttributeAssigned(
          targetTenant.data.id,
          targetTenant.metadata.version,
          updatedTenant,
          attribute.id,
          correlationId
        )
      );
      return updatedTenant;
    },

    async addDeclaredAttribute({
      tenantAttributeSeed,
      authData,
      correlationId,
    }: {
      tenantAttributeSeed: ApiDeclaredTenantAttributeSeed;
      authData: AuthData;
      correlationId: string;
    }): Promise<Tenant> {
      logger.info(
        `Add declared attribute ${tenantAttributeSeed.id} to requester tenant ${authData.organizationId}`
      );
      const targetTenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      const attribute = await retrieveAttribute(
        unsafeBrandId(tenantAttributeSeed.id),
        readModelService,
        attributeKind.declared
      );

      const maybeDeclaredTenantAttribute = targetTenant.data.attributes.find(
        (attr): attr is DeclaredTenantAttribute =>
          attr.type === tenantAttributeType.DECLARED && attr.id === attribute.id
      );

      // eslint-disable-next-line functional/no-let
      let updatedTenant: Tenant = {
        ...targetTenant.data,
        updatedAt: new Date(),
      };
      if (!maybeDeclaredTenantAttribute) {
        // assigning attribute for the first time
        updatedTenant = {
          ...updatedTenant,
          attributes: [
            ...targetTenant.data.attributes,
            {
              id: unsafeBrandId(attribute.id),
              type: tenantAttributeType.DECLARED,
              assignmentTimestamp: new Date(),
              revocationTimestamp: undefined,
            },
          ],
        };
      } else {
        updatedTenant = {
          ...updatedTenant,
          attributes: targetTenant.data.attributes.map((attr) =>
            attr.id === attribute.id
              ? {
                  ...attr,
                  assignmentTimestamp: new Date(),
                  revocationTimestamp: undefined,
                }
              : attr
          ),
        };
      }

      await repository.createEvent(
        toCreateEventTenantDeclaredAttributeAssigned(
          targetTenant.data.id,
          targetTenant.metadata.version,
          updatedTenant,
          unsafeBrandId(tenantAttributeSeed.id),
          correlationId
        )
      );
      return updatedTenant;
    },

    async verifyVerifiedAttribute({
      tenantId,
      tenantAttributeSeed,
      organizationId,
      correlationId,
    }: {
      tenantId: TenantId;
      tenantAttributeSeed: ApiVerifiedTenantAttributeSeed;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<Tenant> {
      logger.info(
        `Verifying attribute ${tenantAttributeSeed.id} to tenant ${tenantId}`
      );

      if (organizationId === tenantId) {
        throw verifiedAttributeSelfVerification();
      }

      const allowedStatuses = [
        agreementState.pending,
        agreementState.active,
        agreementState.suspended,
      ];
      await assertVerifiedAttributeOperationAllowed({
        producerId: organizationId,
        consumerId: tenantId,
        attributeId: unsafeBrandId(tenantAttributeSeed.id),
        agreementStates: allowedStatuses,
        readModelService,
        error: attributeVerificationNotAllowed(
          tenantId,
          unsafeBrandId(tenantAttributeSeed.id)
        ),
      });

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const attribute = await retrieveAttribute(
        unsafeBrandId(tenantAttributeSeed.id),
        readModelService,
        attributeKind.verified
      );

      const verifiedTenantAttribute = targetTenant.data.attributes.find(
        (attr): attr is VerifiedTenantAttribute =>
          attr.type === tenantAttributeType.VERIFIED && attr.id === attribute.id
      );

      // eslint-disable-next-line functional/no-let
      let updatedTenant: Tenant = {
        ...targetTenant.data,
        updatedAt: new Date(),
      };

      if (!verifiedTenantAttribute) {
        // assigning attribute for the first time
        updatedTenant = {
          ...updatedTenant,
          attributes: [
            ...targetTenant.data.attributes,
            {
              id: unsafeBrandId(tenantAttributeSeed.id),
              type: tenantAttributeType.VERIFIED,
              assignmentTimestamp: new Date(),
              verifiedBy: [
                {
                  id: organizationId,
                  verificationDate: new Date(),
                  expirationDate: tenantAttributeSeed.expirationDate
                    ? new Date(tenantAttributeSeed.expirationDate)
                    : undefined,
                  extensionDate: tenantAttributeSeed.expirationDate
                    ? new Date(tenantAttributeSeed.expirationDate)
                    : undefined,
                },
              ],
              revokedBy: [],
            },
          ],
        };
      } else {
        updatedTenant = {
          ...updatedTenant,
          attributes: targetTenant.data.attributes.map((attr) =>
            attr.id === verifiedTenantAttribute.id
              ? {
                  ...attr,
                  assignmentTimestamp:
                    verifiedTenantAttribute.assignmentTimestamp,
                  verifiedBy: buildVerifiedBy(
                    verifiedTenantAttribute,
                    organizationId,
                    tenantAttributeSeed
                  ),
                  revokedBy: verifiedTenantAttribute.revokedBy,
                }
              : attr
          ),
        };
      }

      await repository.createEvent(
        toCreateEventTenantVerifiedAttributeAssigned(
          targetTenant.data.id,
          targetTenant.metadata.version,
          updatedTenant,
          unsafeBrandId(tenantAttributeSeed.id),
          correlationId
        )
      );
      return updatedTenant;
    },

    async internalAssignCertifiedAttribute(
      tenantOrigin: string,
      tenantExternalId: string,
      attributeOrigin: string,
      attributeExternalId: string,
      correlationId: string
    ): Promise<void> {
      logger.info(
        `Assigning certified attribute (${attributeOrigin}/${attributeExternalId}) to tenant (${tenantOrigin}/${tenantExternalId})`
      );

      const tenantToModify = await this.getTenantByExternalId({
        origin: tenantOrigin,
        value: tenantExternalId,
      });

      assertTenantExists(
        unsafeBrandId(`${tenantOrigin}/${tenantExternalId}`),
        tenantToModify
      );

      const attributeToAssign =
        await readModelService.getAttributeByOriginAndCode({
          origin: attributeOrigin,
          code: attributeExternalId,
        });

      if (!attributeToAssign) {
        throw attributeNotFound(`${attributeOrigin}/${attributeExternalId}`);
      }

      const maybeAttribute = tenantToModify.data.attributes.find(
        (attr) =>
          attr.type === tenantAttributeType.CERTIFIED &&
          attr.id === attributeToAssign.id
      ) as CertifiedTenantAttribute;

      // eslint-disable-next-line functional/no-let
      let updatedTenant: Tenant = {
        ...tenantToModify.data,
        updatedAt: new Date(),
      };

      if (!maybeAttribute) {
        // assigning attribute for the first time
        updatedTenant = {
          ...updatedTenant,
          attributes: [
            ...tenantToModify.data.attributes,
            {
              id: attributeToAssign.id,
              type: tenantAttributeType.CERTIFIED,
              assignmentTimestamp: new Date(),
              revocationTimestamp: undefined,
            },
          ],
        };
      } else if (!maybeAttribute.revocationTimestamp) {
        throw certifiedAttributeAlreadyAssigned(
          attributeToAssign.id,
          tenantToModify.data.id
        );
      } else {
        // re-assigning attribute if it was revoked
        updatedTenant = updateAttribute({
          updatedTenant,
          targetTenant: tenantToModify,
          attributeId: attributeToAssign.id,
        });
      }

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        updatedTenant.attributes,
        updatedTenant.externalId
      );

      if (updatedTenant.kind !== tenantKind) {
        updatedTenant = {
          ...updatedTenant,
          kind: tenantKind,
        };
      }

      const event = toCreateEventTenantCertifiedAttributeAssigned(
        tenantToModify.data.id,
        tenantToModify.metadata.version,
        updatedTenant,
        attributeToAssign.id,
        correlationId
      );
      await repository.createEvent(event);
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

    async getProducers({
      producerName,
      offset,
      limit,
    }: {
      producerName: string | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Producers with name = ${producerName}, limit = ${limit}, offset = ${offset}`
      );
      return readModelService.getProducers({ producerName, offset, limit });
    },
    async getConsumers({
      consumerName,
      producerId,
      offset,
      limit,
    }: {
      consumerName: string | undefined;
      producerId: TenantId;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
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
    async getTenantsByName({
      name,
      offset,
      limit,
    }: {
      name: string | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Tenants with name = ${name}, limit = ${limit}, offset = ${offset}`
      );
      return readModelService.getTenantsByName({ name, offset, limit });
    },
    async getTenantById(
      id: TenantId
    ): Promise<WithMetadata<Tenant> | undefined> {
      logger.info(`Retrieving tenant ${id}`);
      return readModelService.getTenantById(id);
    },
    async getTenantByExternalId(
      externalId: ExternalId
    ): Promise<WithMetadata<Tenant> | undefined> {
      logger.info(
        `Retrieving tenant with origin ${externalId.origin} and code ${externalId.value}`
      );
      return readModelService.getTenantByExternalId(externalId);
    },
    async getTenantBySelfcareId(
      selfcareId: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      logger.info(`Retrieving Tenant with Selfcare Id ${selfcareId}`);
      return readModelService.getTenantBySelfcareId(selfcareId);
    },
  };
}

async function assignCertifiedAttribute({
  targetTenant,
  attribute,
  organizationId,
  readModelService,
}: {
  targetTenant: Tenant;
  attribute: Attribute;
  organizationId: TenantId;
  readModelService: ReadModelService;
}): Promise<Tenant> {
  const certifiedTenantAttribute = targetTenant.attributes.find(
    (attr): attr is CertifiedTenantAttribute =>
      attr.type === tenantAttributeType.CERTIFIED && attr.id === attribute.id
  );

  // eslint-disable-next-line functional/no-let
  let updatedTenant: Tenant = {
    ...targetTenant,
    updatedAt: new Date(),
  };

  if (!certifiedTenantAttribute) {
    // assigning attribute for the first time
    updatedTenant = {
      ...updatedTenant,
      attributes: [
        ...targetTenant.attributes,
        {
          id: attribute.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: undefined,
        },
      ],
    };
  } else if (!certifiedTenantAttribute.revocationTimestamp) {
    throw certifiedAttributeAlreadyAssigned(attribute.id, organizationId);
  } else {
    // re-assigning attribute if it was revoked
    updatedTenant = {
      ...updatedTenant,
      attributes: targetTenant.attributes.map((a) =>
        a.id === attribute.id
          ? {
              ...a,
              assignmentTimestamp: new Date(),
              revocationTimestamp: undefined,
            }
          : a
      ),
    };
  }
  const tenantKind = await getTenantKindLoadingCertifiedAttributes(
    readModelService,
    updatedTenant.attributes,
    updatedTenant.externalId
  );

  if (updatedTenant.kind !== tenantKind) {
    updatedTenant = {
      ...updatedTenant,
      kind: tenantKind,
    };
  }
  return updatedTenant;
}

function buildVerifiedBy(
  verifiedTenantAttribute: VerifiedTenantAttribute,
  organizationId: TenantId,
  tenantAttributeSeed: ApiVerifiedTenantAttributeSeed
): TenantVerifier[] {
  const hasPreviouslyVerified = verifiedTenantAttribute.verifiedBy.find(
    (i) => i.id === organizationId
  );
  return hasPreviouslyVerified
    ? verifiedTenantAttribute.verifiedBy.map((verification) =>
        verification.id === organizationId
          ? {
              id: organizationId,
              verificationDate: new Date(),
              expirationDate: tenantAttributeSeed.expirationDate
                ? new Date(tenantAttributeSeed.expirationDate)
                : undefined,
              extensionDate: tenantAttributeSeed.expirationDate
                ? new Date(tenantAttributeSeed.expirationDate)
                : undefined,
            }
          : verification
      )
    : [
        ...verifiedTenantAttribute.verifiedBy,
        {
          id: organizationId,
          verificationDate: new Date(),
          expirationDate: tenantAttributeSeed.expirationDate
            ? new Date(tenantAttributeSeed.expirationDate)
            : undefined,
          extensionDate: tenantAttributeSeed.expirationDate
            ? new Date(tenantAttributeSeed.expirationDate)
            : undefined,
        },
      ];
}

export type TenantService = ReturnType<typeof tenantServiceBuilder>;
