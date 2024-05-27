/* eslint-disable fp/no-delete */
/* eslint-disable functional/immutable-data */
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getMockVerifiedTenantAttribute,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import {
  Agreement,
  AgreementSetDraftByPlatformV2,
  AgreementSuspendedByPlatformV2,
  AgreementUnsuspendedByPlatformV2,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Descriptor,
  EService,
  Tenant,
  TenantId,
  VerifiedTenantAttribute,
  agreementState,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger, userRoles } from "pagopa-interop-commons";
import {
  addOneAgreement,
  addOneEService,
  agreementService,
  readLastAgreementEvent,
} from "./utils.js";

describe("compute Agreement state by attribute", () => {
  it("updates the state of updatable Agreements to Suspended or MissingCertifiedAttributes when the given attribute is not satisfied", async () => {
    // Tests the following state transitions:
    // - Active -> Suspended
    // - Draft -> MissingCertifiedAttributes
    // - Pending -> MissingCertifiedAttributes

    const authData = {
      ...getRandomAuthData(),
      userRoles: [userRoles.INTERNAL_ROLE],
    };

    // Create a consumer with invalid attributes,
    // and use an invalid attribute + the consumer as inputs to computeAgreementsStateByAttribute.
    // This simulates the fact that an attribute has been invalidated for the consumer,
    // triggering a consequent call to computeAgreementsStateByAttribute.
    const invalidCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };
    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        invalidCertifiedAttribute,
        getMockDeclaredTenantAttribute(),
        getMockVerifiedTenantAttribute(),
      ],
    };

    const descriptor1: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        certified: [[getMockEServiceAttribute(consumer.attributes[0].id)]],
        declared: [[getMockEServiceAttribute(consumer.attributes[1].id)]],
        verified: [[getMockEServiceAttribute(consumer.attributes[2].id)]],
      },
    };
    const eservice1: EService = {
      ...getMockEService(),
      producerId: generateId(),
      descriptors: [descriptor1],
    };

    const descriptor2: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        certified: [[getMockEServiceAttribute(consumer.attributes[0].id)]],
        declared: [[getMockEServiceAttribute(consumer.attributes[1].id)]],
        verified: [[getMockEServiceAttribute(consumer.attributes[2].id)]],
      },
    };

    const eservice2: EService = {
      ...getMockEService(),
      producerId: generateId(),
      descriptors: [descriptor2],
    };

    const updatableAgreement1: Agreement = {
      ...getMockAgreement(
        eservice1.id,
        consumer.id,
        randomArrayItem([agreementState.draft, agreementState.pending])
      ),
      descriptorId: eservice1.descriptors[0].id,
      producerId: eservice1.producerId,
      suspendedByPlatform: false,
    };

    const updatableAgreement2: Agreement = {
      ...getMockAgreement(eservice2.id, consumer.id, agreementState.active),
      descriptorId: eservice2.descriptors[0].id,
      producerId: eservice2.producerId,
      suspendedByPlatform: false,
    };

    const nonUpdatableAgreement = {
      ...getMockAgreement(
        eservice1.id,
        consumer.id,
        randomArrayItem([agreementState.archived, agreementState.rejected])
      ),
      descriptorId: eservice1.descriptors[0].id,
      producerId: eservice1.producerId,
    };

    await addOneEService(eservice1);
    await addOneEService(eservice2);
    await addOneAgreement(updatableAgreement1);
    await addOneAgreement(updatableAgreement2);
    await addOneAgreement(nonUpdatableAgreement);

    await agreementService.computeAgreementsStateByAttribute(
      invalidCertifiedAttribute.id,
      consumer,
      {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );

    const nonUpdatableAgreementStateUpdateEvent = await readLastAgreementEvent(
      nonUpdatableAgreement.id
    );

    expect(nonUpdatableAgreementStateUpdateEvent).toMatchObject({
      type: "AgreementAdded",
      event_version: 2,
      version: "0",
      stream_id: nonUpdatableAgreement.id,
    });

    const agreement1StateUpdateEvent = await readLastAgreementEvent(
      updatableAgreement1.id
    );

    expect(agreement1StateUpdateEvent).toMatchObject({
      type: "AgreementSetMissingCertifiedAttributesByPlatform",
      event_version: 2,
      version: "1",
      stream_id: updatableAgreement1.id,
    });

    const agreement1StateUpdateEventData = decodeProtobufPayload({
      messageType: AgreementSuspendedByPlatformV2,
      payload: agreement1StateUpdateEvent.data,
    });

    expect(agreement1StateUpdateEventData).toMatchObject({
      agreement: toAgreementV2({
        ...updatableAgreement1,
        state: agreementState.missingCertifiedAttributes,
        suspendedByPlatform: true,
      }),
    });

    const agreement2StateUpdateEvent = await readLastAgreementEvent(
      updatableAgreement2.id
    );

    expect(agreement2StateUpdateEvent).toMatchObject({
      type: "AgreementSuspendedByPlatform",
      event_version: 2,
      version: "1",
      stream_id: updatableAgreement2.id,
    });

    const agreement2StateUpdateEventData = decodeProtobufPayload({
      messageType: AgreementSuspendedByPlatformV2,
      payload: agreement2StateUpdateEvent.data,
    });

    expect(agreement2StateUpdateEventData).toMatchObject({
      agreement: toAgreementV2({
        ...updatableAgreement2,
        state: agreementState.suspended,
        suspendedByPlatform: true,
      }),
    });
  });

  it("updates the state of updatable Agreements to Active or Draft when the given attribute is satisfied", async () => {
    // Tests the following state transitions:
    // - Suspended -> Active
    // - MissingCertifiedAttributes -> Draft

    const authData = {
      ...getRandomAuthData(),
      userRoles: [userRoles.INTERNAL_ROLE],
    };

    const producerId: TenantId = generateId();

    // Create a consumer with all valid attributes,
    // and use one of these attributes + the consumer as inputs to computeAgreementsStateByAttribute.
    // This simulates the fact that an attribute has been certified for the consumer,
    // triggering a consequent call to computeAgreementsStateByAttribute.
    const tenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const tenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const tenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producerId,
          verificationDate: new Date(),
          extensionDate: new Date(new Date().getTime() + 3600 * 1000),
        },
      ],
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        tenantCertifiedAttribute,
        tenantDeclaredAttribute,
        tenantVerifiedAttribute,
      ],
    };

    const descriptor1: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        certified: [[getMockEServiceAttribute(tenantCertifiedAttribute.id)]],
        declared: [[getMockEServiceAttribute(tenantDeclaredAttribute.id)]],
        verified: [[getMockEServiceAttribute(tenantVerifiedAttribute.id)]],
      },
    };
    const eservice1: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor1],
    };

    const descriptor2: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        certified: [[getMockEServiceAttribute(tenantCertifiedAttribute.id)]],
        declared: [[getMockEServiceAttribute(tenantDeclaredAttribute.id)]],
        verified: [[getMockEServiceAttribute(tenantVerifiedAttribute.id)]],
      },
    };

    const eservice2: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor2],
    };

    const updatableAgreement1: Agreement = {
      ...getMockAgreement(
        eservice1.id,
        consumer.id,
        agreementState.missingCertifiedAttributes
      ),
      descriptorId: eservice1.descriptors[0].id,
      producerId: eservice1.producerId,
      suspendedByPlatform: true,
    };

    const updatableAgreement2: Agreement = {
      ...getMockAgreement(eservice2.id, consumer.id, agreementState.suspended),
      descriptorId: eservice2.descriptors[0].id,
      producerId: eservice2.producerId,
      suspendedByPlatform: true,
      suspendedByConsumer: false,
      suspendedByProducer: false,
    };

    const nonUpdatableAgreement = {
      ...getMockAgreement(
        eservice1.id,
        consumer.id,
        randomArrayItem([agreementState.archived, agreementState.rejected])
      ),
      descriptorId: eservice1.descriptors[0].id,
      producerId: eservice1.producerId,
    };

    await addOneEService(eservice1);
    await addOneEService(eservice2);
    await addOneAgreement(updatableAgreement1);
    await addOneAgreement(updatableAgreement2);
    await addOneAgreement(nonUpdatableAgreement);

    await agreementService.computeAgreementsStateByAttribute(
      randomArrayItem([
        tenantCertifiedAttribute.id,
        tenantDeclaredAttribute.id,
        tenantVerifiedAttribute.id,
      ]),
      consumer,
      {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );

    const nonUpdatableAgreementStateUpdateEvent = await readLastAgreementEvent(
      nonUpdatableAgreement.id
    );

    expect(nonUpdatableAgreementStateUpdateEvent).toMatchObject({
      type: "AgreementAdded",
      event_version: 2,
      version: "0",
      stream_id: nonUpdatableAgreement.id,
    });

    const agreement1StateUpdateEvent = await readLastAgreementEvent(
      updatableAgreement1.id
    );

    expect(agreement1StateUpdateEvent).toMatchObject({
      type: "AgreementSetDraftByPlatform",
      event_version: 2,
      version: "1",
      stream_id: updatableAgreement1.id,
    });

    const agreement1StateUpdateEventData = decodeProtobufPayload({
      messageType: AgreementSetDraftByPlatformV2,
      payload: agreement1StateUpdateEvent.data,
    });

    expect(agreement1StateUpdateEventData).toMatchObject({
      agreement: toAgreementV2({
        ...updatableAgreement1,
        state: agreementState.draft,
        suspendedByPlatform: false,
      }),
    });

    const agreement2StateUpdateEvent = await readLastAgreementEvent(
      updatableAgreement2.id
    );

    expect(agreement2StateUpdateEvent).toMatchObject({
      type: "AgreementUnsuspendedByPlatform",
      event_version: 2,
      version: "1",
      stream_id: updatableAgreement2.id,
    });

    const agreement2StateUpdateEventData = decodeProtobufPayload({
      messageType: AgreementUnsuspendedByPlatformV2,
      payload: agreement2StateUpdateEvent.data,
    });

    expect(agreement2StateUpdateEventData).toMatchObject({
      agreement: toAgreementV2({
        ...updatableAgreement2,
        state: agreementState.active,
        suspendedByPlatform: false,
      }),
    });
  });

  it("suspends an Agreement by platform even when the Agreement is already suspended but with suspendedByPlatform = false", async () => {
    // Tests the following state transitions:
    // - Suspended -> Suspended

    const authData = {
      ...getRandomAuthData(),
      userRoles: [userRoles.INTERNAL_ROLE],
    };

    const invalidCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        invalidCertifiedAttribute,
        getMockDeclaredTenantAttribute(),
        getMockVerifiedTenantAttribute(),
      ],
    };

    const descriptor1: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        certified: [[getMockEServiceAttribute(consumer.attributes[0].id)]],
        declared: [[getMockEServiceAttribute(consumer.attributes[1].id)]],
        verified: [[getMockEServiceAttribute(consumer.attributes[2].id)]],
      },
    };
    const eservice1: EService = {
      ...getMockEService(),
      producerId: generateId(),
      descriptors: [descriptor1],
    };

    const updatableAgreement1: Agreement = {
      ...getMockAgreement(eservice1.id, consumer.id, agreementState.suspended),
      descriptorId: eservice1.descriptors[0].id,
      producerId: eservice1.producerId,
      suspendedByPlatform: false,
    };

    await addOneEService(eservice1);
    await addOneAgreement(updatableAgreement1);

    await agreementService.computeAgreementsStateByAttribute(
      invalidCertifiedAttribute.id,
      consumer,
      {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );

    const agreement1StateUpdateEvent = await readLastAgreementEvent(
      updatableAgreement1.id
    );

    expect(agreement1StateUpdateEvent).toMatchObject({
      type: "AgreementSuspendedByPlatform",
      event_version: 2,
      version: "1",
      stream_id: updatableAgreement1.id,
    });

    const agreement1StateUpdateEventData = decodeProtobufPayload({
      messageType: AgreementSuspendedByPlatformV2,
      payload: agreement1StateUpdateEvent.data,
    });

    expect(agreement1StateUpdateEventData).toMatchObject({
      agreement: toAgreementV2({
        ...updatableAgreement1,
        state: agreementState.suspended,
        suspendedByPlatform: true,
      }),
    });
  });
});
