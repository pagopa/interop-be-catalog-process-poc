/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { fileURLToPath } from "url";
import path from "path";
import {
  dateAtRomeZone,
  formatDateyyyyMMddHHmmss,
  genericLogger,
  timeAtRomeZone,
} from "pagopa-interop-commons";
import {
  addSomeRandomDelegations,
  decodeProtobufPayload,
  getMockAgreement,
  getMockAgreementAttribute,
  getMockAttribute,
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockDelegation,
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
  AgreementActivatedV2,
  AgreementId,
  AgreementSetMissingCertifiedAttributesByPlatformV2,
  AgreementSuspendedByPlatformV2,
  AgreementUnsuspendedByConsumerV2,
  AgreementUnsuspendedByPlatformV2,
  AgreementUnsuspendedByProducerV2,
  Attribute,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Descriptor,
  EService,
  EServiceId,
  Tenant,
  TenantAttribute,
  TenantId,
  VerifiedTenantAttribute,
  agreementState,
  delegationKind,
  delegationState,
  descriptorState,
  fromAgreementV2,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { addDays } from "date-fns";
import { match } from "ts-pattern";
import {
  agreementActivableStates,
  agreementActivationAllowedDescriptorStates,
  agreementArchivableStates,
} from "../src/model/domain/agreement-validators.js";
import {
  agreementActivationFailed,
  agreementNotFound,
  agreementNotInExpectedState,
  agreementStampNotFound,
  attributeNotFound,
  descriptorNotFound,
  descriptorNotInExpectedState,
  eServiceNotFound,
  organizationIsNotTheDelegateProducer,
  organizationIsNotTheProducer,
  organizationNotAllowed,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import { AgreementContractPDFPayload } from "../src/model/domain/models.js";
import {
  RequesterIs,
  addDelegationsAndDelegates,
  addOneAgreement,
  addOneAttribute,
  addOneDelegation,
  addOneEService,
  addOneTenant,
  agreementService,
  authDataAndDelegationsFromRequesterIs,
  fileManager,
  pdfGenerator,
  readAgreementEventByVersion,
  readLastAgreementEvent,
  requesterIs,
} from "./utils.js";

const unsuspensionEventInfoFromRequesterIs = (requesterIs: RequesterIs) =>
  match(requesterIs)
    .with("Producer", "DelegateProducer", () => ({
      eventType: "AgreementUnsuspendedByProducer",
      messageType: AgreementUnsuspendedByProducerV2,
    }))
    .with("Consumer", "DelegateConsumer", () => ({
      eventType: "AgreementUnsuspendedByConsumer",
      messageType: AgreementUnsuspendedByConsumerV2,
    }))
    .exhaustive();

describe("activate agreement", () => {
  async function addRelatedAgreements(agreement: Agreement): Promise<{
    archivableRelatedAgreement1: Agreement;
    archivableRelatedAgreement2: Agreement;
    nonArchivableRelatedAgreement: Agreement;
  }> {
    const archivableRelatedAgreement1: Agreement = {
      ...getMockAgreement(),
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      state: randomArrayItem(agreementArchivableStates),
    };

    const archivableRelatedAgreement2: Agreement = {
      ...getMockAgreement(),
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      state: randomArrayItem(agreementArchivableStates),
    };

    const nonArchivableRelatedAgreement: Agreement = {
      ...getMockAgreement(),
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (state) => !agreementArchivableStates.includes(state)
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

  describe("Agreement Pending", () => {
    it.each([
      { requesterIs: "Producer", withConsumerDelegation: false },
      { requesterIs: "Producer", withConsumerDelegation: true },
      { requesterIs: "DelegateProducer", withConsumerDelegation: false },
      { requesterIs: "DelegateProducer", withConsumerDelegation: true },
    ] as const)(
      "Agreement Pending, Requester === $requesterIs, with consumer delegation: $withConsumerDelegation, valid attributes -- success case: Pending >> Activated",
      async ({ requesterIs, withConsumerDelegation }) => {
        vi.spyOn(pdfGenerator, "generate");
        const producer: Tenant = getMockTenant();
        const consumerId: TenantId = generateId();

        const certifiedAttribute: Attribute = {
          ...getMockAttribute(),
          kind: "Certified",
        };

        const declaredAttribute: Attribute = {
          ...getMockAttribute(),
          kind: "Declared",
        };

        const verifiedAttribute: Attribute = {
          ...getMockAttribute(),
          kind: "Verified",
        };

        const descriptor: Descriptor = {
          ...getMockDescriptorPublished(),
          state: randomArrayItem(agreementActivationAllowedDescriptorStates),
          attributes: {
            certified: [[getMockEServiceAttribute(certifiedAttribute.id)]],
            declared: [[getMockEServiceAttribute(declaredAttribute.id)]],
            verified: [[getMockEServiceAttribute(verifiedAttribute.id)]],
          },
        };

        const eservice: EService = {
          ...getMockEService(),
          producerId: producer.id,
          descriptors: [descriptor],
        };

        const agreement: Agreement = {
          ...getMockAgreement(),
          state: agreementState.pending,
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
          producerId: producer.id,
          consumerId,
          suspendedByConsumer: false, // Must be false, otherwise the agreement would be suspended
          suspendedByProducer: randomBoolean(), // will be set to false by the activation
          stamps: {
            submission: {
              who: generateId(),
              when: new Date(),
            },
            activation: undefined,
          },

          // Adding some random attributes to check that they are overwritten by the activation
          certifiedAttributes: [getMockAgreementAttribute()],
          declaredAttributes: [getMockAgreementAttribute()],
          verifiedAttributes: [getMockAgreementAttribute()],
        };

        const { authData, producerDelegation, delegateProducer } =
          authDataAndDelegationsFromRequesterIs(requesterIs, agreement);

        const delegateConsumer = withConsumerDelegation
          ? getMockTenant()
          : undefined;
        const consumerDelegation = delegateConsumer
          ? getMockDelegation({
              kind: delegationKind.delegatedConsumer,
              delegatorId: agreement.consumerId,
              delegateId: delegateConsumer.id,
              state: delegationState.active,
              eserviceId: agreement.eserviceId,
            })
          : undefined;

        const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
          ...getMockCertifiedTenantAttribute(certifiedAttribute.id),
          revocationTimestamp: undefined,
        };

        const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
          ...getMockDeclaredTenantAttribute(declaredAttribute.id),
          revocationTimestamp: undefined,
          delegationId: consumerDelegation?.id,
        };

        const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
          ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
          verifiedBy: [
            {
              id: producer.id,
              verificationDate: new Date(),
              extensionDate: addDays(new Date(), 30),
              delegationId: producerDelegation?.id,
            },
          ],
        };

        const consumer: Tenant = {
          ...getMockTenant(consumerId),
          selfcareId: generateId(),
          attributes: [
            validTenantCertifiedAttribute,
            validTenantDeclaredAttribute,
            validTenantVerifiedAttribute,
          ],
        };

        await addOneAgreement(agreement);
        await addOneTenant(consumer);
        await addOneTenant(producer);
        await addOneEService(eservice);
        await addOneAttribute(certifiedAttribute);
        await addOneAttribute(declaredAttribute);
        await addOneAttribute(verifiedAttribute);
        const relatedAgreements = await addRelatedAgreements(agreement);

        await addSomeRandomDelegations(agreement, addOneDelegation);
        await addDelegationsAndDelegates({
          producerDelegation,
          delegateProducer,
          consumerDelegation,
          delegateConsumer,
        });

        const acrivateAgreementReturnValue =
          await agreementService.activateAgreement(agreement.id, {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          });

        const agreementEvent = await readLastAgreementEvent(agreement.id);

        expect(agreementEvent).toMatchObject({
          type: "AgreementActivated",
          event_version: 2,
          version: "1",
          stream_id: agreement.id,
        });

        const actualAgreementActivated = fromAgreementV2(
          decodeProtobufPayload({
            messageType: AgreementActivatedV2,
            payload: agreementEvent.data,
          }).agreement!
        );

        const contractDocumentId = actualAgreementActivated.contract!.id;
        const contractCreatedAt = actualAgreementActivated.contract!.createdAt;
        const contractDocumentName = `${consumer.id}_${
          producer.id
        }_${formatDateyyyyMMddHHmmss(
          contractCreatedAt
        )}_agreement_contract.pdf`;

        const expectedContract = {
          id: contractDocumentId,
          contentType: "application/pdf",
          createdAt: contractCreatedAt,
          path: `${config.agreementContractsPath}/${agreement.id}/${contractDocumentId}/${contractDocumentName}`,
          prettyName: "Richiesta di fruizione",
          name: contractDocumentName,
        };

        const expectedActivatedAgreement: Agreement = {
          ...agreement,
          state: agreementState.active,
          stamps: {
            ...agreement.stamps,
            activation: {
              who: authData.userId,
              when: actualAgreementActivated.stamps.activation!.when,
              delegationId: producerDelegation?.id,
            },
          },
          certifiedAttributes: [{ id: certifiedAttribute.id }],
          declaredAttributes: [{ id: declaredAttribute.id }],
          verifiedAttributes: [{ id: verifiedAttribute.id }],
          contract: expectedContract,
          suspendedByProducer: false,
          suspendedByConsumer: false,
          suspendedByPlatform: false, // when the agreement is Activated this is uptated to false
        };

        expect(actualAgreementActivated).toMatchObject(
          expectedActivatedAgreement
        );

        const expectedAgreementPDFPayload: AgreementContractPDFPayload = {
          todayDate: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
          todayTime: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
          agreementId: expectedActivatedAgreement.id,
          submitterId: expectedActivatedAgreement.stamps.submission!.who,
          submissionDate: dateAtRomeZone(
            expectedActivatedAgreement.stamps.submission!.when
          ),
          submissionTime: timeAtRomeZone(
            expectedActivatedAgreement.stamps.submission!.when
          ),
          activatorId: expectedActivatedAgreement.stamps.activation!.who,
          activationDate: dateAtRomeZone(
            expectedActivatedAgreement.stamps.activation!.when
          ),
          activationTime: timeAtRomeZone(
            expectedActivatedAgreement.stamps.activation!.when
          ),
          eserviceId: eservice.id,
          eserviceName: eservice.name,
          descriptorId: eservice.descriptors[0].id,
          descriptorVersion: eservice.descriptors[0].version,
          producerName: producer.name,
          producerIpaCode: producer.externalId.value,

          consumerName: consumer.name,
          consumerIpaCode: consumer.externalId.value,
          certifiedAttributes: [
            {
              assignmentDate: dateAtRomeZone(
                validTenantCertifiedAttribute.assignmentTimestamp
              ),
              assignmentTime: timeAtRomeZone(
                validTenantCertifiedAttribute.assignmentTimestamp
              ),
              attributeName: certifiedAttribute.name,
              attributeId: validTenantCertifiedAttribute.id,
            },
          ],
          declaredAttributes: [
            {
              assignmentDate: dateAtRomeZone(
                validTenantDeclaredAttribute.assignmentTimestamp
              ),
              assignmentTime: timeAtRomeZone(
                validTenantDeclaredAttribute.assignmentTimestamp
              ),
              attributeName: declaredAttribute.name,
              attributeId: validTenantDeclaredAttribute.id,
              delegationId: consumerDelegation?.id,
            },
          ],
          verifiedAttributes: [
            {
              assignmentDate: dateAtRomeZone(
                validTenantVerifiedAttribute.assignmentTimestamp
              ),
              assignmentTime: timeAtRomeZone(
                validTenantVerifiedAttribute.assignmentTimestamp
              ),
              attributeName: verifiedAttribute.name,
              attributeId: validTenantVerifiedAttribute.id,
              expirationDate: dateAtRomeZone(
                validTenantVerifiedAttribute.verifiedBy[0].extensionDate!
              ),
              delegationId: producerDelegation?.id,
            },
          ],
          producerDelegationId: producerDelegation?.id,
          producerDelegateIpaCode: delegateProducer?.externalId.value,
          producerDelegateName: delegateProducer?.name,

          // PDF mentions also consumer delegate in case they exist, even if the caller is the producer/producer delegate
          consumerDelegationId: consumerDelegation?.id,
          consumerDelegateIpaCode: delegateConsumer?.externalId.value,
          consumerDelegateName: delegateConsumer?.name,
        };
        expect(pdfGenerator.generate).toHaveBeenCalledWith(
          path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            "../src",
            "resources/templates/documents/",
            "agreementContractTemplate.html"
          ),
          expectedAgreementPDFPayload
        );

        expect(
          await fileManager.listFiles(config.s3Bucket, genericLogger)
        ).toContain(expectedContract.path);

        await testRelatedAgreementsArchiviation(relatedAgreements);
        expect(acrivateAgreementReturnValue).toMatchObject(
          expectedActivatedAgreement
        );
      }
    );

    it("Agreement Pending, Requester === Producer, invalid certified attributes -- error case: throws agreementActivationFailed and sets the agreement to MissingCertifiedAttributes", async () => {
      const producer: Tenant = getMockTenant();

      const revokedTenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: new Date(),
      };

      const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
        ...getMockDeclaredTenantAttribute(),
        revocationTimestamp: undefined,
      };

      const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
        ...getMockVerifiedTenantAttribute(),
        verifiedBy: [
          {
            id: producer.id,
            verificationDate: new Date(),
            extensionDate: addDays(new Date(), 30),
          },
        ],
      };

      const consumer: Tenant = {
        ...getMockTenant(),
        attributes: [
          revokedTenantCertifiedAttribute,
          validTenantDeclaredAttribute,
          validTenantVerifiedAttribute,
        ],
      };

      const authData = getRandomAuthData(producer.id);
      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
        attributes: {
          certified: [
            [getMockEServiceAttribute(revokedTenantCertifiedAttribute.id)],
          ],
          declared: [
            [getMockEServiceAttribute(validTenantDeclaredAttribute.id)],
          ],
          verified: [
            [getMockEServiceAttribute(validTenantVerifiedAttribute.id)],
          ],
        },
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId: producer.id,
        descriptors: [descriptor],
      };

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.pending,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: producer.id,
        consumerId: consumer.id,
        suspendedByPlatform: false, // Must be false, otherwise no event is created
      };

      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(agreementActivationFailed(agreement.id));

      const agreementEvent = await readLastAgreementEvent(agreement.id);

      expect(agreementEvent).toMatchObject({
        type: "AgreementSetMissingCertifiedAttributesByPlatform",
        event_version: 2,
        version: "1",
        stream_id: agreement.id,
      });

      const actualAgreement = fromAgreementV2(
        decodeProtobufPayload({
          messageType: AgreementSetMissingCertifiedAttributesByPlatformV2,
          payload: agreementEvent.data,
        }).agreement!
      );

      const expectedAgreement: Agreement = {
        ...agreement,
        state: agreementState.missingCertifiedAttributes,
        suspendedByPlatform: true,
      };

      expect(actualAgreement).toMatchObject(expectedAgreement);
    });

    it("Agreement Pending, Requester === Producer, invalid attributes -- error case: throws agreementActivationFailed", async () => {
      const producer: Tenant = getMockTenant();

      const revokedTenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: new Date(),
      };

      const revokedTenantDeclaredAttribute: DeclaredTenantAttribute = {
        ...getMockDeclaredTenantAttribute(),
        revocationTimestamp: new Date(),
      };

      const tenantVerifiedAttributeByAnotherProducer: VerifiedTenantAttribute =
        {
          ...getMockVerifiedTenantAttribute(),
          verifiedBy: [
            { id: generateId<TenantId>(), verificationDate: new Date() },
          ],
        };

      const tenantVerfiedAttributeWithExpiredExtension: VerifiedTenantAttribute =
        {
          ...getMockVerifiedTenantAttribute(),
          verifiedBy: [
            {
              id: producer.id,
              verificationDate: new Date(),
              extensionDate: new Date(),
            },
          ],
        };

      const consumerInvalidAttribute: TenantAttribute = randomArrayItem([
        revokedTenantCertifiedAttribute,
        revokedTenantDeclaredAttribute,
        tenantVerifiedAttributeByAnotherProducer,
        tenantVerfiedAttributeWithExpiredExtension,
      ]);

      const consumer: Tenant = {
        ...getMockTenant(),
        attributes: [consumerInvalidAttribute],
      };

      const authData = getRandomAuthData(producer.id);
      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
        attributes: {
          certified:
            consumerInvalidAttribute.type === "PersistentCertifiedAttribute"
              ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
              : [[]],

          declared:
            consumerInvalidAttribute.type === "PersistentDeclaredAttribute"
              ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
              : [],
          verified:
            consumerInvalidAttribute.type === "PersistentVerifiedAttribute"
              ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
              : [],
        },
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId: producer.id,
        descriptors: [descriptor],
      };

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.pending,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: producer.id,
        consumerId: consumer.id,
      };

      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(agreementActivationFailed(agreement.id));
    });

    it("Agreement Pending, Requester === Consumer -- error case: throws organizationIsNotTheProducer", async () => {
      const consumerId = generateId<TenantId>();
      const authData = getRandomAuthData(consumerId);

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.pending,
        consumerId,
      };
      await addOneAgreement(agreement);
      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        organizationIsNotTheProducer(authData.organizationId)
      );
    });

    it("Agreement Pending, Requester === DelegateConsumer -- error case: throws organizationIsNotTheProducer", async () => {
      const delegateId = generateId<TenantId>();
      const authData = getRandomAuthData(delegateId);
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.pending,
      };

      const consumerDelegation = getMockDelegation({
        delegatorId: agreement.consumerId,
        kind: delegationKind.delegatedConsumer,
        state: delegationState.active,
        eserviceId: agreement.eserviceId,
        delegateId,
      });

      await addOneAgreement(agreement);
      await addOneDelegation(consumerDelegation);
      await addSomeRandomDelegations(agreement, addOneDelegation);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        organizationIsNotTheProducer(authData.organizationId)
      );
    });

    it("Agreement Pending, Requester === Producer and active producer delegation exists -- error case: throws organizationIsNotTheDelegateProducer", async () => {
      const producerId = generateId<TenantId>();
      const authData = getRandomAuthData(producerId);
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.pending,
        producerId,
      };

      const producerDelegation = getMockDelegation({
        delegatorId: producerId,
        kind: delegationKind.delegatedProducer,
        state: delegationState.active,
        delegateId: generateId<TenantId>(),
        eserviceId: agreement.eserviceId,
      });

      await addOneAgreement(agreement);
      await addOneDelegation(producerDelegation);
      await addSomeRandomDelegations(agreement, addOneDelegation);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        organizationIsNotTheDelegateProducer(
          authData.organizationId,
          producerDelegation.id
        )
      );
    });
  });

  describe("Agreement Suspended", () => {
    it.each(Object.values(requesterIs))(
      "Agreement Suspended, valid attributes, requester is: %s -- success case: Suspended >> Activated",
      async (requesterIs) => {
        const { suspendedByProducer, suspendedByConsumer } = match(requesterIs)
          .with("Producer", "DelegateProducer", () => ({
            // Only suspendedByProducer is true, so that the next state is active
            suspendedByProducer: true,
            suspendedByConsumer: false,
          }))
          .with("Consumer", "DelegateConsumer", () => ({
            // Only suspendedByConsumer is true, so that the next state is active
            suspendedByProducer: false,
            suspendedByConsumer: true,
          }))
          .exhaustive();

        const producer: Tenant = getMockTenant();

        const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
          ...getMockCertifiedTenantAttribute(),
          revocationTimestamp: undefined,
        };

        const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
          ...getMockDeclaredTenantAttribute(),
          revocationTimestamp: undefined,
        };

        const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
          ...getMockVerifiedTenantAttribute(),
          verifiedBy: [
            {
              id: producer.id,
              verificationDate: new Date(),
              extensionDate: addDays(new Date(), 30),
            },
          ],
        };

        const consumer: Tenant = {
          ...getMockTenant(),
          attributes: [
            validTenantCertifiedAttribute,
            validTenantDeclaredAttribute,
            validTenantVerifiedAttribute,
          ],
        };

        const descriptor: Descriptor = {
          ...getMockDescriptorPublished(),
          state: randomArrayItem(agreementActivationAllowedDescriptorStates),
          attributes: {
            certified: [
              [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
            ],
            declared: [
              [getMockEServiceAttribute(validTenantDeclaredAttribute.id)],
            ],
            verified: [
              [getMockEServiceAttribute(validTenantVerifiedAttribute.id)],
            ],
          },
        };

        const eservice: EService = {
          ...getMockEService(),
          producerId: producer.id,
          descriptors: [descriptor],
        };

        const mockAgreement = getMockAgreement();
        const agreement: Agreement = {
          ...mockAgreement,
          state: agreementState.suspended,
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
          producerId: producer.id,
          consumerId: consumer.id,
          suspendedByProducer,
          suspendedByConsumer,
          suspendedAt: new Date(),
          stamps: {
            ...mockAgreement.stamps,
            suspensionByProducer: suspendedByProducer
              ? {
                  who: generateId(),
                  when: new Date(),
                }
              : undefined,
            suspensionByConsumer: suspendedByConsumer
              ? {
                  who: generateId(),
                  when: new Date(),
                }
              : undefined,
          },

          // Adding some random attributes to check that they are not modified by the Unsuspension
          certifiedAttributes: [getMockAgreementAttribute()],
          declaredAttributes: [getMockAgreementAttribute()],
          verifiedAttributes: [getMockAgreementAttribute()],
        };

        const {
          authData,
          producerDelegation,
          consumerDelegation,
          delegateProducer,
          delegateConsumer,
        } = authDataAndDelegationsFromRequesterIs(requesterIs, agreement);

        await addOneTenant(consumer);
        await addOneTenant(producer);
        await addOneEService(eservice);
        await addOneAgreement(agreement);
        const relatedAgreements = await addRelatedAgreements(agreement);

        await addSomeRandomDelegations(agreement, addOneDelegation);
        await addDelegationsAndDelegates({
          producerDelegation,
          delegateProducer,
          consumerDelegation,
          delegateConsumer,
        });

        const activateAgreementReturnValue =
          await agreementService.activateAgreement(agreement.id, {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          });

        const agreementEvent = await readLastAgreementEvent(agreement.id);

        const { eventType, messageType } =
          unsuspensionEventInfoFromRequesterIs(requesterIs);

        expect(agreementEvent).toMatchObject({
          type: eventType,
          event_version: 2,
          version: "1",
          stream_id: agreement.id,
        });

        const actualAgreementActivated = fromAgreementV2(
          decodeProtobufPayload({
            messageType,
            payload: agreementEvent.data,
          }).agreement!
        );

        const expectedActivatedAgreement: Agreement = {
          ...agreement,
          state: agreementState.active,
          suspendedAt: undefined,
          stamps: {
            ...agreement.stamps,
            suspensionByProducer: undefined,
            suspensionByConsumer: undefined,
          },
          suspendedByConsumer: false,
          suspendedByProducer: false,
          suspendedByPlatform: false, // when the agreement is Activated this is uptated to false
        };

        expect(actualAgreementActivated).toMatchObject(
          expectedActivatedAgreement
        );

        expect(activateAgreementReturnValue).toMatchObject(
          expectedActivatedAgreement
        );

        await testRelatedAgreementsArchiviation(relatedAgreements);
      }
    );

    it("Agreement Suspended, Requester === Consumer === Producer, no matter the attributes -- success case: Suspended >> Activated", async () => {
      const revokedTenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: new Date(),
      };

      const consumerAndProducer: Tenant = {
        ...getMockTenant(),
        attributes: [
          revokedTenantCertifiedAttribute,
          getMockDeclaredTenantAttribute(),
          getMockVerifiedTenantAttribute(),
        ],
      };

      const authData = getRandomAuthData(consumerAndProducer.id);

      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
        attributes: {
          certified: [
            [getMockEServiceAttribute(consumerAndProducer.attributes[0].id)],
          ],
          declared: [
            [getMockEServiceAttribute(consumerAndProducer.attributes[1].id)],
          ],
          verified: [
            [getMockEServiceAttribute(consumerAndProducer.attributes[2].id)],
          ],
        },
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId: consumerAndProducer.id,
        descriptors: [descriptor],
      };

      // At least one of the two is true, they will both become false anyways
      const suspendedByConsumer = randomBoolean();
      const suspendedByProducer = !suspendedByConsumer ? true : randomBoolean();

      const mockAgreement = getMockAgreement();
      const agreement: Agreement = {
        ...mockAgreement,
        state: agreementState.suspended,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: consumerAndProducer.id,
        consumerId: consumerAndProducer.id,
        suspendedByProducer,
        suspendedByConsumer,
        suspendedAt: new Date(),
        stamps: {
          ...mockAgreement.stamps,
          suspensionByProducer: suspendedByProducer
            ? {
                who: authData.userId,
                when: new Date(),
              }
            : undefined,
          suspensionByConsumer: suspendedByConsumer
            ? {
                who: authData.userId,
                when: new Date(),
              }
            : undefined,
        },

        // Adding some random attributes to check that they are not modified by the Unsuspension
        certifiedAttributes: [getMockAgreementAttribute()],
        declaredAttributes: [getMockAgreementAttribute()],
        verifiedAttributes: [getMockAgreementAttribute()],
      };

      await addOneTenant(consumerAndProducer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);
      const relatedAgreements = await addRelatedAgreements(agreement);

      const activateAgreementReturnValue =
        await agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        });

      const agreementEvent = await readLastAgreementEvent(agreement.id);

      // In this case, where the caller is both Producer and Consumer,
      // it saves an UnsuspendedByProducer event
      expect(agreementEvent).toMatchObject({
        type: "AgreementUnsuspendedByProducer",
        event_version: 2,
        version: "1",
        stream_id: agreement.id,
      });

      const actualAgreementActivated = fromAgreementV2(
        decodeProtobufPayload({
          messageType: AgreementUnsuspendedByProducerV2,
          payload: agreementEvent.data,
        }).agreement!
      );

      const expectedActivatedAgreement: Agreement = {
        ...agreement,
        state: agreementState.active,
        suspendedAt: undefined,
        stamps: {
          ...agreement.stamps,
          suspensionByProducer: undefined,
          suspensionByConsumer: undefined,
        },
        suspendedByConsumer: false,
        suspendedByProducer: false,
        suspendedByPlatform: false, // when the agreement is Activated this is uptated to false
      };

      expect(actualAgreementActivated).toMatchObject(
        expectedActivatedAgreement
      );

      expect(activateAgreementReturnValue).toMatchObject(
        expectedActivatedAgreement
      );

      await testRelatedAgreementsArchiviation(relatedAgreements);
    });

    describe.each(Object.values(requesterIs))(
      "Agreement Suspended, valid attributes, requester is: %s -- success case: Suspended >> Suspended",
      async (requesterIs) => {
        const { suspendedByProducer, suspendedByConsumer } = match(requesterIs)
          .with("Producer", "DelegateProducer", () => ({
            suspendedByConsumer: true,
            suspendedByProducer: randomBoolean(),
          }))
          .with("Consumer", "DelegateConsumer", () => ({
            suspendedByConsumer: randomBoolean(),
            suspendedByProducer: true,
          }))
          .exhaustive();

        const producer: Tenant = getMockTenant();

        const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
          ...getMockCertifiedTenantAttribute(),
          revocationTimestamp: undefined,
        };

        const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
          ...getMockDeclaredTenantAttribute(),
          revocationTimestamp: undefined,
        };

        const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
          ...getMockVerifiedTenantAttribute(),
          verifiedBy: [
            {
              id: producer.id,
              verificationDate: new Date(),
              extensionDate: addDays(new Date(), 30),
            },
          ],
        };

        const consumer: Tenant = {
          ...getMockTenant(),
          attributes: [
            validTenantCertifiedAttribute,
            validTenantDeclaredAttribute,
            validTenantVerifiedAttribute,
          ],
        };

        const descriptor: Descriptor = {
          ...getMockDescriptorPublished(),
          state: randomArrayItem(agreementActivationAllowedDescriptorStates),
          attributes: {
            certified: [
              [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
            ],
            declared: [
              [getMockEServiceAttribute(validTenantDeclaredAttribute.id)],
            ],
            verified: [
              [getMockEServiceAttribute(validTenantVerifiedAttribute.id)],
            ],
          },
        };

        const eservice: EService = {
          ...getMockEService(),
          producerId: producer.id,
          descriptors: [descriptor],
        };

        const mockAgreement: Agreement = {
          ...getMockAgreement(),
          state: agreementState.suspended,
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
          producerId: producer.id,
          consumerId: consumer.id,
          suspendedByProducer,
          suspendedByConsumer,
          suspendedAt: new Date(),
          stamps: {
            ...getMockAgreement().stamps,
            suspensionByProducer: suspendedByProducer
              ? {
                  who: generateId(),
                  when: new Date(),
                }
              : undefined,
            suspensionByConsumer: suspendedByConsumer
              ? {
                  who: generateId(),
                  when: new Date(),
                }
              : undefined,
          },
          // Adding some random attributes to check that they are not modified by the Unsuspension
          certifiedAttributes: [getMockAgreementAttribute()],
          declaredAttributes: [getMockAgreementAttribute()],
          verifiedAttributes: [getMockAgreementAttribute()],
        };

        const {
          authData,
          producerDelegation,
          consumerDelegation,
          delegateProducer,
          delegateConsumer,
        } = authDataAndDelegationsFromRequesterIs(requesterIs, mockAgreement);

        const expectedStamps = {
          suspensionByProducer: match(requesterIs)
            .with("Producer", "DelegateProducer", () => undefined)
            .with(
              "Consumer",
              "DelegateConsumer",
              () => mockAgreement.stamps.suspensionByProducer
            )
            .exhaustive(),

          suspensionByConsumer: match(requesterIs)
            .with(
              "Producer",
              "DelegateProducer",
              () => mockAgreement.stamps.suspensionByConsumer
            )
            .with("Consumer", "DelegateConsumer", () => undefined)
            .exhaustive(),
        };

        const expectedUnsuspendedAgreement: Agreement = {
          ...mockAgreement,
          state: agreementState.suspended,
          suspendedAt: mockAgreement.suspendedAt,
          stamps: {
            ...mockAgreement.stamps,
            ...expectedStamps,
          },
          suspendedByConsumer: match(requesterIs)
            .with("Producer", "DelegateProducer", () => true)
            .with("Consumer", "DelegateConsumer", () => false)
            .exhaustive(),
          suspendedByProducer: match(requesterIs)
            .with("Producer", "DelegateProducer", () => false)
            .with("Consumer", "DelegateConsumer", () => true)
            .exhaustive(),
        };

        const { eventType, messageType } =
          unsuspensionEventInfoFromRequesterIs(requesterIs);

        it("if suspendedByPlatform === false, unsuspends by Producer or Consumer and remains in a Suspended state", async () => {
          const agreement: Agreement = {
            ...mockAgreement,
            suspendedByPlatform: false,
          };
          const expected = {
            ...expectedUnsuspendedAgreement,
            suspendedByPlatform: false,
          };
          await addOneTenant(consumer);
          await addOneTenant(producer);
          await addOneEService(eservice);
          await addOneAgreement(agreement);
          const relatedAgreements = await addRelatedAgreements(agreement);

          await addSomeRandomDelegations(agreement, addOneDelegation);
          await addDelegationsAndDelegates({
            producerDelegation,
            delegateProducer,
            consumerDelegation,
            delegateConsumer,
          });

          const activateAgreementReturnValue =
            await agreementService.activateAgreement(agreement.id, {
              authData,
              serviceName: "",
              correlationId: generateId(),
              logger: genericLogger,
            });

          const agreementEvent = await readLastAgreementEvent(agreement.id);

          expect(agreementEvent).toMatchObject({
            type: eventType,

            event_version: 2,
            version: "1",
            stream_id: agreement.id,
          });

          const actualAgreementUnsuspended = fromAgreementV2(
            decodeProtobufPayload({
              messageType,
              payload: agreementEvent.data,
            }).agreement!
          );

          await testRelatedAgreementsArchiviation(relatedAgreements);

          expect(actualAgreementUnsuspended).toMatchObject(expected);

          expect(activateAgreementReturnValue).toMatchObject(expected);
        });

        it("if suspendedByPlatform === true, unsuspends by Producer or Consumer and also by platform, and remains in a Suspended state", async () => {
          const agreement: Agreement = {
            ...mockAgreement,
            suspendedByPlatform: true,
          };

          const expected1 = {
            ...expectedUnsuspendedAgreement,
            suspendedByPlatform: true,
          };

          const expected2 = {
            ...expected1,
            suspendedByPlatform: false,
          };

          await addOneTenant(consumer);
          await addOneTenant(producer);
          await addOneEService(eservice);
          await addOneAgreement(agreement);
          const relatedAgreements = await addRelatedAgreements(agreement);

          await addSomeRandomDelegations(agreement, addOneDelegation);
          await addDelegationsAndDelegates({
            producerDelegation,
            delegateProducer,
            consumerDelegation,
            delegateConsumer,
          });

          const activateAgreementReturnValue =
            await agreementService.activateAgreement(agreement.id, {
              authData,
              serviceName: "",
              correlationId: generateId(),
              logger: genericLogger,
            });

          const agreementEvent = await readAgreementEventByVersion(
            agreement.id,
            1
          );

          expect(agreementEvent).toMatchObject({
            type: eventType,
            event_version: 2,
            version: "1",
            stream_id: agreement.id,
          });

          const actualAgreementUnsuspended = fromAgreementV2(
            decodeProtobufPayload({
              messageType,
              payload: agreementEvent.data,
            }).agreement!
          );

          expect(actualAgreementUnsuspended).toMatchObject(expected1);

          const agreementUnsuspendedByPlatformEvent =
            await readAgreementEventByVersion(agreement.id, 2);

          expect(agreementUnsuspendedByPlatformEvent).toMatchObject({
            type: "AgreementUnsuspendedByPlatform",
            event_version: 2,
            version: "2",
            stream_id: agreement.id,
          });

          const actualAgreementUnsuspendedByPlatform = fromAgreementV2(
            decodeProtobufPayload({
              messageType: AgreementUnsuspendedByPlatformV2,
              payload: agreementUnsuspendedByPlatformEvent.data,
            }).agreement!
          );

          await testRelatedAgreementsArchiviation(relatedAgreements);
          expect(actualAgreementUnsuspendedByPlatform).toMatchObject(expected2);
          expect(activateAgreementReturnValue).toMatchObject(expected2);
        });
      }
    );

    describe.each(Object.values(requesterIs))(
      "Agreement Suspended, invalid attributes, requester is: %s -- success case: Suspended >> Suspended",
      async (requesterIs) => {
        const { suspendedByProducer, suspendedByConsumer } = match(requesterIs)
          .with("Producer", "DelegateProducer", () => ({
            suspendedByConsumer: true,
            suspendedByProducer: randomBoolean(),
          }))
          .with("Consumer", "DelegateConsumer", () => ({
            suspendedByConsumer: randomBoolean(),
            suspendedByProducer: true,
          }))
          .exhaustive();

        const producer: Tenant = getMockTenant();

        const revokedTenantCertifiedAttribute: CertifiedTenantAttribute = {
          ...getMockCertifiedTenantAttribute(),
          revocationTimestamp: new Date(),
        };

        const revokedTenantDeclaredAttribute: DeclaredTenantAttribute = {
          ...getMockDeclaredTenantAttribute(),
          revocationTimestamp: new Date(),
        };

        const tenantVerifiedAttributeByAnotherProducer: VerifiedTenantAttribute =
          {
            ...getMockVerifiedTenantAttribute(),
            verifiedBy: [
              { id: generateId<TenantId>(), verificationDate: new Date() },
            ],
          };

        const tenantVerfiedAttributeWithExpiredExtension: VerifiedTenantAttribute =
          {
            ...getMockVerifiedTenantAttribute(),
            verifiedBy: [
              {
                id: producer.id,
                verificationDate: new Date(),
                extensionDate: new Date(),
              },
            ],
          };

        const consumerInvalidAttribute: TenantAttribute = randomArrayItem([
          revokedTenantCertifiedAttribute,
          revokedTenantDeclaredAttribute,
          tenantVerifiedAttributeByAnotherProducer,
          tenantVerfiedAttributeWithExpiredExtension,
        ]);

        const consumer: Tenant = {
          ...getMockTenant(),
          attributes: [consumerInvalidAttribute],
        };

        const descriptor: Descriptor = {
          ...getMockDescriptorPublished(),
          state: randomArrayItem(agreementActivationAllowedDescriptorStates),
          attributes: {
            certified:
              consumerInvalidAttribute.type === "PersistentCertifiedAttribute"
                ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
                : [[]],

            declared:
              consumerInvalidAttribute.type === "PersistentDeclaredAttribute"
                ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
                : [],
            verified:
              consumerInvalidAttribute.type === "PersistentVerifiedAttribute"
                ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
                : [],
          },
        };

        const eservice: EService = {
          ...getMockEService(),
          producerId: producer.id,
          descriptors: [descriptor],
        };

        const mockAgreement: Agreement = {
          ...getMockAgreement(),
          state: agreementState.suspended,
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
          producerId: producer.id,
          consumerId: consumer.id,
          suspendedByProducer,
          suspendedByConsumer,
          suspendedAt: new Date(),
          stamps: {
            ...getMockAgreement().stamps,
            suspensionByProducer: suspendedByProducer
              ? {
                  who: generateId(),
                  when: new Date(),
                }
              : undefined,
            suspensionByConsumer: suspendedByConsumer
              ? {
                  who: generateId(),
                  when: new Date(),
                }
              : undefined,
          },
          // Adding some random attributes to check that they are not modified by the Unsuspension
          certifiedAttributes: [getMockAgreementAttribute()],
          declaredAttributes: [getMockAgreementAttribute()],
          verifiedAttributes: [getMockAgreementAttribute()],
        };

        const {
          authData,
          producerDelegation,
          consumerDelegation,
          delegateProducer,
          delegateConsumer,
        } = authDataAndDelegationsFromRequesterIs(requesterIs, mockAgreement);

        const expectedStamps = {
          suspensionByProducer: match(requesterIs)
            .with("Producer", "DelegateProducer", () => undefined)
            .with(
              "Consumer",
              "DelegateConsumer",
              () => mockAgreement.stamps.suspensionByProducer
            )
            .exhaustive(),
          suspensionByConsumer: match(requesterIs)
            .with(
              "Producer",
              "DelegateProducer",
              () => mockAgreement.stamps.suspensionByConsumer
            )
            .with("Consumer", "DelegateConsumer", () => undefined)
            .exhaustive(),
        };

        const expectedUnsuspendedAgreement: Agreement = {
          ...mockAgreement,
          state: agreementState.suspended,
          suspendedAt: mockAgreement.suspendedAt,
          stamps: {
            ...mockAgreement.stamps,
            ...expectedStamps,
          },
          suspendedByConsumer: match(requesterIs)
            .with("Producer", "DelegateProducer", () => true)
            .with("Consumer", "DelegateConsumer", () => false)
            .exhaustive(),
          suspendedByProducer: match(requesterIs)
            .with("Producer", "DelegateProducer", () => false)
            .with("Consumer", "DelegateConsumer", () => true)
            .exhaustive(),
        };

        const { eventType, messageType } =
          unsuspensionEventInfoFromRequesterIs(requesterIs);

        it("if suspendedByPlatform === true, unsuspends by Producer or Consumer and remains in a Suspended state", async () => {
          const agreement: Agreement = {
            ...mockAgreement,
            suspendedByPlatform: true,
          };
          const expected = {
            ...expectedUnsuspendedAgreement,
            suspendedByPlatform: true,
          };
          await addOneTenant(consumer);
          await addOneTenant(producer);
          await addOneEService(eservice);
          await addOneAgreement(agreement);
          const relatedAgreements = await addRelatedAgreements(agreement);

          await addSomeRandomDelegations(agreement, addOneDelegation);
          await addDelegationsAndDelegates({
            producerDelegation,
            delegateProducer,
            consumerDelegation,
            delegateConsumer,
          });

          const activateAgreementReturnValue =
            await agreementService.activateAgreement(agreement.id, {
              authData,
              serviceName: "",
              correlationId: generateId(),
              logger: genericLogger,
            });
          const agreementEvent = await readLastAgreementEvent(agreement.id);
          expect(agreementEvent).toMatchObject({
            type: eventType,
            event_version: 2,
            version: "1",
            stream_id: agreement.id,
          });
          const actualAgreementUnsuspended = fromAgreementV2(
            decodeProtobufPayload({
              messageType,
              payload: agreementEvent.data,
            }).agreement!
          );
          await testRelatedAgreementsArchiviation(relatedAgreements);
          expect(actualAgreementUnsuspended).toMatchObject(expected);
          expect(activateAgreementReturnValue).toMatchObject(expected);
        });

        it("if suspendedByPlatform === false, unsuspends by Producer or Consumer and also suspends by platform, and remains in a Suspended state", async () => {
          const agreement: Agreement = {
            ...mockAgreement,
            suspendedByPlatform: false,
          };

          const expected1 = {
            ...expectedUnsuspendedAgreement,
            suspendedByPlatform: false,
          };

          const expected2 = {
            ...expected1,
            suspendedByPlatform: true,
          };

          await addOneTenant(consumer);
          await addOneTenant(producer);
          await addOneEService(eservice);
          await addOneAgreement(agreement);
          const relatedAgreements = await addRelatedAgreements(agreement);

          await addSomeRandomDelegations(agreement, addOneDelegation);
          await addDelegationsAndDelegates({
            producerDelegation,
            delegateProducer,
            consumerDelegation,
            delegateConsumer,
          });

          const activateAgreementReturnValue =
            await agreementService.activateAgreement(agreement.id, {
              authData,
              serviceName: "",
              correlationId: generateId(),
              logger: genericLogger,
            });

          const agreementEvent = await readAgreementEventByVersion(
            agreement.id,
            1
          );

          expect(agreementEvent).toMatchObject({
            type: eventType,
            event_version: 2,
            version: "1",
            stream_id: agreement.id,
          });

          const actualAgreementUnsuspended = fromAgreementV2(
            decodeProtobufPayload({
              messageType,
              payload: agreementEvent.data,
            }).agreement!
          );

          expect(actualAgreementUnsuspended).toMatchObject(expected1);

          const agreementUnsuspendedByPlatformEvent =
            await readAgreementEventByVersion(agreement.id, 2);

          expect(agreementUnsuspendedByPlatformEvent).toMatchObject({
            type: "AgreementSuspendedByPlatform",
            event_version: 2,
            version: "2",
            stream_id: agreement.id,
          });

          const actualAgreementUnsuspendedByPlatform = fromAgreementV2(
            decodeProtobufPayload({
              messageType: AgreementSuspendedByPlatformV2,
              payload: agreementUnsuspendedByPlatformEvent.data,
            }).agreement!
          );

          await testRelatedAgreementsArchiviation(relatedAgreements);
          expect(actualAgreementUnsuspendedByPlatform).toMatchObject(expected2);
          expect(activateAgreementReturnValue).toMatchObject(expected2);
        });
      }
    );

    it("Agreement Suspended, Requester === Producer and active producer delegation exists -- error case: throws organizationNotAllowed", async () => {
      const producerId = generateId<TenantId>();
      const authData = getRandomAuthData(producerId);
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.suspended,
        producerId,
      };

      const producerDelegation = getMockDelegation({
        delegatorId: producerId,
        kind: delegationKind.delegatedProducer,
        state: delegationState.active,
        delegateId: generateId<TenantId>(),
        eserviceId: agreement.eserviceId,
      });

      await addOneAgreement(agreement);
      await addOneDelegation(producerDelegation);
      await addSomeRandomDelegations(agreement, addOneDelegation);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(organizationNotAllowed(authData.organizationId));
    });

    it("Agreement Suspended, Requester === Consumer and active consumer delegation exists -- error case: throws organizationNotAllowed", async () => {
      const consumerId = generateId<TenantId>();
      const authData = getRandomAuthData(consumerId);
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.suspended,
        consumerId,
      };

      const consumerDelegation = getMockDelegation({
        delegatorId: consumerId,
        kind: delegationKind.delegatedConsumer,
        state: delegationState.active,
        delegateId: generateId<TenantId>(),
        eserviceId: agreement.eserviceId,
      });

      await addOneAgreement(agreement);
      await addOneDelegation(consumerDelegation);
      await addSomeRandomDelegations(agreement, addOneDelegation);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(organizationNotAllowed(authData.organizationId));
    });
  });

  describe("All other error cases", () => {
    it("should throw an agreementNotFound error when the Agreement does not exist", async () => {
      await addOneAgreement(getMockAgreement());
      const authData = getRandomAuthData();
      const agreementId = generateId<AgreementId>();
      await expect(
        agreementService.activateAgreement(agreementId, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(agreementNotFound(agreementId));
    });

    it("should throw an organizationNotAllowed error when the requester is not the Consumer or Producer or Delegated Consumer or Delegate Producer or Delegate Consumer", async () => {
      const authData = getRandomAuthData();
      const agreement: Agreement = getMockAgreement(
        generateId<EServiceId>(),
        generateId<TenantId>(),
        agreementState.suspended
      );

      const producerDelegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegatorId: agreement.producerId,
        delegateId: generateId<TenantId>(),
        state: delegationState.active,
        eserviceId: agreement.eserviceId,
      });
      const consumerDelegation = getMockDelegation({
        kind: delegationKind.delegatedConsumer,
        delegatorId: agreement.consumerId,
        delegateId: generateId<TenantId>(),
        state: delegationState.active,
        eserviceId: agreement.eserviceId,
      });

      await addOneAgreement(agreement);
      await addOneDelegation(producerDelegation);
      await addOneDelegation(consumerDelegation);
      await addSomeRandomDelegations(agreement, addOneDelegation);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(organizationNotAllowed(authData.organizationId));
    });

    it.each(
      Object.values(agreementState).filter(
        (state) => !agreementActivableStates.includes(state)
      )
    )(
      "should throw an agreementNotInExpectedState error when the Agreement is not in an activable state - agreement state: %s",
      async (agreementState) => {
        const consumerId = generateId<TenantId>();
        const authData = getRandomAuthData(consumerId);

        const agreement: Agreement = {
          ...getMockAgreement(),
          state: agreementState,
          consumerId,
        };
        await addOneAgreement(agreement);
        await expect(
          agreementService.activateAgreement(agreement.id, {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          })
        ).rejects.toThrowError(
          agreementNotInExpectedState(agreement.id, agreement.state)
        );
      }
    );

    it("should throw an eServiceNotFound error when the EService does not exist", async () => {
      const consumerId = generateId<TenantId>();
      const authData = getRandomAuthData(consumerId);

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: randomArrayItem(
          agreementActivableStates.filter((s) => s !== agreementState.pending)
        ),
        consumerId,
      };
      await addOneAgreement(agreement);
      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
    });

    it("should throw a descriptorNotFound error when the Descriptor does not exist", async () => {
      const consumerId = generateId<TenantId>();
      const producerId = generateId<TenantId>();
      const authData = getRandomAuthData(producerId);

      const eservice: EService = {
        ...getMockEService(),
        producerId,
      };
      const agreement: Agreement = {
        ...getMockAgreement(),
        eserviceId: eservice.id,
        consumerId,
        state: randomArrayItem(agreementActivableStates),
        producerId,
      };

      await addOneEService(eservice);
      await addOneAgreement(agreement);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        descriptorNotFound(agreement.eserviceId, agreement.descriptorId)
      );
    });

    it.each(
      Object.values(descriptorState).filter(
        (state) => !agreementActivationAllowedDescriptorStates.includes(state)
      )
    )(
      "should throw a descriptorNotInExpectedState error when the Descriptor is not in an expected state - descriptor state: %s",
      async (descriptorState) => {
        const consumerId = generateId<TenantId>();
        const producerId = generateId<TenantId>();
        const authData = getRandomAuthData(producerId);

        const descriptor: Descriptor = {
          ...getMockDescriptorPublished(),
          state: descriptorState,
        };

        const eservice: EService = {
          ...getMockEService(),
          producerId,
          descriptors: [descriptor],
        };

        const agreement: Agreement = {
          ...getMockAgreement(),
          state: randomArrayItem(agreementActivableStates),
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
          producerId,
          consumerId,
        };

        await addOneEService(eservice);
        await addOneAgreement(agreement);

        await expect(
          agreementService.activateAgreement(agreement.id, {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          })
        ).rejects.toThrowError(
          descriptorNotInExpectedState(
            eservice.id,
            descriptor.id,
            agreementActivationAllowedDescriptorStates
          )
        );
      }
    );

    it("should throw a tenantNotFound error when the Consumer does not exist", async () => {
      const consumerId = generateId<TenantId>();
      const producerId = generateId<TenantId>();
      const authData = getRandomAuthData(producerId);

      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId,
        descriptors: [descriptor],
      };

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: randomArrayItem(agreementActivableStates),
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId,
        consumerId,
      };

      await addOneEService(eservice);
      await addOneAgreement(agreement);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(tenantNotFound(consumerId));
    });

    it("should throw a tenantNotFound error when the Producer does not exist", async () => {
      const producerId = generateId<TenantId>();
      const consumer = getMockTenant();
      const authData = getRandomAuthData(producerId);

      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId,
        descriptors: [descriptor],
      };

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: randomArrayItem(agreementActivableStates),
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId,
        consumerId: consumer.id,
      };

      await addOneTenant(consumer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);

      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(tenantNotFound(producerId));
    });

    it("should throw agreementStampNotFound when the contract builder cannot find the submission stamp", async () => {
      const producer: Tenant = getMockTenant();
      const consumer: Tenant = getMockTenant();

      const authData = getRandomAuthData(producer.id);
      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId: producer.id,
        descriptors: [descriptor],
      };

      const mockAgreement: Agreement = getMockAgreement();
      const agreement: Agreement = {
        ...mockAgreement,
        state: agreementState.pending,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: producer.id,
        consumerId: consumer.id,
        suspendedByConsumer: false,
        suspendedByProducer: randomBoolean(),
        stamps: {
          submission: undefined,
        },
      };

      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);
      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(agreementStampNotFound("submission"));
    });

    it("should throw attributeNotFound when the contract builder cannot retrieve an attribute", async () => {
      const producer: Tenant = getMockTenant();

      const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: undefined,
      };

      const consumer: Tenant = {
        ...getMockTenant(),
        selfcareId: generateId(),
        attributes: [validTenantCertifiedAttribute],
      };

      const authData = getRandomAuthData(producer.id);
      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        state: randomArrayItem(agreementActivationAllowedDescriptorStates),
        attributes: {
          certified: [
            [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
          ],
          declared: [],
          verified: [],
        },
      };

      const eservice: EService = {
        ...getMockEService(),
        producerId: producer.id,
        descriptors: [descriptor],
      };

      const mockAgreement: Agreement = getMockAgreement();
      const agreement: Agreement = {
        ...mockAgreement,
        state: agreementState.pending,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: producer.id,
        consumerId: consumer.id,
        suspendedByConsumer: false,
        suspendedByProducer: randomBoolean(),
        stamps: {
          submission: {
            who: authData.userId,
            when: new Date(),
          },
          activation: {
            who: authData.userId,
            when: new Date(),
          },
        },
      };

      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);
      await expect(
        agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        attributeNotFound(validTenantCertifiedAttribute.id)
      );
    });
  });
});
