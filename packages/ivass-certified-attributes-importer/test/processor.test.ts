/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { randomUUID } from "crypto";
import {
  it,
  afterEach,
  beforeAll,
  describe,
  expect,
  vi,
  vitest,
  inject,
} from "vitest";
import {
  InteropToken,
  InteropTokenGenerator,
  RefreshableInteropToken,
  genericLogger,
} from "pagopa-interop-commons";
import {
  Tenant,
  toReadModelAttribute,
  toReadModelTenant,
  unsafeBrandId,
  generateId,
} from "pagopa-interop-models";
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { TenantProcessService } from "../src/service/tenantProcessService.js";
import { ReadModelQueries } from "../src/service/readModelQueriesService.js";
import { importAttributes } from "../src/service/processor.js";
import {
  ATTRIBUTE_IVASS_INSURANCES_ID,
  downloadCSVMock,
  downloadCSVMockGenerator,
  internalAssignCertifiedAttributeMock,
  internalRevokeCertifiedAttributeMock,
  MOCK_TENANT_ID,
  persistentTenant,
  persistentTenantAttribute,
} from "./helpers.js";

export const readModelConfig = inject("readModelConfig");

export const { cleanup, readModelRepository } = await setupTestContainersVitest(
  inject("readModelConfig")
);

describe("IVASS Certified Attributes Importer", async () => {
  const tokenGeneratorMock = {} as InteropTokenGenerator;
  const refreshableTokenMock = new RefreshableInteropToken(tokenGeneratorMock);
  const tenantProcessMock = new TenantProcessService("url");
  const csvDownloaderMock = downloadCSVMock;
  const readModelQueries = new ReadModelQueries(readModelRepository);

  const run = () =>
    importAttributes(
      csvDownloaderMock,
      readModelQueries,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      MOCK_TENANT_ID,
      genericLogger,
      generateId()
    );

  const interopToken: InteropToken = {
    header: {
      alg: "algorithm",
      use: "use",
      typ: "type",
      kid: "key-id",
    },
    payload: {
      jti: "token-id",
      iss: "issuer",
      aud: ["audience1"],
      sub: "subject",
      iat: 0,
      nbf: 0,
      exp: 10,
      role: "role1",
    },
    serialized: "the-token",
  };
  const generateInternalTokenMock = (): Promise<InteropToken> =>
    Promise.resolve(interopToken);

  const refreshableInternalTokenSpy = vi
    .spyOn(refreshableTokenMock, "get")
    .mockImplementation(generateInternalTokenMock);

  const internalAssignCertifiedAttributeSpy = vi
    .spyOn(tenantProcessMock, "internalAssignCertifiedAttribute")
    .mockImplementation(internalAssignCertifiedAttributeMock);
  const internalRevokeCertifiedAttributeSpy = vi
    .spyOn(tenantProcessMock, "internalRevokeCertifiedAttribute")
    .mockImplementation(internalRevokeCertifiedAttributeMock);

  const getIVASSTenantsSpy = vi.spyOn(readModelQueries, "getIVASSTenants");

  const getTenantsWithAttributesSpy = vi.spyOn(
    readModelQueries,
    "getTenantsWithAttributes"
  );

  const getTenantByIdSpy = vi.spyOn(readModelQueries, "getTenantById");

  const getAttributeByExternalIdSpy = vi.spyOn(
    readModelQueries,
    "getAttributeByExternalId"
  );

  beforeAll(() => {
    vitest.clearAllMocks();
  });

  afterEach(async () => {
    vitest.clearAllMocks();
    await cleanup();
  });

  it("should succeed", async () => {
    await writeInitialData();

    await run();

    expect(downloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalled();
    expect(internalAssignCertifiedAttributeSpy).toBeCalled();
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed with fields starting with quotes", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
    D0001;2020-12-02;9999-12-31;"DE ROTTERDAM" BUILDING, 29TH FLOOR, EAST TOWER, WILHELMINAKADE 149A (3072 AP)  ROTTERDAM PAESI BASSI;0000012345678901
    `;

    const readModelTenants: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IVASS", value: "12345678901" },
        attributes: [],
      },
    ];

    await writeInitialData();

    await Promise.all(
      readModelTenants.map((tenant) =>
        writeInReadmodel(toReadModelTenant(tenant), readModelRepository.tenants)
      )
    );

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    const getIVASSTenantsSpy = vi.spyOn(readModelQueries, "getIVASSTenants");

    await importAttributes(
      localDownloadCSVMock,
      readModelQueries,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      MOCK_TENANT_ID,
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toHaveBeenCalledWith(
      readModelTenants.map((t) => t.externalId.value)
    );
    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed, assigning only missing attributes", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
    D0001;2020-12-02;9999-12-31;Org1;0000012345678901
    D0002;2020-06-10;9999-12-31;Org2;0000012345678902
    D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    await writeInitialData();

    const readModelTenants: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IVASS", value: "12345678901" },
        attributes: [
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
          },
        ],
      },
      {
        ...persistentTenant,
        externalId: { origin: "IVASS", value: "12345678902" },
        attributes: [{ ...persistentTenantAttribute }],
      },
      {
        ...persistentTenant,
        externalId: { origin: "IVASS", value: "12345678903" },
        attributes: [],
      },
    ];

    await Promise.all(
      readModelTenants.map((tenant) =>
        writeInReadmodel(toReadModelTenant(tenant), readModelRepository.tenants)
      )
    );

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsSpy = vi.spyOn(readModelQueries, "getIVASSTenants");

    await importAttributes(
      localDownloadCSVMock,
      readModelQueries,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      MOCK_TENANT_ID,
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toHaveBeenCalledWith(
      readModelTenants.map((t) => t.externalId.value)
    );
    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(3);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(3);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed, unassigning expired organizations ", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
    D0001;2020-12-02;2021-12-31;Org1;0000012345678901
    D0002;2100-06-10;9999-12-31;Org2;0000012345678902
    D0003;2000-06-10;9999-12-31;Org3;0000012345678903`;

    const tenant1: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678901" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };
    const tenant2: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678902" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };
    const tenant3: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678903" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    await writeInitialData();
    await Promise.all(
      [tenant1, tenant2, tenant3].map((tenant) =>
        writeInReadmodel(toReadModelTenant(tenant), readModelRepository.tenants)
      )
    );

    const getIVASSTenantsSpy = vi.spyOn(readModelQueries, "getIVASSTenants");
    const getTenantsWithAttributesSpy = vi.spyOn(
      readModelQueries,
      "getTenantsWithAttributes"
    );

    await importAttributes(
      localDownloadCSVMock,
      readModelQueries,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      MOCK_TENANT_ID,
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toHaveBeenCalledWith([tenant3.externalId.value]);
    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(2);
  });

  it("should succeed, unassigning only existing attributes", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
    D0001;2020-12-02;2021-12-31;Org1;0000012345678901
    D0002;2020-06-10;2021-12-31;Org2;0000012345678902
    D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    const tenant3: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678901" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };

    await writeInitialData();
    await writeInReadmodel(
      toReadModelTenant(tenant3),
      readModelRepository.tenants
    );

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsSpy = vi.spyOn(readModelQueries, "getIVASSTenants");

    const getTenantsWithAttributesSpy = vi.spyOn(
      readModelQueries,
      "getTenantsWithAttributes"
    );

    await importAttributes(
      localDownloadCSVMock,
      readModelQueries,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      MOCK_TENANT_ID,
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toHaveBeenCalledWith(["12345678903"]);
    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
  });

  it("should succeed, only for tenants that exist on read model ", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
    D0001;2020-12-02;9999-12-31;Org1;0000012345678901
    D0002;2020-06-10;2021-12-31;Org2;0000012345678902
    D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    const tenant3: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678903" },
      attributes: [{ ...persistentTenantAttribute }],
    };

    await writeInitialData();
    await writeInReadmodel(
      toReadModelTenant(tenant3),
      readModelRepository.tenants
    );

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsSpy = vi.spyOn(readModelQueries, "getIVASSTenants");

    const getTenantsWithAttributesSpy = vi.spyOn(
      readModelQueries,
      "getTenantsWithAttributes"
    );

    await importAttributes(
      localDownloadCSVMock,
      readModelQueries,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      MOCK_TENANT_ID,
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toHaveBeenCalledWith([
      "12345678901",
      tenant3.externalId.value,
    ]);
    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed with more than one batch", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
      D0001;2020-12-02;9999-12-31;Org1;0000012345678901
      D0002;2020-06-10;2021-12-31;Org2;0000012345678902
      D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    const readModelTenantsBatch1: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IVASS", value: "12345678901" },
        attributes: [{ ...persistentTenantAttribute }],
      },
    ];

    await writeInitialData();
    await Promise.all(
      readModelTenantsBatch1.map((tenant) =>
        writeInReadmodel(toReadModelTenant(tenant), readModelRepository.tenants)
      )
    );

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsSpy = vi.spyOn(readModelQueries, "getIVASSTenants");
    const getTenantsWithAttributesSpy = vi.spyOn(
      readModelQueries,
      "getTenantsWithAttributes"
    );

    await importAttributes(
      localDownloadCSVMock,
      readModelQueries,
      tenantProcessMock,
      refreshableTokenMock,
      1,
      MOCK_TENANT_ID,
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toBeCalledTimes(2);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should fail on CSV retrieve error", async () => {
    const localDownloadCSVMock = vi
      .fn()
      .mockImplementation(
        (): Promise<string> => Promise.reject(new Error("CSV Retrieve error"))
      );

    await writeInitialData();

    await expect(() =>
      importAttributes(
        localDownloadCSVMock,
        readModelQueries,
        tenantProcessMock,
        refreshableTokenMock,
        1,
        MOCK_TENANT_ID,
        genericLogger,
        generateId()
      )
    ).rejects.toThrowError("CSV Retrieve error");

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(0);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(0);

    expect(getIVASSTenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should fail if the tenant is not configured as certifier", async () => {
    await writeInReadmodel(
      toReadModelTenant({
        attributes: [],
        externalId: { origin: "IVASS", value: "ivass-tenant-id" },
        createdAt: new Date(),
        features: [],
        id: MOCK_TENANT_ID,
        mails: [],
        name: "IVASS Tenant",
      }),
      readModelRepository.tenants
    );

    await expect(() => run()).rejects.toThrowError(
      `Tenant with id ${MOCK_TENANT_ID} is not a certifier`
    );

    expect(downloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(0);

    expect(getIVASSTenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should skip CSV file rows with unexpected schema", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
      ;Unexpected value;;Org1;0000012345678901
      D0002;2020-06-10;2021-12-31;Org2;0000012345678902
      D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    const tenant2: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678902" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };
    const tenant3: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678903" },
      attributes: [{ ...persistentTenantAttribute }],
    };

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    await writeInitialData();
    await Promise.all(
      [tenant2, tenant3].map((tenant) =>
        writeInReadmodel(toReadModelTenant(tenant), readModelRepository.tenants)
      )
    );

    const getIVASSTenantsSpy = vi.spyOn(readModelQueries, "getIVASSTenants");

    const getTenantsWithAttributesSpy = vi.spyOn(
      readModelQueries,
      "getTenantsWithAttributes"
    );

    await importAttributes(
      localDownloadCSVMock,
      readModelQueries,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      MOCK_TENANT_ID,
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
  });

  it("should succeed with missing Tax Code", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
      D0001;2020-12-02;9999-12-31;Org1;
      D0002;2020-06-10;9999-12-31;Org2;0000012345678902
      D0003;2019-07-19;9999-12-31;Org3;`;

    const tenant1: Tenant = {
      ...persistentTenant,
      id: unsafeBrandId(randomUUID()),
      externalId: { origin: "IVASS", value: "D0001" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };
    const tenant2: Tenant = {
      ...persistentTenant,
      id: unsafeBrandId(randomUUID()),
      externalId: { origin: "IVASS", value: "D0003" },
      attributes: [],
    };

    const tenant3: Tenant = {
      ...persistentTenant,
      id: unsafeBrandId(randomUUID()),
      externalId: { origin: "IVASS", value: "D0005" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };

    const readModelTenants: Tenant[] = [tenant1, tenant2, tenant3];

    await writeInitialData();
    await Promise.all(
      readModelTenants.map((tenant) =>
        writeInReadmodel(toReadModelTenant(tenant), readModelRepository.tenants)
      )
    );

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getTenantsWithAttributesSpy = vi.spyOn(
      readModelQueries,
      "getTenantsWithAttributes"
    );

    await importAttributes(
      localDownloadCSVMock,
      readModelQueries,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      MOCK_TENANT_ID,
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(internalAssignCertifiedAttributeSpy.mock.calls[0][0]).toEqual(
      "IVASS"
    );
    expect(internalAssignCertifiedAttributeSpy.mock.calls[0][1]).toEqual(
      "D0003"
    );
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(internalRevokeCertifiedAttributeSpy.mock.calls[0][0]).toEqual(
      "IVASS"
    );
    expect(internalRevokeCertifiedAttributeSpy.mock.calls[0][1]).toEqual(
      "D0005"
    );
  });

  it("should unassign attribute for tenants not in the file", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
      D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    const tenant1: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678901" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };

    const tenant3: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678903" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };

    await writeInitialData();
    await Promise.all(
      [tenant1, tenant3].map((tenant) =>
        writeInReadmodel(toReadModelTenant(tenant), readModelRepository.tenants)
      )
    );

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsSpy = vi.spyOn(readModelQueries, "getIVASSTenants");

    const getTenantsWithAttributesSpy = vi.spyOn(
      readModelQueries,
      "getTenantsWithAttributes"
    );

    await importAttributes(
      localDownloadCSVMock,
      readModelQueries,
      tenantProcessMock,
      refreshableTokenMock,
      1,
      MOCK_TENANT_ID,
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
  });

  it("should fail if the file does not contain records", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
      `;

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    await writeInitialData();
    const getIVASSTenantsSpy = vi.spyOn(readModelQueries, "getIVASSTenants");
    const getTenantsWithAttributesSpy = vi.spyOn(
      readModelQueries,
      "getTenantsWithAttributes"
    );

    await expect(() =>
      importAttributes(
        localDownloadCSVMock,
        readModelQueries,
        tenantProcessMock,
        refreshableTokenMock,
        10,
        MOCK_TENANT_ID,
        genericLogger,
        generateId()
      )
    ).rejects.toThrowError("File does not contain valid assignments");

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });
});

function writeInitialData() {
  return Promise.all([
    writeInReadmodel(
      toReadModelTenant({
        id: MOCK_TENANT_ID,
        externalId: { origin: "IVASS", value: "12345678901" },
        attributes: [],
        createdAt: new Date(),
        features: [{ type: "PersistentCertifier", certifierId: "IVASS" }],
        mails: [],
        name: "tenantName",
      }),
      readModelRepository.tenants
    ),

    writeInReadmodel(
      toReadModelAttribute({
        origin: "IVASS",
        code: "insurances",
        creationTime: new Date(),
        description: "Insurance",
        id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        kind: "Certified",
        name: "Insurance",
      }),
      readModelRepository.attributes
    ),
  ]);
}
