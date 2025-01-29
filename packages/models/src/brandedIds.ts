import crypto from "crypto";
import { z } from "zod";

export const CorrelationId = z.string().brand("CorrelationId");
export type CorrelationId = z.infer<typeof CorrelationId>;

export const EServiceId = z.string().uuid().brand("EServiceId");
export type EServiceId = z.infer<typeof EServiceId>;

export const EServiceDocumentId = z.string().uuid().brand("EServiceDocumentId");
export type EServiceDocumentId = z.infer<typeof EServiceDocumentId>;

export const AgreementId = z.string().uuid().brand("AgreementId");
export type AgreementId = z.infer<typeof AgreementId>;

export const AgreementDocumentId = z
  .string()
  .uuid()
  .brand("AgreementDocumentId");
export type AgreementDocumentId = z.infer<typeof AgreementDocumentId>;

export const AttributeId = z.string().uuid().brand("AttributeId");
export type AttributeId = z.infer<typeof AttributeId>;

export const DescriptorId = z.string().uuid().brand("DescriptorId");
export type DescriptorId = z.infer<typeof DescriptorId>;

export const TenantId = z.string().uuid().brand("TenantId");
export type TenantId = z.infer<typeof TenantId>;

export const UserId = z.string().uuid().brand("UserId");
export type UserId = z.infer<typeof UserId>;

export const RiskAnalysisSingleAnswerId = z
  .string()
  .uuid()
  .brand("RiskAnalysisSingleAnswerId");
export type RiskAnalysisSingleAnswerId = z.infer<
  typeof RiskAnalysisSingleAnswerId
>;

export const RiskAnalysisMultiAnswerId = z
  .string()
  .uuid()
  .brand("RiskAnalysisMultiAnswerId");
export type RiskAnalysisMultiAnswerId = z.infer<
  typeof RiskAnalysisMultiAnswerId
>;

export const RiskAnalysisFormId = z.string().uuid().brand("RiskAnalysisFormId");
export type RiskAnalysisFormId = z.infer<typeof RiskAnalysisFormId>;

export const RiskAnalysisId = z.string().uuid().brand("RiskAnalysisId");
export type RiskAnalysisId = z.infer<typeof RiskAnalysisId>;

export const PurposeId = z.string().uuid().brand("PurposeId");
export type PurposeId = z.infer<typeof PurposeId>;

export const PurposeVersionId = z.string().uuid().brand("PurposeVersionId");
export type PurposeVersionId = z.infer<typeof PurposeVersionId>;

export const PurposeVersionDocumentId = z
  .string()
  .uuid()
  .brand("PurposeVersionDocumentId");
export type PurposeVersionDocumentId = z.infer<typeof PurposeVersionDocumentId>;

export const ClientId = z.string().uuid().brand("ClientId");
export type ClientId = z.infer<typeof ClientId>;

export const SelfcareId = z.string().uuid().brand("SelfcareId");
export type SelfcareId = z.infer<typeof SelfcareId>;

export const ProducerKeychainId = z.string().uuid().brand("ProducerKeychainId");
export type ProducerKeychainId = z.infer<typeof ProducerKeychainId>;

export const DelegationId = z.string().uuid().brand("DelegationId");
export type DelegationId = z.infer<typeof DelegationId>;

export const DelegationContractId = z
  .string()
  .uuid()
  .brand("DelegationContractId");
export type DelegationContractId = z.infer<typeof DelegationContractId>;

const eserviceDescriptorPrefix = "ESERVICEDESCRIPTOR#";
export const PlatformStatesEServiceDescriptorPK = z
  .string()
  .refine((pk) => pk.startsWith(eserviceDescriptorPrefix))
  .brand(`${eserviceDescriptorPrefix}eServiceId#descriptorId`);
export type PlatformStatesEServiceDescriptorPK = z.infer<
  typeof PlatformStatesEServiceDescriptorPK
>;

const agreementPrefix = "AGREEMENT#";
export const PlatformStatesAgreementPK = z
  .string()
  .refine((pk) => pk.startsWith(agreementPrefix))
  .brand(`${agreementPrefix}consumerId#eserviceId`);
export type PlatformStatesAgreementPK = z.infer<
  typeof PlatformStatesAgreementPK
>;

const purposePrefix = "PURPOSE#";
export const PlatformStatesPurposePK = z
  .string()
  .refine((pk) => pk.startsWith(purposePrefix))
  .brand(`${purposePrefix}purposeId`);
export type PlatformStatesPurposePK = z.infer<typeof PlatformStatesPurposePK>;

const clientPrefix = "CLIENT#";
export const PlatformStatesClientPK = z
  .string()
  .refine((pk) => pk.startsWith(clientPrefix))
  .brand(`${clientPrefix}clientId`);
export type PlatformStatesClientPK = z.infer<typeof PlatformStatesClientPK>;

export const GSIPKConsumerIdEServiceId = z
  .string()
  .brand(`tenantId#eserviceId`);
export type GSIPKConsumerIdEServiceId = z.infer<
  typeof GSIPKConsumerIdEServiceId
>;

export const clientKidPurposePrefix = "CLIENTKIDPURPOSE#";
export const TokenGenerationStatesClientKidPurposePK = z
  .string()
  .refine((pk) => pk.startsWith(clientKidPurposePrefix))
  .brand(`${clientKidPurposePrefix}clientId#kid#purposeId`);
export type TokenGenerationStatesClientKidPurposePK = z.infer<
  typeof TokenGenerationStatesClientKidPurposePK
>;

export const clientKidPrefix = "CLIENTKID#";
export const TokenGenerationStatesClientKidPK = z
  .string()
  .refine((pk) => pk.startsWith(clientKidPrefix))
  .brand(`${clientKidPrefix}clientId#kid`);
export type TokenGenerationStatesClientKidPK = z.infer<
  typeof TokenGenerationStatesClientKidPK
>;

export const GSIPKEServiceIdDescriptorId = z
  .string()
  .brand(`eserviceId#descriptorId`);
export type GSIPKEServiceIdDescriptorId = z.infer<
  typeof GSIPKEServiceIdDescriptorId
>;

export const GSIPKClientIdPurposeId = z.string().brand(`clientId#purposeId`);
export type GSIPKClientIdPurposeId = z.infer<typeof GSIPKClientIdPurposeId>;

export const GSIPKClientIdKid = z.string().brand("clientId#kid");
export type GSIPKClientIdKid = z.infer<typeof GSIPKClientIdKid>;

export const EServiceTemplateId = z.string().uuid().brand("EServiceTemplateId");
export type EServiceTemplateId = z.infer<typeof EServiceTemplateId>;

export const EServiceTemplateVersionId = z
  .string()
  .uuid()
  .brand("EServiceTemplateVersionId");
export type EServiceTemplateVersionId = z.infer<
  typeof EServiceTemplateVersionId
>;

type IDS =
  | CorrelationId
  | EServiceId
  | EServiceDocumentId
  | AgreementId
  | AgreementDocumentId
  | DescriptorId
  | AttributeId
  | TenantId
  | RiskAnalysisSingleAnswerId
  | RiskAnalysisMultiAnswerId
  | RiskAnalysisFormId
  | RiskAnalysisId
  | PurposeId
  | PurposeVersionId
  | PurposeVersionDocumentId
  | ClientId
  | UserId
  | SelfcareId
  | ProducerKeychainId
  | DelegationId
  | DelegationContractId
  | PlatformStatesEServiceDescriptorPK
  | PlatformStatesAgreementPK
  | PlatformStatesPurposePK
  | PlatformStatesClientPK
  | GSIPKConsumerIdEServiceId
  | TokenGenerationStatesClientKidPurposePK
  | TokenGenerationStatesClientKidPK
  | GSIPKEServiceIdDescriptorId
  | GSIPKClientIdPurposeId
  | GSIPKClientIdKid
  | EServiceTemplateId
  | EServiceTemplateVersionId;

// This function is used to generate a new ID for a new object
// it infers the type of the ID based on how is used the result
// the 'as' is used to cast the uuid string to the inferred type
export function generateId<T extends IDS>(): T {
  return crypto.randomUUID() as T;
}

// This function is used to get a branded ID from a string
// it's an unsafe function because it doesn't check if the string
// is a valid uuid and it doen't check if the string rappresent
// a valid ID for the type.
// The user of this function must be sure that the string is a valid
// uuid and that the string rappresent a valid ID for the type
export function unsafeBrandId<T extends IDS>(id: string): T {
  return id as T;
}
