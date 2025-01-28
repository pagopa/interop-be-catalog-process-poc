import { z } from "zod";

export const CatalogTopicConfig = z
  .object({
    CATALOG_TOPIC: z.string(),
  })
  .transform((c) => ({
    catalogTopic: c.CATALOG_TOPIC,
  }));
export type CatalogTopicConfig = z.infer<typeof CatalogTopicConfig>;

export const AgreementTopicConfig = z
  .object({
    AGREEMENT_TOPIC: z.string(),
  })
  .transform((c) => ({
    agreementTopic: c.AGREEMENT_TOPIC,
  }));
export type AgreementTopicConfig = z.infer<typeof AgreementTopicConfig>;

export const TenantTopicConfig = z
  .object({
    TENANT_TOPIC: z.string(),
  })
  .transform((c) => ({
    tenantTopic: c.TENANT_TOPIC,
  }));
export type TenantTopicConfig = z.infer<typeof TenantTopicConfig>;

export const AttributeTopicConfig = z
  .object({
    ATTRIBUTE_TOPIC: z.string(),
  })
  .transform((c) => ({
    attributeTopic: c.ATTRIBUTE_TOPIC,
  }));
export type AttributeTopicConfig = z.infer<typeof AttributeTopicConfig>;

export const PurposeTopicConfig = z
  .object({
    PURPOSE_TOPIC: z.string(),
  })
  .transform((c) => ({
    purposeTopic: c.PURPOSE_TOPIC,
  }));
export type PurposeTopicConfig = z.infer<typeof PurposeTopicConfig>;

export const AuthorizationTopicConfig = z
  .object({
    AUTHORIZATION_TOPIC: z.string(),
  })
  .transform((c) => ({
    authorizationTopic: c.AUTHORIZATION_TOPIC,
  }));
export type AuthorizationTopicConfig = z.infer<typeof AuthorizationTopicConfig>;

export const DelegationTopicConfig = z
  .object({
    DELEGATION_TOPIC: z.string(),
  })
  .transform((c) => ({
    delegationTopic: c.DELEGATION_TOPIC,
  }));
export type DelegationTopicConfig = z.infer<typeof DelegationTopicConfig>;

export const EServiceTemplateTopicConfig = z
  .object({
    ESERVICE_TEMPLATE_TOPIC: z.string(),
  })
  .transform((c) => ({
    eserviceTemplateTopic: c.ESERVICE_TEMPLATE_TOPIC,
  }));
export type EServiceTemplateTopicConfig = z.infer<
  typeof EServiceTemplateTopicConfig
>;

export const KafkaTopicConfig = z.union([
  CatalogTopicConfig,
  AgreementTopicConfig,
  TenantTopicConfig,
  AttributeTopicConfig,
  PurposeTopicConfig,
  AuthorizationTopicConfig,
  DelegationTopicConfig,
  EServiceTemplateTopicConfig,
]);
export type KafkaTopicConfig = z.infer<typeof KafkaTopicConfig>;
