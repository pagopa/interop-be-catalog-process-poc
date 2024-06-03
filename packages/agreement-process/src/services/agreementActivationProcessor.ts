/* eslint-disable max-params */
import {
  AuthData,
  CreateEvent,
  FileManager,
  Logger,
  PDFGenerator,
} from "pagopa-interop-commons";
import {
  Agreement,
  EService,
  Tenant,
  agreementState,
  AgreementEvent,
  AgreementState,
  Descriptor,
  genericError,
  AgreementEventV2,
  UserId,
  WithMetadata,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { SelfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import {
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  agreementArchivableStates,
} from "../model/domain/validators.js";
import {
  toCreateEventAgreementActivated,
  toCreateEventAgreementSuspendedByPlatform,
  toCreateEventAgreementUnsuspendedByConsumer,
  toCreateEventAgreementUnsuspendedByPlatform,
  toCreateEventAgreementUnsuspendedByProducer,
} from "../model/domain/toEvent.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import { apiAgreementDocumentToAgreementDocument } from "../model/domain/apiConverter.js";
import { config } from "../utilities/config.js";
import {
  createStamp,
  suspendedByConsumerStamp,
  suspendedByProducerStamp,
} from "./agreementStampUtils.js";
import { createAgreementArchivedByUpgradeEvent } from "./agreementService.js";
import { ReadModelService } from "./readModelService.js";
import { contractBuilder } from "./agreementContractBuilder.js";

export function createActivationUpdateAgreementSeed({
  firstActivation,
  newState,
  descriptor,
  consumer,
  eservice,
  authData,
  agreement,
  suspendedByConsumer,
  suspendedByProducer,
  suspendedByPlatform,
}: {
  firstActivation: boolean;
  newState: AgreementState;
  descriptor: Descriptor;
  consumer: Tenant;
  eservice: EService;
  authData: AuthData;
  agreement: Agreement;
  suspendedByConsumer: boolean | undefined;
  suspendedByProducer: boolean | undefined;
  suspendedByPlatform: boolean | undefined;
}): UpdateAgreementSeed {
  const stamp = createStamp(authData.userId);

  return firstActivation
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
        suspendedByPlatform,
        stamps: {
          ...agreement.stamps,
          activation: stamp,
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
            stamp
          ),
          suspensionByProducer: suspendedByProducerStamp(
            agreement,
            authData.organizationId,
            agreementState.active,
            stamp
          ),
        },
        suspendedByPlatform,
        suspendedAt:
          newState === agreementState.active
            ? undefined
            : agreement.suspendedAt,
      };
}

export async function createActivationEvent(
  firstActivation: boolean,
  updatedAgreement: Agreement,
  originalSuspendedByPlatform: boolean | undefined,
  suspendedByPlatformChanged: boolean,
  agreementEventStoreVersion: number,
  authData: AuthData,
  correlationId: string
): Promise<Array<CreateEvent<AgreementEventV2>>> {
  if (firstActivation) {
    // Pending >>> Active
    return [
      toCreateEventAgreementActivated(
        updatedAgreement,
        agreementEventStoreVersion,
        correlationId
      ),
    ];
  } else {
    // Suspended >>> Active
    // Suspended >>> Suspended

    /* Not a first activation, meaning that the agreement was already active
    and it was then suspended. If the requester is the producer (or producer === consumer),
    the updatedAgreement was updated setting the suspendedByProducer flag to false,
    and here we create the unsuspension by producer event.
    Otherwise, the requester is the consumer, and the updatedAgreement was updated setting
    the suspendedByConsumer flag to false, so we create the unsuspension by consumer event.

    Still, these events could result in activating the agreement or not, depending on the
    other suspension flags:

    - In case that the consumer/producer flag was the only suspension flag set to true,
      the updated ugreement has no more suspension flags set to true, so it becomes active.
      We just create corresponding unsuspension event, containing the updated (active) agreement.

    - In case that the agreement has still some suspension flags set to true, the updated agreement
      is still suspended. We still create the corresponding unsuspension event containing
      the updated agreement. Furthermore, in this cases, where the agreement is still suspended,
      also the platform flag could have been updated due to attribute changes. If that's the case,
      we also create the corresponding suspension/unsuspension by platform event.
    */

    return match([authData.organizationId, updatedAgreement.state])
      .with([updatedAgreement.producerId, agreementState.active], () => [
        toCreateEventAgreementUnsuspendedByProducer(
          updatedAgreement,
          agreementEventStoreVersion,
          correlationId
        ),
      ])
      .with([updatedAgreement.producerId, agreementState.suspended], () => [
        toCreateEventAgreementUnsuspendedByProducer(
          {
            ...updatedAgreement,
            suspendedByPlatform: originalSuspendedByPlatform,
          },
          agreementEventStoreVersion,
          correlationId
        ),
        ...maybeCreateSuspensionByPlatformEvents(
          updatedAgreement,
          suspendedByPlatformChanged,
          agreementEventStoreVersion + 1,
          correlationId
        ),
      ])
      .with([updatedAgreement.consumerId, agreementState.active], () => [
        toCreateEventAgreementUnsuspendedByConsumer(
          updatedAgreement,
          agreementEventStoreVersion,
          correlationId
        ),
      ])
      .with([updatedAgreement.consumerId, agreementState.suspended], () => [
        toCreateEventAgreementUnsuspendedByConsumer(
          {
            ...updatedAgreement,
            suspendedByPlatform: originalSuspendedByPlatform,
          },
          agreementEventStoreVersion,
          correlationId
        ),
        ...maybeCreateSuspensionByPlatformEvents(
          updatedAgreement,
          suspendedByPlatformChanged,
          agreementEventStoreVersion + 1,
          correlationId
        ),
      ])
      .otherwise(() => {
        throw genericError(
          `Unexpected organizationId - nextState pair in activateAgreement. OrganizationId: ${authData.organizationId} - nextState: ${updatedAgreement.state}`
        );
      });
  }
}

export const archiveRelatedToAgreements = async (
  agreement: Agreement,
  userId: UserId,
  readModelService: ReadModelService,
  correlationId: string
): Promise<Array<CreateEvent<AgreementEvent>>> => {
  const existingAgreements = await readModelService.getAllAgreements({
    consumerId: agreement.consumerId,
    eserviceId: agreement.eserviceId,
  });

  const archivables = existingAgreements.filter(
    (a) =>
      agreementArchivableStates.includes(a.data.state) &&
      a.data.id !== agreement.id
  );

  return archivables.map((agreementData) =>
    createAgreementArchivedByUpgradeEvent(agreementData, userId, correlationId)
  );
};

export function maybeCreateSuspensionByPlatformEvents(
  updatedAgreement: Agreement,
  suspendedByPlatformChanged: boolean,
  agreementEventStoreVersion: number,
  correlationId: string
): Array<CreateEvent<AgreementEventV2>> {
  if (
    suspendedByPlatformChanged &&
    updatedAgreement.state === agreementState.suspended
  ) {
    return updatedAgreement.suspendedByPlatform
      ? [
          toCreateEventAgreementSuspendedByPlatform(
            updatedAgreement,
            agreementEventStoreVersion,
            correlationId
          ),
        ]
      : [
          toCreateEventAgreementUnsuspendedByPlatform(
            updatedAgreement,
            agreementEventStoreVersion,
            correlationId
          ),
        ];
  }
  return [];
}

export async function createActivationContract(
  agreement: WithMetadata<Agreement>,
  firstActivation: boolean,
  readModelService: ReadModelService,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  selfcareV2Client: SelfcareV2Client,
  logger: Logger,
  authData: AuthData,
  updatedAgreementWithoutContract: Agreement,
  updatedAgreementSeed: UpdateAgreementSeed,
  eservice: EService,
  consumer: Tenant,
  producer: Tenant
): Promise<Agreement["contract"]> {
  if (!firstActivation) {
    return agreement.data.contract;
  }

  const { contractSeed, createdAt } = await contractBuilder(
    readModelService,
    pdfGenerator,
    fileManager,
    selfcareV2Client,
    config,
    logger
  ).createContract(
    authData.selfcareId,
    updatedAgreementWithoutContract,
    eservice,
    consumer,
    producer,
    updatedAgreementSeed
  );

  return apiAgreementDocumentToAgreementDocument(contractSeed, createdAt);
}
