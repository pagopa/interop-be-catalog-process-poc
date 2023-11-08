import { match } from "ts-pattern";
import { CreateEvent } from "pagopa-interop-commons";
import {
  PersistentAgreement,
  PersistentAgreementState,
  AgreementEvent,
  AgreementStateV1,
  AgreementV1,
  PersistentAgreementDocument,
  AgreementDocumentV1,
  StampsV1,
  StampV1,
  PersistentStamps,
  PersistentStamp,
} from "pagopa-interop-models";

export const toAgreementStateV1 = (
  state: PersistentAgreementState
): AgreementStateV1 =>
  match(state)
    .with("Draft", () => AgreementStateV1.DRAFT)
    .with("Suspended", () => AgreementStateV1.SUSPENDED)
    .with("Archived", () => AgreementStateV1.ARCHIVED)
    .with("Pending", () => AgreementStateV1.PENDING)
    .with("Active", () => AgreementStateV1.ACTIVE)
    .with("Rejected", () => AgreementStateV1.REJECTED)
    .with(
      "MissingCertifiedAttributes",
      () => AgreementStateV1.MISSING_CERTIFIED_ATTRIBUTES
    )
    .exhaustive();

export const toAgreementDocumentV1 = (
  input: PersistentAgreementDocument
): AgreementDocumentV1 => ({
  ...input,
  createdAt: BigInt(input.createdAt.getTime()),
});

export const toStampV1 = (input: PersistentStamp): StampV1 => ({
  ...input,
  when: BigInt(input.when.getTime()),
});

export const toStampsV1 = (input: PersistentStamps): StampsV1 => ({
  submission: input.submission ? toStampV1(input.submission) : undefined,
  activation: input.activation ? toStampV1(input.activation) : undefined,
  rejection: input.rejection ? toStampV1(input.rejection) : undefined,
  suspensionByProducer: input.suspensionByProducer
    ? toStampV1(input.suspensionByProducer)
    : undefined,
  upgrade: input.upgrade ? toStampV1(input.upgrade) : undefined,
  archiving: input.archiving ? toStampV1(input.archiving) : undefined,
  suspensionByConsumer: input.suspensionByConsumer
    ? toStampV1(input.suspensionByConsumer)
    : undefined,
});

export const toAgreementV1 = (input: PersistentAgreement): AgreementV1 => ({
  ...input,
  state: toAgreementStateV1(input.state),
  createdAt: BigInt(input.createdAt.getTime()),
  updatedAt: input.updatedAt ? BigInt(input.updatedAt.getTime()) : undefined,
  suspendedAt: input.suspendedAt
    ? BigInt(input.suspendedAt.getTime())
    : undefined,
  consumerDocuments: input.consumerDocuments.map(toAgreementDocumentV1),
  contract: input.contract ? toAgreementDocumentV1(input.contract) : undefined,
  stamps: toStampsV1(input.stamps),
});

export function toCreateEventAgreementDeleted(
  streamId: string,
  version: number
): CreateEvent<AgreementEvent> {
  return {
    streamId,
    version,
    event: {
      type: "AgreementDeleted",
      data: {
        agreementId: streamId,
      },
    },
  };
}

export function toCreateEventAgreementAdded(
  agreement: PersistentAgreement
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreement.id,
    version: 0,
    event: {
      type: "AgreementAdded",
      data: {
        agreement: toAgreementV1(agreement),
      },
    },
  };
}
