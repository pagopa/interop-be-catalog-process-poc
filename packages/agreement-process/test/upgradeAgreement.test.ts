/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable fp/no-delete */
import {
  FileManagerError,
  formatDateyyyyMMddHHmmss,
  genericLogger,
} from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockAttribute,
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
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementAddedV2,
  AgreementArchivedByUpgradeV2,
  AgreementDocument,
  AgreementId,
  AgreementUpgradedV2,
  Descriptor,
  EService,
  EServiceId,
  Tenant,
  TenantId,
  agreementState,
  attributeKind,
  descriptorState,
  fromAgreementV2,
  generateId,
  toAgreementV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { selfcareV2ClientApi } from "pagopa-interop-api-clients";
import { agreementUpgradableStates } from "../src/model/domain/agreement-validators.js";
import {
  agreementAlreadyExists,
  agreementNotFound,
  agreementNotInExpectedState,
  descriptorNotFound,
  eServiceNotFound,
  missingCertifiedAttributesError,
  noNewerDescriptor,
  operationNotAllowed,
  publishedDescriptorNotFound,
  tenantNotFound,
  unexpectedVersionFormat,
} from "../src/model/domain/errors.js";
import { createStamp } from "../src/services/agreementStampUtils.js";
import { config } from "../src/config/config.js";
import { agreementToApiAgreement } from "../src/model/domain/apiConverter.js";
import {
  addOneAgreement,
  addOneAttribute,
  addOneEService,
  addOneTenant,
  agreementService,
  fileManager,
  getMockConsumerDocument,
  getMockContract,
  readAgreementEventByVersion,
  uploadDocument,
} from "./utils.js";
import {
  mockAgreementRouterRequest,
  mockSelfcareV2ClientCall,
} from "./supertestSetup.js";

describe("upgrade Agreement", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  const mockSelfcareUserResponse: selfcareV2ClientApi.UserResponse = {
    email: "test@test.com",
    name: "Test Name",
    surname: "Test Surname",
    taxCode: "TSTTSTTSTTSTTSTT",
    id: generateId(),
  };

  beforeEach(async () => {
    // eslint-disable-next-line functional/immutable-data
    mockSelfcareV2ClientCall(mockSelfcareUserResponse);
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it("should succeed with valid Verified and Declared attributes when consumer and producer are the same", async () => {
    const producerAndConsumerId = generateId<TenantId>();

    // Certified attributes are not verified when producer and consumer are the same,
    // so the test shall pass even with this invalid attribute
    const invalidCertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const validVerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producerAndConsumerId,
          verificationDate: new Date(),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };
    await addOneAttribute(
      getMockAttribute(attributeKind.verified, validVerifiedTenantAttribute.id)
    );

    const validDeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };
    await addOneAttribute(
      getMockAttribute(attributeKind.declared, validDeclaredTenantAttribute.id)
    );

    const producerAndConsumer: Tenant = {
      ...getMockTenant(),
      id: producerAndConsumerId,
      selfcareId: generateId(),
      attributes: [
        invalidCertifiedTenantAttribute,
        validDeclaredTenantAttribute,
        validVerifiedTenantAttribute,
      ],
    };
    await addOneTenant(producerAndConsumer);

    const authData = getRandomAuthData(producerAndConsumer.id);

    const newPublishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "2",
      attributes: {
        certified: [
          [getMockEServiceAttribute(invalidCertifiedTenantAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validDeclaredTenantAttribute.id)]],
        verified: [[getMockEServiceAttribute(validVerifiedTenantAttribute.id)]],
      },
    };

    const currentDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: descriptorState.deprecated,
      version: "1",
    };
    const eservice: EService = {
      ...getMockEService(),
      producerId: producerAndConsumer.id,
      descriptors: [newPublishedDescriptor, currentDescriptor],
    };
    await addOneEService(eservice);

    const agreementId: AgreementId = generateId<AgreementId>();

    const docsNumber = Math.floor(Math.random() * 10) + 1;
    const agreementConsumerDocuments = Array.from({ length: docsNumber }, () =>
      getMockConsumerDocument(agreementId)
    );

    const agreement: Agreement = {
      ...getMockAgreement(
        eservice.id,
        producerAndConsumer.id,
        randomArrayItem(agreementUpgradableStates)
      ),
      id: agreementId,
      producerId: eservice.producerId,
      descriptorId: currentDescriptor.id,
      createdAt: new Date(),
      consumerDocuments: agreementConsumerDocuments,
      suspendedByConsumer: randomBoolean(),
      suspendedByProducer: randomBoolean(),
      stamps: {
        submission: createStamp(authData.userId),
        activation: createStamp(authData.userId),
        suspensionByConsumer: createStamp(authData.userId),
        suspensionByProducer: createStamp(authData.userId),
      },
      contract: getMockContract(
        agreementId,
        producerAndConsumer.id,
        producerAndConsumer.id
      ),
      suspendedAt: new Date(),
    };
    await addOneAgreement(agreement);

    for (const doc of agreementConsumerDocuments) {
      await uploadDocument(agreementId, doc.id, doc.name);
    }

    const returnedAgreement = await mockAgreementRouterRequest.post({
      path: "/agreements/:agreementId/upgrade",
      pathParams: { agreementId: agreement.id },
      authData,
    });
    const newAgreementId = unsafeBrandId<AgreementId>(returnedAgreement.id);

    const actualAgreementArchivedEvent = await readAgreementEventByVersion(
      agreement.id,
      1
    );

    expect(actualAgreementArchivedEvent).toMatchObject({
      type: "AgreementArchivedByUpgrade",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementArchived = decodeProtobufPayload({
      messageType: AgreementArchivedByUpgradeV2,
      payload: actualAgreementArchivedEvent.data,
    }).agreement;

    const expectedAgreementArchived: Agreement = {
      ...agreement,
      state: agreementState.archived,
      stamps: {
        ...agreement.stamps,
        archiving: {
          who: authData.userId,
          when: new Date(),
        },
      },
    };

    expect(actualAgreementArchived).toEqual(
      toAgreementV2(expectedAgreementArchived)
    );

    expect(newAgreementId).toBeDefined();

    const actualAgreementUpgradedEvent = await readAgreementEventByVersion(
      newAgreementId,
      0
    );

    expect(actualAgreementUpgradedEvent).toMatchObject({
      type: "AgreementUpgraded",
      event_version: 2,
      version: "0",
      stream_id: newAgreementId,
    });

    const actualAgreementUpgraded: Agreement = fromAgreementV2(
      decodeProtobufPayload({
        messageType: AgreementUpgradedV2,
        payload: actualAgreementUpgradedEvent.data,
      }).agreement!
    );

    const contractDocumentId = actualAgreementUpgraded.contract!.id;
    const contractCreatedAt = actualAgreementUpgraded.contract!.createdAt;
    const contractDocumentName = `${producerAndConsumer.id}_${
      producerAndConsumer.id
    }_${formatDateyyyyMMddHHmmss(contractCreatedAt)}_agreement_contract.pdf`;

    const expectedContract = {
      id: contractDocumentId,
      contentType: "application/pdf",
      createdAt: contractCreatedAt,
      path: `${config.agreementContractsPath}/${actualAgreementUpgraded.id}/${contractDocumentId}/${contractDocumentName}`,
      prettyName: "Richiesta di fruizione",
      name: contractDocumentName,
    };

    const expectedUpgradedAgreement = {
      ...agreement,
      id: newAgreementId,
      descriptorId: newPublishedDescriptor.id,
      createdAt: agreement.createdAt,
      stamps: {
        ...agreement.stamps,
        upgrade: {
          who: authData.userId,
          when: new Date(),
        },
      },
      verifiedAttributes: [{ id: validVerifiedTenantAttribute.id }],
      certifiedAttributes: [],
      declaredAttributes: [{ id: validDeclaredTenantAttribute.id }],
      consumerDocuments: agreementConsumerDocuments.map<AgreementDocument>(
        (doc, i) => ({
          ...doc,
          id: actualAgreementUpgraded?.consumerDocuments[i].id,
          path: actualAgreementUpgraded?.consumerDocuments[i].path,
        })
      ),
      contract: expectedContract,
      suspendedByPlatform: undefined,
      updatedAt: undefined,
      rejectionReason: undefined,
    };

    expect(actualAgreementUpgraded).toEqual(expectedUpgradedAgreement);
    expect(agreementToApiAgreement(expectedUpgradedAgreement)).toEqual(
      returnedAgreement
    );
    for (const agreementDoc of expectedUpgradedAgreement.consumerDocuments) {
      const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${newAgreementId}/${agreementDoc.id}/${agreementDoc.name}`;

      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toContainEqual(expectedUploadedDocumentPath);
    }
  });

  it("should succeed with valid Verified, Certified, and Declared attributes when consumer and producer are different", async () => {
    const producer = getMockTenant();

    const validVerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };
    await addOneAttribute(
      getMockAttribute(attributeKind.verified, validVerifiedTenantAttribute.id)
    );

    const validDeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };
    await addOneAttribute(
      getMockAttribute(attributeKind.declared, validDeclaredTenantAttribute.id)
    );

    const validCertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    await addOneAttribute(
      getMockAttribute(
        attributeKind.certified,
        validCertifiedTenantAttribute.id
      )
    );

    const consumer: Tenant = {
      ...getMockTenant(),
      selfcareId: generateId(),
      attributes: [
        validCertifiedTenantAttribute,
        validDeclaredTenantAttribute,
        validVerifiedTenantAttribute,
      ],
    };
    await addOneTenant(consumer);
    await addOneTenant(producer);

    const authData = getRandomAuthData(consumer.id);

    const newPublishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "2",
      attributes: {
        certified: [
          [getMockEServiceAttribute(validCertifiedTenantAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validDeclaredTenantAttribute.id)]],
        verified: [[getMockEServiceAttribute(validVerifiedTenantAttribute.id)]],
      },
    };

    const currentDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: descriptorState.deprecated,
      version: "1",
    };
    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [newPublishedDescriptor, currentDescriptor],
    };
    await addOneEService(eservice);

    const agreementId: AgreementId = generateId<AgreementId>();

    const docsNumber = Math.floor(Math.random() * 10) + 1;
    const agreementConsumerDocuments = Array.from({ length: docsNumber }, () =>
      getMockConsumerDocument(agreementId)
    );

    const agreement: Agreement = {
      ...getMockAgreement(
        eservice.id,
        consumer.id,
        randomArrayItem(agreementUpgradableStates)
      ),
      id: agreementId,
      producerId: eservice.producerId,
      descriptorId: currentDescriptor.id,
      createdAt: new Date(),
      consumerDocuments: agreementConsumerDocuments,
      suspendedByConsumer: randomBoolean(),
      suspendedByProducer: randomBoolean(),
      stamps: {
        submission: createStamp(authData.userId),
        activation: createStamp(authData.userId),
        suspensionByConsumer: createStamp(authData.userId),
        suspensionByProducer: createStamp(authData.userId),
      },
      contract: getMockContract(agreementId, consumer.id, producer.id),
      suspendedAt: new Date(),
    };
    await addOneAgreement(agreement);

    for (const doc of agreementConsumerDocuments) {
      await uploadDocument(agreementId, doc.id, doc.name);
    }

    const returnedAgreement = await mockAgreementRouterRequest.post({
      path: "/agreements/:agreementId/upgrade",
      pathParams: { agreementId: agreement.id },
      authData,
    });
    const newAgreementId = unsafeBrandId<AgreementId>(returnedAgreement.id);

    const actualAgreementArchivedEvent = await readAgreementEventByVersion(
      agreement.id,
      1
    );

    expect(actualAgreementArchivedEvent).toMatchObject({
      type: "AgreementArchivedByUpgrade",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementArchived = decodeProtobufPayload({
      messageType: AgreementArchivedByUpgradeV2,
      payload: actualAgreementArchivedEvent.data,
    }).agreement;

    const expectedAgreementArchived: Agreement = {
      ...agreement,
      state: agreementState.archived,
      stamps: {
        ...agreement.stamps,
        archiving: {
          who: authData.userId,
          when: new Date(),
        },
      },
    };

    expect(actualAgreementArchived).toEqual(
      toAgreementV2(expectedAgreementArchived)
    );

    expect(newAgreementId).toBeDefined();

    const actualAgreementUpgradedEvent = await readAgreementEventByVersion(
      newAgreementId,
      0
    );

    expect(actualAgreementUpgradedEvent).toMatchObject({
      type: "AgreementUpgraded",
      event_version: 2,
      version: "0",
      stream_id: newAgreementId,
    });

    const actualAgreementUpgraded: Agreement = fromAgreementV2(
      decodeProtobufPayload({
        messageType: AgreementUpgradedV2,
        payload: actualAgreementUpgradedEvent.data,
      }).agreement!
    );

    const contractDocumentId = actualAgreementUpgraded.contract!.id;
    const contractCreatedAt = actualAgreementUpgraded.contract!.createdAt;
    const contractDocumentName = `${consumer.id}_${
      producer.id
    }_${formatDateyyyyMMddHHmmss(contractCreatedAt)}_agreement_contract.pdf`;

    const expectedContract = {
      id: contractDocumentId,
      contentType: "application/pdf",
      createdAt: contractCreatedAt,
      path: `${config.agreementContractsPath}/${actualAgreementUpgraded.id}/${contractDocumentId}/${contractDocumentName}`,
      prettyName: "Richiesta di fruizione",
      name: contractDocumentName,
    };

    const expectedUpgradedAgreement = {
      ...agreement,
      id: newAgreementId,
      descriptorId: newPublishedDescriptor.id,
      createdAt: agreement.createdAt,
      stamps: {
        ...agreement.stamps,
        upgrade: {
          who: authData.userId,
          when: new Date(),
        },
      },
      verifiedAttributes: [{ id: validVerifiedTenantAttribute.id }],
      certifiedAttributes: [{ id: validCertifiedTenantAttribute.id }],
      declaredAttributes: [{ id: validDeclaredTenantAttribute.id }],
      consumerDocuments: agreementConsumerDocuments.map<AgreementDocument>(
        (doc, i) => ({
          ...doc,
          id: actualAgreementUpgraded?.consumerDocuments[i].id,
          path: actualAgreementUpgraded?.consumerDocuments[i].path,
        })
      ),
      contract: expectedContract,
      suspendedByPlatform: undefined,
      updatedAt: undefined,
      rejectionReason: undefined,
    };

    expect(actualAgreementUpgraded).toEqual(expectedUpgradedAgreement);
    expect(agreementToApiAgreement(expectedUpgradedAgreement)).toEqual(
      returnedAgreement
    );

    for (const agreementDoc of expectedUpgradedAgreement.consumerDocuments) {
      const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${newAgreementId}/${agreementDoc.id}/${agreementDoc.name}`;

      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toContainEqual(expectedUploadedDocumentPath);
    }
  });

  it("should succeed with invalid Declared or Verified attributes, creating a new Draft agreement", async () => {
    const producer = getMockTenant();

    const invalidVerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: new Date(), // invalid because of this
        },
      ],
    };

    const invalidDeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const validCertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const invalidAttribute = randomArrayItem([
      invalidDeclaredTenantAttribute,
      invalidVerifiedTenantAttribute,
    ]);
    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [validCertifiedTenantAttribute, invalidAttribute],
    };
    await addOneTenant(consumer);
    await addOneTenant(producer);

    const authData = getRandomAuthData(consumer.id);

    const newPublishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "2",
      attributes: {
        certified: [
          [getMockEServiceAttribute(validCertifiedTenantAttribute.id)],
        ],
        declared: [
          invalidAttribute.id === invalidDeclaredTenantAttribute.id
            ? [getMockEServiceAttribute(invalidDeclaredTenantAttribute.id)]
            : [],
        ],
        verified: [
          invalidAttribute.id === invalidVerifiedTenantAttribute.id
            ? [getMockEServiceAttribute(invalidVerifiedTenantAttribute.id)]
            : [],
        ],
      },
    };

    const currentDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: descriptorState.deprecated,
      version: "1",
    };
    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [newPublishedDescriptor, currentDescriptor],
    };
    await addOneEService(eservice);

    const agreementId: AgreementId = generateId<AgreementId>();

    const docsNumber = Math.floor(Math.random() * 10) + 1;
    const agreementConsumerDocuments = Array.from({ length: docsNumber }, () =>
      getMockConsumerDocument(agreementId)
    );

    const agreement: Agreement = {
      ...getMockAgreement(
        eservice.id,
        consumer.id,
        randomArrayItem(agreementUpgradableStates)
      ),
      id: agreementId,
      producerId: eservice.producerId,
      descriptorId: currentDescriptor.id,
      createdAt: new Date(),
      consumerDocuments: agreementConsumerDocuments,
      suspendedByConsumer: randomBoolean(),
      suspendedByProducer: randomBoolean(),
      stamps: {
        submission: createStamp(authData.userId),
        activation: createStamp(authData.userId),
        suspensionByConsumer: createStamp(authData.userId),
        suspensionByProducer: createStamp(authData.userId),
      },
      contract: getMockContract(agreementId, consumer.id, producer.id),
      suspendedAt: new Date(),
    };
    await addOneAgreement(agreement);

    for (const doc of agreementConsumerDocuments) {
      await uploadDocument(agreementId, doc.id, doc.name);
    }

    const returnedAgreement = await mockAgreementRouterRequest.post({
      path: "/agreements/:agreementId/upgrade",
      pathParams: { agreementId: agreement.id },
      authData,
    });
    const newAgreementId = unsafeBrandId<AgreementId>(returnedAgreement.id);

    expect(newAgreementId).toBeDefined();
    const actualAgreementCreatedEvent = await readAgreementEventByVersion(
      newAgreementId,
      0
    );

    expect(actualAgreementCreatedEvent).toMatchObject({
      type: "AgreementAdded",
      event_version: 2,
      version: "0",
      stream_id: newAgreementId,
    });

    const actualCreatedAgreement = fromAgreementV2(
      decodeProtobufPayload({
        messageType: AgreementAddedV2,
        payload: actualAgreementCreatedEvent.data,
      }).agreement!
    );

    const expectedCreatedAgreement = {
      ...agreement,
      id: newAgreementId,
      descriptorId: newPublishedDescriptor.id,
      state: agreementState.draft,
      createdAt: agreement.createdAt,
      verifiedAttributes: [],
      certifiedAttributes: [],
      declaredAttributes: [],
      consumerDocuments: agreementConsumerDocuments.map<AgreementDocument>(
        (doc, i) => ({
          ...doc,
          id: actualCreatedAgreement?.consumerDocuments[i].id,
          path: actualCreatedAgreement?.consumerDocuments[i].path,
        })
      ),
      stamps: {
        suspensionByConsumer: agreement.stamps.suspensionByConsumer,
        suspensionByProducer: agreement.stamps.suspensionByProducer,
      },
      suspendedByPlatform: undefined,
      updatedAt: undefined,
      rejectionReason: undefined,
      contract: undefined,
    };

    expect(actualCreatedAgreement).toEqual(expectedCreatedAgreement);
    expect(agreementToApiAgreement(expectedCreatedAgreement)).toEqual(
      returnedAgreement
    );

    for (const agreementDoc of expectedCreatedAgreement.consumerDocuments) {
      const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${newAgreementId}/${agreementDoc.id}/${agreementDoc.name}`;

      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toContainEqual(expectedUploadedDocumentPath);
    }
  });

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    const authData = getRandomAuthData();

    const agreementId = generateId<AgreementId>();
    await addOneAgreement(getMockAgreement());

    await expect(
      agreementService.upgradeAgreement(agreementId, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw an operationNotAllowed error when the requester is not the consumer", async () => {
    const authData = getRandomAuthData();

    const agreement: Agreement = getMockAgreement(
      generateId<EServiceId>(),
      generateId<TenantId>()
    );
    await addOneAgreement(agreement);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw an agreementNotInExpectedState error when the agreement doesn't have an upgradable states", async () => {
    const consumerId = generateId<TenantId>();
    const authData = getRandomAuthData(consumerId);

    const invalidAgreementState = randomArrayItem(
      Object.values(agreementState).filter(
        (s) => !agreementUpgradableStates.includes(s)
      )
    );
    const agreement: Agreement = getMockAgreement(
      generateId<EServiceId>(),
      consumerId,
      invalidAgreementState
    );
    await addOneAgreement(agreement);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });

  it("should throw an eServiceNotFound error when the eservice does not exist", async () => {
    const consumerId = generateId<TenantId>();
    const authData = getRandomAuthData(consumerId);

    const agreement: Agreement = getMockAgreement(
      generateId<EServiceId>(),
      consumerId,
      randomArrayItem(agreementUpgradableStates)
    );
    await addOneAgreement(agreement);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
  });

  it("should throw a publishedDescriptorNotFound error when a published descriptor does not exist", async () => {
    const consumerId = generateId<TenantId>();
    const authData = getRandomAuthData(consumerId);

    const nonPublishedDescriptorState = Object.values(descriptorState).filter(
      (s) => s !== descriptorState.published
    );
    const nonPublishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(nonPublishedDescriptorState),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [nonPublishedDescriptor],
    };
    await addOneEService(eservice);

    const agreement: Agreement = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(agreementUpgradableStates)
      ),
      producerId: eservice.producerId,
    };
    await addOneAgreement(agreement);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(publishedDescriptorNotFound(agreement.eserviceId));
  });

  it("should throw an unexpectedVersionFormat error when the published descriptor has an unexpected version format", async () => {
    const consumerId = generateId<TenantId>();
    const authData = getRandomAuthData(consumerId);

    const publishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "invalid-version-number",
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [publishedDescriptor],
    };
    await addOneEService(eservice);

    const agreement: Agreement = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(agreementUpgradableStates)
      ),
      producerId: eservice.producerId,
    };
    await addOneAgreement(agreement);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      unexpectedVersionFormat(agreement.eserviceId, publishedDescriptor.id)
    );
  });

  it("should throw a descriptorNotFound error when the agreement descriptor does not exist", async () => {
    const consumerId = generateId<TenantId>();
    const authData = getRandomAuthData(consumerId);

    const publishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "2",
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [publishedDescriptor],
    };
    await addOneEService(eservice);

    const agreement: Agreement = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(agreementUpgradableStates)
      ),
      producerId: eservice.producerId,
    };
    await addOneAgreement(agreement);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      descriptorNotFound(eservice.id, agreement.descriptorId)
    );
  });

  it("should throw an unexpectedVersionFormat error when the agreement descriptor has an unexpected version format", async () => {
    const consumerId = generateId<TenantId>();
    const authData = getRandomAuthData(consumerId);

    const newPublishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "2",
    };

    const currentDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: descriptorState.deprecated,
      version: "invalid-version-number",
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [newPublishedDescriptor, currentDescriptor],
    };
    await addOneEService(eservice);

    const agreement: Agreement = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(agreementUpgradableStates)
      ),
      producerId: eservice.producerId,
      descriptorId: currentDescriptor.id,
    };
    await addOneAgreement(agreement);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      unexpectedVersionFormat(eservice.id, agreement.descriptorId)
    );
  });

  it("should throw a noNewerDescriptor error when the latest published descriptor has version number lower than or equal to the agreement current descriptor", async () => {
    const consumerId = generateId<TenantId>();
    const authData = getRandomAuthData(consumerId);

    const newPublishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "1",
    };

    const currentDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: descriptorState.deprecated,
      version: randomArrayItem(["1", "2"]),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [newPublishedDescriptor, currentDescriptor],
    };
    await addOneEService(eservice);

    const agreement: Agreement = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(agreementUpgradableStates)
      ),
      producerId: eservice.producerId,
      descriptorId: currentDescriptor.id,
    };
    await addOneAgreement(agreement);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      noNewerDescriptor(eservice.id, agreement.descriptorId)
    );
  });

  it("should throw a tenantNotFound error when the consumer tenant does not exist", async () => {
    const consumerId = generateId<TenantId>();
    const authData = getRandomAuthData(consumerId);

    const newPublishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "2",
    };

    const currentDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: descriptorState.deprecated,
      version: "1",
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [newPublishedDescriptor, currentDescriptor],
    };
    await addOneEService(eservice);

    const agreement: Agreement = {
      ...getMockAgreement(
        eservice.id,
        consumerId,
        randomArrayItem(agreementUpgradableStates)
      ),
      producerId: eservice.producerId,
      descriptorId: currentDescriptor.id,
    };
    await addOneAgreement(agreement);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(consumerId));
  });

  it("should throw a tenantNotFound error when the producer tenant does not exist", async () => {
    const consumer = getMockTenant();
    await addOneTenant(consumer);
    const authData = getRandomAuthData(consumer.id);

    const newPublishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "2",
    };

    const currentDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: descriptorState.deprecated,
      version: "1",
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [newPublishedDescriptor, currentDescriptor],
    };
    await addOneEService(eservice);

    const agreement: Agreement = {
      ...getMockAgreement(
        eservice.id,
        consumer.id,
        randomArrayItem(agreementUpgradableStates)
      ),
      producerId: eservice.producerId,
      descriptorId: currentDescriptor.id,
    };
    await addOneAgreement(agreement);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(agreement.producerId));
  });

  it("should throw a missingCertifiedAttributesError error when consumer and producer are different and published descriptor has invalid certified attributes", async () => {
    const invalidCertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [invalidCertifiedTenantAttribute],
    };
    const producer = getMockTenant();
    await addOneTenant(consumer);
    await addOneTenant(producer);

    const authData = getRandomAuthData(consumer.id);

    const newPublishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "2",
      attributes: {
        certified: [
          [getMockEServiceAttribute(invalidCertifiedTenantAttribute.id)],
        ],
        declared: [],
        verified: [],
      },
    };

    const currentDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: descriptorState.deprecated,
      version: "1",
    };
    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [newPublishedDescriptor, currentDescriptor],
    };
    await addOneEService(eservice);

    const agreement: Agreement = {
      ...getMockAgreement(
        eservice.id,
        consumer.id,
        randomArrayItem(agreementUpgradableStates)
      ),
      producerId: eservice.producerId,
      descriptorId: currentDescriptor.id,
    };
    await addOneAgreement(agreement);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      missingCertifiedAttributesError(newPublishedDescriptor.id, consumer.id)
    );
  });

  it("should throw a FileManagerError error when document copy fails", async () => {
    const consumer: Tenant = getMockTenant();
    const producer = getMockTenant();
    await addOneTenant(consumer);
    await addOneTenant(producer);

    const authData = getRandomAuthData(consumer.id);

    const newPublishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "2",
      attributes: {
        certified: [],
        declared: [],
        verified: [],
      },
    };

    const currentDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: descriptorState.deprecated,
      version: "1",
    };
    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [newPublishedDescriptor, currentDescriptor],
    };
    await addOneEService(eservice);

    const agreementId: AgreementId = generateId<AgreementId>();
    const agreement: Agreement = {
      ...getMockAgreement(
        eservice.id,
        consumer.id,
        randomArrayItem(agreementUpgradableStates)
      ),
      id: agreementId,
      producerId: eservice.producerId,
      descriptorId: currentDescriptor.id,
      consumerDocuments: [getMockConsumerDocument(agreementId)],
    };
    await addOneAgreement(agreement);

    // trying to copy a document not present in the S3 bucket - no upload was performed
    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(FileManagerError);
  });

  it("should throw an agreementAlreadyExists error when creating a new draft agreement and there exists a draft conflicting agreement for the same consumer and eservice", async () => {
    const invalidDeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: new Date(),
    };
    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [invalidDeclaredTenantAttribute],
    };
    const producer = getMockTenant();
    await addOneTenant(consumer);
    await addOneTenant(producer);

    const authData = getRandomAuthData(consumer.id);

    const newPublishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      version: "2",
      attributes: {
        certified: [],
        declared: [
          [getMockEServiceAttribute(invalidDeclaredTenantAttribute.id)],
        ],
        verified: [],
      },
    };

    const currentDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: descriptorState.deprecated,
      version: "1",
    };
    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [newPublishedDescriptor, currentDescriptor],
    };
    await addOneEService(eservice);

    const agreementId: AgreementId = generateId<AgreementId>();
    const agreement: Agreement = {
      ...getMockAgreement(
        eservice.id,
        consumer.id,
        randomArrayItem(agreementUpgradableStates)
      ),
      id: agreementId,
      producerId: eservice.producerId,
      descriptorId: currentDescriptor.id,
    };
    await addOneAgreement(agreement);

    const conflictingAgreement: Agreement = getMockAgreement(
      eservice.id,
      consumer.id,
      agreementState.draft
    );
    await addOneAgreement(conflictingAgreement);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      agreementAlreadyExists(agreement.consumerId, agreement.eserviceId)
    );
  });
});
