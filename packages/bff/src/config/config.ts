import {
  APIEndpoint,
  CommonHTTPServiceConfig,
  FileManagerConfig,
  S3Config,
  SelfCareConfig,
  SessionTokenGenerationConfig,
  TokenGenerationConfig,
  RedisRateLimiterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const TenantProcessServerConfig = z
  .object({
    TENANT_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    tenantProcessUrl: c.TENANT_PROCESS_URL,
  }));
export type TenantProcessServerConfig = z.infer<
  typeof TenantProcessServerConfig
>;

export const AgreementProcessServerConfig = z
  .object({
    AGREEMENT_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    agreementProcessUrl: c.AGREEMENT_PROCESS_URL,
  }));
export type AgreementProcessServerConfig = z.infer<
  typeof AgreementProcessServerConfig
>;

export const CatalogProcessServerConfig = z
  .object({
    CATALOG_PROCESS_URL: APIEndpoint,
    ESERVICE_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    catalogProcessUrl: c.CATALOG_PROCESS_URL,
    eserviceDocumentsPath: c.ESERVICE_DOCUMENTS_PATH,
  }));
export type CatalogProcessServerConfig = z.infer<
  typeof CatalogProcessServerConfig
>;

export const AttributeRegistryProcessServerConfig = z
  .object({
    ATTRIBUTE_REGISTRY_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    attributeRegistryUrl: c.ATTRIBUTE_REGISTRY_PROCESS_URL,
  }));
export type AttributeRegistryProcessServerConfig = z.infer<
  typeof AttributeRegistryProcessServerConfig
>;

export const PurposeProcessServerConfig = z
  .object({
    PURPOSE_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    purposeUrl: c.PURPOSE_PROCESS_URL,
  }));
export type PurposeProcessServerConfig = z.infer<
  typeof PurposeProcessServerConfig
>;

export const AuthorizationProcessServerConfig = z
  .object({
    AUTHORIZATION_PROCESS_URL: APIEndpoint,
    TENANT_ALLOWED_ORIGINS: z.string(),
    SAML_AUDIENCE: z.string(),
    PAGOPA_TENANT_ID: z.string(),
    SAML_CALLBACK_URL: z.string().url(),
    SAML_CALLBACK_ERROR_URL: z.string().url(),
    SUPPORT_LANDING_TOKEN_DURATION_SECONDS: z.coerce.number().default(300),
    SUPPORT_TOKEN_DURATION_SECONDS: z.coerce.number().default(3600),
  })
  .transform((c) => ({
    authorizationUrl: c.AUTHORIZATION_PROCESS_URL,
    tenantAllowedOrigins: c.TENANT_ALLOWED_ORIGINS.split(","),
    samlAudience: c.SAML_AUDIENCE,
    pagoPaTenantId: c.PAGOPA_TENANT_ID,
    samlCallbackUrl: c.SAML_CALLBACK_URL,
    samlCallbackErrorUrl: c.SAML_CALLBACK_ERROR_URL,
    supportLandingJwtDuration: c.SUPPORT_LANDING_TOKEN_DURATION_SECONDS,
    supportJwtDuration: c.SUPPORT_TOKEN_DURATION_SECONDS,
  }));
export type AuthorizationProcessServerConfig = z.infer<
  typeof AuthorizationProcessServerConfig
>;

export const AllowedListConfig = z
  .object({
    ALLOW_LIST_CONTAINER: z.string(),
    ALLOW_LIST_PATH: z.string(),
    ALLOW_LIST_FILE_NAME: z.string(),
  })
  .transform((c) => ({
    allowListContainer: c.ALLOW_LIST_CONTAINER,
    allowListPath: c.ALLOW_LIST_PATH,
    allowListFileName: c.ALLOW_LIST_FILE_NAME,
  }));
export const ExportFileConfig = z
  .object({
    EXPORT_ESERVICE_CONTAINER: z.string(),
    EXPORT_ESERVICE_PATH: z.string(),
    PRESIGNED_URL_GET_DURATION_MINUTES: z.coerce.number(),
  })
  .transform((c) => ({
    exportEserviceContainer: c.EXPORT_ESERVICE_CONTAINER,
    exportEservicePath: c.EXPORT_ESERVICE_PATH,
    presignedUrlGetDurationMinutes: c.PRESIGNED_URL_GET_DURATION_MINUTES,
  }));
export type ExportFileConfig = z.infer<typeof ExportFileConfig>;

export const S3RiskAnalysisConfig = z
  .object({
    RISK_ANALYSIS_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    riskAnalysisDocumentsPath: c.RISK_ANALYSIS_DOCUMENTS_PATH,
  }));

const BffProcessConfig = CommonHTTPServiceConfig.and(TenantProcessServerConfig)
  .and(AgreementProcessServerConfig)
  .and(CatalogProcessServerConfig)
  .and(AttributeRegistryProcessServerConfig)
  .and(SelfCareConfig)
  .and(PurposeProcessServerConfig)
  .and(RedisRateLimiterConfig)
  .and(AuthorizationProcessServerConfig)
  .and(TokenGenerationConfig)
  .and(SessionTokenGenerationConfig)
  .and(FileManagerConfig)
  .and(S3RiskAnalysisConfig)
  .and(AllowedListConfig)
  .and(S3Config)
  .and(ExportFileConfig);

export type BffProcessConfig = z.infer<typeof BffProcessConfig>;
export const config: BffProcessConfig = BffProcessConfig.parse(process.env);
