import { describe, expect, it } from "vitest";
import { Tenant, tenantFeatureType } from "pagopa-interop-models";
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

      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [],
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(3);
      expect(tenantsByName.results).toEqual([tenant1, tenant2, tenant3]);
    });
    it("should get tenants by name", async () => {
      await addOneTenant(tenant1);

      await addOneTenant(tenant2);

      const tenantsByName = await readModelService.getTenants({
        name: "Tenant 1",
        features: [],
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(1);
      expect(tenantsByName.results).toEqual([tenant1]);
    });
    it("should get tenants by feature", async () => {
      const tenantDelegatedProducer1: Tenant = {
        ...tenant1,
        features: [
          {
            type: tenantFeatureType.delegatedProducer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(tenantDelegatedProducer1);

      const tenantDelegatedProducer2: Tenant = {
        ...tenant2,
        features: [
          {
            type: tenantFeatureType.delegatedProducer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(tenantDelegatedProducer2);

      const tenantDelegatedConsumer1: Tenant = {
        ...tenant3,
        features: [
          {
            type: tenantFeatureType.delegatedConsumer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(tenantDelegatedConsumer1);

      const tenantDelegatedConsumer2: Tenant = {
        ...tenant4,
        features: [
          {
            type: tenantFeatureType.delegatedConsumer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(tenantDelegatedConsumer2);

      const tenantCertifier1 = {
        ...tenant5,
        features: [
          {
            type: tenantFeatureType.persistentCertifier,
            certifierId: "certifierId",
          },
        ],
      };

      await addOneTenant(tenantCertifier1);

      const tenantsByDelegatedProducerFeature =
        await readModelService.getTenants({
          name: undefined,
          features: [tenantFeatureType.delegatedProducer],
          offset: 0,
          limit: 50,
        });
      expect(tenantsByDelegatedProducerFeature.totalCount).toBe(2);
      expect(tenantsByDelegatedProducerFeature.results).toEqual([
        tenantDelegatedProducer1,
        tenantDelegatedProducer2,
      ]);

      const tenantsByDelegatedConsumerFeature =
        await readModelService.getTenants({
          name: undefined,
          features: [tenantFeatureType.delegatedConsumer],
          offset: 0,
          limit: 50,
        });
      expect(tenantsByDelegatedConsumerFeature.totalCount).toBe(2);
      expect(tenantsByDelegatedConsumerFeature.results).toEqual([
        tenantDelegatedConsumer1,
        tenantDelegatedConsumer2,
      ]);

      const tenantsByCertifierFeature = await readModelService.getTenants({
        name: undefined,
        features: [tenantFeatureType.persistentCertifier],
        offset: 0,
        limit: 50,
      });
      expect(tenantsByCertifierFeature.totalCount).toBe(1);
      expect(tenantsByCertifierFeature.results).toEqual([tenantCertifier1]);

      const allTenants = await readModelService.getTenants({
        name: undefined,
        features: [
          tenantFeatureType.delegatedProducer,
          tenantFeatureType.delegatedConsumer,
          tenantFeatureType.persistentCertifier,
        ],
        offset: 0,
        limit: 50,
      });
      expect(allTenants.totalCount).toBe(5);
    });
    it("should get tenants by feature and name", async () => {
      const tenantDelegatedProducer1: Tenant = {
        ...tenant1,
        features: [
          {
            type: tenantFeatureType.delegatedProducer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(tenantDelegatedProducer1);

      const tenantDelegatedProducer2: Tenant = {
        ...tenant2,
        features: [
          {
            type: tenantFeatureType.delegatedProducer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(tenantDelegatedProducer2);

      const tenantDelegatedConsumer1: Tenant = {
        ...tenant3,
        features: [
          {
            type: tenantFeatureType.delegatedConsumer,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(tenantDelegatedConsumer1);

      const tenantCertifier1 = {
        ...tenant4,
        features: [
          {
            type: tenantFeatureType.persistentCertifier,
            certifierId: "certifierId",
          },
        ],
      };

      await addOneTenant(tenantCertifier1);
      await addOneTenant(tenant5);

      const tenantsByName = await readModelService.getTenants({
        name: "Tenant 2",
        features: [
          tenantFeatureType.delegatedProducer,
          tenantFeatureType.persistentCertifier,
        ],
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(1);
      expect(tenantsByName.results).toEqual([tenantDelegatedProducer2]);

      const tenantsByName2 = await readModelService.getTenants({
        name: "Tenant",
        features: [tenantFeatureType.delegatedProducer],
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName2.totalCount).toBe(2);
      expect(tenantsByName2.results).toEqual([
        tenantDelegatedProducer1,
        tenantDelegatedProducer2,
      ]);

      const tenantsByName3 = await readModelService.getTenants({
        name: "Tenant 3",
        features: [tenantFeatureType.delegatedConsumer],
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName3.totalCount).toBe(1);
      expect(tenantsByName3.results).toEqual([tenantDelegatedConsumer1]);

      const tenantsByName4 = await readModelService.getTenants({
        name: "Noname",
        features: [tenantFeatureType.persistentCertifier],
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName4.totalCount).toBe(0);
    });
    it("should not get tenants if there are not any tenants", async () => {
      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [],
        offset: 0,
        limit: 50,
      });
      expect(tenantsByName.totalCount).toBe(0);
      expect(tenantsByName.results).toEqual([]);
    });
    it("should not get tenants if the name does not match", async () => {
      await addOneTenant(tenant1);

      await addOneTenant(tenant2);

      const tenantsByName = await readModelService.getTenants({
        name: "Tenant 6",
        features: [],
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
      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [],
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
      const tenantsByName = await readModelService.getTenants({
        name: undefined,
        features: [],
        offset: 2,
        limit: 4,
      });
      expect(tenantsByName.results.length).toBe(3);
    });
  });
});
