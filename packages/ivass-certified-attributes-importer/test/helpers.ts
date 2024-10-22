/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  Attribute,
  Tenant,
  TenantAttribute,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { vi } from "vitest";
import { InteropContext } from "../src/model/interopContextModel.js";

const csvFileContent = `OTHER_FIELD;CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
F1;D0001;2020-12-02;9999-12-31;Org1;0000012345678901
F2;D0002;2020-06-10;9999-12-31;Org2;0000012345678902
F3;D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

export const ATTRIBUTE_IVASS_INSURANCES_ID =
  "b1d64ee0-fda9-48e2-84f8-1b62f1292b47";

export const MOCK_TENANT_ID = unsafeBrandId<TenantId>(
  "f50da1f7-604e-4386-b090-1a89ed0de421"
);

export const downloadCSVMockGenerator = (csvContent: string) =>
  vi
    .fn()
    .mockImplementation((): Promise<string> => Promise.resolve(csvContent));
export const getTenantsMockGenerator =
  (f: (codes: string[]) => Tenant[]) =>
  (codes: string[]): Promise<Tenant[]> =>
    Promise.resolve(f(codes));
export const getTenantByIdMockGenerator =
  (f: (tenantId: string) => Tenant) =>
  (tenantId: string): Promise<Tenant> =>
    Promise.resolve(f(tenantId));

export const downloadCSVMock = downloadCSVMockGenerator(csvFileContent);

export const internalAssignCertifiedAttributeMock = (
  _tenantOrigin: string,
  _tenantExternalId: string,
  _attributeOrigin: string,
  _attributeExternalId: string,
  _context: InteropContext
): Promise<void> => Promise.resolve();
export const internalRevokeCertifiedAttributeMock = (
  _tenantOrigin: string,
  _tenantExternalId: string,
  _attributeOrigin: string,
  _attributeExternalId: string,
  _context: InteropContext
): Promise<void> => Promise.resolve();

export const persistentTenant: Tenant = {
  id: unsafeBrandId("091fbea1-0c8e-411b-988f-5098b6a33ba7"),
  externalId: { origin: "tenantOrigin", value: "tenantValue" },
  attributes: [],
  features: [],
  createdAt: new Date(),
  mails: [],
  name: "tenantName",
};

export const persistentAttribute: Attribute = {
  id: unsafeBrandId("7a04c906-1525-4c68-8a5b-d740d77d9c80"),
  origin: "attributeOrigin",
  code: "attributeCode",
  name: "attributeName",
  kind: "Certified",
  creationTime: new Date(),
  description: "attributeDescription",
};

export const persistentTenantAttribute: TenantAttribute = {
  id: unsafeBrandId("7a04c906-1525-4c68-8a5b-d740d77d9c80"),
  type: "PersistentCertifiedAttribute",
  assignmentTimestamp: new Date(),
};
