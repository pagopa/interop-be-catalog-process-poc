import {
  createMockedApiRequester,
  mockAuthenticationMiddleware,
} from "pagopa-interop-commons-test";
import { inject, vi } from "vitest";
import { DB } from "pagopa-interop-commons";
import {
  authorizationApi,
  SelfcareV2InstitutionClient,
} from "pagopa-interop-api-clients";
import { postgresDB, selfcareV2Client } from "./utils.js";

const mockGetInstitutionProductUsersUsingGET = vi.fn();
export function mockSelfcareV2ClientCall({
  value,
  mockedFor,
}: {
  value: Awaited<
    ReturnType<typeof selfcareV2Client.getInstitutionProductUsersUsingGET>
  >;
  mockedFor: "Router" | "Service";
}): void {
  if (mockedFor === "Router") {
    mockGetInstitutionProductUsersUsingGET.mockImplementation(
      async () => value
    );
  } else {
    selfcareV2Client.getInstitutionProductUsersUsingGET = vi.fn(
      async () => value
    );
  }
}

vi.doMock("pagopa-interop-api-clients", async (importActual) => {
  const actual = await importActual<
    typeof import("pagopa-interop-api-clients")
  >();
  return {
    ...actual,
    selfcareV2InstitutionClientBuilder: (): SelfcareV2InstitutionClient =>
      ({
        getInstitutionProductUsersUsingGET:
          mockGetInstitutionProductUsersUsingGET,
      } as unknown as SelfcareV2InstitutionClient),
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
