/* eslint-disable max-params */
import { AuthData, CreateEvent } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEvent,
  AgreementEventV2,
  AgreementState,
  CorrelationId,
  Descriptor,
  EService,
  Tenant,
  TenantId,
  agreementState,
  genericError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  agreementArchivableStates,
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
} from "../model/domain/agreement-validators.js";
import {
  ActiveDelegations,
  UpdateAgreementSeed,
} from "../model/domain/models.js";
import {
  toCreateEventAgreementActivated,
  toCreateEventAgreementSuspendedByPlatform,
  toCreateEventAgreementUnsuspendedByConsumer,
  toCreateEventAgreementUnsuspendedByPlatform,
  toCreateEventAgreementUnsuspendedByProducer,
} from "../model/domain/toEvent.js";
import { createAgreementArchivedByUpgradeEvent } from "./agreementService.js";
import {
  createStamp,
  suspendedByConsumerStamp,
  suspendedByProducerStamp,
} from "./agreementStampUtils.js";
import { ReadModelService } from "./readModelService.js";

export function createActivationUpdateAgreementSeed({
  isFirstActivation,
  newState,
  descriptor,
  consumer,
  eservice,
  authData,
  agreement,
  suspendedByConsumer,
  suspendedByProducer,
  suspendedByPlatform,
  activeDelegations,
}: {
  isFirstActivation: boolean;
  newState: AgreementState;
  descriptor: Descriptor;
  consumer: Tenant;
  eservice: EService;
  authData: AuthData;
  agreement: Agreement;
  suspendedByConsumer: boolean | undefined;
  suspendedByProducer: boolean | undefined;
  suspendedByPlatform: boolean | undefined;
  activeDelegations: ActiveDelegations;
}): UpdateAgreementSeed {
  const stamp = createStamp(authData, activeDelegations);

  return isFirstActivation
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
            stamp,
            activeDelegations.consumerDelegation?.delegateId
          ),
          suspensionByProducer: suspendedByProducerStamp(
            agreement,
            authData.organizationId,
            agreementState.active,
            stamp,
            activeDelegations.producerDelegation?.delegateId
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
  isFirstActivation: boolean,
  updatedAgreement: Agreement,
  originalSuspendedByPlatform: boolean | undefined,
  suspendedByPlatformChanged: boolean,
  agreementEventStoreVersion: number,
  authData: AuthData,
  correlationId: CorrelationId,
  activeDelegations: ActiveDelegations
): Promise<Array<CreateEvent<AgreementEventV2>>> {
  if (isFirstActivation) {
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
    and here we create the unsuspension by producer event, it works in the same way if requester is delegate producer.
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

    return match<[TenantId | undefined, AgreementState]>([
      authData.organizationId,
      updatedAgreement.state,
    ])
      .with(
        [updatedAgreement.producerId, agreementState.active],
        [
          activeDelegations.producerDelegation?.delegateId,
          agreementState.active,
        ],
        () => [
          toCreateEventAgreementUnsuspendedByProducer(
            updatedAgreement,
            agreementEventStoreVersion,
            correlationId
          ),
        ]
      )
      .with(
        [updatedAgreement.producerId, agreementState.suspended],
        [
          activeDelegations.producerDelegation?.delegateId,
          agreementState.suspended,
        ],
        () => [
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
        ]
      )
      .with(
        [updatedAgreement.consumerId, agreementState.active],
        [
          activeDelegations.consumerDelegation?.delegateId,
          agreementState.active,
        ],
        () => [
          toCreateEventAgreementUnsuspendedByConsumer(
            updatedAgreement,
            agreementEventStoreVersion,
            correlationId
          ),
        ]
      )
      .with(
        [updatedAgreement.consumerId, agreementState.suspended],
        [
          activeDelegations.consumerDelegation?.delegateId,
          agreementState.suspended,
        ],
        () => [
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
        ]
      )
      .otherwise(() => {
        throw genericError(
          `Unexpected organizationId - nextState pair in activateAgreement. OrganizationId: ${authData.organizationId} - nextState: ${updatedAgreement.state}`
        );
      });
  }
}

export const archiveRelatedToAgreements = async (
  agreement: Agreement,
  authData: AuthData,
  activeDelegations: ActiveDelegations,
  readModelService: ReadModelService,
  correlationId: CorrelationId
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
    createAgreementArchivedByUpgradeEvent(
      agreementData,
      authData,
      activeDelegations,
      correlationId
    )
  );
};

export function maybeCreateSuspensionByPlatformEvents(
  updatedAgreement: Agreement,
  suspendedByPlatformChanged: boolean,
  agreementEventStoreVersion: number,
  correlationId: CorrelationId
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
