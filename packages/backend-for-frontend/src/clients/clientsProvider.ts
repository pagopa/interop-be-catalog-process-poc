import {
  tenantApi,
  attributeRegistryApi,
  catalogApi,
  agreementApi,
  purposeApi,
  authorizationApi,
  selfcareV2ClientApi,
  selfcareV2InstitutionClientBuilder,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type TenantProcessClient = {
  tenant: ReturnType<typeof tenantApi.createTenantApiClient>;
  tenantAttribute: ReturnType<typeof tenantApi.createTenantAttributeApiClient>;
  selfcare: ReturnType<typeof tenantApi.createSelfcareApiClient>;
};

export type AttributeProcessClient = ReturnType<
  typeof attributeRegistryApi.createAttributeApiClient
>;

export type CatalogProcessClient = ReturnType<
  typeof catalogApi.createProcessApiClient
>;

export type AgreementProcessClient = ReturnType<
  typeof agreementApi.createAgreementApiClient
>;

export type PurposeProcessClient = ReturnType<
  typeof purposeApi.createPurposeApiClient
>;

export type AuthorizationProcessClient = {
  client: ReturnType<typeof authorizationApi.createClientApiClient>;
  producerKeychain: ReturnType<
    typeof authorizationApi.createProducerKeychainApiClient
  >;
  user: ReturnType<typeof authorizationApi.createUserApiClient>;
  token: ReturnType<typeof authorizationApi.createTokenGenerationApiClient>;
};

export type SelfcareV2Client = {
  institution: ReturnType<
    typeof selfcareV2ClientApi.createInstitutionsApiClient
  >;
};

export type PagoPAInteropBeClients = {
  tenantProcessClient: TenantProcessClient;
  attributeProcessClient: AttributeProcessClient;
  catalogProcessClient: CatalogProcessClient;
  agreementProcessClient: AgreementProcessClient;
  purposeProcessClient: PurposeProcessClient;
  authorizationClient: AuthorizationProcessClient;
  selfcareV2Client: SelfcareV2Client;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    tenantProcessClient: {
      tenant: tenantApi.createTenantApiClient(config.tenantProcessUrl),
      tenantAttribute: tenantApi.createTenantAttributeApiClient(
        config.tenantProcessUrl
      ),
      selfcare: tenantApi.createSelfcareApiClient(config.tenantProcessUrl),
    },
    agreementProcessClient: agreementApi.createAgreementApiClient(
      config.agreementProcessUrl
    ),
    catalogProcessClient: catalogApi.createProcessApiClient(
      config.catalogProcessUrl
    ),
    attributeProcessClient: attributeRegistryApi.createAttributeApiClient(
      config.attributeRegistryUrl
    ),
    purposeProcessClient: purposeApi.createPurposeApiClient(config.purposeUrl),
    authorizationClient: {
      client: authorizationApi.createClientApiClient(config.authorizationUrl),
      producerKeychain: authorizationApi.createProducerKeychainApiClient(
        config.authorizationUrl
      ),
      user: authorizationApi.createUserApiClient(config.authorizationUrl),
      token: authorizationApi.createTokenGenerationApiClient(
        config.authorizationUrl
      ),
    },
    selfcareV2Client: {
      institution: selfcareV2InstitutionClientBuilder(config),
    },
  };
}
