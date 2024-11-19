/* eslint-disable functional/immutable-data */
/* eslint-disable fp/no-delete */
import { FileManagerError, genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockCertifiedTenantAttribute,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import {
  AgreementAddedV2,
  AgreementDocument,
  AgreementId,
  AgreementV2,
  DescriptorId,
  EServiceId,
  TenantId,
  agreementState,
  generateId,
  toAgreementV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  agreementClonableStates,
  agreementCloningConflictingStates,
} from "../src/model/domain/agreement-validators.js";
import {
  agreementAlreadyExists,
  agreementNotFound,
  agreementNotInExpectedState,
  descriptorNotFound,
  eServiceNotFound,
  missingCertifiedAttributesError,
  operationNotAllowed,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import { apiAgreementToAgreement } from "../src/model/domain/apiConverter.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  agreementService,
  fileManager,
  getMockConsumerDocument,
  readAgreementEventByVersion,
  uploadDocument,
} from "./utils.js";
import { mockAgreementRouterRequest } from "./supertestSetup.js";

describe("clone agreement", () => {
  const TEST_EXECUTION_DATE = new Date();

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_EXECUTION_DATE);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should succeed when requester is Consumer and the Agreement is in a clonable state", async () => {
    const authData = getRandomAuthData();
    const consumerId = authData.organizationId;

    const validCertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validCertifiedEserviceAttribute = getMockEServiceAttribute(
      validCertifiedTenantAttribute.id
    );

    const consumer = getMockTenant(consumerId, [validCertifiedTenantAttribute]);

    const descriptor = getMockDescriptorPublished(
      generateId<DescriptorId>(),
      [[validCertifiedEserviceAttribute]],
      // Declared and verified attributes shall not be validated: we add some random ones to test that
      [[getMockEServiceAttribute()]],
      [[getMockEServiceAttribute()]]
    );
    const eservice = getMockEService(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      [descriptor]
    );

    const agreementId = generateId<AgreementId>();

    const docsNumber = Math.floor(Math.random() * 10) + 1;
    const agreementConsumerDocuments = Array.from({ length: docsNumber }, () =>
      getMockConsumerDocument(agreementId)
    );
    const agreementToBeCloned = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(agreementClonableStates)
      ),
      id: agreementId,
      producerId: eservice.producerId,
      descriptorId: descriptor.id,
      consumerDocuments: agreementConsumerDocuments,
      contract: undefined,
    };

    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreementToBeCloned);

    for (const doc of agreementConsumerDocuments) {
      await uploadDocument(agreementId, doc.id, doc.name);
    }

    const anotherNonConflictingAgreement = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(
          Object.values(agreementState).filter(
            (s) => !agreementCloningConflictingStates.includes(s)
          )
        )
      ),
      producerId: eservice.producerId,
    };

    await addOneAgreement(anotherNonConflictingAgreement);

    const apiReturnedAgreement = await mockAgreementRouterRequest.post({
      path: "/agreements/:agreementId/clone",
      pathParams: { agreementId: agreementToBeCloned.id },
      authData,
    });

    const returnedAgreement = apiAgreementToAgreement(apiReturnedAgreement);

    const newAgreementId = unsafeBrandId<AgreementId>(returnedAgreement.id);

    const agreementClonedEvent = await readAgreementEventByVersion(
      newAgreementId,
      0
    );

    expect(agreementClonedEvent).toMatchObject({
      type: "AgreementAdded",
      event_version: 2,
      version: "0",
      stream_id: newAgreementId,
    });

    const agreementClonedEventPayload = decodeProtobufPayload({
      messageType: AgreementAddedV2,
      payload: agreementClonedEvent.data,
    });

    const agreementClonedAgreement = agreementClonedEventPayload.agreement;

    const expectedAgreementCloned: AgreementV2 = toAgreementV2({
      ...agreementToBeCloned,
      id: newAgreementId,
      // eserviceId: agreementToBeCloned.eserviceId,
      // descriptorId: agreementToBeCloned.descriptorId,
      // producerId: agreementToBeCloned.producerId,
      // consumerId: agreementToBeCloned.consumerId,
      // consumerNotes: agreementToBeCloned.consumerNotes,
      verifiedAttributes: [],
      certifiedAttributes: [],
      declaredAttributes: [],
      state: agreementState.draft,
      createdAt: TEST_EXECUTION_DATE,
      consumerDocuments: agreementConsumerDocuments.map<AgreementDocument>(
        (doc, i) => ({
          ...doc,
          id: unsafeBrandId(
            agreementClonedAgreement?.consumerDocuments[i].id as string
          ),
          path: agreementClonedAgreement?.consumerDocuments[i].path as string,
        })
      ),
      stamps: {},
    });

    expect(expectedAgreementCloned).toEqual(toAgreementV2(returnedAgreement));

    delete expectedAgreementCloned.suspendedAt;
    delete expectedAgreementCloned.updatedAt;
    delete expectedAgreementCloned.contract;
    expectedAgreementCloned.stamps = {};

    expect(agreementClonedEventPayload).toMatchObject({
      agreement: expectedAgreementCloned,
    });

    for (const agreementDoc of expectedAgreementCloned.consumerDocuments) {
      const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${newAgreementId}/${agreementDoc.id}/${agreementDoc.name}`;

      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toContainEqual(expectedUploadedDocumentPath);
    }
  });

  it("should throw an agreementNotFound error when the Agreement does not exist", async () => {
    await addOneAgreement(getMockAgreement());
    const authData = getRandomAuthData();
    const agreementId = generateId<AgreementId>();
    await expect(
      agreementService.cloneAgreement(agreementId, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw an operationNotAllowed error when the requester is not the Consumer", async () => {
    const authData = getRandomAuthData();
    const agreement = getMockAgreement();
    await addOneAgreement(agreement);
    await expect(
      agreementService.cloneAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw an agreementNotInExpectedState error when the Agreement is not in a clonable state", async () => {
    const authData = getRandomAuthData();
    const consumerId = authData.organizationId;
    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      consumerId,
      randomArrayItem(
        Object.values(agreementState).filter(
          (s) => !agreementClonableStates.includes(s)
        )
      )
    );

    await addOneAgreement(agreement);
    await expect(
      agreementService.cloneAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });

  it("should throw an eserviceNotFound error when the EService does not exist", async () => {
    const authData = getRandomAuthData();
    const consumerId = authData.organizationId;
    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      consumerId,
      randomArrayItem(agreementClonableStates)
    );

    await addOneAgreement(agreement);
    await expect(
      agreementService.cloneAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
  });

  it("should throw an agreementAlreadyExists error when a conflicting Agreement already exists", async () => {
    const authData = getRandomAuthData();
    const consumerId = authData.organizationId;
    const eservice = getMockEService();
    const agreement = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(agreementClonableStates)
      ),
      producerId: eservice.producerId,
    };

    const conflictingAgreement = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(agreementCloningConflictingStates)
      ),
      producerId: eservice.producerId,
    };

    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOneAgreement(conflictingAgreement);
    await expect(
      agreementService.cloneAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementAlreadyExists(consumerId, eservice.id));
  });

  it("should throw a tenantNotFound error when the Consumer does not exist", async () => {
    const authData = getRandomAuthData();
    const consumerId = authData.organizationId;

    const descriptor = getMockDescriptorPublished();
    const eservice = getMockEService(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      [descriptor]
    );
    const agreement = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(agreementClonableStates)
      ),
      producerId: eservice.producerId,
      descriptorId: descriptor.id,
    };

    const conflictingAgreement = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(
          Object.values(agreementState).filter(
            (s) => !agreementCloningConflictingStates.includes(s)
          )
        )
      ),
      producerId: eservice.producerId,
    };

    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOneAgreement(conflictingAgreement);
    await expect(
      agreementService.cloneAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(consumerId));
  });

  it("should throw a descriptorNotFound error when the Descriptor does not exist", async () => {
    const authData = getRandomAuthData();
    const consumerId = authData.organizationId;
    const consumer = getMockTenant(consumerId);
    const eservice = getMockEService();
    const agreement = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(agreementClonableStates)
      ),
      producerId: eservice.producerId,
    };

    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await expect(
      agreementService.cloneAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      descriptorNotFound(eservice.id, agreement.descriptorId)
    );
  });

  it("should throw a missingCertifiedAttributesError when the Consumer has invalid certified attributes", async () => {
    const authData = getRandomAuthData();
    const consumerId = authData.organizationId;

    const invalidCertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const invalidCertifiedEserviceAttribute = getMockEServiceAttribute(
      invalidCertifiedTenantAttribute.id
    );

    const consumer = getMockTenant(consumerId, [
      invalidCertifiedTenantAttribute,
    ]);

    const descriptor = getMockDescriptorPublished(generateId<DescriptorId>(), [
      [invalidCertifiedEserviceAttribute],
    ]);
    const eservice = getMockEService(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      [descriptor]
    );

    const agreementId = generateId<AgreementId>();

    const agreement = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(agreementClonableStates)
      ),
      id: agreementId,
      producerId: eservice.producerId,
      descriptorId: descriptor.id,
    };

    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);

    await expect(
      agreementService.cloneAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      missingCertifiedAttributesError(descriptor.id, consumerId)
    );
  });

  it("should throw a FileManagerError error when document copy fails", async () => {
    const authData = getRandomAuthData();
    const consumerId = authData.organizationId;

    const consumer = getMockTenant(consumerId);

    const descriptor = getMockDescriptorPublished();
    const eservice = getMockEService(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      [descriptor]
    );

    const agreementId = generateId<AgreementId>();

    const agreement = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(agreementClonableStates)
      ),
      id: agreementId,
      producerId: eservice.producerId,
      descriptorId: descriptor.id,
      consumerDocuments: [getMockConsumerDocument(agreementId)],
    };

    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);

    await expect(
      agreementService.cloneAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(FileManagerError);
  });
});
