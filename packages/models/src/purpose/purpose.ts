import { z } from "zod";
import {
  EServiceId,
  PurposeId,
  PurposeVersionDocumentId,
  PurposeVersionId,
  TenantId,
} from "../brandedIds.js";
import { PurposeRiskAnalysisForm } from "../risk-analysis/riskAnalysis.js";

export const purposeVersionState = {
  draft: "Draft",
  active: "Active",
  suspended: "Suspended",
  archived: "Archived",
  waitingForApproval: "WaitingForApproval",
  rejected: "Rejected",
} as const;
export const PurposeVersionState = z.enum([
  Object.values(purposeVersionState)[0],
  ...Object.values(purposeVersionState).slice(1),
]);
export type PurposeVersionState = z.infer<typeof PurposeVersionState>;

export const PurposeVersionDocument = z.object({
  id: PurposeVersionDocumentId,
  contentType: z.string(),
  path: z.string(),
  createdAt: z.coerce.date(),
});
export type PurposeVersionDocument = z.infer<typeof PurposeVersionDocument>;

export const PurposeVersion = z.object({
  id: PurposeVersionId,
  state: PurposeVersionState,
  expectedApprovalDate: z.coerce.date().optional(),
  riskAnalysis: PurposeVersionDocument.optional(),
  dailyCalls: z.number(),
  rejectionReason: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  firstActivationAt: z.coerce.date().optional(),
  suspendedAt: z.coerce.date().optional(),
});
export type PurposeVersion = z.infer<typeof PurposeVersion>;

export const Purpose = z.object({
  id: PurposeId,
  eserviceId: EServiceId,
  consumerId: TenantId,
  versions: z.array(PurposeVersion),
  suspendedByConsumer: z.boolean().optional(),
  suspendedByProducer: z.boolean().optional(),
  title: z.string(),
  description: z.string(),
  riskAnalysisForm: PurposeRiskAnalysisForm.optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  isFreeOfCharge: z.boolean(),
  freeOfChargeReason: z.string().optional(),
});
export type Purpose = z.infer<typeof Purpose>;

export const PurposeSeed = z.object({
  eserviceId: EServiceId,
  consumerId: TenantId,
  riskAnalysisForm: PurposeRiskAnalysisForm.optional(),
  title: z.string(),
  description: z.string(),
  isFreeOfCharge: z.boolean(),
  freeOfChargeReason: z.string().optional(),
});
export type PurposeSeed = z.infer<typeof PurposeSeed>;

export const ownership = {
  CONSUMER: "CONSUMER",
  PRODUCER: "PRODUCER",
  SELF_CONSUMER: "SELF_CONSUMER",
} as const;
export const Ownership = z.enum([
  Object.values(ownership)[0],
  ...Object.values(ownership).slice(1),
]);
export type Ownership = z.infer<typeof Ownership>;
