import z from "zod";
import { AttributeId, DelegationId, TenantId } from "../brandedIds.js";

export const tenantKind = {
  PA: "PA",
  GSP: "GSP",
  PRIVATE: "PRIVATE",
  SCP: "SCP",
} as const;

export const TenantKind = z.enum([
  Object.values(tenantKind)[0],
  ...Object.values(tenantKind).slice(1),
]);

export type TenantKind = z.infer<typeof TenantKind>;

export const ExternalId = z.object({
  origin: z.string(),
  value: z.string(),
});

export type ExternalId = z.infer<typeof ExternalId>;

export const tenantFeatureType = {
  persistentCertifier: "PersistentCertifier",
  delegatedProducer: "DelegatedProducer",
  delegatedConsumer: "DelegatedConsumer",
} as const;

export const TenantFeatureType = z.enum([
  Object.values(tenantFeatureType)[0],
  ...Object.values(tenantFeatureType).slice(1),
]);

export type TenantFeatureType = z.infer<typeof TenantFeatureType>;

export const TenantFeatureCertifier = z.object({
  type: z.literal(tenantFeatureType.persistentCertifier),
  certifierId: z.string(),
});
export type TenantFeatureCertifier = z.infer<typeof TenantFeatureCertifier>;

export const TenantFeatureDelegatedProducer = z.object({
  type: z.literal(tenantFeatureType.delegatedProducer),
  availabilityTimestamp: z.coerce.date(),
});
export type TenantFeatureDelegatedProducer = z.infer<
  typeof TenantFeatureDelegatedProducer
>;

export const TenantFeatureDelegatedConsumer = z.object({
  type: z.literal(tenantFeatureType.delegatedConsumer),
  availabilityTimestamp: z.coerce.date(),
});
export type TenantFeatureDelegatedConsumer = z.infer<
  typeof TenantFeatureDelegatedConsumer
>;

export const TenantFeature = z.discriminatedUnion("type", [
  TenantFeatureCertifier,
  TenantFeatureDelegatedProducer,
  TenantFeatureDelegatedConsumer,
]);

export type TenantFeature = z.infer<typeof TenantFeature>;

export const tenantAttributeType = {
  CERTIFIED: "PersistentCertifiedAttribute",
  DECLARED: "PersistentDeclaredAttribute",
  VERIFIED: "PersistentVerifiedAttribute",
} as const;

export const TenantAttributeType = z.enum([
  Object.values(tenantAttributeType)[0],
  ...Object.values(tenantAttributeType).slice(1),
]);

export type TenantAttributeType = z.infer<typeof TenantAttributeType>;

export const TenantVerifier = z.object({
  id: TenantId,
  delegationId: DelegationId.optional(),
  verificationDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional(),
  extensionDate: z.coerce.date().optional(),
});
export type TenantVerifier = z.infer<typeof TenantVerifier>;

export const TenantRevoker = z.object({
  expirationDate: z.coerce.date().optional(),
  extensionDate: z.coerce.date().optional(),
  id: TenantId,
  delegationId: DelegationId.optional(),
  revocationDate: z.coerce.date(),
  verificationDate: z.coerce.date(),
});
export type TenantRevoker = z.infer<typeof TenantRevoker>;

export const CertifiedTenantAttribute = z.object({
  assignmentTimestamp: z.coerce.date(),
  id: AttributeId,
  type: z.literal(tenantAttributeType.CERTIFIED),
  revocationTimestamp: z.coerce.date().optional(),
});
export type CertifiedTenantAttribute = z.infer<typeof CertifiedTenantAttribute>;

export const VerifiedTenantAttribute = z.object({
  assignmentTimestamp: z.coerce.date(),
  type: z.literal(tenantAttributeType.VERIFIED),
  id: AttributeId,
  verifiedBy: z.array(TenantVerifier),
  revokedBy: z.array(TenantRevoker),
});
export type VerifiedTenantAttribute = z.infer<typeof VerifiedTenantAttribute>;

export const DeclaredTenantAttribute = z.object({
  type: z.literal(tenantAttributeType.DECLARED),
  id: AttributeId,
  assignmentTimestamp: z.coerce.date(),
  revocationTimestamp: z.coerce.date().optional(),
  delegationId: DelegationId.optional(),
});
export type DeclaredTenantAttribute = z.infer<typeof DeclaredTenantAttribute>;

export const TenantAttribute = z.discriminatedUnion("type", [
  CertifiedTenantAttribute,
  VerifiedTenantAttribute,
  DeclaredTenantAttribute,
]);

export type TenantAttribute = z.infer<typeof TenantAttribute>;

export const tenantMailKind = {
  ContactEmail: "CONTACT_EMAIL",
  DigitalAddress: "DIGITAL_ADDRESS",
} as const;
export const TenantMailKind = z.enum([
  Object.values(tenantMailKind)[0],
  ...Object.values(tenantMailKind).slice(1),
]);
export type TenantMailKind = z.infer<typeof TenantMailKind>;

export const TenantMail = z.object({
  id: z.string(),
  kind: TenantMailKind,
  address: z.string(),
  description: z.string().optional(),
  createdAt: z.coerce.date(),
});
export type TenantMail = z.infer<typeof TenantMail>;

export const tenantUnitType = {
  AOO: "AOO",
  UO: "UO",
} as const;

export const TenantUnitType = z.enum([
  Object.values(tenantUnitType)[0],
  ...Object.values(tenantUnitType).slice(1),
]);

export type TenantUnitType = z.infer<typeof TenantUnitType>;

export const Tenant = z.object({
  id: TenantId,
  kind: TenantKind.optional(),
  selfcareId: z.string().optional(),
  externalId: ExternalId,
  features: z.array(TenantFeature),
  attributes: z.array(TenantAttribute),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  mails: z.array(TenantMail),
  name: z.string(),
  onboardedAt: z.coerce.date().optional(),
  subUnitType: TenantUnitType.optional(),
});

export type Tenant = z.infer<typeof Tenant>;

export const CompactTenant = z.object({
  id: TenantId,
  attributes: z.array(TenantAttribute),
});
export type CompactTenant = z.infer<typeof CompactTenant>;
