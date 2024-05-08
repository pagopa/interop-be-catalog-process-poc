import { unsafeBrandId } from "../brandedIds.js";
import {
  AgreementDocumentV1,
  StampV1,
  StampsV1,
  AgreementStateV1,
  AgreementV1,
} from "../gen/v1/agreement/agreement.js";
import {
  AgreementDocument,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
  agreementState,
  Agreement,
} from "./agreement.js";

export const fromAgreementDocumentV1 = (
  input: AgreementDocumentV1
): AgreementDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: new Date(Number(input.createdAt)),
});

export const fromAgreementStampV1 = (
  input: StampV1 | undefined
): AgreementStamp | undefined =>
  input
    ? {
        who: unsafeBrandId(input.who),
        when: new Date(Number(input.when)),
      }
    : undefined;

export const fromAgreementStamps = (
  input: StampsV1 | undefined
): AgreementStamps | undefined =>
  input
    ? {
        ...input,
        submission: fromAgreementStampV1(input.submission),
        activation: fromAgreementStampV1(input.activation),
        rejection: fromAgreementStampV1(input.rejection),
        suspensionByProducer: fromAgreementStampV1(input.suspensionByProducer),
        suspensionByConsumer: fromAgreementStampV1(input.suspensionByConsumer),
        upgrade: fromAgreementStampV1(input.upgrade),
        archiving: fromAgreementStampV1(input.archiving),
      }
    : undefined;

export const fromAgreementStateV1 = (
  input: AgreementStateV1
): AgreementState => {
  switch (input) {
    case AgreementStateV1.ACTIVE:
      return agreementState.active;
    case AgreementStateV1.SUSPENDED:
      return agreementState.suspended;
    case AgreementStateV1.ARCHIVED:
      return agreementState.archived;
    case AgreementStateV1.DRAFT:
      return agreementState.draft;
    case AgreementStateV1.PENDING:
      return agreementState.pending;
    case AgreementStateV1.MISSING_CERTIFIED_ATTRIBUTES:
      return agreementState.missingCertifiedAttributes;
    case AgreementStateV1.REJECTED:
      return agreementState.rejected;
    case AgreementStateV1.UNSPECIFIED$:
      throw new Error("Unspecified agreement state");
  }
};

export const fromAgreementV1 = (input: AgreementV1): Agreement => ({
  ...input,
  id: unsafeBrandId(input.id),
  eserviceId: unsafeBrandId(input.eserviceId),
  descriptorId: unsafeBrandId(input.descriptorId),
  producerId: unsafeBrandId(input.producerId),
  consumerId: unsafeBrandId(input.consumerId),
  certifiedAttributes: input.certifiedAttributes.map((a) => ({
    ...a,
    id: unsafeBrandId(a.id),
  })),
  declaredAttributes: input.declaredAttributes.map((a) => ({
    ...a,
    id: unsafeBrandId(a.id),
  })),
  verifiedAttributes: input.verifiedAttributes.map((a) => ({
    ...a,
    id: unsafeBrandId(a.id),
  })),
  state: fromAgreementStateV1(input.state),
  createdAt: new Date(Number(input.createdAt)),
  updatedAt: input.updatedAt ? new Date(Number(input.updatedAt)) : undefined,
  suspendedAt: input.suspendedAt
    ? new Date(Number(input.suspendedAt))
    : undefined,
  consumerDocuments: input.consumerDocuments.map(fromAgreementDocumentV1),
  contract: input.contract
    ? fromAgreementDocumentV1(input.contract)
    : undefined,
  stamps: { ...fromAgreementStamps(input.stamps) },
});
