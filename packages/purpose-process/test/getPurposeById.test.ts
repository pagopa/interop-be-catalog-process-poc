/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockTenant,
  getMockPurpose,
  writeInReadmodel,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  tenantKind,
  Purpose,
  generateId,
  toReadModelEService,
  PurposeId,
  EServiceId,
  TenantId,
  toReadModelTenant,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  eserviceNotFound,
  tenantNotFound,
  tenantKindNotFound,
} from "../src/model/domain/errors.js";
import { purposeToApiPurpose } from "../src/model/domain/apiConverter.js";
import {
  getMockEService,
  addOnePurpose,
  eservices,
  purposeService,
  tenants,
} from "./utils.js";
import { mockPurposeRouterRequest } from "./supertestSetup.js";

describe("getPurposeById", () => {
  it("should get the purpose if it exists", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService = getMockEService();
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
    };
    const mockPurpose2: Purpose = {
      ...getMockPurpose(),
      id: generateId(),
      title: "another purpose",
    };
    await addOnePurpose(mockPurpose1);
    await addOnePurpose(mockPurpose2);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    const result = await mockPurposeRouterRequest.get({
      path: "/purposes/:id",
      pathParams: { id: mockPurpose1.id },
      authData: getMockAuthData(mockTenant.id),
    });

    expect(result).toEqual(purposeToApiPurpose(mockPurpose1, false));
    expect(result.isRiskAnalysisValid).toBe(false);
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const notExistingId: PurposeId = generateId();
    const mockTenant = getMockTenant();
    const mockPurpose = getMockPurpose();
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    expect(
      purposeService.getPurposeById(notExistingId, mockTenant.id, genericLogger)
    ).rejects.toThrowError(purposeNotFound(notExistingId));
  });
  it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const notExistingId: EServiceId = generateId();
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: notExistingId,
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    expect(
      purposeService.getPurposeById(
        mockPurpose.id,
        mockTenant.id,
        genericLogger
      )
    ).rejects.toThrowError(eserviceNotFound(notExistingId));
  });
  it("should throw tenantNotFound if the tenant doesn't exist", async () => {
    const notExistingId: TenantId = generateId();
    const mockEService = getMockEService();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.getPurposeById(
        mockPurpose.id,
        notExistingId,
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(notExistingId));
  });
  it("should throw tenantKindNotFound if the tenant doesn't exist", async () => {
    const mockTenant = getMockTenant();
    const mockEService = getMockEService();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    expect(
      purposeService.getPurposeById(
        mockPurpose.id,
        mockTenant.id,
        genericLogger
      )
    ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
  });
});
