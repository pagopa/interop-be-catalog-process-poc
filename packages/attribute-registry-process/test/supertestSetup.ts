import {
  createMockedApiRequester,
  mockAuthenticationMiddleware,
} from "pagopa-interop-commons-test";
import { inject, vi } from "vitest";
import { DB } from "pagopa-interop-commons";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
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

export const mockAttributeRegistryRouterRequest =
  createMockedApiRequester<typeof attributeRegistryApi.attributeEndpoints>(app);
