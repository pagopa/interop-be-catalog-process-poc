/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockAuthData,
  getMockEService,
  getMockTenant,
  randomArrayItem,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  EServiceId,
  TenantId,
  eserviceMode,
  generateId,
  tenantKind,
  toReadModelEService,
  toReadModelTenant,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger, getFormRulesByVersion } from "pagopa-interop-commons";
import {
  riskAnalysisConfigVersionNotFound,
  eserviceNotFound,
  tenantKindNotFound,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import { riskAnalysisFormConfigToApiRiskAnalysisFormConfig } from "../src/model/domain/apiConverter.js";
import { eservices, tenants, purposeService } from "./utils.js";
import { mockPurposeRouterRequest } from "./supertestSetup.js";

describe("retrieveRiskAnalysisConfigurationByVersion", async () => {
  it("should retrieve risk analysis configuration by version (Eservice mode: deliver)", async () => {
    const mockEservice = { ...getMockEService(), mode: eserviceMode.deliver };
    const kind = randomArrayItem(Object.values(tenantKind));
    const mockTenant = {
      ...getMockTenant(),
      kind,
    };
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    const riskAnalysisVersion = "1.0";

    const result = await mockPurposeRouterRequest.get({
      path: "/purposes/riskAnalysis/version/:riskAnalysisVersion",
      queryParams: { eserviceId: mockEservice.id },
      pathParams: { riskAnalysisVersion },
      authData: getMockAuthData(mockTenant.id),
    });

    expect(result).toEqual(
      riskAnalysisFormConfigToApiRiskAnalysisFormConfig(
        getFormRulesByVersion(kind, riskAnalysisVersion)!
      )
    );
  });
  it("should retrieve risk analysis configuration by version (Eservice mode: receive)", async () => {
    const mockEservice = { ...getMockEService(), mode: eserviceMode.receive };
    const kind = randomArrayItem(Object.values(tenantKind));
    const mockTenant = {
      ...getMockTenant(mockEservice.producerId),
      kind,
    };
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    const riskAnalysisVersion = "1.0";

    const result = await mockPurposeRouterRequest.get({
      path: "/purposes/riskAnalysis/version/:riskAnalysisVersion",
      queryParams: { eserviceId: mockEservice.id },
      pathParams: { riskAnalysisVersion },
      authData: getMockAuthData(mockTenant.id),
    });

    expect(result).toEqual(
      riskAnalysisFormConfigToApiRiskAnalysisFormConfig(
        getFormRulesByVersion(kind, riskAnalysisVersion)!
      )
    );
  });
  it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const mockTenant = getMockTenant();
    const randomId = generateId<EServiceId>();
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    expect(
      purposeService.retrieveRiskAnalysisConfigurationByVersion({
        eserviceId: randomId,
        riskAnalysisVersion: "1.0",
        organizationId: mockTenant.id,
        logger: genericLogger,
      })
    ).rejects.toThrowError(eserviceNotFound(randomId));
  });
  it("should throw tenantNotFound if the tenant doesn't exist", async () => {
    const mockEservice = { ...getMockEService(), mode: eserviceMode.deliver };
    const randomId = generateId<TenantId>();
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);

    expect(
      purposeService.retrieveRiskAnalysisConfigurationByVersion({
        eserviceId: mockEservice.id,
        riskAnalysisVersion: "1.0",
        organizationId: randomId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(randomId));
  });
  it("should throw tenantKindNotFound if the tenant kind is undefined", async () => {
    const mockEservice = { ...getMockEService(), mode: eserviceMode.deliver };
    const mockTenant = {
      ...getMockTenant(),
      kind: undefined,
    };
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    expect(
      purposeService.retrieveRiskAnalysisConfigurationByVersion({
        eserviceId: mockEservice.id,
        riskAnalysisVersion: "1.0",
        organizationId: mockTenant.id,
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
  });
  it("should throw RiskAnalysisConfigVersionNotFound if a config with that version doesn't exist", async () => {
    const mockEservice = { ...getMockEService(), mode: eserviceMode.deliver };
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    const wrongRiskAnalysisVersion = "0.0";

    expect(
      purposeService.retrieveRiskAnalysisConfigurationByVersion({
        eserviceId: mockEservice.id,
        riskAnalysisVersion: wrongRiskAnalysisVersion,
        organizationId: mockTenant.id,
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      riskAnalysisConfigVersionNotFound(
        wrongRiskAnalysisVersion,
        mockTenant.kind
      )
    );
  });
});
