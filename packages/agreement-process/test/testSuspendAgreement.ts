/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable fp/no-delete */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { v4 as uuidv4 } from "uuid";
import {
  Agreement,
  AgreementId,
  AgreementUpdatedV1,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Descriptor,
  EService,
  TenantId,
  VerifiedTenantAttribute,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import { agreementSuspendableStates } from "../src/model/domain/validators.js";
import { toAgreementV1 } from "../src/model/domain/toEvent.js";
import { createStamp } from "../src/services/agreementStampUtils.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  descriptorNotFound,
  eServiceNotFound,
  operationNotAllowed,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  postgresDB,
  agreements,
  agreementService,
  eservices,
  tenants,
} from "./agreementService.integration.test.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readLastAgreementEvent,
} from "./utils.js";

export const testSuspendAgreement = (): ReturnType<typeof describe> =>
  describe("suspend agreement", () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should succeed when requester is Consumer or Producer, Consumer has all attributes satisfied, and the Agreement is in an suspendable state", async () => {
      /* If the consumer has all the attributes satisfied,
      the agreement will be suspended with suspendedByPlatform flag set to false
      and suspendedByConsumer or suspendedByProducer flag set
      to true depending on the requester (consumer or producer) */
      const producerId = generateId<TenantId>();

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

      const consumer = {
        ...getMockTenant(),
        attributes: [
          tenantCertifiedAttribute,
          tenantDeclaredAttribute,
          tenantVerifiedAttribute,
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

      const agreement: Agreement = {
        ...getMockAgreement(),
        consumerId: consumer.id,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: eservice.producerId,
        state: randomArrayItem(agreementSuspendableStates),
      };

      await addOneTenant(consumer, tenants);
      await addOneEService(eservice, eservices);
      await addOneAgreement(agreement, postgresDB, agreements);

      const requesterId = randomArrayItem([
        agreement.consumerId,
        agreement.producerId,
      ]);
      const authData = getRandomAuthData(requesterId);

      await agreementService.suspendAgreement(agreement.id, authData, uuidv4());

      const agreementEvent = await readLastAgreementEvent(
        agreement.id,
        postgresDB
      );

      expect(agreementEvent).toMatchObject({
        type: "AgreementUpdated",
        event_version: 1,
        version: "0",
        stream_id: agreement.id,
      });

      const actualAgreementSuspended = decodeProtobufPayload({
        messageType: AgreementUpdatedV1,
        payload: agreementEvent.data,
      }).agreement;

      const isConsumer = requesterId === agreement.consumerId;
      const expectedStamps = {
        suspensionByConsumer: isConsumer
          ? {
              who: authData.userId,
              when: new Date(),
            }
          : agreement.stamps.suspensionByConsumer,
        suspensionByProducer: !isConsumer
          ? {
              who: authData.userId,
              when: new Date(),
            }
          : agreement.stamps.suspensionByProducer,
      };
      const expectedSuspensionFlags = {
        suspendedByConsumer: isConsumer
          ? true
          : agreement.suspendedByConsumer ?? false,
        suspendedByProducer: !isConsumer
          ? true
          : agreement.suspendedByProducer ?? false,
        suspendedByPlatform: false,
      };
      const expectedAgreementSuspended: Agreement = {
        ...agreement,
        ...expectedSuspensionFlags,
        state: agreementState.suspended,
        suspendedAt: agreement.suspendedAt ?? new Date(),
        stamps: {
          ...agreement.stamps,
          ...expectedStamps,
        },
      };
      expect(actualAgreementSuspended).toMatchObject(
        toAgreementV1(expectedAgreementSuspended)
      );
    });

    it("should succeed when requester is Consumer or Producer, Consumer attributes are not satisfied, and the Agreement is in an suspendable state", async () => {
      /* If the consumer DOES NOT have all the attributes satisfied,
      the agreement will be suspended with suspendedByPlatform flag set to true
      and suspendedByConsumer or suspendedByProducer flag set
      to true depending on the requester (consumer or producer) */
      const producerId = generateId<TenantId>();

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

      const consumer = {
        ...getMockTenant(),
        attributes: [
          tenantVerifiedAttribute,
          // Missing certified and declared attributes from the descriptor
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

      const agreement: Agreement = {
        ...getMockAgreement(),
        consumerId: consumer.id,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: eservice.producerId,
        state: randomArrayItem(agreementSuspendableStates),
      };

      await addOneTenant(consumer, tenants);
      await addOneEService(eservice, eservices);
      await addOneAgreement(agreement, postgresDB, agreements);

      const requesterId = randomArrayItem([
        agreement.consumerId,
        agreement.producerId,
      ]);
      const authData = getRandomAuthData(requesterId);

      await agreementService.suspendAgreement(agreement.id, authData, uuidv4());

      const agreementEvent = await readLastAgreementEvent(
        agreement.id,
        postgresDB
      );

      expect(agreementEvent).toMatchObject({
        type: "AgreementUpdated",
        event_version: 1,
        version: "0",
        stream_id: agreement.id,
      });

      const actualAgreementSuspended = decodeProtobufPayload({
        messageType: AgreementUpdatedV1,
        payload: agreementEvent.data,
      }).agreement;

      const isConsumer = requesterId === agreement.consumerId;
      const expectedStamps = {
        suspensionByConsumer: isConsumer
          ? {
              who: authData.userId,
              when: new Date(),
            }
          : agreement.stamps.suspensionByConsumer,
        suspensionByProducer: !isConsumer
          ? {
              who: authData.userId,
              when: new Date(),
            }
          : agreement.stamps.suspensionByProducer,
      };
      const expectedSuspensionFlags = {
        suspendedByConsumer: isConsumer
          ? true
          : agreement.suspendedByConsumer ?? false,
        suspendedByProducer: !isConsumer
          ? true
          : agreement.suspendedByProducer ?? false,
        suspendedByPlatform: true, // This is the difference with the previous test
      };
      const expectedAgreementSuspended: Agreement = {
        ...agreement,
        ...expectedSuspensionFlags,
        state: agreementState.suspended,
        suspendedAt: agreement.suspendedAt ?? new Date(),
        stamps: {
          ...agreement.stamps,
          ...expectedStamps,
        },
      };
      expect(actualAgreementSuspended).toMatchObject(
        toAgreementV1(expectedAgreementSuspended)
      );
    });

    it("should succeed when requester is Consumer or Producer, Agreement producer and consumer are the same, and the Agreement is in an suspendable state", async () => {
      /* If the consumer and producer of the agreement are the same, there is no need to check the attributes.
      the agreement will be suspended with suspendedByPlatform flag set to false
      and suspendedByConsumer and suspendedByProducer flags both set to true */

      const producerAndConsumerId = generateId<TenantId>();

      const consumer = getMockTenant(producerAndConsumerId);
      const descriptor: Descriptor = getMockDescriptorPublished();

      const eservice: EService = {
        ...getMockEService(),
        producerId: producerAndConsumerId,
        descriptors: [descriptor],
      };

      const agreement: Agreement = {
        ...getMockAgreement(),
        consumerId: consumer.id,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: eservice.producerId,
        state: randomArrayItem(agreementSuspendableStates),
      };

      await addOneTenant(consumer, tenants);
      await addOneEService(eservice, eservices);
      await addOneAgreement(agreement, postgresDB, agreements);

      const authData = getRandomAuthData(producerAndConsumerId);

      await agreementService.suspendAgreement(agreement.id, authData, uuidv4());

      const agreementEvent = await readLastAgreementEvent(
        agreement.id,
        postgresDB
      );

      expect(agreementEvent).toMatchObject({
        type: "AgreementUpdated",
        event_version: 1,
        version: "0",
        stream_id: agreement.id,
      });

      const actualAgreementSuspended = decodeProtobufPayload({
        messageType: AgreementUpdatedV1,
        payload: agreementEvent.data,
      }).agreement;

      const expectedAgreementSuspended: Agreement = {
        ...agreement,
        suspendedByConsumer: true,
        suspendedByProducer: true,
        suspendedByPlatform: false,
        state: agreementState.suspended,
        suspendedAt: agreement.suspendedAt ?? new Date(),
        stamps: {
          ...agreement.stamps,
          suspensionByConsumer: {
            who: authData.userId,
            when: new Date(),
          },
          suspensionByProducer: {
            who: authData.userId,
            when: new Date(),
          },
        },
      };
      expect(actualAgreementSuspended).toMatchObject(
        toAgreementV1(expectedAgreementSuspended)
      );
    });

    it("should preserve the suspension flags and the stamps that it does not update", async () => {
      const producerId = generateId<TenantId>();

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

      const consumer = {
        ...getMockTenant(),
        attributes: [
          tenantCertifiedAttribute,
          tenantDeclaredAttribute,
          tenantVerifiedAttribute,
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

      const requesterId = randomArrayItem([consumer.id, producerId]);

      const authData = getRandomAuthData(requesterId);
      const agreement: Agreement = {
        ...getMockAgreement(),
        consumerId: consumer.id,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: eservice.producerId,
        state: agreementState.suspended,
        suspendedByConsumer: randomBoolean(),
        suspendedByProducer: randomBoolean(),
        suspendedByPlatform: randomBoolean(),
        stamps: {
          activation: createStamp(authData),
          archiving: createStamp(authData),
          rejection: createStamp(authData),
          submission: createStamp(authData),
          upgrade: createStamp(authData),
          suspensionByConsumer: createStamp(authData),
          suspensionByProducer: createStamp(authData),
        },
      };

      await addOneTenant(consumer, tenants);
      await addOneEService(eservice, eservices);
      await addOneAgreement(agreement, postgresDB, agreements);

      await agreementService.suspendAgreement(agreement.id, authData, uuidv4());

      const agreementEvent = await readLastAgreementEvent(
        agreement.id,
        postgresDB
      );

      expect(agreementEvent).toMatchObject({
        type: "AgreementUpdated",
        event_version: 1,
        version: "0",
        stream_id: agreement.id,
      });

      const actualAgreementSuspended = decodeProtobufPayload({
        messageType: AgreementUpdatedV1,
        payload: agreementEvent.data,
      }).agreement;

      const isConsumer = requesterId === agreement.consumerId;
      const expectedStamps = {
        suspensionByConsumer: isConsumer
          ? {
              who: authData.userId,
              when: new Date(),
            }
          : agreement.stamps.suspensionByConsumer,
        suspensionByProducer: !isConsumer
          ? {
              who: authData.userId,
              when: new Date(),
            }
          : agreement.stamps.suspensionByProducer,
      };
      const expectedSuspensionFlags = {
        suspendedByConsumer: isConsumer
          ? true
          : agreement.suspendedByConsumer ?? false,
        suspendedByProducer: !isConsumer
          ? true
          : agreement.suspendedByProducer ?? false,
        suspendedByPlatform: false,
      };
      const expectedAgreementSuspended: Agreement = {
        ...agreement,
        ...expectedSuspensionFlags,
        state: agreementState.suspended,
        suspendedAt: agreement.suspendedAt ?? new Date(),
        stamps: {
          ...agreement.stamps,
          ...expectedStamps,
        },
      };
      expect(actualAgreementSuspended).toMatchObject(
        toAgreementV1(expectedAgreementSuspended)
      );
    });

    it("should throw an agreementNotFound error when the agreement does not exist", async () => {
      const authData = getRandomAuthData();
      const agreementId = generateId<AgreementId>();
      await expect(
        agreementService.suspendAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(agreementNotFound(agreementId));
    });

    it("should throw operationNotAllowed when the requester is not the Consumer or the Producer", async () => {
      const authData = getRandomAuthData();
      const agreement = getMockAgreement();
      await addOneAgreement(agreement, postgresDB, agreements);
      await expect(
        agreementService.suspendAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
    });

    it("should throw agreementNotInExpectedState when the agreement is not in a rejectable state", async () => {
      const agreement = {
        ...getMockAgreement(),
        state: randomArrayItem(
          Object.values(agreementState).filter(
            (s) => !agreementSuspendableStates.includes(s)
          )
        ),
      };
      await addOneAgreement(agreement, postgresDB, agreements);
      const authData = getRandomAuthData(agreement.producerId);
      await expect(
        agreementService.suspendAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(
        agreementNotInExpectedState(agreement.id, agreement.state)
      );
    });

    it("should throw an eServiceNotFound error when the eService does not exist", async () => {
      const agreement = {
        ...getMockAgreement(),
        state: randomArrayItem(agreementSuspendableStates),
      };
      await addOneAgreement(agreement, postgresDB, agreements);
      const authData = getRandomAuthData(agreement.producerId);
      await expect(
        agreementService.suspendAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
    });

    it("should throw a tenantNotFound error when the consumer does not exist", async () => {
      const eservice = getMockEService();
      const consumer = getMockTenant();
      const agreement = {
        ...getMockAgreement(),
        state: randomArrayItem(agreementSuspendableStates),
        eserviceId: eservice.id,
        producerId: eservice.producerId,
        consumerId: consumer.id,
      };
      await addOneAgreement(agreement, postgresDB, agreements);
      await addOneEService(eservice, eservices);
      const authData = getRandomAuthData(agreement.producerId);

      await expect(
        agreementService.suspendAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(tenantNotFound(agreement.consumerId));
    });

    it("should throw a descriptorNotFound error when the descriptor does not exist", async () => {
      const eservice = getMockEService();
      const consumer = getMockTenant();
      const agreement = {
        ...getMockAgreement(),
        state: randomArrayItem(agreementSuspendableStates),
        eserviceId: eservice.id,
        producerId: eservice.producerId,
        consumerId: consumer.id,
      };
      await addOneAgreement(agreement, postgresDB, agreements);
      await addOneEService(eservice, eservices);
      await addOneTenant(consumer, tenants);
      const authData = getRandomAuthData(agreement.producerId);

      await expect(
        agreementService.suspendAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(
        descriptorNotFound(eservice.id, agreement.descriptorId)
      );
    });
  });
