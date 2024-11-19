/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import crypto, { JsonWebKey } from "crypto";
import { createJWK, genericLogger } from "pagopa-interop-commons";
import { Client } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { getMockClient, getMockKey } from "pagopa-interop-commons-test";
import { authorizationApi } from "pagopa-interop-api-clients";
import {
  clientNotFound,
  clientKeyNotFound,
} from "../src/model/domain/errors.js";
import { clientToApiClient } from "../src/model/domain/apiConverter.js";
import { addOneClient, authorizationService } from "./utils.js";
import { mockTokenGenerationRouterRequest } from "./supertestSetup.js";

describe("getKeyWithClientByKeyId", async () => {
  it("should get the jwkKey with client by kid if it exists", async () => {
    const key = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }).publicKey;

    const base64Key = Buffer.from(
      key.export({ type: "pkcs1", format: "pem" })
    ).toString("base64url");

    const mockKey1 = { ...getMockKey(), encodedPem: base64Key };

    const jwk: JsonWebKey = createJWK(base64Key);

    const mockKey2 = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      keys: [mockKey1, mockKey2],
    };
    const expectedJwkKey: authorizationApi.JWKKey = {
      ...jwk,
      kty: jwk.kty!,
      kid: mockKey1.kid,
      use: "sig",
    };
    await addOneClient(mockClient);

    const { key: jwkKey, client } = await mockTokenGenerationRouterRequest.get({
      path: "/clients/:clientId/keys/:keyId/bundle",
      pathParams: { clientId: mockClient.id, keyId: mockKey1.kid },
    });

    expect(jwkKey).toEqual(expectedJwkKey);
    expect(client).toEqual(clientToApiClient(mockClient, { showUsers: false }));
  });

  it("should throw clientNotFound if the client doesn't exist", async () => {
    const mockKey = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
    };

    expect(
      authorizationService.getKeyWithClientByKeyId({
        clientId: mockClient.id,
        kid: mockKey.kid,
        logger: genericLogger,
      })
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw clientKeyNotFound if the key doesn't exist", async () => {
    const mockKey = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      keys: [getMockKey()],
    };
    await addOneClient(mockClient);

    expect(
      authorizationService.getKeyWithClientByKeyId({
        clientId: mockClient.id,
        kid: mockKey.kid,
        logger: genericLogger,
      })
    ).rejects.toThrowError(clientKeyNotFound(mockKey.kid, mockClient.id));
  });
});
