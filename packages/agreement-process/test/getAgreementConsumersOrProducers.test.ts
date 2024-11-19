/* eslint-disable functional/no-let */
import {
  getMockTenant,
  getMockAgreement,
  getMockAuthData,
} from "pagopa-interop-commons-test/index.js";
import { Tenant } from "pagopa-interop-models";
import { describe, beforeEach, it, expect } from "vitest";
import { CompactOrganization } from "../src/model/domain/models.js";
import { addOneTenant, addOneAgreement } from "./utils.js";
import { mockAgreementRouterRequest } from "./supertestSetup.js";

describe("get agreement consumers / producers", () => {
  let tenant1: Tenant;
  let tenant2: Tenant;
  let tenant3: Tenant;
  let tenant4: Tenant;
  let tenant5: Tenant;
  let tenant6: Tenant;

  const toCompactOrganization = (tenant: Tenant): CompactOrganization => ({
    id: tenant.id,
    name: tenant.name,
  });

  beforeEach(async () => {
    tenant1 = { ...getMockTenant(), name: "Tenant 1 Foo" };
    tenant2 = { ...getMockTenant(), name: "Tenant 2 Bar" };
    tenant3 = { ...getMockTenant(), name: "Tenant 3 FooBar" };
    tenant4 = { ...getMockTenant(), name: "Tenant 4 Baz" };
    tenant5 = { ...getMockTenant(), name: "Tenant 5 BazBar" };
    tenant6 = { ...getMockTenant(), name: "Tenant 6 BazFoo" };

    await addOneTenant(tenant1);
    await addOneTenant(tenant2);
    await addOneTenant(tenant3);
    await addOneTenant(tenant4);
    await addOneTenant(tenant5);
    await addOneTenant(tenant6);

    const agreement1 = {
      ...getMockAgreement(),
      producerId: tenant1.id,
      consumerId: tenant2.id,
    };

    const agreement2 = {
      ...getMockAgreement(),
      producerId: tenant1.id,
      consumerId: tenant3.id,
    };

    const agreement3 = {
      ...getMockAgreement(),
      producerId: tenant2.id,
      consumerId: tenant4.id,
    };

    const agreement4 = {
      ...getMockAgreement(),
      producerId: tenant2.id,
      consumerId: tenant5.id,
    };

    const agreement5 = {
      ...getMockAgreement(),
      producerId: tenant3.id,
      consumerId: tenant6.id,
    };

    await addOneAgreement(agreement1);
    await addOneAgreement(agreement2);
    await addOneAgreement(agreement3);
    await addOneAgreement(agreement4);
    await addOneAgreement(agreement5);
  });
  describe("get agreement consumers", () => {
    it("should get all agreement consumers", async () => {
      const consumers = await mockAgreementRouterRequest.get({
        path: "/consumers",
        queryParams: { limit: 10, offset: 0 },
        authData: getMockAuthData(),
      });
      expect(consumers).toEqual({
        totalCount: 5,
        results: expect.arrayContaining(
          [tenant2, tenant3, tenant4, tenant5, tenant6].map(
            toCompactOrganization
          )
        ),
      });
    });
    it("should get agreement consumers filtered by name", async () => {
      const consumers = await mockAgreementRouterRequest.get({
        path: "/consumers",
        queryParams: { consumerName: "Foo", limit: 10, offset: 0 },
        authData: getMockAuthData(),
      });

      expect(consumers).toEqual({
        totalCount: 2,
        results: expect.arrayContaining(
          [tenant3, tenant6].map(toCompactOrganization)
        ),
      });
    });
    it("should get agreement consumers with limit", async () => {
      const consumers = await mockAgreementRouterRequest.get({
        path: "/consumers",
        queryParams: { limit: 2, offset: 0 },
        authData: getMockAuthData(),
      });

      expect(consumers).toEqual({
        totalCount: 5,
        results: expect.arrayContaining(
          [tenant2, tenant3].map(toCompactOrganization)
        ),
      });
    });
    it("should get agreement consumers with offset and limit", async () => {
      const consumers = await mockAgreementRouterRequest.get({
        path: "/consumers",
        queryParams: { limit: 2, offset: 1 },
        authData: getMockAuthData(),
      });

      expect(consumers).toEqual({
        totalCount: 5,
        results: expect.arrayContaining(
          [tenant3, tenant4].map(toCompactOrganization)
        ),
      });
    });
    it("should get agreement consumers with offset, limit, and name filter", async () => {
      const consumers = await mockAgreementRouterRequest.get({
        path: "/consumers",
        queryParams: { consumerName: "Foo", limit: 1, offset: 1 },
        authData: getMockAuthData(),
      });

      expect(consumers).toEqual({
        totalCount: 2,
        results: expect.arrayContaining([tenant6].map(toCompactOrganization)),
      });
    });
    it("should get no agreement consumers in case no filters match", async () => {
      const producers = await mockAgreementRouterRequest.get({
        path: "/producers",
        queryParams: {
          producerName: "Not existing name",
          limit: 10,
          offset: 1,
        },
        authData: getMockAuthData(),
      });

      expect(producers).toEqual({
        totalCount: 0,
        results: [],
      });
    });
  });
  describe("get agreement producers", () => {
    it("should get all agreement producers", async () => {
      const producers = await mockAgreementRouterRequest.get({
        path: "/producers",
        queryParams: {
          limit: 10,
          offset: 0,
        },
        authData: getMockAuthData(),
      });

      expect(producers).toEqual({
        totalCount: 3,
        results: expect.arrayContaining(
          [tenant1, tenant2, tenant3].map(toCompactOrganization)
        ),
      });
    });
    it("should get agreement producers filtered by name", async () => {
      const producers = await mockAgreementRouterRequest.get({
        path: "/producers",
        queryParams: {
          producerName: "Bar",
          limit: 10,
          offset: 0,
        },
        authData: getMockAuthData(),
      });

      expect(producers).toEqual({
        totalCount: 2,
        results: expect.arrayContaining(
          [tenant2, tenant3].map(toCompactOrganization)
        ),
      });
    });
    it("should get agreement producers with limit", async () => {
      const producers = await mockAgreementRouterRequest.get({
        path: "/producers",
        queryParams: {
          limit: 2,
          offset: 0,
        },
        authData: getMockAuthData(),
      });

      expect(producers).toEqual({
        totalCount: 3,
        results: expect.arrayContaining(
          [tenant1, tenant2].map(toCompactOrganization)
        ),
      });
    });
    it("should get agreement producers with offset and limit", async () => {
      const producers = await mockAgreementRouterRequest.get({
        path: "/producers",
        queryParams: {
          limit: 2,
          offset: 1,
        },
        authData: getMockAuthData(),
      });

      expect(producers).toEqual({
        totalCount: 3,
        results: expect.arrayContaining(
          [tenant2, tenant3].map(toCompactOrganization)
        ),
      });
    });
    it("should get agreement producers with offset, limit, and name filter", async () => {
      const producers = await mockAgreementRouterRequest.get({
        path: "/producers",
        queryParams: {
          producerName: "Bar",
          limit: 1,
          offset: 1,
        },
        authData: getMockAuthData(),
      });

      expect(producers).toEqual({
        totalCount: 2,
        results: expect.arrayContaining([tenant3].map(toCompactOrganization)),
      });
    });
    it("should get no agreement producers in case no filters match", async () => {
      const producers = await mockAgreementRouterRequest.get({
        path: "/producers",
        queryParams: {
          producerName: "Not existing name",
          limit: 10,
          offset: 0,
        },
        authData: getMockAuthData(),
      });

      expect(producers).toEqual({
        totalCount: 0,
        results: [],
      });
    });
  });
});
