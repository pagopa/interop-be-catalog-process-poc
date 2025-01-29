import z from "zod";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  TenantId,
} from "../brandedIds.js";
import {
  Document,
  AgreementApprovalPolicy,
  EServiceAttributes,
  Technology,
  EServiceMode,
} from "../eservice/eservice.js";
import { RiskAnalysis } from "../risk-analysis/riskAnalysis.js";

export const eserviceTemplateVersionState = {
  draft: "Draft",
  published: "Published",
  suspended: "Suspended",
  deprecated: "Deprecated",
} as const;
export const EServiceTemplateVersionState = z.enum([
  Object.values(eserviceTemplateVersionState)[0],
  ...Object.values(eserviceTemplateVersionState).slice(1),
]);
export type EServiceTemplateVersionState = z.infer<
  typeof EServiceTemplateVersionState
>;

export const EServiceTemplateVersion = z.object({
  id: EServiceTemplateVersionId,
  version: z.string(),
  description: z.string().optional(),
  interface: Document.optional(),
  docs: z.array(Document),
  state: EServiceTemplateVersionState,
  voucherLifespan: z.number().int(),
  dailyCallsPerConsumer: z.number().int().optional(),
  dailyCallsTotal: z.number().int().optional(),
  agreementApprovalPolicy: AgreementApprovalPolicy.optional(),
  createdAt: z.coerce.date(),
  publishedAt: z.coerce.date().optional(),
  suspendedAt: z.coerce.date().optional(),
  deprecatedAt: z.coerce.date().optional(),
  attributes: EServiceAttributes,
});
export type EServiceTemplateVersion = z.infer<typeof EServiceTemplateVersion>;

export const EServiceTemplate = z.object({
  id: EServiceTemplateId,
  creatorId: TenantId,
  name: z.string(),
  audienceDescription: z.string(),
  eserviceDescription: z.string(),
  technology: Technology,
  versions: z.array(EServiceTemplateVersion),
  createdAt: z.coerce.date(),
  riskAnalysis: z.array(RiskAnalysis),
  mode: EServiceMode,
  isSignalHubEnabled: z.boolean().optional(),
});
export type EServiceTemplate = z.infer<typeof EServiceTemplate>;
