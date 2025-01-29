import { agreementApi, purposeApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type AgreementProcessClient = ReturnType<
  typeof agreementApi.createAgreementApiClient
>;

export type PurposeProcessClient = ReturnType<
  typeof purposeApi.createPurposeApiClient
>;
export type PagoPAInteropBeClients = {
  agreementProcessClient: AgreementProcessClient;
  purposeProcessClient: PurposeProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    agreementProcessClient: agreementApi.createAgreementApiClient(
      config.agreementProcessUrl
    ),
    purposeProcessClient: purposeApi.createPurposeApiClient(
      config.purposeProcessUrl
    ),
  };
}
