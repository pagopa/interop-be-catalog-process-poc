import { CreateEvent } from "pagopa-interop-commons";
import {
  CorrelationId,
  DelegationId,
  Purpose,
  PurposeEventV2,
  PurposeId,
  PurposeVersionId,
  toPurposeV2,
} from "pagopa-interop-models";

export const toCreateEventWaitingForApprovalPurposeVersionDeleted = ({
  purpose,
  version,
  versionId,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  versionId: PurposeVersionId;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "WaitingForApprovalPurposeVersionDeleted",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), versionId },
  },
  correlationId,
});

export const toCreateEventPurposeVersionRejected = ({
  purpose,
  version,
  versionId,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  versionId: PurposeVersionId;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeVersionRejected",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), versionId },
  },
  correlationId,
});

export const toCreateEventDraftPurposeUpdated = ({
  purpose,
  version,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "DraftPurposeUpdated",
    event_version: 2,
    data: {
      purpose: toPurposeV2(purpose),
    },
  },
  correlationId,
});

export const toCreateEventDraftPurposeDeleted = ({
  purpose,
  version,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "DraftPurposeDeleted",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose) },
  },
  correlationId,
});

export const toCreateEventWaitingForApprovalPurposeDeleted = ({
  purpose,
  version,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "WaitingForApprovalPurposeDeleted",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose) },
  },
  correlationId,
});

export const toCreateEventPurposeDeletedByRevokedDelegation = ({
  purpose,
  delegationId,
  version,
  correlationId,
}: {
  purpose: Purpose;
  delegationId: DelegationId;
  version: number;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeDeletedByRevokedDelegation",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), delegationId },
  },
  correlationId,
});

export const toCreateEventPurposeArchived = ({
  purpose,
  purposeVersionId,
  version,
  correlationId,
}: {
  purpose: Purpose;
  purposeVersionId: PurposeVersionId;
  version: number;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeArchived",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), versionId: purposeVersionId },
  },
  correlationId,
});

export const toCreateEventPurposeVersionArchivedByRevokedDelegation = ({
  purpose,
  purposeVersionId,
  delegationId,
  version,
  correlationId,
}: {
  purpose: Purpose;
  purposeVersionId: PurposeVersionId;
  delegationId: DelegationId;
  version: number;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeVersionArchivedByRevokedDelegation",
    event_version: 2,
    data: {
      purpose: toPurposeV2(purpose),
      versionId: purposeVersionId,
      delegationId,
    },
  },
  correlationId,
});

export const toCreateEventPurposeSuspendedByConsumer = ({
  purpose,
  purposeVersionId,
  version,
  correlationId,
}: {
  purpose: Purpose;
  purposeVersionId: PurposeVersionId;
  version: number;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeVersionSuspendedByConsumer",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), versionId: purposeVersionId },
  },
  correlationId,
});

export const toCreateEventPurposeSuspendedByProducer = ({
  purpose,
  purposeVersionId,
  version,
  correlationId,
}: {
  purpose: Purpose;
  purposeVersionId: PurposeVersionId;
  version: number;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeVersionSuspendedByProducer",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), versionId: purposeVersionId },
  },
  correlationId,
});

export function toCreateEventPurposeAdded(
  purpose: Purpose,
  correlationId: CorrelationId
): CreateEvent<PurposeEventV2> {
  return {
    streamId: purpose.id,
    version: undefined,
    event: {
      type: "PurposeAdded",
      event_version: 2,
      data: {
        purpose: toPurposeV2(purpose),
      },
    },
    correlationId,
  };
}

export const toCreateEventPurposeCloned = ({
  purpose,
  sourcePurposeId,
  sourceVersionId,
  correlationId,
}: {
  purpose: Purpose;
  sourcePurposeId: PurposeId;
  sourceVersionId: PurposeVersionId;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version: undefined,
  event: {
    type: "PurposeCloned",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), sourcePurposeId, sourceVersionId },
  },
  correlationId,
});

export function toCreateEventNewPurposeVersionActivated({
  purpose,
  version,
  versionId,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  versionId: PurposeVersionId;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> {
  return {
    streamId: purpose.id,
    version,
    event: {
      type: "NewPurposeVersionActivated",
      event_version: 2,
      data: {
        purpose: toPurposeV2(purpose),
        versionId,
      },
    },
    correlationId,
  };
}

export function toCreateEventNewPurposeVersionWaitingForApproval({
  purpose,
  version,
  versionId,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  versionId: PurposeVersionId;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> {
  return {
    streamId: purpose.id,
    version,
    event: {
      type: "NewPurposeVersionWaitingForApproval",
      event_version: 2,
      data: {
        purpose: toPurposeV2(purpose),
        versionId,
      },
    },
    correlationId,
  };
}

export const toCreateEventPurposeActivated = ({
  purpose,
  version,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeActivated",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose) },
  },
  correlationId,
});

export const toCreateEventPurposeWaitingForApproval = ({
  purpose,
  version,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeWaitingForApproval",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose) },
  },
  correlationId,
});

export const toCreateEventPurposeVersionActivated = ({
  purpose,
  version,
  versionId,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  versionId: PurposeVersionId;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeVersionActivated",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), versionId },
  },
  correlationId,
});

export const toCreateEventPurposeVersionUnsuspenedByProducer = ({
  purpose,
  version,
  versionId,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  versionId: PurposeVersionId;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeVersionUnsuspendedByProducer",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), versionId },
  },
  correlationId,
});

export const toCreateEventPurposeVersionUnsuspenedByConsumer = ({
  purpose,
  version,
  versionId,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  versionId: PurposeVersionId;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeVersionUnsuspendedByConsumer",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), versionId },
  },
  correlationId,
});

export const toCreateEventPurposeVersionOverQuotaUnsuspended = ({
  purpose,
  version,
  versionId,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  versionId: PurposeVersionId;
  correlationId: CorrelationId;
}): CreateEvent<PurposeEventV2> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeVersionOverQuotaUnsuspended",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), versionId },
  },
  correlationId,
});
