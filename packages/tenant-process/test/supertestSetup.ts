import {
  createMockedApiRequester,
  mockAuthenticationMiddleware,
} from "pagopa-interop-commons-test";
import { inject, vi } from "vitest";
import { tenantApi } from "pagopa-interop-api-clients";
import { DB } from "pagopa-interop-commons";
import { postgresDB } from "./utils.js";

vi.mock("pagopa-interop-commons", async (importActual) => {
  const actual = await importActual<typeof import("pagopa-interop-commons")>();
  return {
    ...actual,
    initDB: (): DB => postgresDB,
    authenticationMiddleware: mockAuthenticationMiddleware,
  };
});

vi.mock("../src/config/config.js", async (importActual) => {
  const actual = await importActual<typeof import("../src/config/config.js")>();
  return {
    ...actual,
    ...inject("readModelConfig"),
    ...inject("eventStoreConfig"),
  };
});

const { default: app } = await import("../src/app.js");

export const mockTenantAttributeRouterRequest =
  createMockedApiRequester<typeof tenantApi.tenantAttributeEndpoints>(app);

export const mockTenantRouterRequest =
  createMockedApiRequester<typeof tenantApi.tenantEndpoints>(app);

export const mockSelfcareTenantRouterRequest =
  createMockedApiRequester<typeof tenantApi.selfcareEndpoints>(app);

export const mockInternalTenantRouterRequest =
  createMockedApiRequester<typeof tenantApi.internalEndpoints>(app);

export const mockM2MTenantRouterRequest =
  createMockedApiRequester<typeof tenantApi.m2mEndpoints>(app);
