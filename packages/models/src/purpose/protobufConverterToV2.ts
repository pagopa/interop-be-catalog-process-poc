import { match } from "ts-pattern";
import {
  PurposeStateV2,
  PurposeV2,
  PurposeVersionDocumentV2,
  PurposeVersionV2,
} from "../gen/v2/purpose/purpose.js";
import {
  Purpose,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionState,
  purposeVersionState,
} from "./purpose.js";

export const toPurposeVersionStateV2 = (
  input: PurposeVersionState
): PurposeStateV2 =>
  match(input)
    .with(purposeVersionState.draft, () => PurposeStateV2.DRAFT)
    .with(purposeVersionState.active, () => PurposeStateV2.ACTIVE)
    .with(purposeVersionState.suspended, () => PurposeStateV2.SUSPENDED)
    .with(purposeVersionState.archived, () => PurposeStateV2.ARCHIVED)
    .with(
      purposeVersionState.waitingForApproval,
      () => PurposeStateV2.WAITING_FOR_APPROVAL
    )
    .with(purposeVersionState.rejected, () => PurposeStateV2.REJECTED)
    .exhaustive();

export const toPurposeVersionDocumentV2 = (
  input: PurposeVersionDocument
): PurposeVersionDocumentV2 => ({
  ...input,
  createdAt: BigInt(input.createdAt.getTime()),
});

export const toPurposeVersionV2 = (
  input: PurposeVersion
): PurposeVersionV2 => ({
  ...input,
  state: toPurposeVersionStateV2(input.state),
  expectedApprovalDate: input.expectedApprovalDate
    ? BigInt(input.expectedApprovalDate.getTime())
    : undefined,
  createdAt: BigInt(input.createdAt.getTime()),
  updatedAt: input.updatedAt ? BigInt(input.updatedAt.getTime()) : undefined,
  firstActivationAt: input.firstActivationAt
    ? BigInt(input.firstActivationAt.getTime())
    : undefined,
  suspendedAt: input.suspendedAt
    ? BigInt(input.suspendedAt.getTime())
    : undefined,
  riskAnalysis: input.riskAnalysis
    ? toPurposeVersionDocumentV2(input.riskAnalysis)
    : undefined,
});

export const toPurposeV2 = (input: Purpose): PurposeV2 => ({
  ...input,
  versions: input.versions.map(toPurposeVersionV2),
  createdAt: BigInt(input.createdAt.getTime()),
  updatedAt: BigInt(input.updatedAt.getTime()),
});
