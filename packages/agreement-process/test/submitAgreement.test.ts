/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/immutable-data */
import { fail } from "assert";
import {
  formatDateyyyyMMddHHmmss,
  genericLogger,
} from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockDescriptor,
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
  AgreementActivatedV2,
  AgreementId,
  AgreementSetMissingCertifiedAttributesByPlatformV2,
  AgreementSubmittedV2,
  AgreementV2,
  Attribute,
  DescriptorId,
  DescriptorState,
  EServiceId,
  SelfcareId,
  TenantAttribute,
  TenantId,
  agreementApprovalPolicy,
  agreementState,
  attributeKind,
  descriptorState,
  fromAgreementV2,
  generateId,
  tenantMailKind,
  toAgreementStateV2,
} from "pagopa-interop-models";
import { selfcareV2ClientApi } from "pagopa-interop-api-clients";
import { afterEach, describe, expect, it, vi } from "vitest";
import { agreementSubmissionConflictingStates } from "../src/model/domain/agreement-validators.js";
import {
  agreementAlreadyExists,
  agreementMissingUserInfo,
  agreementNotFound,
  agreementNotInExpectedState,
  agreementSelfcareIdNotFound,
  agreementSubmissionFailed,
  consumerWithNotValidEmail,
  descriptorNotInExpectedState,
  eServiceNotFound,
  notLatestEServiceDescriptor,
  operationNotAllowed,
  tenantNotFound,
  userNotFound,
} from "../src/model/domain/errors.js";
import { createStamp } from "../src/services/agreementStampUtils.js";
import { config } from "../src/config/config.js";
import { apiAgreementToAgreement } from "../src/model/domain/apiConverter.js";
import {
  addOneAgreement,
  addOneAttribute,
  addOneEService,
  addOneTenant,
  agreementService,
  expectedAgreementWithCorrectDate,
  fileManager,
  readLastAgreementEvent,
  selfcareV2ClientMock,
} from "./utils.js";
import {
  mockAgreementRouterRequest,
  mockSelfcareV2ClientCall,
} from "./supertestSetup.js";

describe("submit agreement", () => {
  afterEach(async () => {
    vi.clearAllMocks();
  });

  const mockUserResponse: selfcareV2ClientApi.UserResponse = {
    email: "selfcare.test.submitagreement@test.org",
    name: "Test Name",
    surname: "Test Surname",
    id: generateId(),
    taxCode: "TAXCODE",
  };

  async function addRelatedAgreements(agreement: Agreement): Promise<{
    archivableRelatedAgreement1: Agreement;
    archivableRelatedAgreement2: Agreement;
    nonArchivableRelatedAgreement: Agreement;
  }> {
    const archivableRelatedAgreement1: Agreement = {
      ...getMockAgreement(),
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      state: agreementState.active,
    };

    const archivableRelatedAgreement2: Agreement = {
      ...getMockAgreement(),
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      state: agreementState.suspended,
    };

    const nonArchivableRelatedAgreement: Agreement = {
      ...getMockAgreement(),
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (state) =>
            !agreementSubmissionConflictingStates.includes(state) &&
            state !== agreementState.active &&
            state !== agreementState.suspended
        )
      ),
    };

    await addOneAgreement(archivableRelatedAgreement1);
    await addOneAgreement(archivableRelatedAgreement2);
    await addOneAgreement(nonArchivableRelatedAgreement);
    return {
      archivableRelatedAgreement1,
      archivableRelatedAgreement2,
      nonArchivableRelatedAgreement,
    };
  }

  async function testRelatedAgreementsArchiviation(relatedAgreements: {
    archivableRelatedAgreement1: Agreement;
    archivableRelatedAgreement2: Agreement;
    nonArchivableRelatedAgreement: Agreement;
  }): Promise<void> {
    // Verifying archiviation relating agreements
    const archiveEvent1 = await readLastAgreementEvent(
      relatedAgreements.archivableRelatedAgreement1.id
    );
    const archiveEvent2 = await readLastAgreementEvent(
      relatedAgreements.archivableRelatedAgreement2.id
    );
    const nonArchivedAgreementEvent = await readLastAgreementEvent(
      relatedAgreements.nonArchivableRelatedAgreement.id
    );

    expect(archiveEvent1).toMatchObject({
      type: "AgreementArchivedByUpgrade",
      event_version: 2,
      version: "1",
      stream_id: relatedAgreements.archivableRelatedAgreement1.id,
    });

    expect(archiveEvent2).toMatchObject({
      type: "AgreementArchivedByUpgrade",
      event_version: 2,
      version: "1",
      stream_id: relatedAgreements.archivableRelatedAgreement2.id,
    });

    expect(nonArchivedAgreementEvent).toMatchObject({
      type: "AgreementAdded",
      event_version: 2,
      version: "0",
      stream_id: relatedAgreements.nonArchivableRelatedAgreement.id,
    });
  }

  it("should throw an agreementNotFound when Agreement not found", async () => {
    await addOneAgreement(getMockAgreement());

    const agreementId = generateId<AgreementId>();
    const authData = getRandomAuthData();
    await expect(
      agreementService.submitAgreement(
        agreementId,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw an operationNotAllowed error when requester is not consumer", async () => {
    const consumer = getMockTenant();
    const producer = getMockTenant();

    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      consumer.id,
      agreementState.draft
    );

    await addOneAgreement(agreement);

    const authData = getRandomAuthData(producer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw an agreementNotInExpectedState error when the agreement is state different from DRAFT", async () => {
    const consumer = getMockTenant();
    const producer = getMockTenant();

    const agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        consumer.id,
        randomArrayItem(
          Object.values(agreementState).filter(
            (s) => s !== agreementState.draft
          )
        )
      ),
      producerId: producer.id,
    };
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });

  it("should throw an agreementAlreadyExists error when a conflicting agreement already exists", async () => {
    const consumer = getMockTenant();
    const producer = getMockTenant();

    const agreement = {
      ...getMockAgreement(generateId<EServiceId>(), consumer.id),
      state: agreementState.draft,
      producerId: producer.id,
    };

    const pendingAgreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementSubmissionConflictingStates),
      consumerId: agreement.consumerId,
      producerId: agreement.producerId,
      eserviceId: agreement.eserviceId,
    };

    await addOneAgreement(agreement);
    await addOneAgreement(pendingAgreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      agreementAlreadyExists(consumer.id, agreement.eserviceId)
    );
  });

  it("should throw a consumerWithNotValidEmail error when consumer doesn't have a contact email", async () => {
    const consumer = {
      ...getMockTenant(),
      mails: [],
    };
    const producer = getMockTenant();

    const agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        consumer.id,
        agreementState.draft
      ),
      producerId: producer.id,
    };
    await addOneTenant(consumer);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      consumerWithNotValidEmail(agreement.id, consumer.id)
    );
  });

  it("should throw a consumerWithNotValidEmail error when the consumer has only a different mail kind", async () => {
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.DigitalAddress,
          address: "A fake digital Address",
          createdAt: new Date(),
        },
      ],
    };
    const producer = getMockTenant();

    const agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        consumer.id,
        agreementState.draft
      ),
      producerId: producer.id,
    };
    await addOneTenant(consumer);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      consumerWithNotValidEmail(agreement.id, consumer.id)
    );
  });

  it("should throw an eServiceNotFound error when eservice does not exist", async () => {
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };
    const producer = getMockTenant();

    const agreement = {
      ...getMockAgreement(),
      consumerId: consumer.id,
      producerId: producer.id,
    };

    await addOneTenant(consumer);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
  });

  it("should throw a notLatestEServiceDescriptor error when eservice has only draft descriptors (no active descriptors)", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(notLatestEServiceDescriptor(agreement.descriptorId));
  });

  it("should throw a notLatestEServiceDescriptor error when the agreement descriptor does not exist in the eservice descriptors", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: generateId<DescriptorId>(),
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(notLatestEServiceDescriptor(agreement.descriptorId));
  });

  it("should throw a notLatestEServiceDescriptor error when the agreement descriptor is not the latest published", async () => {
    const producer = getMockTenant();
    const descriptorId = generateId<DescriptorId>();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const oldDescriptor = {
      ...getMockDescriptor(),
      id: descriptorId,
      state: randomArrayItem(
        Object.values(descriptorState).filter(
          (state: DescriptorState) => state !== descriptorState.draft
        )
      ),
      version: "1",
    };

    const newDescriptor = {
      ...getMockDescriptor(),
      state: randomArrayItem(
        Object.values(descriptorState).filter(
          (state: DescriptorState) => state !== descriptorState.draft
        )
      ),
      version: "2",
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      oldDescriptor,
      newDescriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId,
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(notLatestEServiceDescriptor(agreement.descriptorId));
  });

  it("should throw a descriptorNotInExpectedState error when eservice latest descriptor has invalid state", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const allowedStatus: DescriptorState[] = [
      descriptorState.published,
      descriptorState.suspended,
    ];
    const descriptor = {
      ...getMockDescriptor(),
      state: randomArrayItem(
        Object.values(descriptorState).filter(
          (state: DescriptorState) =>
            !allowedStatus.includes(state) && state !== descriptorState.draft
        )
      ),
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      descriptorNotInExpectedState(eservice.id, descriptor.id, allowedStatus)
    );
  });

  it("should throw a tenantNotFound error when producer does not exist in tenant collection", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(tenantNotFound(agreement.producerId));
  });

  it("should throw a tenantNotFound error when consumer does not exist in tenant collection", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
    };

    await addOneEService(eservice);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(tenantNotFound(agreement.consumerId));
  });

  it("should throw an agreementSubmissionFailed error when new agreement state is not ACTIVE or PENDING", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      attributes: {
        certified: [[getMockEServiceAttribute()]],
        declared: [],
        verified: [],
      },
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
      state: agreementState.draft,
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    mockSelfcareV2ClientCall({});
    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(agreementSubmissionFailed(agreement.id));
  });

  it("should throw a userNotFound error when user info cannot be fetched from Selfcare API in getSubmissionInfo", async () => {
    const consumer = {
      ...getMockTenant(),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };
    const producer = getMockTenant(consumer.id);

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      attributes: {
        certified: [],
        declared: [],
        verified: [],
      },
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
      state: agreementState.draft,
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    mockSelfcareV2ClientCall(undefined);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(userNotFound(consumer.selfcareId, authData.userId));
  });

  it("should throw an agreementSelfcareIdNotFound error when selfcare id is not found for the consumer", async () => {
    const consumer = {
      ...getMockTenant(),
      selfcareId: undefined,
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };
    const producer = getMockTenant(consumer.id);

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      attributes: {
        certified: [[getMockEServiceAttribute()]],
        declared: [],
        verified: [],
      },
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
      state: agreementState.draft,
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(agreementSelfcareIdNotFound(consumer.id));
  });

  it("should throw an agreementMissingUserInfo error when name, surname, or taxcode properties are missing in selfcare user response", async () => {
    const consumer = {
      ...getMockTenant(),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };
    const producer = getMockTenant(consumer.id);

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      attributes: {
        certified: [[getMockEServiceAttribute()]],
        declared: [],
        verified: [],
      },
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
      state: agreementState.draft,
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    mockSelfcareV2ClientCall({});

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(agreementMissingUserInfo(authData.userId));
  });

  it("should throw an agreementSubmissionFailed error when recalculation of suspendByPlatform returns true, and also set the agreement to MissingCertifiedAttributes state", async () => {
    const consumerId = generateId<TenantId>();
    const producer = getMockTenant();
    const consumerNotesText = "This is a test";

    const validVerifiedTenantAttribute: TenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: consumerId,
          verificationDate: new Date(new Date().getFullYear() - 1),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const consumer = {
      ...getMockTenant(consumerId, [validVerifiedTenantAttribute]),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      attributes: {
        certified: [[getMockEServiceAttribute()]],
        declared: [],
        verified: [[getMockEServiceAttribute(validVerifiedTenantAttribute.id)]],
      },
    };

    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement: Agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
      state: agreementState.draft,
      suspendedByPlatform: false,
    };

    const attribute: Attribute = {
      id: validVerifiedTenantAttribute.id,
      kind: attributeKind.verified,
      description: "A verified attribute",
      name: "A verified attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAttribute(attribute);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    mockSelfcareV2ClientCall(mockUserResponse);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        {
          consumerNotes: consumerNotesText,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(agreementSubmissionFailed(agreement.id));

    const uploadedFiles = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(uploadedFiles.length).toEqual(0);

    const actualAgreementData = await readLastAgreementEvent(agreement.id);
    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData.type).toEqual(
      "AgreementSetMissingCertifiedAttributesByPlatform"
    );
    expect(actualAgreementData).toMatchObject({
      type: "AgreementSetMissingCertifiedAttributesByPlatform",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
      messageType: AgreementSetMissingCertifiedAttributesByPlatformV2,
      payload: actualAgreementData.data,
    }).agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementAddedV1 data");
    }

    expect(selfcareV2ClientMock.getUserInfoUsingGET).not.toHaveBeenCalled();
    expect(actualAgreement.suspendedByPlatform).toBeTruthy();
    expect(actualAgreement.state).toEqual(
      toAgreementStateV2(agreementState.missingCertifiedAttributes)
    );
  });

  it("should submit agreement with state ACTIVE when producer is equal to consumer, and generate an AgreementActivated event and AgreementArchivedByUpgrade for related agreements", async () => {
    const producerAndConsumerId = generateId<TenantId>();
    const producer = getMockTenant(producerAndConsumerId);
    const consumerNotesText = "This is a test";

    const consumer = {
      ...getMockTenant(producerAndConsumerId),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      attributes: {
        certified: [],
        declared: [],
        verified: [],
      },
    };

    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const authData = getRandomAuthData(consumer.id);

    const agreement: Agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
      state: agreementState.draft,
      // The agreement is draft, so it doens't have a contract or attributes
      contract: undefined,
      certifiedAttributes: [],
      declaredAttributes: [],
      verifiedAttributes: [],
      suspendedByConsumer: randomBoolean(),
      suspendedByProducer: randomBoolean(),
      stamps: {
        suspensionByConsumer: createStamp(authData.userId),
        suspensionByProducer: createStamp(authData.userId),
      },
      suspendedAt: new Date(),
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const {
      archivableRelatedAgreement1,
      archivableRelatedAgreement2,
      nonArchivableRelatedAgreement,
    } = await addRelatedAgreements(agreement);

    mockSelfcareV2ClientCall(mockUserResponse);

    const apiSubmittedAgreement = await mockAgreementRouterRequest.post({
      path: "/agreements/:agreementId/submit",
      pathParams: { agreementId: agreement.id },
      body: { consumerNotes: consumerNotesText },
      authData,
    });

    const submittedAgreement = apiAgreementToAgreement(apiSubmittedAgreement);

    const actualAgreementData = await readLastAgreementEvent(agreement.id);
    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData.type).toEqual("AgreementActivated");
    expect(actualAgreementData).toMatchObject({
      type: "AgreementActivated",
      event_version: 2,
      version: "1",
      stream_id: submittedAgreement.id,
    });

    const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
      messageType: AgreementActivatedV2,
      payload: actualAgreementData.data,
    }).agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementAddedV1 data");
    }

    const uploadedFiles = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    expect(uploadedFiles.length).toEqual(0);

    // TODO verify if this logic is correct: we have a resulting agreement
    // in state ACTIVE but with contract undefined and no attributes.
    // https://pagopa.atlassian.net/browse/IMN-623
    expect(submittedAgreement.contract).not.toBeDefined();

    const expectedAgreement: Agreement = {
      ...agreement,
      state: agreementState.active,
      consumerNotes: consumerNotesText,
      suspendedByPlatform: false,
      stamps: {
        ...agreement.stamps,
        submission: {
          who: authData.userId,
          when: submittedAgreement.stamps?.submission!.when,
        },
        activation: {
          who: authData.userId,
          when: submittedAgreement.stamps?.activation!.when,
        },
      },
    };

    const correctExpectedAgreement = expectedAgreementWithCorrectDate({
      expectedAgreement,
      agreement,
      agreementReturnValue: submittedAgreement,
    });

    expect(selfcareV2ClientMock.getUserInfoUsingGET).not.toHaveBeenCalled();
    expect(fromAgreementV2(actualAgreement)).toEqual(expectedAgreement);
    expect(submittedAgreement).toEqual(correctExpectedAgreement);

    await testRelatedAgreementsArchiviation({
      archivableRelatedAgreement1,
      archivableRelatedAgreement2,
      nonArchivableRelatedAgreement,
    });
  });

  it("should create a new agreement contract for first activation with new state ACTIVE when producer is equal to consumer, generates AgreementActivated event", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    const producerAndConsumerId = generateId<TenantId>();
    const producer = getMockTenant(producerAndConsumerId);
    const consumerNotesText = "This is a test";

    const validVerifiedTenantAttribute: TenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producerAndConsumerId,
          verificationDate: new Date(new Date().getFullYear() - 1),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const validCertifiedTenantAttribute: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validDeclaredTenantAttribute: TenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const consumer = {
      ...getMockTenant(producerAndConsumerId, [
        validVerifiedTenantAttribute,
        validCertifiedTenantAttribute,
        validDeclaredTenantAttribute,
      ]),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      attributes: {
        certified: [
          [getMockEServiceAttribute(validCertifiedTenantAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validDeclaredTenantAttribute.id)]],
        verified: [[getMockEServiceAttribute(validVerifiedTenantAttribute.id)]],
      },
    };

    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const authData = getRandomAuthData(consumer.id);
    const agreement: Agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
      state: agreementState.draft,
      suspendedByConsumer: randomBoolean(),
      suspendedByProducer: randomBoolean(),
      stamps: {
        suspensionByConsumer: createStamp(authData.userId),
        suspensionByProducer: createStamp(authData.userId),
      },
      suspendedAt: new Date(),
    };

    const validAttribute: Attribute = {
      id: validVerifiedTenantAttribute.id,
      kind: attributeKind.verified,
      description: "A verified attribute",
      name: "A verified attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    };

    const declaredAttribute: Attribute = {
      id: validDeclaredTenantAttribute.id,
      kind: attributeKind.declared,
      description: "A declared attribute",
      name: "A declared attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    };

    const certifiedAttribute: Attribute = {
      id: validCertifiedTenantAttribute.id,
      kind: attributeKind.certified,
      description: "A certified attribute",
      name: "A certified attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAttribute(validAttribute);
    await addOneAttribute(declaredAttribute);
    await addOneAttribute(certifiedAttribute);
    await addOneAgreement(agreement);

    mockSelfcareV2ClientCall(mockUserResponse);
    const apiSubmittedAgreement = await mockAgreementRouterRequest.post({
      path: "/agreements/:agreementId/submit",
      pathParams: { agreementId: agreement.id },
      body: { consumerNotes: consumerNotesText },
      authData,
    });

    const submittedAgreement = apiAgreementToAgreement(apiSubmittedAgreement);

    expect(submittedAgreement).toBeDefined();
    expect(submittedAgreement.state).toBe(agreementState.active);

    const uploadedFiles = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    expect(submittedAgreement.contract).toBeDefined();
    expect(uploadedFiles[0]).toEqual(submittedAgreement.contract?.path);

    const actualAgreementData = await readLastAgreementEvent(agreement.id);
    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData.type).toEqual("AgreementActivated");
    expect(actualAgreementData).toMatchObject({
      type: "AgreementActivated",
      event_version: 2,
      version: "1",
      stream_id: submittedAgreement.id,
    });

    const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
      messageType: AgreementActivatedV2,
      payload: actualAgreementData.data,
    }).agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementAddedV1 data");
    }

    const contractDocumentId = submittedAgreement.contract!.id;
    const contractCreatedAt = submittedAgreement.contract!.createdAt;
    const contractDocumentName = `${consumer.id}_${
      producer.id
    }_${formatDateyyyyMMddHHmmss(contractCreatedAt)}_agreement_contract.pdf`;

    const expectedContract = {
      id: contractDocumentId,
      contentType: "application/pdf",
      createdAt: contractCreatedAt,
      path: `${config.agreementContractsPath}/${agreement.id}/${contractDocumentId}/${contractDocumentName}`,
      prettyName: "Richiesta di fruizione",
      name: contractDocumentName,
    };

    const expectedAgreement: Agreement = {
      ...agreement,
      state: agreementState.active,
      consumerNotes: consumerNotesText,
      contract: expectedContract,
      suspendedByPlatform: false,
      verifiedAttributes: [
        {
          id: validVerifiedTenantAttribute.id,
        },
      ],
      certifiedAttributes: [
        {
          id: validCertifiedTenantAttribute.id,
        },
      ],
      declaredAttributes: [
        {
          id: validDeclaredTenantAttribute.id,
        },
      ],
      stamps: {
        ...agreement.stamps,
        submission: {
          who: authData.userId,
          when: submittedAgreement.stamps?.submission!.when,
        },
        activation: {
          who: authData.userId,
          when: submittedAgreement.stamps?.activation!.when,
        },
      },
    };

    const expectedAgreementWithCorrectDate = {
      ...expectedAgreement,
      consumerDocuments: agreement.consumerDocuments.map((doc, index) => ({
        ...doc,
        createdAt: submittedAgreement.consumerDocuments[index].createdAt,
      })),
    };

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(expectedContract.path);

    expect(selfcareV2ClientMock.getUserInfoUsingGET).toHaveBeenCalled();
    expect(fromAgreementV2(actualAgreement)).toEqual(expectedAgreement);
    expect(submittedAgreement).toEqual(expectedAgreementWithCorrectDate);
    vi.useRealTimers();
  });

  it("should submit agreement contract with new state ACTIVE when producer and consumer are different, and generate an AgreementActivated event and AgreementArchivedByUpgrade for related agreements", async () => {
    const consumerId = generateId<TenantId>();
    const producer = getMockTenant(consumerId);
    const consumerNotesText = "This is a test";

    const validVerifiedTenantAttribute: TenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(new Date().getFullYear() - 1),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const validCertifiedTenantAttribute: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validDeclaredTenantAttribute: TenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const consumer = {
      ...getMockTenant(consumerId, [
        validVerifiedTenantAttribute,
        validCertifiedTenantAttribute,
        validDeclaredTenantAttribute,
      ]),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      agreementApprovalPolicy: agreementApprovalPolicy.automatic,
      attributes: {
        certified: [
          [getMockEServiceAttribute(validCertifiedTenantAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validDeclaredTenantAttribute.id)]],
        verified: [[getMockEServiceAttribute(validVerifiedTenantAttribute.id)]],
      },
    };

    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const authData = getRandomAuthData(consumer.id);
    const agreement: Agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
      state: agreementState.draft,
      suspendedByConsumer: randomBoolean(),
      suspendedByProducer: randomBoolean(),
      stamps: {
        suspensionByConsumer: createStamp(authData.userId),
        suspensionByProducer: createStamp(authData.userId),
      },
      suspendedAt: new Date(),
      // The agreement is draft, so it doens't have a contract or attributes
      contract: undefined,
      certifiedAttributes: [],
      declaredAttributes: [],
      verifiedAttributes: [],
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const {
      archivableRelatedAgreement1,
      archivableRelatedAgreement2,
      nonArchivableRelatedAgreement,
    } = await addRelatedAgreements(agreement);

    mockSelfcareV2ClientCall(mockUserResponse);

    const apiSubmittedAgreement = await mockAgreementRouterRequest.post({
      path: "/agreements/:agreementId/submit",
      pathParams: { agreementId: agreement.id },
      body: { consumerNotes: consumerNotesText },
      authData,
    });

    const submittedAgreement = apiAgreementToAgreement(apiSubmittedAgreement);

    const actualAgreementData = await readLastAgreementEvent(agreement.id);
    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData.type).toEqual("AgreementActivated");
    expect(actualAgreementData).toMatchObject({
      type: "AgreementActivated",
      event_version: 2,
      version: "1",
      stream_id: submittedAgreement.id,
    });

    const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
      messageType: AgreementActivatedV2,
      payload: actualAgreementData.data,
    }).agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementAddedV1 data");
    }

    const uploadedFiles = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    expect(uploadedFiles.length).toEqual(0);

    // TODO verify if this logic is correct: we have a resulting agreement
    // in state ACTIVE but with contract undefined and no attribute.
    // https://pagopa.atlassian.net/browse/IMN-623
    expect(submittedAgreement.contract).not.toBeDefined();

    const expectedAgreement = {
      ...agreement,
      state: agreementState.active,
      consumerNotes: consumerNotesText,
      suspendedByPlatform: false,
      certifiedAttributes: [
        {
          id: validCertifiedTenantAttribute.id,
        },
      ],
      declaredAttributes: [
        {
          id: validDeclaredTenantAttribute.id,
        },
      ],
      verifiedAttributes: [
        {
          id: validVerifiedTenantAttribute.id,
        },
      ],
      stamps: {
        ...agreement.stamps,
        submission: {
          who: authData.userId,
          when: submittedAgreement.stamps?.submission?.when,
        },
        activation: {
          who: authData.userId,
          when: submittedAgreement.stamps?.activation?.when,
        },
      },
    };

    const expectedAgreementWithCorrectDate = {
      ...expectedAgreement,
      consumerDocuments: agreement.consumerDocuments.map((doc, index) => ({
        ...doc,
        createdAt: submittedAgreement.consumerDocuments[index].createdAt,
      })),
    };

    expect(selfcareV2ClientMock.getUserInfoUsingGET).not.toHaveBeenCalled();
    expect(fromAgreementV2(actualAgreement)).toEqual(expectedAgreement);
    expect(submittedAgreement).toEqual(expectedAgreementWithCorrectDate);

    await testRelatedAgreementsArchiviation({
      archivableRelatedAgreement1,
      archivableRelatedAgreement2,
      nonArchivableRelatedAgreement,
    });
  });

  it("should create a new agreement contract for first activation with new state ACTIVE when producer and consumer are different, generates AgreementActivated", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    const consumerId = generateId<TenantId>();
    const producer = getMockTenant(consumerId);
    const consumerNotesText = "This is a test";

    const validVerifiedTenantAttribute: TenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(new Date().getFullYear() - 1),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const validCertifiedTenantAttribute: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validDeclaredTenantAttribute: TenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const consumer = {
      ...getMockTenant(consumerId, [
        validVerifiedTenantAttribute,
        validCertifiedTenantAttribute,
        validDeclaredTenantAttribute,
      ]),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      agreementApprovalPolicy: agreementApprovalPolicy.automatic,
      attributes: {
        certified: [
          [getMockEServiceAttribute(validCertifiedTenantAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validDeclaredTenantAttribute.id)]],
        verified: [[getMockEServiceAttribute(validVerifiedTenantAttribute.id)]],
      },
    };

    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const authData = getRandomAuthData(consumer.id);
    const agreement: Agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
      state: agreementState.draft,
      suspendedByConsumer: randomBoolean(),
      suspendedByProducer: randomBoolean(),
      stamps: {
        suspensionByConsumer: createStamp(authData.userId),
        suspensionByProducer: createStamp(authData.userId),
      },
      suspendedAt: new Date(),
      // The agreement is draft, so it doens't have a contract or attributes
      contract: undefined,
      certifiedAttributes: [],
      declaredAttributes: [],
      verifiedAttributes: [],
    };

    const verifiedAttribute: Attribute = {
      id: validVerifiedTenantAttribute.id,
      kind: attributeKind.verified,
      description: "A verified attribute",
      name: "A verified attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    };

    const declareAttribute: Attribute = {
      id: validDeclaredTenantAttribute.id,
      kind: attributeKind.declared,
      description: "A declared attribute",
      name: "A declared attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    };

    const certifiedAttribute: Attribute = {
      id: validCertifiedTenantAttribute.id,
      kind: attributeKind.certified,
      description: "A certified attribute",
      name: "A certified attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAttribute(verifiedAttribute);
    await addOneAttribute(declareAttribute);
    await addOneAttribute(certifiedAttribute);
    await addOneAgreement(agreement);

    mockSelfcareV2ClientCall(mockUserResponse);

    const apiSubmittedAgreement = await mockAgreementRouterRequest.post({
      path: "/agreements/:agreementId/submit",
      pathParams: { agreementId: agreement.id },
      body: { consumerNotes: consumerNotesText },
      authData,
    });

    const submittedAgreement = apiAgreementToAgreement(apiSubmittedAgreement);

    expect(submittedAgreement).toBeDefined();
    expect(submittedAgreement.state).toBe(agreementState.active);

    const uploadedFiles = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    expect(submittedAgreement.contract).toBeDefined();
    expect(uploadedFiles[0]).toEqual(submittedAgreement.contract?.path);

    const actualAgreementData = await readLastAgreementEvent(agreement.id);
    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData.type).toEqual("AgreementActivated");
    expect(actualAgreementData).toMatchObject({
      type: "AgreementActivated",
      event_version: 2,
      version: "1",
      stream_id: submittedAgreement.id,
    });

    const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
      messageType: AgreementActivatedV2,
      payload: actualAgreementData.data,
    }).agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementAddedV1 data");
    }

    const contractDocumentId = submittedAgreement.contract!.id;
    const contractCreatedAt = submittedAgreement.contract!.createdAt;
    const contractDocumentName = `${consumer.id}_${
      producer.id
    }_${formatDateyyyyMMddHHmmss(contractCreatedAt)}_agreement_contract.pdf`;

    const expectedContract = {
      id: contractDocumentId,
      contentType: "application/pdf",
      createdAt: contractCreatedAt,
      path: `${config.agreementContractsPath}/${agreement.id}/${contractDocumentId}/${contractDocumentName}`,
      prettyName: "Richiesta di fruizione",
      name: contractDocumentName,
    };

    const expectedAgreement = {
      ...agreement,
      state: agreementState.active,
      consumerNotes: consumerNotesText,
      contract: expectedContract,
      suspendedByPlatform: false,
      certifiedAttributes: [
        {
          id: validCertifiedTenantAttribute.id,
        },
      ],
      declaredAttributes: [
        {
          id: validDeclaredTenantAttribute.id,
        },
      ],
      verifiedAttributes: [
        {
          id: validVerifiedTenantAttribute.id,
        },
      ],
      stamps: {
        ...agreement.stamps,
        submission: {
          who: authData.userId,
          when: submittedAgreement.stamps?.submission?.when,
        },
        activation: {
          who: authData.userId,
          when: submittedAgreement.stamps?.activation?.when,
        },
      },
    };

    const expectedAgreementWithCorrectDate = {
      ...expectedAgreement,
      consumerDocuments: agreement.consumerDocuments.map((doc, index) => ({
        ...doc,
        createdAt: submittedAgreement.consumerDocuments[index].createdAt,
      })),
    };

    expect(selfcareV2ClientMock.getUserInfoUsingGET).toHaveBeenCalled();

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(expectedContract.path);

    expect(fromAgreementV2(actualAgreement)).toEqual(expectedAgreement);
    expect(submittedAgreement).toEqual(expectedAgreementWithCorrectDate);
    vi.useRealTimers();
  });

  it("should submit agreement with new state PENDING when producer is different from consumer and no related agreements exist, and approval policy is manual, generates AgreementSubmitted event", async () => {
    const consumerId = generateId<TenantId>();
    const producer = getMockTenant();
    const consumerNotesText = "This is a test";

    const certifiedTenantAttribute: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const declareTenantAttribute: TenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const consumer = {
      ...getMockTenant(consumerId, [
        certifiedTenantAttribute,
        declareTenantAttribute,
      ]),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const certifiedDescriptorAttribute = getMockEServiceAttribute(
      certifiedTenantAttribute.id
    );
    const declaredDescriptorAttribute = getMockEServiceAttribute(
      declareTenantAttribute.id
    );

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      agreementApprovalPolicy: agreementApprovalPolicy.manual,
      attributes: {
        certified: [[certifiedDescriptorAttribute]],
        declared: [[declaredDescriptorAttribute]],
        verified: [],
      },
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const authData = getRandomAuthData(consumer.id);
    const agreement: Agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
      state: agreementState.draft,
      suspendedByConsumer: randomBoolean(),
      suspendedByProducer: randomBoolean(),
      stamps: {
        suspensionByConsumer: createStamp(authData.userId),
        suspensionByProducer: createStamp(authData.userId),
      },
      suspendedAt: new Date(),
      // The agreement is draft, so it doens't have a contract or attributes
      contract: undefined,
      certifiedAttributes: [],
      declaredAttributes: [],
      verifiedAttributes: [],
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    mockSelfcareV2ClientCall(mockUserResponse);
    const apiSubmittedAgreement = await mockAgreementRouterRequest.post({
      path: "/agreements/:agreementId/submit",
      pathParams: { agreementId: agreement.id },
      body: { consumerNotes: consumerNotesText },
      authData,
    });

    const submittedAgreement = apiAgreementToAgreement(apiSubmittedAgreement);

    const actualAgreementData = await readLastAgreementEvent(agreement.id);
    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData.type).toEqual("AgreementSubmitted");
    expect(actualAgreementData).toMatchObject({
      type: "AgreementSubmitted",
      event_version: 2,
      version: "1",
      stream_id: submittedAgreement.id,
    });

    const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
      messageType: AgreementSubmittedV2,
      payload: actualAgreementData.data,
    }).agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementActivatedV2 data");
    }

    const uploadedFiles = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    expect(uploadedFiles.length).toEqual(0);

    expect(submittedAgreement.contract).not.toBeDefined();

    const expectedAgreement = {
      ...agreement,
      state: agreementState.pending,
      consumerNotes: consumerNotesText,
      certifiedAttributes: [],
      declaredAttributes: [],
      verifiedAttributes: [],
      suspendedByPlatform: false,
      stamps: {
        ...agreement.stamps,
        submission: {
          who: authData.userId,
          when: submittedAgreement.stamps?.submission?.when,
        },
      },
    };

    const expectedAgreementWithCorrectDate = {
      ...expectedAgreement,
      consumerDocuments: agreement.consumerDocuments.map((doc, index) => ({
        ...doc,
        createdAt: submittedAgreement.consumerDocuments[index].createdAt,
      })),
    };

    expect(selfcareV2ClientMock.getUserInfoUsingGET).not.toHaveBeenCalled();
    expect(fromAgreementV2(actualAgreement)).toEqual(expectedAgreement);
    expect(submittedAgreement).toEqual(expectedAgreementWithCorrectDate);
  });

  it("should submit agreement with new state PENDING when producer is different from consumer and no related agreements exist and verified att are not satisfied, generates AgreementSubmitted event", async () => {
    const consumerId = generateId<TenantId>();
    const producer = getMockTenant();
    const consumerNotesText = "This is a test";

    const certifiedTenantAttribute: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const declareTenantAttribute: TenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const consumer = {
      ...getMockTenant(consumerId, [
        certifiedTenantAttribute,
        declareTenantAttribute,
      ]),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const certifiedDescriptorAttribute = getMockEServiceAttribute(
      certifiedTenantAttribute.id
    );
    const declaredDescriptorAttribute = getMockEServiceAttribute(
      declareTenantAttribute.id
    );

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      agreementApprovalPolicy: agreementApprovalPolicy.automatic,
      attributes: {
        certified: [[certifiedDescriptorAttribute]],
        declared: [[declaredDescriptorAttribute]],
        // Adding a verified attribute that is not satisfied
        verified: [[getMockEServiceAttribute()]],
      },
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const authData = getRandomAuthData(consumer.id);
    const agreement: Agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
      state: agreementState.draft,
      suspendedByConsumer: randomBoolean(),
      suspendedByProducer: randomBoolean(),
      stamps: {
        suspensionByConsumer: createStamp(authData.userId),
        suspensionByProducer: createStamp(authData.userId),
      },
      suspendedAt: new Date(),
      // The agreement is draft, so it doens't have a contract or attributes
      contract: undefined,
      certifiedAttributes: [],
      declaredAttributes: [],
      verifiedAttributes: [],
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    mockSelfcareV2ClientCall(mockUserResponse);
    const apiSubmittedAgreement = await mockAgreementRouterRequest.post({
      path: "/agreements/:agreementId/submit",
      pathParams: { agreementId: agreement.id },
      body: { consumerNotes: consumerNotesText },
      authData,
    });

    const submittedAgreement = apiAgreementToAgreement(apiSubmittedAgreement);

    const actualAgreementData = await readLastAgreementEvent(agreement.id);
    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData.type).toEqual("AgreementSubmitted");
    expect(actualAgreementData).toMatchObject({
      type: "AgreementSubmitted",
      event_version: 2,
      version: "1",
      stream_id: submittedAgreement.id,
    });

    const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
      messageType: AgreementSubmittedV2,
      payload: actualAgreementData.data,
    }).agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementActivatedV2 data");
    }

    const uploadedFiles = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    expect(submittedAgreement.contract).not.toBeDefined();
    expect(uploadedFiles.length).toEqual(0);

    const expectedAgreement = {
      ...agreement,
      state: agreementState.pending,
      consumerNotes: consumerNotesText,
      certifiedAttributes: [],
      declaredAttributes: [],
      verifiedAttributes: [],
      suspendedByPlatform: false,
      stamps: {
        ...agreement.stamps,
        submission: {
          who: authData.userId,
          when: submittedAgreement.stamps?.submission?.when,
        },
      },
    };

    const expectedAgreementWithCorrectDate = {
      ...expectedAgreement,
      consumerDocuments: agreement.consumerDocuments.map((doc, index) => ({
        ...doc,
        createdAt: submittedAgreement.consumerDocuments[index].createdAt,
      })),
    };

    expect(selfcareV2ClientMock.getUserInfoUsingGET).not.toHaveBeenCalled();
    expect(fromAgreementV2(actualAgreement)).toEqual(expectedAgreement);
    expect(submittedAgreement).toEqual(expectedAgreementWithCorrectDate);
  });
});
