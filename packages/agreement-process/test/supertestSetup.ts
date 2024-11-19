import {
  agreementApi,
  SelfcareV2UsersClient,
} from "pagopa-interop-api-clients";
import { DB, FileManager } from "pagopa-interop-commons";
import {
  mockAuthenticationMiddleware,
  createMockedApiRequester,
} from "pagopa-interop-commons-test";
import { vi, inject, Mock } from "vitest";
import { postgresDB, fileManager, selfcareV2ClientMock } from "./utils.js";

export function mockSelfcareV2ClientCall(
  value?:
    | Awaited<ReturnType<typeof selfcareV2ClientMock.getUserInfoUsingGET>>
    | undefined
): void {
  (selfcareV2ClientMock.getUserInfoUsingGET as Mock).mockImplementation(
    async () => value
  );
}

vi.doMock("pagopa-interop-api-clients", async (importActual) => {
  const actual = await importActual<
    typeof import("pagopa-interop-api-clients")
  >();
  return {
    ...actual,
    selfcareV2UsersClientBuilder: (): SelfcareV2UsersClient =>
      selfcareV2ClientMock,
  };
});

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

export const mockAgreementRouterRequest =
  createMockedApiRequester<typeof agreementApi.agreementEndpoints>(app);
