/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import { Tenant } from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { getMockAuthData, getMockTenant } from "pagopa-interop-commons-test";
import { tenantNotFoundBySelfcareId } from "../src/model/domain/errors.js";
import { toApiTenant } from "../src/model/domain/apiConverter.js";
import { addOneTenant, tenantService } from "./utils.js";
import { mockSelfcareTenantRouterRequest } from "./supertestSetup.js";

describe("getTenantBySelfcareId", () => {
  const tenant1: Tenant = {
    ...getMockTenant(),
    name: "Tenant 1",
  };
  const tenant2: Tenant = {
    ...getMockTenant(),
    name: "Tenant 2",
  };
  const tenant3: Tenant = {
    ...getMockTenant(),
    name: "Tenant 3",
  };

  it("should get the tenant by selfcareId", async () => {
    await addOneTenant(tenant1);
    await addOneTenant(tenant2);
    await addOneTenant(tenant3);

    const returnedTenant = await mockSelfcareTenantRouterRequest.get({
      path: "/tenants/selfcare/:selfcareId",
      pathParams: { selfcareId: tenant1.selfcareId! },
      authData: getMockAuthData(),
    });

    expect(returnedTenant).toEqual(toApiTenant(tenant1));
  });
  it("should throw tenantNotFoundBySelfcareId if the tenant isn't in DB", async () => {
    await addOneTenant(tenant2);
    expect(
      tenantService.getTenantBySelfcareId(tenant1.selfcareId!, genericLogger)
    ).rejects.toThrowError(tenantNotFoundBySelfcareId(tenant1.selfcareId!));
  });
});
