import {
  agreementApi,
  catalogApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  agreementApiState,
  catalogApiDescriptorState,
} from "./api/apiTypes.js";

/* 
  This file contains commons utility functions 
  used to pick or transform data from model to another.
*/

const ACTIVE_DESCRIPTOR_STATES_FILTER: catalogApi.EServiceDescriptorState[] = [
  catalogApiDescriptorState.PUBLISHED,
  catalogApiDescriptorState.SUSPENDED,
  catalogApiDescriptorState.DEPRECATED,
];

export function getLatestActiveDescriptor(
  eservice: catalogApi.EService
): catalogApi.EServiceDescriptor | undefined {
  return eservice.descriptors
    .filter((d) => ACTIVE_DESCRIPTOR_STATES_FILTER.includes(d.state))
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
}

export function getTenantEmail(
  tenant: tenantApi.Tenant
): tenantApi.Mail | undefined {
  return tenant.mails.find(
    (m) => m.kind === tenantApi.MailKind.Values.CONTACT_EMAIL
  );
}

export function isUpgradable(
  eservice: catalogApi.EService,
  agreement: agreementApi.Agreement
): boolean {
  const eserviceDescriptor = eservice.descriptors.find(
    (e) => e.id === agreement.descriptorId
  );

  return (
    eserviceDescriptor !== undefined &&
    eservice.descriptors
      .filter((d) => Number(d.version) > Number(eserviceDescriptor.version))
      .find(
        (d) =>
          (d.state === catalogApiDescriptorState.PUBLISHED ||
            d.state === catalogApiDescriptorState.SUSPENDED) &&
          (agreement.state === agreementApiState.ACTIVE ||
            agreement.state === agreementApiState.SUSPENDED)
      ) !== undefined
  );
}
