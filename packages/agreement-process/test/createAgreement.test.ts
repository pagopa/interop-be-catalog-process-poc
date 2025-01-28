import { fail } from "assert";
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  expectPastTimestamp,
  getMockAgreement,
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockDelegation,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementAddedV2,
  AgreementId,
  AgreementV2,
  AttributeId,
  DelegationId,
  Descriptor,
  DescriptorId,
  EServiceAttribute,
  EServiceId,
  Tenant,
  TenantAttribute,
  TenantId,
  agreementState,
  delegationKind,
  delegationState,
  descriptorState,
  generateId,
  toAgreementStateV2,
  toAgreementV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { agreementCreationConflictingStates } from "../src/model/domain/agreement-validators.js";
import {
  agreementAlreadyExists,
  delegationNotFound,
  descriptorNotInExpectedState,
  eServiceNotFound,
  missingCertifiedAttributesError,
  notLatestEServiceDescriptor,
  organizationIsNotTheDelegateConsumer,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOneTenant,
  agreementService,
  readLastAgreementEvent,
} from "./utils.js";

/**
 * Executes the generic agreement expectation for agreement creation process,
 * and return the created AgreementV1 object to be used for further checks.
 *
 * @param agreementId - The ID of the agreement.
 * @param expectedEserviceId - The expected e-service ID of the agreement.
 * @param expectedDescriptorId - The expected descriptor ID of the agreement.
 * @param expectedProducerId - The expected producer ID of the agreement.
 * @param expectedConsumerId - The expected consumer ID of the agreement.
 * @returns A Promise that resolves return the created AgreementV1 object.
 */
const expectedAgreementCreation = async (
  agreement: Agreement,
  expectedEserviceId: EServiceId,
  expectedDescriptorId: DescriptorId,
  expectedProducerId: TenantId,
  expectedConsumerId: TenantId
): Promise<AgreementV2> => {
  const agreementId = unsafeBrandId<AgreementId>(agreement.id);
  expect(agreementId).toBeDefined();
  if (!agreementId) {
    fail("Unhandled error: returned agreementId is undefined");
  }

  const writtenEvent = await readLastAgreementEvent(agreementId);

  if (!writtenEvent) {
    fail("Creation fails: agreement not found in event-store");
  }

  expect(writtenEvent).toMatchObject({
    type: "AgreementAdded",
    event_version: 2,
    version: "0",
    stream_id: agreementId,
  });

  const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
    messageType: AgreementAddedV2,
    payload: writtenEvent.data,
  }).agreement;

  if (!actualAgreement) {
    fail("impossible to decode AgreementAddedV1 data");
  }

  expect(actualAgreement.contract).toBeUndefined();
  expect(actualAgreement).property("createdAt").satisfy(expectPastTimestamp);

  expect(actualAgreement).toMatchObject({
    id: agreementId,
    eserviceId: expectedEserviceId,
    descriptorId: expectedDescriptorId,
    producerId: expectedProducerId,
    consumerId: expectedConsumerId,
    state: toAgreementStateV2(agreementState.draft),
    verifiedAttributes: [],
    certifiedAttributes: [],
    declaredAttributes: [],
    consumerDocuments: [],
    stamps: {},
    createdAt: expect.any(BigInt),
  });
  expect(actualAgreement).toEqual(toAgreementV2(agreement));

  return actualAgreement;
};

describe("create agreement", () => {
  it("should succeed when EService Producer and Agreement Consumer are the same, even on unmet attributes", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const attributeId = generateId<AttributeId>();

    const descriptor = getMockDescriptorPublished(descriptorId, [
      [getMockEServiceAttribute(attributeId)],
    ]);
    const eservice = getMockEService(eserviceId, authData.organizationId, [
      descriptor,
    ]);
    const tenant = getMockTenant(authData.organizationId);

    await addOneEService(eservice);
    await addOneTenant(tenant);

    const createdAgreement = await agreementService.createAgreement(
      {
        eserviceId,
        descriptorId,
      },
      {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    await expectedAgreementCreation(
      createdAgreement,
      eserviceId,
      descriptorId,
      authData.organizationId,
      tenant.id
    );
  });

  it("should succeed when EService producer and Agreement consumer are different Tenants, and the consumer has all Descriptor certified Attributes not revoked", async () => {
    const authData = getRandomAuthData();
    const eserviceProducer: Tenant = getMockTenant();

    const certifiedDescriptorAttribute1: EServiceAttribute =
      getMockEServiceAttribute();
    const certifiedDescriptorAttribute2: EServiceAttribute =
      getMockEServiceAttribute();

    const descriptor = getMockDescriptorPublished(generateId<DescriptorId>(), [
      [certifiedDescriptorAttribute1],
      [certifiedDescriptorAttribute2],
    ]);

    const certifiedTenantAttribute1: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(certifiedDescriptorAttribute1.id),
      revocationTimestamp: undefined,
    };

    const certifiedTenantAttribute2: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(certifiedDescriptorAttribute2.id),
      revocationTimestamp: undefined,
    };

    const consumer = getMockTenant(authData.organizationId, [
      getMockDeclaredTenantAttribute(),
      certifiedTenantAttribute1,
      certifiedTenantAttribute2,
    ]);

    const eservice = getMockEService(
      generateId<EServiceId>(),
      eserviceProducer.id,
      [descriptor]
    );

    await addOneTenant(eserviceProducer);
    await addOneTenant(consumer);
    await addOneEService(eservice);

    const createdAgreement = await agreementService.createAgreement(
      {
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      },
      {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    await expectedAgreementCreation(
      createdAgreement,
      eservice.id,
      descriptor.id,
      eserviceProducer.id,
      consumer.id
    );
  });
  it("should succeed when the delegationId is provided, the requester is the delegate and the delegator has all Descriptor certified Attributes not revoked", async () => {
    const authData = getRandomAuthData();
    const eserviceProducer: Tenant = getMockTenant();

    const certifiedDescriptorAttribute1: EServiceAttribute =
      getMockEServiceAttribute();
    const certifiedDescriptorAttribute2: EServiceAttribute =
      getMockEServiceAttribute();

    const descriptor = getMockDescriptorPublished(generateId<DescriptorId>(), [
      [certifiedDescriptorAttribute1],
      [certifiedDescriptorAttribute2],
    ]);

    const certifiedTenantAttribute1: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(certifiedDescriptorAttribute1.id),
      revocationTimestamp: undefined,
    };

    const certifiedTenantAttribute2: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(certifiedDescriptorAttribute2.id),
      revocationTimestamp: undefined,
    };

    const delegator = getMockTenant(generateId<TenantId>(), [
      getMockDeclaredTenantAttribute(),
      certifiedTenantAttribute1,
      certifiedTenantAttribute2,
    ]);

    const delegate = getMockTenant(authData.organizationId);

    const eservice = getMockEService(
      generateId<EServiceId>(),
      eserviceProducer.id,
      [descriptor]
    );

    const existingAgreementForDelegateAsConsumer: Agreement = getMockAgreement(
      eservice.id,
      delegate.id,
      randomArrayItem(agreementCreationConflictingStates)
    );

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      state: delegationState.active,
      eserviceId: eservice.id,
      delegatorId: delegator.id,
      delegateId: delegate.id,
    });

    await addOneTenant(eserviceProducer);
    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEService(eservice);
    await addOneDelegation(delegation);
    await addOneAgreement(existingAgreementForDelegateAsConsumer);

    const createdAgreement = await agreementService.createAgreement(
      {
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
        delegationId: delegation.id,
      },
      {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    await expectedAgreementCreation(
      createdAgreement,
      eservice.id,
      descriptor.id,
      eserviceProducer.id,
      delegator.id
    );
  });

  it("should succeed when EService producer and Agreement consumer are different Tenants, and the Descriptor has no certified Attributes", async () => {
    const eserviceProducer: Tenant = getMockTenant();
    const consumer: Tenant = getMockTenant();

    // Descriptor has no certified attributes - no requirements for the consumer
    const descriptor = getMockDescriptorPublished();

    const eservice = getMockEService(
      generateId<EServiceId>(),
      eserviceProducer.id,
      [descriptor]
    );

    await addOneTenant(eserviceProducer);
    await addOneTenant(consumer);
    await addOneEService(eservice);

    const authData = getRandomAuthData(consumer.id); // different from eserviceProducer

    const createdAgreement = await agreementService.createAgreement(
      {
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      },
      {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    await expectedAgreementCreation(
      createdAgreement,
      eservice.id,
      descriptor.id,
      eserviceProducer.id,
      consumer.id
    );
  });

  it("should succeed when EService's latest Descriptors are draft, and the latest non-draft Descriptor is published", async () => {
    const tenant: Tenant = getMockTenant();

    const descriptor0: Descriptor = getMockDescriptorPublished();
    const descriptor1: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "1",
      state: descriptorState.draft,
    };

    const descriptor2: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "2",
      state: descriptorState.draft,
    };

    const eservice = getMockEService(generateId<EServiceId>(), tenant.id, [
      descriptor0,
      descriptor1,
      descriptor2,
    ]);

    await addOneTenant(tenant);
    await addOneEService(eservice);

    const authData = getRandomAuthData(tenant.id);

    const createdAgreement = await agreementService.createAgreement(
      {
        eserviceId: eservice.id,
        descriptorId: descriptor0.id,
      },
      {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    await expectedAgreementCreation(
      createdAgreement,
      eservice.id,
      descriptor0.id,
      tenant.id,
      tenant.id
    );
  });

  it("should succeed when Agreements in non-conflicting states exist for the same EService and consumer", async () => {
    const tenant: Tenant = getMockTenant();
    const descriptor: Descriptor = getMockDescriptorPublished();

    const eservice = getMockEService(generateId<EServiceId>(), tenant.id, [
      descriptor,
    ]);

    const otherAgreement = getMockAgreement(
      eservice.id,
      tenant.id,
      randomArrayItem(
        Object.values(agreementState).filter(
          (state) => !agreementCreationConflictingStates.includes(state)
        )
      )
    );

    await addOneTenant(tenant);
    await addOneEService(eservice);
    await addOneAgreement(otherAgreement);

    const authData = getRandomAuthData(tenant.id);

    const createdAgreement = await agreementService.createAgreement(
      {
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      },
      {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    await expectedAgreementCreation(
      createdAgreement,
      eservice.id,
      descriptor.id,
      tenant.id,
      tenant.id
    );
  });

  it("should throw an eServiceNotFound error when the EService does not exist", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();

    await expect(
      agreementService.createAgreement(
        {
          eserviceId,
          descriptorId,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceNotFound(unsafeBrandId(eserviceId)));
  });

  it("should throw a notLatestEServiceDescriptor error when the EService has no Descriptor", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();

    const eservice = getMockEService(eserviceId, authData.organizationId, []);

    await addOneEService(eservice);

    await expect(
      agreementService.createAgreement(
        {
          eserviceId,
          descriptorId,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      notLatestEServiceDescriptor(unsafeBrandId(descriptorId))
    );
  });

  it("should throw a notLatestEServiceDescriptor error when the EService Descriptor is not the latest non-draft Descriptor", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();
    const notDraftDescriptorStates = Object.values(descriptorState).filter(
      (state) =>
        state !== descriptorState.draft &&
        state !== descriptorState.waitingForApproval
    );

    const descriptor0: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "0",
      state: randomArrayItem(notDraftDescriptorStates),
    };
    const descriptor1: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "1",
      state: randomArrayItem(notDraftDescriptorStates),
    };

    const eservice = getMockEService(eserviceId, authData.organizationId, [
      descriptor0,
      descriptor1,
    ]);

    await addOneEService(eservice);
    await addOneTenant(getMockTenant(authData.organizationId));

    await expect(
      agreementService.createAgreement(
        {
          eserviceId,
          descriptorId: descriptor0.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      notLatestEServiceDescriptor(unsafeBrandId(descriptor0.id))
    );
  });

  it("should throw a descriptorNotInExpectedState error when the EService's latest non-draft Descriptor is not published", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();

    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "0",
      state: randomArrayItem(
        Object.values(descriptorState).filter(
          (state) =>
            state !== descriptorState.published &&
            state !== descriptorState.draft &&
            state !== descriptorState.waitingForApproval
        )
      ),
    };

    const eservice = getMockEService(eserviceId, authData.organizationId, [
      descriptor,
    ]);

    await addOneEService(eservice);
    await addOneTenant(getMockTenant(authData.organizationId));

    await expect(
      agreementService.createAgreement(
        {
          eserviceId,
          descriptorId: descriptor.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      descriptorNotInExpectedState(eservice.id, descriptor.id, [
        descriptorState.published,
      ])
    );
  });

  it("should throw an agreementAlreadyExists error when an Agreement in a conflicting state already exists for the same EService and consumer", async () => {
    const consumer: Tenant = getMockTenant();
    const descriptor: Descriptor = getMockDescriptorPublished();

    const eservice = getMockEService(generateId<EServiceId>(), consumer.id, [
      descriptor,
    ]);

    const conflictingAgreement = getMockAgreement(
      eservice.id,
      consumer.id,
      randomArrayItem(agreementCreationConflictingStates)
    );

    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(conflictingAgreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.createAgreement(
        {
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(agreementAlreadyExists(consumer.id, eservice.id));
  });

  it("should throw an agreementAlreadyExists when the delegationId is provided, the requester is the delegate and an Agreement in a conflicting state already exists for the same EService and the delegator as Consumer", async () => {
    const authData = getRandomAuthData();
    const eserviceProducer: Tenant = getMockTenant();

    const delegator = getMockTenant(generateId<TenantId>(), [
      getMockDeclaredTenantAttribute(),
    ]);

    const delegate = getMockTenant(authData.organizationId);

    const descriptor = getMockDescriptorPublished();
    const eservice = getMockEService(
      generateId<EServiceId>(),
      eserviceProducer.id,
      [descriptor]
    );

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      state: delegationState.active,
      eserviceId: eservice.id,
      delegatorId: delegator.id,
      delegateId: delegate.id,
    });

    const conflictingAgreement = getMockAgreement(
      eservice.id,
      delegator.id,
      randomArrayItem(agreementCreationConflictingStates)
    );

    await addOneTenant(eserviceProducer);
    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEService(eservice);
    await addOneDelegation(delegation);
    await addOneAgreement(conflictingAgreement);

    await expect(
      agreementService.createAgreement(
        {
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
          delegationId: delegation.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(agreementAlreadyExists(delegator.id, eservice.id));
  });

  it("should throw a tenantNotFound error when the consumer Tenant does not exist", async () => {
    const consumer: Tenant = getMockTenant();
    const descriptor: Descriptor = getMockDescriptorPublished();

    const eservice = getMockEService(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      [descriptor]
    );

    await addOneEService(eservice);

    const authData = getRandomAuthData(consumer.id);

    await expect(() =>
      agreementService.createAgreement(
        {
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(tenantNotFound(consumer.id));
  });

  it("should throw a missingCertifiedAttributesError error when the EService producer and Agreement consumer are different Tenants, and the consumer is missing a Descriptor certified Attribute", async () => {
    const eserviceProducer: Tenant = getMockTenant();

    // Descriptor has two certified attributes
    const certifiedDescriptorAttribute1: EServiceAttribute =
      getMockEServiceAttribute();
    const certifiedDescriptorAttribute2: EServiceAttribute =
      getMockEServiceAttribute();

    const descriptor = getMockDescriptorPublished(generateId<DescriptorId>(), [
      [certifiedDescriptorAttribute1],
      [certifiedDescriptorAttribute2],
    ]);

    // In this case, the consumer is missing one of the two certified attributes
    const certifiedTenantAttribute1: TenantAttribute =
      getMockCertifiedTenantAttribute(certifiedDescriptorAttribute1.id);

    const consumer = {
      ...getMockTenant(),
      attributes: [certifiedTenantAttribute1],
    };

    const eservice = getMockEService(
      generateId<EServiceId>(),
      eserviceProducer.id,
      [descriptor]
    );

    await addOneTenant(eserviceProducer);
    await addOneTenant(consumer);
    await addOneEService(eservice);

    const authData = getRandomAuthData(consumer.id);
    await expect(
      agreementService.createAgreement(
        {
          eserviceId: eservice.id,
          descriptorId: eservice.descriptors[0].id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      missingCertifiedAttributesError(descriptor.id, consumer.id)
    );
  });

  it("should throw a missingCertifiedAttributesError error when the EService producer and Agreement consumer are different Tenants, and the consumer has a Descriptor certified Attribute revoked", async () => {
    const eserviceProducer: Tenant = getMockTenant();

    // Descriptor has two certified attributes
    const certifiedDescriptorAttribute1: EServiceAttribute =
      getMockEServiceAttribute();
    const certifiedDescriptorAttribute2: EServiceAttribute =
      getMockEServiceAttribute();

    const descriptor: Descriptor = getMockDescriptorPublished(
      generateId<DescriptorId>(),
      [[certifiedDescriptorAttribute1], [certifiedDescriptorAttribute2]]
    );

    const eservice = getMockEService(
      generateId<EServiceId>(),
      eserviceProducer.id,
      [descriptor]
    );

    // In this case, the consumer has one of the two certified attributes revoked
    const certifiedTenantAttribute1: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(certifiedDescriptorAttribute1.id),
      revocationTimestamp: new Date(),
      assignmentTimestamp: new Date(),
    };
    const certifiedTenantAttribute2: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(certifiedDescriptorAttribute2.id),
      revocationTimestamp: undefined,
      assignmentTimestamp: new Date(),
    };

    const consumer = {
      ...getMockTenant(),
      attributes: [certifiedTenantAttribute1, certifiedTenantAttribute2],
    };

    await addOneTenant(eserviceProducer);
    await addOneTenant(consumer);
    await addOneEService(eservice);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.createAgreement(
        {
          eserviceId: eservice.id,
          descriptorId: eservice.descriptors[0].id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      missingCertifiedAttributesError(descriptor.id, consumer.id)
    );
  });
  it("should throw organizationIsNotTheDelegateConsumer error when there is an active delegation and the requester is the delegator", async () => {
    const authData = getRandomAuthData();

    const eservice = getMockEService(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      [getMockDescriptorPublished()]
    );

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      state: delegationState.active,
      delegatorId: authData.organizationId,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    await expect(
      agreementService.createAgreement(
        {
          eserviceId: eservice.id,
          descriptorId: eservice.descriptors[0].id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      organizationIsNotTheDelegateConsumer(
        authData.organizationId,
        delegation.id
      )
    );
  });
  it("should throw delegationNotFound error when the provided delegation id does not exist", async () => {
    const delegationId = generateId<DelegationId>();
    const eservice = getMockEService(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      [getMockDescriptorPublished()]
    );

    await addOneEService(eservice);
    await addOneDelegation(
      getMockDelegation({
        kind: delegationKind.delegatedConsumer,
        eserviceId: eservice.id,
        state: delegationState.active,
      })
    );

    await expect(
      agreementService.createAgreement(
        {
          eserviceId: eservice.id,
          descriptorId: eservice.descriptors[0].id,
          delegationId,
        },
        {
          authData: getRandomAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(delegationNotFound(delegationId));
  });
  it("should throw organizationIsNotTheDelegateConsumer error when the requester is not the delegate if delegationId is provided", async () => {
    const authData = getRandomAuthData();
    const eservice = getMockEService(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      [getMockDescriptorPublished()]
    );

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    await expect(
      agreementService.createAgreement(
        {
          eserviceId: eservice.id,
          descriptorId: eservice.descriptors[0].id,
          delegationId: delegation.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      organizationIsNotTheDelegateConsumer(
        authData.organizationId,
        delegation.id
      )
    );
  });
});
