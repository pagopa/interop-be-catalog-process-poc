import z from "zod";
import {
  AgreementDocumentId,
  AgreementId,
  AttributeId,
  DelegationId,
  DescriptorId,
  EServiceId,
  TenantId,
  UserId,
} from "./../brandedIds.js";

export const agreementState = {
  draft: "Draft",
  suspended: "Suspended",
  archived: "Archived",
  pending: "Pending",
  active: "Active",
  missingCertifiedAttributes: "MissingCertifiedAttributes",
  rejected: "Rejected",
} as const;
export const AgreementState = z.enum([
  Object.values(agreementState)[0],
  ...Object.values(agreementState).slice(1),
]);
export type AgreementState = z.infer<typeof AgreementState>;

export const AgreementAttribute = z.object({ id: AttributeId });
export type AgreementAttribute = z.infer<typeof AgreementAttribute>;

export const AgreementDocument = z.object({
  id: AgreementDocumentId,
  name: z.string(),
  prettyName: z.string(),
  contentType: z.string(),
  path: z.string(),
  createdAt: z.coerce.date(),
});
export type AgreementDocument = z.infer<typeof AgreementDocument>;

export const AgreementStamp = z.object({
  who: UserId,
  delegationId: DelegationId.optional(),
  when: z.coerce.date(),
});
export type AgreementStamp = z.infer<typeof AgreementStamp>;

export const AgreementStamps = z.object({
  submission: AgreementStamp.optional(),
  activation: AgreementStamp.optional(),
  rejection: AgreementStamp.optional(),
  suspensionByProducer: AgreementStamp.optional(),
  suspensionByConsumer: AgreementStamp.optional(),
  upgrade: AgreementStamp.optional(),
  archiving: AgreementStamp.optional(),
});
export type AgreementStamps = z.infer<typeof AgreementStamps>;

export const Agreement = z.object({
  id: AgreementId,
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  producerId: TenantId,
  consumerId: TenantId,
  state: AgreementState,
  verifiedAttributes: z.array(AgreementAttribute),
  certifiedAttributes: z.array(AgreementAttribute),
  declaredAttributes: z.array(AgreementAttribute),
  suspendedByConsumer: z.boolean().optional(),
  suspendedByProducer: z.boolean().optional(),
  suspendedByPlatform: z.boolean().optional(),
  consumerDocuments: z.array(AgreementDocument),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  consumerNotes: z.string().optional(),
  contract: AgreementDocument.optional(),
  stamps: AgreementStamps,
  rejectionReason: z.string().optional(),
  suspendedAt: z.coerce.date().optional(),
});
export type Agreement = z.infer<typeof Agreement>;
