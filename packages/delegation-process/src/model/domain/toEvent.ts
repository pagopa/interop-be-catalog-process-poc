import { CreateEvent } from "pagopa-interop-commons";
import {
  CorrelationId,
  Delegation,
  DelegationEventV2,
  WithMetadata,
  toDelegationV2,
} from "pagopa-interop-models";

export function toCreateEventProducerDelegationSubmitted(
  delegation: Delegation,
  correlationId: CorrelationId
): CreateEvent<DelegationEventV2> {
  return {
    streamId: delegation.id,
    version: undefined,
    event: {
      type: "ProducerDelegationSubmitted",
      event_version: 2,
      data: {
        delegation: toDelegationV2(delegation),
      },
    },
    correlationId,
  };
}

export function toCreateEventProducerDelegationRevoked(
  delegation: WithMetadata<Delegation>,
  correlationId: CorrelationId
): CreateEvent<DelegationEventV2> {
  return {
    streamId: delegation.data.id,
    version: delegation.metadata.version,
    event: {
      type: "ProducerDelegationRevoked",
      event_version: 2,
      data: {
        delegation: toDelegationV2(delegation.data),
      },
    },
    correlationId,
  };
}

export function toCreateEventProducerDelegationApproved(
  delegation: WithMetadata<Delegation>,
  correlationId: CorrelationId
): CreateEvent<DelegationEventV2> {
  return {
    streamId: delegation.data.id,
    version: delegation.metadata.version,
    event: {
      type: "ProducerDelegationApproved",
      event_version: 2,
      data: {
        delegation: toDelegationV2(delegation.data),
      },
    },
    correlationId,
  };
}

export function toCreateEventProducerDelegationRejected(
  delegation: WithMetadata<Delegation>,
  correlationId: CorrelationId
): CreateEvent<DelegationEventV2> {
  return {
    streamId: delegation.data.id,
    version: delegation.metadata.version,
    event: {
      type: "ProducerDelegationRejected",
      event_version: 2,
      data: {
        delegation: toDelegationV2(delegation.data),
      },
    },
    correlationId,
  };
}

export function toCreateEventConsumerDelegationSubmitted(
  delegation: Delegation,
  correlationId: CorrelationId
): CreateEvent<DelegationEventV2> {
  return {
    streamId: delegation.id,
    version: undefined,
    event: {
      type: "ConsumerDelegationSubmitted",
      event_version: 2,
      data: {
        delegation: toDelegationV2(delegation),
      },
    },
    correlationId,
  };
}

export function toCreateEventConsumerDelegationApproved(
  delegation: WithMetadata<Delegation>,
  correlationId: CorrelationId
): CreateEvent<DelegationEventV2> {
  return {
    streamId: delegation.data.id,
    version: delegation.metadata.version,
    event: {
      type: "ConsumerDelegationApproved",
      event_version: 2,
      data: {
        delegation: toDelegationV2(delegation.data),
      },
    },
    correlationId,
  };
}

export function toCreateEventConsumerDelegationRevoked(
  delegation: WithMetadata<Delegation>,
  correlationId: CorrelationId
): CreateEvent<DelegationEventV2> {
  return {
    streamId: delegation.data.id,
    version: delegation.metadata.version,
    event: {
      type: "ConsumerDelegationRevoked",
      event_version: 2,
      data: {
        delegation: toDelegationV2(delegation.data),
      },
    },
    correlationId,
  };
}

export function toCreateEventConsumerDelegationRejected(
  delegation: WithMetadata<Delegation>,
  correlationId: CorrelationId
): CreateEvent<DelegationEventV2> {
  return {
    streamId: delegation.data.id,
    version: delegation.metadata.version,
    event: {
      type: "ConsumerDelegationRejected",
      event_version: 2,
      data: {
        delegation: toDelegationV2(delegation.data),
      },
    },
    correlationId,
  };
}
