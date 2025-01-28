import z from "zod";
import {
  AttributeId,
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  TenantId,
} from "../brandedIds.js";
import { RiskAnalysis } from "../risk-analysis/riskAnalysis.js";

export const technology = { rest: "Rest", soap: "Soap" } as const;
export const Technology = z.enum([
  Object.values(technology)[0],
  ...Object.values(technology).slice(1),
]);
export type Technology = z.infer<typeof Technology>;

export const descriptorState = {
  draft: "Draft",
  published: "Published",
  deprecated: "Deprecated",
  suspended: "Suspended",
  archived: "Archived",
  waitingForApproval: "WaitingForApproval",
} as const;
export const DescriptorState = z.enum([
  Object.values(descriptorState)[0],
  ...Object.values(descriptorState).slice(1),
]);
export type DescriptorState = z.infer<typeof DescriptorState>;

export const agreementApprovalPolicy = {
  manual: "Manual",
  automatic: "Automatic",
} as const;
export const AgreementApprovalPolicy = z.enum([
  Object.values(agreementApprovalPolicy)[0],
  ...Object.values(agreementApprovalPolicy).slice(1),
]);
export type AgreementApprovalPolicy = z.infer<typeof AgreementApprovalPolicy>;

export const EServiceAttribute = z.object({
  id: AttributeId,
  explicitAttributeVerification: z.boolean(),
});
export type EServiceAttribute = z.infer<typeof EServiceAttribute>;

export const EServiceAttributes = z.object({
  certified: z.array(z.array(EServiceAttribute)),
  declared: z.array(z.array(EServiceAttribute)),
  verified: z.array(z.array(EServiceAttribute)),
});
export type EserviceAttributes = z.infer<typeof EServiceAttributes>;

export const Document = z.object({
  id: EServiceDocumentId,
  name: z.string(),
  contentType: z.string(),
  prettyName: z.string(),
  path: z.string(),
  checksum: z.string(),
  uploadDate: z.coerce.date(),
});
export type Document = z.infer<typeof Document>;

export const DescriptorRejectionReason = z.object({
  rejectionReason: z.string(),
  rejectedAt: z.coerce.date(),
});
export type DescriptorRejectionReason = z.infer<
  typeof DescriptorRejectionReason
>;

export const Descriptor = z.object({
  id: DescriptorId,
  version: z.string(),
  description: z.string().optional(),
  interface: Document.optional(),
  docs: z.array(Document),
  state: DescriptorState,
  audience: z.array(z.string()),
  voucherLifespan: z.number().int(),
  dailyCallsPerConsumer: z.number().int(),
  dailyCallsTotal: z.number().int(),
  agreementApprovalPolicy: AgreementApprovalPolicy.optional(),
  createdAt: z.coerce.date(),
  serverUrls: z.array(z.string()),
  publishedAt: z.coerce.date().optional(),
  suspendedAt: z.coerce.date().optional(),
  deprecatedAt: z.coerce.date().optional(),
  archivedAt: z.coerce.date().optional(),
  attributes: EServiceAttributes,
  rejectionReasons: z.array(DescriptorRejectionReason).optional(),
});
export type Descriptor = z.infer<typeof Descriptor>;

export const eserviceMode = {
  receive: "Receive",
  deliver: "Deliver",
} as const;
export const EServiceMode = z.enum([
  Object.values(eserviceMode)[0],
  ...Object.values(eserviceMode).slice(1),
]);
export type EServiceMode = z.infer<typeof EServiceMode>;

export const EService = z.object({
  id: EServiceId,
  producerId: TenantId,
  name: z.string(),
  description: z.string(),
  technology: Technology,
  attributes: EServiceAttributes.optional(),
  descriptors: z.array(Descriptor),
  createdAt: z.coerce.date(),
  riskAnalysis: z.array(RiskAnalysis),
  mode: EServiceMode,
  isSignalHubEnabled: z.boolean().optional(),
  isDelegable: z.boolean().optional(),
  isClientAccessDelegable: z.boolean().optional(),
});
export type EService = z.infer<typeof EService>;
