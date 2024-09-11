import { describe, expect, it } from "vitest";
import { Tenant } from "pagopa-interop-models";
import { getMockTenant } from "pagopa-interop-commons-test";
import { addOneTenant, readModelService } from "./utils.js";

describe("getTenants", () => {
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
  const tenant4: Tenant = {
    ...getMockTenant(),
    name: "Tenant 4",
  };
  const tenant5: Tenant = {
    ...getMockTenant(),
    name: "Tenant 5",
  };
  describe("getTenants", () => {
    it("should get all the tenants with no filter", async () => {
      await addOneTenant(tenant1);
      await addOneTenant(tenant2);
      await addOneTenant(tenant3);

      const tenantsByName = await readModelService.getTenantsByName({
        name: undefined,
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(3);
      expect(tenantsByName.results).toEqual([tenant1, tenant2, tenant3]);
    });
    it("should get tenants by name", async () => {
      await addOneTenant(tenant1);

      await addOneTenant(tenant2);

      const tenantsByName = await readModelService.getTenantsByName({
        name: "Tenant 1",
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(1);
      expect(tenantsByName.results).toEqual([tenant1]);
    });
    it("should not get tenants if there are not any tenants", async () => {
      const tenantsByName = await readModelService.getTenantsByName({
        name: undefined,
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(0);
      expect(tenantsByName.results).toEqual([]);
    });
    it("should not get tenants if the name does not match", async () => {
      await addOneTenant(tenant1);

      await addOneTenant(tenant2);

      const tenantsByName = await readModelService.getTenantsByName({
        name: "Tenant 6",
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(0);
      expect(tenantsByName.results).toEqual([]);
    });
    it("should get a maximun number of tenants based on a specified limit", async () => {
      await addOneTenant(tenant1);
      await addOneTenant(tenant2);
      await addOneTenant(tenant3);
      await addOneTenant(tenant4);
      await addOneTenant(tenant5);
      const tenantsByName = await readModelService.getTenantsByName({
        name: undefined,
        offset: 0,
        limit: 4,
      });
      expect(tenantsByName.results.length).toBe(4);
    });
    it("should get a maximun number of tenants based on a specified limit and offset", async () => {
      await addOneTenant(tenant1);
      await addOneTenant(tenant2);
      await addOneTenant(tenant3);
      await addOneTenant(tenant4);
      await addOneTenant(tenant5);
      const tenantsByName = await readModelService.getTenantsByName({
        name: undefined,
        offset: 2,
        limit: 4,
      });
      expect(tenantsByName.results.length).toBe(3);
    });
  });
});
