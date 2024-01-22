import { CreateEvent } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementDocument,
  AgreementDocumentV1,
  AgreementEventAdded,
  AgreementEventConsumerDocumentAdded,
  AgreementEventConsumerDocumentRemoved,
  AgreementEventContractAdded,
  AgreementEventDeleted,
  AgreementEventUpdated,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
  AgreementStateV1,
  AgreementV1,
  StampV1,
  StampsV1,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export const toAgreementStateV1 = (state: AgreementState): AgreementStateV1 =>
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
  input: AgreementDocument
): AgreementDocumentV1 => ({
  ...input,
  createdAt: BigInt(input.createdAt.getTime()),
});

export const toStampV1 = (input: AgreementStamp): StampV1 => ({
  ...input,
  when: BigInt(input.when.getTime()),
});

export const toStampsV1 = (input: AgreementStamps): StampsV1 => ({
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

export const toAgreementV1 = (input: Agreement): AgreementV1 => ({
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
): CreateEvent<AgreementEventDeleted> {
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
  agreement: Agreement
): CreateEvent<AgreementEventAdded> {
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

export function toCreateEventAgreementUpdated(
  agreement: Agreement,
  version: number
): CreateEvent<AgreementEventUpdated> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementUpdated",
      data: {
        agreement: toAgreementV1(agreement),
      },
    },
  };
}

export function toCreateEventAgreementContractAdded(
  agreementId: string,
  agreementDocument: AgreementDocument,
  version: number
): CreateEvent<AgreementEventContractAdded> {
  return {
    streamId: agreementId,
    version,
    event: {
      type: "AgreementContractAdded",
      data: {
        agreementId,
        contract: toAgreementDocumentV1(agreementDocument),
      },
    },
  };
}

export function toCreateEventAgreementConsumerDocumentAdded(
  agreementId: string,
  agreementDocument: AgreementDocument,
  version: number
): CreateEvent<AgreementEventConsumerDocumentAdded> {
  return {
    streamId: agreementId,
    version,
    event: {
      type: "AgreementConsumerDocumentAdded",
      data: {
        agreementId,
        document: toAgreementDocumentV1(agreementDocument),
      },
    },
  };
}

export function toCreateEventAgreementConsumerDocumentRemoved(
  agreementId: string,
  documentId: string,
  version: number
): CreateEvent<AgreementEventConsumerDocumentRemoved> {
  return {
    streamId: agreementId,
    version,
    event: {
      type: "AgreementConsumerDocumentRemoved",
      data: {
        agreementId,
        documentId,
      },
    },
  };
}
