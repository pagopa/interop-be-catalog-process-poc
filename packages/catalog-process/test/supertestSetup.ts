import { catalogApi } from "pagopa-interop-api-clients";
import { DB, FileManager } from "pagopa-interop-commons";
import {
  mockAuthenticationMiddleware,
  createMockedApiRequester,
} from "pagopa-interop-commons-test/index.js";
import { vi, inject } from "vitest";
import { postgresDB, fileManager } from "./utils.js";

vi.mock("pagopa-interop-commons", async (importActual) => {
  const actual = await importActual<typeof import("pagopa-interop-commons")>();
  return {
    ...actual,
    initDB: (): DB => postgresDB,
    initFileManager: (): FileManager => fileManager,
    authenticationMiddleware: mockAuthenticationMiddleware,
  };
});

vi.mock("../src/config/config.js", async (importActual) => {
  const actual = await importActual<typeof import("../src/config/config.js")>();
  return {
    ...actual,
    ...inject("readModelConfig"),
    ...inject("eventStoreConfig"),
    ...inject("fileManagerConfig"),
  };
});

const { default: app } = await import("../src/app.js");

export const mockEserviceRouterRequest =
  createMockedApiRequester<typeof catalogApi.processEndpoints>(app);
