/* eslint-disable max-params */
import { AuthData, CreateEvent, FileManager } from "pagopa-interop-commons";
import {
  Agreement,
  Descriptor,
  EService,
  Tenant,
  agreementState,
  WithMetadata,
  AgreementEvent,
  AgreementId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  assertAgreementExist,
  assertRequesterIsConsumerOrProducer,
  assertTenantExist,
  failOnActivationFailure,
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  validateActivationOnDescriptor,
  assertActivableState,
  verifyConsumerDoesNotActivatePending,
  assertEServiceExist,
  agreementArchivableStates,
} from "../model/domain/validators.js";
import {
  toCreateEventAgreementActivated,
  toCreateEventAgreementArchived,
  toCreateEventAgreementUnsuspendedByConsumer,
  toCreateEventAgreementUnsuspendedByProducer,
} from "../model/domain/toEvent.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import {
  agreementStateByFlags,
  nextState,
  suspendedByConsumerFlag,
  suspendedByProducerFlag,
} from "./agreementStateProcessor.js";
import { contractBuilder } from "./agreementContractBuilder.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";
import {
  createStamp,
  suspendedByConsumerStamp,
  suspendedByProducerStamp,
} from "./agreementStampUtils.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";

export async function activateAgreementLogic(
  agreementId: AgreementId,
  agreementQuery: AgreementQuery,
  eserviceQuery: EserviceQuery,
  tenantQuery: TenantQuery,
  attributeQuery: AttributeQuery,
  authData: AuthData,
  storeFile: FileManager["storeBytes"],
  correlationId: string
): Promise<Array<CreateEvent<AgreementEvent>>> {
  const agreement = await agreementQuery.getAgreementById(agreementId);
  assertAgreementExist(agreementId, agreement);

  assertRequesterIsConsumerOrProducer(agreement.data, authData);
  verifyConsumerDoesNotActivatePending(agreement.data, authData);
  assertActivableState(agreement.data);

  const eservice = await eserviceQuery.getEServiceById(
    agreement.data.eserviceId
  );
  assertEServiceExist(agreement.data.eserviceId, eservice);

  const descriptor = validateActivationOnDescriptor(
    eservice,
    agreement.data.descriptorId
  );

  const tenant = await tenantQuery.getTenantById(agreement.data.consumerId);
  assertTenantExist(agreement.data.consumerId, tenant);

  return activateAgreement(
    agreement,
    eservice,
    descriptor,
    tenant,
    authData,
    tenantQuery,
    agreementQuery,
    attributeQuery,
    storeFile,
    correlationId
  );
}

async function activateAgreement(
  agreementData: WithMetadata<Agreement>,
  eservice: EService,
  descriptor: Descriptor,
  consumer: Tenant,
  authData: AuthData,
  tenantQuery: TenantQuery,
  agreementQuery: AgreementQuery,
  attributeQuery: AttributeQuery,
  storeFile: FileManager["storeBytes"],
  correlationId: string
): Promise<Array<CreateEvent<AgreementEvent>>> {
  const agreement = agreementData.data;
  const nextAttributesState = nextState(agreement, descriptor, consumer);

  const suspendedByConsumer = suspendedByConsumerFlag(
    agreement,
    authData.organizationId,
    agreementState.active
  );
  const suspendedByProducer = suspendedByProducerFlag(
    agreement,
    authData.organizationId,
    agreementState.active
  );

  const newState = agreementStateByFlags(
    nextAttributesState,
    suspendedByProducer,
    suspendedByConsumer
  );

  failOnActivationFailure(newState, agreement);

  const firstActivation =
    agreement.state === agreementState.pending &&
    newState === agreementState.active;

  const updatedAgreementSeed: UpdateAgreementSeed = firstActivation
    ? {
        state: newState,
        certifiedAttributes: matchingCertifiedAttributes(descriptor, consumer),
        declaredAttributes: matchingDeclaredAttributes(descriptor, consumer),
        verifiedAttributes: matchingVerifiedAttributes(
          eservice,
          descriptor,
          consumer
        ),
        suspendedByConsumer,
        suspendedByProducer,
        stamps: {
          ...agreement.stamps,
          activation: createStamp(authData),
        },
      }
    : {
        state: newState,
        suspendedByConsumer,
        suspendedByProducer,
        stamps: {
          ...agreement.stamps,
          suspensionByConsumer: suspendedByConsumerStamp(
            agreement,
            authData.organizationId,
            agreementState.active,
            createStamp(authData)
          ),
          suspensionByProducer: suspendedByProducerStamp(
            agreement,
            authData.organizationId,
            agreementState.active,
            createStamp(authData)
          ),
        },
        suspendedAt:
          newState === agreementState.active
            ? undefined
            : agreement.suspendedAt,
      };

  const updatedAgreement = {
    ...agreement,
    ...updatedAgreementSeed,
  };

  const activationEvent = await match(firstActivation)
    .with(true, async () => {
      const activatedAgreementEvent = toCreateEventAgreementActivated(
        updatedAgreement,
        agreementData.metadata.version,
        correlationId
      );

      await createContract(
        updatedAgreement,
        updatedAgreementSeed,
        eservice,
        consumer,
        attributeQuery,
        tenantQuery,
        storeFile
      );

      return activatedAgreementEvent;
    })
    .with(false, () => {
      if (authData.organizationId === agreement.consumerId) {
        return toCreateEventAgreementUnsuspendedByConsumer(
          updatedAgreement,
          agreementData.metadata.version,
          correlationId
        );
      } else if (authData.organizationId === agreement.producerId) {
        return toCreateEventAgreementUnsuspendedByProducer(
          updatedAgreement,
          agreementData.metadata.version,
          correlationId
        );
      } else {
        throw new Error(
          `Unexpected organizationId ${authData.organizationId} in activateAgreement`
        );
      }
    })
    .exhaustive();

  const archiveEvents = await archiveRelatedToAgreements(
    agreement,
    authData,
    agreementQuery,
    correlationId
  );

  return [activationEvent, ...archiveEvents];
}

const archiveRelatedToAgreements = async (
  agreement: Agreement,
  authData: AuthData,
  agreementQuery: AgreementQuery,
  correlationId: string
): Promise<Array<CreateEvent<AgreementEvent>>> => {
  const existingAgreements = await agreementQuery.getAllAgreements({
    consumerId: agreement.consumerId,
    eserviceId: agreement.eserviceId,
  });

  const archivables = existingAgreements.filter(
    (a) =>
      agreementArchivableStates.includes(a.data.state) &&
      a.data.id !== agreement.id
  );

  return archivables.map((agreementData) =>
    toCreateEventAgreementArchived(
      {
        ...agreementData.data,
        state: agreementState.archived,
        certifiedAttributes: agreementData.data.certifiedAttributes,
        declaredAttributes: agreementData.data.declaredAttributes,
        verifiedAttributes: agreementData.data.verifiedAttributes,
        suspendedByConsumer: agreementData.data.suspendedByConsumer,
        suspendedByProducer: agreementData.data.suspendedByProducer,
        suspendedByPlatform: agreementData.data.suspendedByPlatform,
        stamps: {
          ...agreementData.data.stamps,
          archiving: createStamp(authData),
        },
      },
      agreementData.metadata.version,
      correlationId
    )
  );
};

const createContract = async (
  agreement: Agreement,
  updateSeed: UpdateAgreementSeed,
  eservice: EService,
  consumer: Tenant,
  attributeQuery: AttributeQuery,
  tenantQuery: TenantQuery,
  storeFile: FileManager["storeBytes"]
): Promise<void> => {
  const producer = await tenantQuery.getTenantById(agreement.producerId);
  assertTenantExist(agreement.producerId, producer);

  await contractBuilder(attributeQuery, storeFile).createContract(
    agreement,
    eservice,
    consumer,
    producer,
    updateSeed
  );
};
