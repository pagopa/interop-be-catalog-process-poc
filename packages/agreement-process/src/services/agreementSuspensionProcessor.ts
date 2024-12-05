import { AuthData, CreateEvent } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEventV2,
  CorrelationId,
  Descriptor,
  Tenant,
  WithMetadata,
  agreementState,
  delegationKind,
  genericError,
} from "pagopa-interop-models";
import {
  ActiveDelegations,
  UpdateAgreementSeed,
} from "../model/domain/models.js";
import {
  toCreateEventAgreementSuspendedByProducer,
  toCreateEventAgreementSuspendedByConsumer,
} from "../model/domain/toEvent.js";
import { getRequesterDelegateKind } from "../utilities/delegations.js";
import {
  agreementStateByFlags,
  nextStateByAttributesFSM,
  suspendedByConsumerFlag,
  suspendedByProducerFlag,
} from "./agreementStateProcessor.js";
import {
  createStamp,
  suspendedByConsumerStamp,
  suspendedByProducerStamp,
} from "./agreementStampUtils.js";

export function createSuspensionUpdatedAgreement({
  agreement,
  authData,
  descriptor,
  consumer,
  activeDelegations,
}: {
  agreement: Agreement;
  authData: AuthData;
  descriptor: Descriptor;
  consumer: Tenant;
  activeDelegations: ActiveDelegations;
}): Agreement {
  /* nextAttributesState VS targetDestinationState
  -- targetDestinationState is the state where the caller wants to go (suspended, in this case)
  -- nextStateByAttributes is the next state of the Agreement based the attributes of the consumer
  */
  const targetDestinationState = agreementState.suspended;
  const nextStateByAttributes = nextStateByAttributesFSM(
    agreement,
    descriptor,
    consumer,
    activeDelegations.producer?.delegateId
  );

  const suspendedByConsumer = suspendedByConsumerFlag(
    agreement,
    authData.organizationId,
    targetDestinationState,
    activeDelegations.consumer?.delegateId
  );
  const suspendedByProducer = suspendedByProducerFlag(
    agreement,
    authData.organizationId,
    targetDestinationState,
    activeDelegations.producer?.delegateId
  );

  const newState = agreementStateByFlags(
    nextStateByAttributes,
    suspendedByProducer,
    suspendedByConsumer,
    agreement.suspendedByPlatform
  );

  const stamp = createStamp(authData, activeDelegations);

  const suspensionByProducerStamp = suspendedByProducerStamp(
    agreement,
    authData.organizationId,
    agreementState.suspended,
    stamp,
    activeDelegations.producer?.delegateId
  );

  const suspensionByConsumerStamp = suspendedByConsumerStamp(
    agreement,
    authData.organizationId,
    agreementState.suspended,
    stamp
  );

  const updateSeed: UpdateAgreementSeed = {
    state: newState,
    suspendedByConsumer,
    suspendedByProducer,
    stamps: {
      ...agreement.stamps,
      suspensionByConsumer: suspensionByConsumerStamp,
      suspensionByProducer: suspensionByProducerStamp,
    },
    suspendedAt: agreement.suspendedAt ?? new Date(),
  };

  return {
    ...agreement,
    ...updateSeed,
  };
}

// eslint-disable-next-line max-params
export function createAgreementSuspendedEvent(
  authData: AuthData,
  correlationId: CorrelationId,
  updatedAgreement: Agreement,
  agreement: WithMetadata<Agreement>,
  activeDelegations: ActiveDelegations
): CreateEvent<AgreementEventV2> {
  const isProducer = authData.organizationId === agreement.data.producerId;
  const isConsumer = authData.organizationId === agreement.data.consumerId;
  const requesterDelegateKind = getRequesterDelegateKind(
    activeDelegations,
    authData
  );

  if (
    isProducer ||
    requesterDelegateKind === delegationKind.delegatedProducer
  ) {
    return toCreateEventAgreementSuspendedByProducer(
      updatedAgreement,
      agreement.metadata.version,
      correlationId
    );
  } else if (
    isConsumer ||
    requesterDelegateKind === delegationKind.delegatedConsumer
  ) {
    return toCreateEventAgreementSuspendedByConsumer(
      updatedAgreement,
      agreement.metadata.version,
      correlationId
    );
  } else {
    throw genericError(
      "Agreement can only be suspended by the consumer or producer/delegate producer."
    );
  }
}
