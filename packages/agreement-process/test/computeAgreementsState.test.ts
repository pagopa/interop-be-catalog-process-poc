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
  randomBoolean,
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
import { userRoles } from "pagopa-interop-commons";
import { agreementApi } from "pagopa-interop-api-clients";
import {
  addOneAgreement,
  addOneEService,
  getMockApiTenantDeclaredAttribute,
  getMockApiTenantVerifiedAttribute,
  readLastAgreementEvent,
} from "./utils.js";
import { mockAgreementRouterRequest } from "./supertestSetup.js";

describe("compute Agreements state by attribute", () => {
  describe("when the given attribute is not satisfied", async () => {
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

    const apiInvalidCertifiedAttribute: agreementApi.TenantAttribute = {
      certified: {
        id: invalidCertifiedAttribute.id,
        assignmentTimestamp:
          invalidCertifiedAttribute.assignmentTimestamp.toISOString(),
        revocationTimestamp:
          invalidCertifiedAttribute.revocationTimestamp?.toISOString(),
      },
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        invalidCertifiedAttribute,
        getMockDeclaredTenantAttribute(),
        getMockVerifiedTenantAttribute(),
      ],
    };

    const apiConsumer: agreementApi.CompactTenant = {
      id: consumer.id,
      attributes: [
        apiInvalidCertifiedAttribute,
        getMockApiTenantDeclaredAttribute(),
        getMockApiTenantVerifiedAttribute(),
      ],
    };

    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        certified: [[getMockEServiceAttribute(consumer.attributes[0].id)]],
        declared: [[getMockEServiceAttribute(consumer.attributes[1].id)]],
        verified: [[getMockEServiceAttribute(consumer.attributes[2].id)]],
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      producerId: generateId(),
      descriptors: [descriptor],
    };

    it("updates the state of an updatable Agreement from Active to Suspended", async () => {
      await addOneEService(eservice);

      const updatableActiveAgreement: Agreement = {
        ...getMockAgreement(eservice.id, consumer.id, agreementState.active),
        descriptorId: eservice.descriptors[0].id,
        producerId: eservice.producerId,
        suspendedByPlatform: false,
      };

      await addOneAgreement(updatableActiveAgreement);

      await mockAgreementRouterRequest.post({
        path: "/compute/agreementsState",
        body: {
          attributeId: invalidCertifiedAttribute.id,
          consumer: apiConsumer,
        },
        authData,
      });

      const agreementStateUpdateEvent = await readLastAgreementEvent(
        updatableActiveAgreement.id
      );

      expect(agreementStateUpdateEvent).toMatchObject({
        type: "AgreementSuspendedByPlatform",
        event_version: 2,
        version: "1",
        stream_id: updatableActiveAgreement.id,
      });

      const agreementStateUpdateEventData = decodeProtobufPayload({
        messageType: AgreementSuspendedByPlatformV2,
        payload: agreementStateUpdateEvent.data,
      });

      expect(agreementStateUpdateEventData).toMatchObject({
        agreement: toAgreementV2({
          ...updatableActiveAgreement,
          state: agreementState.suspended,
          suspendedByPlatform: true,
        }),
      });
    });

    it.each([agreementState.draft, agreementState.pending])(
      "updates the state of an updatable Agreement from %s to MissingCertifiedAttributes",
      async (state) => {
        await addOneEService(eservice);

        const updatableDraftOrPendingAgreement: Agreement = {
          ...getMockAgreement(eservice.id, consumer.id, state),
          descriptorId: eservice.descriptors[0].id,
          producerId: eservice.producerId,
          suspendedByPlatform: false,
        };

        await addOneAgreement(updatableDraftOrPendingAgreement);

        await mockAgreementRouterRequest.post({
          path: "/compute/agreementsState",
          body: {
            attributeId: invalidCertifiedAttribute.id,
            consumer: apiConsumer,
          },
          authData,
        });

        const agreementStateUpdateEvent = await readLastAgreementEvent(
          updatableDraftOrPendingAgreement.id
        );

        expect(agreementStateUpdateEvent).toMatchObject({
          type: "AgreementSetMissingCertifiedAttributesByPlatform",
          event_version: 2,
          version: "1",
          stream_id: updatableDraftOrPendingAgreement.id,
        });

        const agreementStateUpdateEventData = decodeProtobufPayload({
          messageType: AgreementSuspendedByPlatformV2,
          payload: agreementStateUpdateEvent.data,
        });

        expect(agreementStateUpdateEventData).toMatchObject({
          agreement: toAgreementV2({
            ...updatableDraftOrPendingAgreement,
            state: agreementState.missingCertifiedAttributes,
            suspendedByPlatform: true,
          }),
        });
      }
    );

    it("suspends an Agreement by platform even when the Agreement is already suspended but with suspendedByPlatform = false", async () => {
      await addOneEService(eservice);

      // At least one of these flags must be true
      const suspendedByConsumer = randomBoolean();
      const suspendedByProducer = !suspendedByConsumer ? true : randomBoolean();

      const updatableSuspendedAgreement: Agreement = {
        ...getMockAgreement(eservice.id, consumer.id, agreementState.suspended),
        descriptorId: eservice.descriptors[0].id,
        producerId: eservice.producerId,
        suspendedByPlatform: false,
        suspendedByConsumer,
        suspendedByProducer,
      };

      await addOneAgreement(updatableSuspendedAgreement);

      await mockAgreementRouterRequest.post({
        path: "/compute/agreementsState",
        body: {
          attributeId: invalidCertifiedAttribute.id,
          consumer: apiConsumer,
        },
        authData,
      });

      const agreementStateUpdateEvent = await readLastAgreementEvent(
        updatableSuspendedAgreement.id
      );

      expect(agreementStateUpdateEvent).toMatchObject({
        type: "AgreementSuspendedByPlatform",
        event_version: 2,
        version: "1",
        stream_id: updatableSuspendedAgreement.id,
      });

      const agreementStateUpdateEventData = decodeProtobufPayload({
        messageType: AgreementSuspendedByPlatformV2,
        payload: agreementStateUpdateEvent.data,
      });

      expect(agreementStateUpdateEventData).toMatchObject({
        agreement: toAgreementV2({
          ...updatableSuspendedAgreement,
          state: agreementState.suspended,
          suspendedByPlatform: true,
        }),
      });
    });
  });

  describe("when the given attribute is satisfied", async () => {
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

    const apiTenantCertifiedAttribute: agreementApi.TenantAttribute = {
      certified: {
        id: tenantCertifiedAttribute.id,
        assignmentTimestamp:
          tenantCertifiedAttribute.assignmentTimestamp.toISOString(),
        revocationTimestamp:
          tenantCertifiedAttribute.revocationTimestamp?.toISOString(),
      },
    };

    const apiTenantDeclaredAttribute: agreementApi.TenantAttribute = {
      declared: {
        id: tenantDeclaredAttribute.id,
        assignmentTimestamp:
          tenantDeclaredAttribute.assignmentTimestamp.toISOString(),
        revocationTimestamp:
          tenantDeclaredAttribute.revocationTimestamp?.toISOString(),
      },
    };

    const apiTenantVerifiedAttribute: agreementApi.TenantAttribute = {
      verified: {
        id: tenantVerifiedAttribute.id,
        assignmentTimestamp:
          tenantVerifiedAttribute.assignmentTimestamp.toISOString(),
        verifiedBy: tenantVerifiedAttribute.verifiedBy.map((data) => ({
          ...data,
          verificationDate: data.verificationDate.toISOString(),
          expirationDate: data.expirationDate?.toISOString(),
          extensionDate: data.extensionDate?.toISOString(),
        })),
        revokedBy: tenantVerifiedAttribute.revokedBy.map((data) => ({
          ...data,
          verificationDate: data.verificationDate.toISOString(),
          expirationDate: data.expirationDate?.toISOString(),
          extensionDate: data.extensionDate?.toISOString(),
          revocationDate: data.revocationDate.toISOString(),
        })),
      },
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        tenantCertifiedAttribute,
        tenantDeclaredAttribute,
        tenantVerifiedAttribute,
      ],
    };

    const apiConsumer: agreementApi.CompactTenant = {
      id: consumer.id,
      attributes: [
        apiTenantCertifiedAttribute,
        apiTenantDeclaredAttribute,
        apiTenantVerifiedAttribute,
      ],
    };

    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        certified: [[getMockEServiceAttribute(tenantCertifiedAttribute.id)]],
        declared: [[getMockEServiceAttribute(tenantDeclaredAttribute.id)]],
        verified: [[getMockEServiceAttribute(tenantVerifiedAttribute.id)]],
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor],
    };

    it("updates the state of an updatable Agreement from Suspended to Active", async () => {
      await addOneEService(eservice);

      const updatableSuspendedAgreement: Agreement = {
        ...getMockAgreement(eservice.id, consumer.id, agreementState.suspended),
        descriptorId: eservice.descriptors[0].id,
        producerId: eservice.producerId,
        suspendedByPlatform: true,
        suspendedByConsumer: false,
        suspendedByProducer: false,
      };

      await addOneAgreement(updatableSuspendedAgreement);

      await mockAgreementRouterRequest.post({
        path: "/compute/agreementsState",
        body: {
          attributeId: randomArrayItem([
            tenantCertifiedAttribute.id,
            tenantDeclaredAttribute.id,
            tenantVerifiedAttribute.id,
          ]),
          consumer: apiConsumer,
        },
        authData,
      });

      const agreementStateUpdateEvent = await readLastAgreementEvent(
        updatableSuspendedAgreement.id
      );

      expect(agreementStateUpdateEvent).toMatchObject({
        type: "AgreementUnsuspendedByPlatform",
        event_version: 2,
        version: "1",
        stream_id: updatableSuspendedAgreement.id,
      });

      const agreementStateUpdateEventData = decodeProtobufPayload({
        messageType: AgreementUnsuspendedByPlatformV2,
        payload: agreementStateUpdateEvent.data,
      });

      expect(agreementStateUpdateEventData).toMatchObject({
        agreement: toAgreementV2({
          ...updatableSuspendedAgreement,
          state: agreementState.active,
          suspendedByPlatform: false,
        }),
      });
    });

    it("updates the state of an updatable Agreement from MissingCertifiedAttributes to Draft", async () => {
      await addOneEService(eservice);

      const updatableMissingCertAttributesAgreement: Agreement = {
        ...getMockAgreement(
          eservice.id,
          consumer.id,
          agreementState.missingCertifiedAttributes
        ),
        descriptorId: eservice.descriptors[0].id,
        producerId: eservice.producerId,
        suspendedByPlatform: true,
      };

      await addOneAgreement(updatableMissingCertAttributesAgreement);

      await mockAgreementRouterRequest.post({
        path: "/compute/agreementsState",
        body: {
          attributeId: randomArrayItem([
            tenantCertifiedAttribute.id,
            tenantDeclaredAttribute.id,
            tenantVerifiedAttribute.id,
          ]),
          consumer: apiConsumer,
        },
        authData,
      });

      const agreementStateUpdateEvent = await readLastAgreementEvent(
        updatableMissingCertAttributesAgreement.id
      );

      expect(agreementStateUpdateEvent).toMatchObject({
        type: "AgreementSetDraftByPlatform",
        event_version: 2,
        version: "1",
        stream_id: updatableMissingCertAttributesAgreement.id,
      });

      const agreementStateUpdateEventData = decodeProtobufPayload({
        messageType: AgreementSetDraftByPlatformV2,
        payload: agreementStateUpdateEvent.data,
      });

      expect(agreementStateUpdateEventData).toMatchObject({
        agreement: toAgreementV2({
          ...updatableMissingCertAttributesAgreement,
          state: agreementState.draft,
          suspendedByPlatform: false,
        }),
      });
    });

    it("un-suspends an Agreement by platform, even if the Agreement remains suspended because suspended by producer or consumer", async () => {
      await addOneEService(eservice);

      // At least one of these flags must be true
      const suspendedByProducer = randomBoolean();
      const suspendedByConsumer = !suspendedByProducer ? true : randomBoolean();

      const updatableSuspendedAgreement: Agreement = {
        ...getMockAgreement(eservice.id, consumer.id, agreementState.suspended),
        descriptorId: eservice.descriptors[0].id,
        producerId: eservice.producerId,
        suspendedByPlatform: true,
        suspendedByConsumer,
        suspendedByProducer,
      };

      await addOneAgreement(updatableSuspendedAgreement);

      await mockAgreementRouterRequest.post({
        path: "/compute/agreementsState",
        body: {
          attributeId: randomArrayItem([
            tenantCertifiedAttribute.id,
            tenantDeclaredAttribute.id,
            tenantVerifiedAttribute.id,
          ]),
          consumer: apiConsumer,
        },
        authData,
      });

      const agreementStateUpdateEvent = await readLastAgreementEvent(
        updatableSuspendedAgreement.id
      );

      expect(agreementStateUpdateEvent).toMatchObject({
        type: "AgreementUnsuspendedByPlatform",
        event_version: 2,
        version: "1",
        stream_id: updatableSuspendedAgreement.id,
      });

      const agreementStateUpdateEventData = decodeProtobufPayload({
        messageType: AgreementUnsuspendedByPlatformV2,
        payload: agreementStateUpdateEvent.data,
      });

      expect(agreementStateUpdateEventData).toMatchObject({
        agreement: toAgreementV2({
          ...updatableSuspendedAgreement,
          state: agreementState.suspended,
          suspendedByPlatform: false,
        }),
      });
    });
  });

  it("updates the state of multiple updatable Agreements for multiple Eservices, without modifying non-updatable Agreements", async () => {
    const authData = {
      ...getRandomAuthData(),
      userRoles: [userRoles.INTERNAL_ROLE],
    };

    const invalidCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const apiInvalidCertifiedAttribute: agreementApi.TenantAttribute = {
      certified: {
        id: invalidCertifiedAttribute.id,
        assignmentTimestamp:
          invalidCertifiedAttribute.assignmentTimestamp.toISOString(),
        revocationTimestamp:
          invalidCertifiedAttribute.revocationTimestamp?.toISOString(),
      },
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        invalidCertifiedAttribute,
        getMockDeclaredTenantAttribute(),
        getMockVerifiedTenantAttribute(),
      ],
    };

    const apiConsumer: agreementApi.CompactTenant = {
      id: consumer.id,
      attributes: [
        apiInvalidCertifiedAttribute,
        getMockApiTenantDeclaredAttribute(),
        getMockApiTenantVerifiedAttribute(),
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

    await mockAgreementRouterRequest.post({
      path: "/compute/agreementsState",
      body: {
        attributeId: invalidCertifiedAttribute.id,
        consumer: apiConsumer,
      },
      authData,
    });

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
});
