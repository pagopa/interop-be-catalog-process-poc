import {
  createMockedApiRequester,
  mockAuthenticationMiddleware,
} from "pagopa-interop-commons-test";
import { inject, Mock, vi } from "vitest";
import { DB } from "pagopa-interop-commons";
import {
  authorizationApi,
  SelfcareV2InstitutionClient,
} from "pagopa-interop-api-clients";
import { postgresDB, selfcareV2Client } from "./utils.js";

export function mockSelfcareV2ClientCall(
  value?:
    | Awaited<
        ReturnType<typeof selfcareV2Client.getInstitutionProductUsersUsingGET>
      >
    | undefined
): void {
  (
    selfcareV2Client.getInstitutionProductUsersUsingGET as Mock
  ).mockImplementation(async () => value);
}

vi.doMock("pagopa-interop-api-clients", async (importActual) => {
  const actual = await importActual<
    typeof import("pagopa-interop-api-clients")
  >();
  return {
    ...actual,
    selfcareV2InstitutionClientBuilder: (): SelfcareV2InstitutionClient =>
      selfcareV2Client,
  };
});

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

export const mockClientRouterRequest =
  createMockedApiRequester<typeof authorizationApi.clientEndpoints>(app);

export const mockProducerKeyChainRouterRequest =
  createMockedApiRequester<typeof authorizationApi.producerKeychainEndpoints>(
    app
  );

export const mockTokenGenerationRouterRequest =
  createMockedApiRequester<typeof authorizationApi.tokenGenerationEndpoints>(
    app
  );
