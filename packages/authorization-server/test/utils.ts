import crypto from "crypto";
import { setupTestContainersVitest } from "pagopa-interop-commons-test/index.js";
import {
  ClientId,
  generateId,
  TokenGenerationStatesClientEntry,
} from "pagopa-interop-models";
import { afterEach, inject, vi } from "vitest";
import {
  DynamoDBClient,
  PutItemCommand,
  PutItemInput,
} from "@aws-sdk/client-dynamodb";
import { KMSClient } from "@aws-sdk/client-kms";
import { initProducer } from "kafka-iam-auth";
import * as jose from "jose";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  tokenGenerationCommonReadModelServiceBuilder,
  TokenGenerationReadModelRepository,
} from "pagopa-interop-commons";
import { tokenServiceBuilder } from "../src/services/tokenService.js";

export const configTokenGenerationStates = inject(
  "tokenGenerationReadModelConfig"
);

export const { cleanup, fileManager, redisRateLimiter } =
  await setupTestContainersVitest(
    undefined,
    undefined,
    inject("fileManagerConfig"),
    undefined,
    inject("redisRateLimiterConfig")
  );

afterEach(cleanup);

if (configTokenGenerationStates === undefined) {
  throw new Error("configTokenGenerationStates is undefined");
}

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${configTokenGenerationStates.tokenGenerationReadModelDbPort}`,
});

export const mockProducer = {
  send: vi.fn(),
};
export const mockKMSClient = {
  send: vi.fn(),
};

export const tokenService = tokenServiceBuilder({
  dynamoDBClient,
  kmsClient: mockKMSClient as unknown as KMSClient,
  redisRateLimiter,
  producer: mockProducer as unknown as Awaited<ReturnType<typeof initProducer>>,
  fileManager,
});

const tokenGenerationReadModelRepository =
  TokenGenerationReadModelRepository.init({
    dynamoDBClient,
    platformStatesTableName:
      configTokenGenerationStates.tokenGenerationReadModelTableNamePlatform,
    tokenGenerationStatesTableName:
      configTokenGenerationStates.tokenGenerationReadModelTableNameTokenGeneration,
  });

export const tokenGenerationCommonReadModelService =
  tokenGenerationCommonReadModelServiceBuilder(
    tokenGenerationReadModelRepository
  );

// TODO: copied from client-assertion-validation
export const generateKeySet = (): {
  keySet: crypto.KeyPairKeyObjectResult;
  publicKeyEncodedPem: string;
} => {
  const keySet: crypto.KeyPairKeyObjectResult = crypto.generateKeyPairSync(
    "rsa",
    {
      modulusLength: 2048,
    }
  );

  const pemPublicKey = keySet.publicKey
    .export({
      type: "spki",
      format: "pem",
    })
    .toString();

  const publicKeyEncodedPem = Buffer.from(pemPublicKey).toString("base64");
  return {
    keySet,
    publicKeyEncodedPem,
  };
};

const signClientAssertion = async ({
  payload,
  headers,
  keySet,
}: {
  payload: jose.JWTPayload;
  headers: jose.JWTHeaderParameters;
  keySet: crypto.KeyPairKeyObjectResult;
}): Promise<string> => {
  const pemPrivateKey = keySet.privateKey.export({
    type: "pkcs8",
    format: "pem",
  });

  const privateKey = await jose.importPKCS8(
    Buffer.isBuffer(pemPrivateKey)
      ? pemPrivateKey.toString("utf8")
      : pemPrivateKey,
    "RS256"
  );

  return await new jose.SignJWT(payload)
    .setProtectedHeader(headers)
    .sign(privateKey);
};

export const getMockClientAssertion = async (props?: {
  standardClaimsOverride?: Partial<jose.JWTPayload>;
  customClaims?: { [k: string]: unknown };
  customHeader?: { [k: string]: unknown };
}): Promise<{
  jws: string;
  clientAssertion: {
    payload: jose.JWTPayload;
    header: jose.JWTHeaderParameters;
  };
  publicKeyEncodedPem: string;
}> => {
  const { keySet, publicKeyEncodedPem } = generateKeySet();

  const threeHourLater = new Date();
  threeHourLater.setHours(threeHourLater.getHours() + 3);

  const clientId = generateId<ClientId>();
  const defaultPayload: jose.JWTPayload = {
    iss: clientId,
    sub: clientId,
    aud: ["test.interop.pagopa.it", "dev.interop.pagopa.it"],
    exp: threeHourLater.getTime() / 1000,
    jti: generateId(),
    iat: new Date().getTime() / 1000,
  };

  const actualPayload: jose.JWTPayload = {
    ...defaultPayload,
    ...props?.standardClaimsOverride,
    ...props?.customClaims,
  };

  const headers: jose.JWTHeaderParameters = {
    alg: "RS256",
    kid: "kid",
    ...props?.customHeader,
  };

  const jws = await signClientAssertion({
    payload: actualPayload,
    headers,
    keySet,
  });

  return {
    jws,
    clientAssertion: {
      payload: actualPayload,
      header: headers,
    },
    publicKeyEncodedPem,
  };
};

export const getMockAccessTokenRequest =
  async (): Promise<authorizationServerApi.AccessTokenRequest> => {
    const { jws } = await getMockClientAssertion();
    return {
      client_id: generateId<ClientId>(),
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: jws,
      grant_type: "client_credentials",
    };
  };

// export const generateExpectedInteropToken = async (
//   jws: string,
//   clientId: ClientId
// ): Promise<InteropToken> => {
//   const { data: jwt } = verifyClientAssertion(jws, clientId);
//   if (!jwt) {
//     fail();
//   }

//   const currentTimestamp = Date.now();
//   const token: InteropToken = {
//     header: {
//       alg: "RS256",
//       use: "sig",
//       typ: "at+jwt",
//       kid: config.generatedInteropTokenKid,
//     },
//     payload: {
//       jti: generateId(),
//       iss: config.generatedInteropTokenIssuer,
//       aud: jwt.payload.aud,
//       sub: jwt.payload.sub,
//       iat: currentTimestamp,
//       nbf: currentTimestamp,
//       exp: currentTimestamp + tokenDurationInSeconds * 1000,
//     },
//     serialized: "",
//   };
// };

// TODO this is duplicated: move to commons
export const writeTokenStateClientEntry = async (
  tokenStateEntry: TokenGenerationStatesClientEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: tokenStateEntry.PK,
      },
      updatedAt: {
        S: tokenStateEntry.updatedAt,
      },
      consumerId: {
        S: tokenStateEntry.consumerId,
      },
      clientKind: {
        S: tokenStateEntry.clientKind,
      },
      publicKey: {
        S: tokenStateEntry.publicKey,
      },
      GSIPK_clientId: {
        S: tokenStateEntry.GSIPK_clientId,
      },
      GSIPK_kid: {
        S: tokenStateEntry.GSIPK_kid,
      },
    },
    TableName: "token-generation-states",
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};
