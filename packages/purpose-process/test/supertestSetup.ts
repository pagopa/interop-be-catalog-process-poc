import {
  createMockedApiRequester,
  mockAuthenticationMiddleware,
} from "pagopa-interop-commons-test";
import { inject, vi } from "vitest";
import { purposeApi } from "pagopa-interop-api-clients";
import { DB, FileManager } from "pagopa-interop-commons";
import { fileManager, postgresDB } from "./utils.js";

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

export const mockPurposeRouterRequest =
  createMockedApiRequester<typeof purposeApi.purposeEndpoints>(app);
