/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
import crypto from "crypto";
import { describe, it, vi, beforeAll, afterAll, expect } from "vitest";
import {
  TenantId,
  UserId,
  generateId,
  notAllowedPrivateKeyException,
  ProducerKeychain,
  Key,
  ProducerKeychainKeyAddedV2,
  invalidKey,
  toProducerKeychainV2,
  Client,
} from "pagopa-interop-models";
import {
  AuthData,
  genericLogger,
  calculateKid,
  createJWK,
} from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockClient,
  getMockKey,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test/index.js";
import { getMockProducerKeychain } from "pagopa-interop-commons-test";
import {
  authorizationApi,
  selfcareV2ClientApi,
} from "pagopa-interop-api-clients";
import {
  producerKeychainNotFound,
  keyAlreadyExists,
  userNotFound,
  userWithoutSecurityPrivileges,
  organizationNotAllowedOnProducerKeychain,
  tooManyKeysPerProducerKeychain,
} from "../src/model/domain/errors.js";
import {
  addOneClient,
  addOneProducerKeychain,
  authorizationService,
  postgresDB,
} from "./utils.js";
import {
  mockProducerKeyChainRouterRequest,
  mockSelfcareV2ClientCall,
} from "./supertestSetup.js";

describe("createProducerKeychainKey", () => {
  const producerId: TenantId = generateId();
  const userId: UserId = generateId();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const key = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }).publicKey;

  const base64Key = Buffer.from(
    key.export({ type: "pkcs1", format: "pem" })
  ).toString("base64url");

  const keySeed: authorizationApi.KeySeed = {
    name: "key seed",
    use: "ENC",
    key: base64Key,
    alg: "",
  };

  const mockSelfCareUsers: selfcareV2ClientApi.UserResource = {
    id: generateId(),
    name: "test",
    roles: [],
    email: "test@test.it",
    surname: "surname_test",
  };

  const mockAuthData: AuthData = {
    ...getMockAuthData(),
    organizationId: producerId,
    userId,
  };

  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    users: [userId],
    producerId,
  };

  it("should create the keys and add them to the producer keychain", async () => {
    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Router",
    });
    await addOneProducerKeychain(mockProducerKeychain);

    await mockProducerKeyChainRouterRequest.post({
      path: "/producerKeychains/:producerKeychainId/keys",
      body: { ...keySeed },
      pathParams: { producerKeychainId: mockProducerKeychain.id },
      authData: mockAuthData,
    });

    const writtenEvent = await readLastEventByStreamId(
      mockProducerKeychain.id,
      '"authorization"',
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockProducerKeychain.id,
      version: "1",
      type: "ProducerKeychainKeyAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainKeyAddedV2,
      payload: writtenEvent.data,
    });

    const expectedProducerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      keys: [
        {
          name: keySeed.name,
          createdAt: new Date(),
          kid: writtenPayload.kid,
          encodedPem: keySeed.key,
          algorithm: keySeed.alg,
          use: "Enc",
          userId,
        },
      ],
    };

    expect(writtenPayload.producerKeychain).toEqual(
      toProducerKeychainV2(expectedProducerKeychain)
    );
    expect(writtenPayload.kid).toEqual(writtenPayload.kid);
  });
  it("should throw producerKeychainNotFound if the producer keychain doesn't exist ", async () => {
    await addOneProducerKeychain(getMockProducerKeychain());

    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Service",
    });

    expect(
      authorizationService.createProducerKeychainKey({
        producerKeychainId: mockProducerKeychain.id,
        authData: mockAuthData,
        keySeed,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(producerKeychainNotFound(mockProducerKeychain.id));
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the consumer", async () => {
    const notProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: generateId(),
    };

    await addOneProducerKeychain(notProducerKeychain);

    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Service",
    });

    expect(
      authorizationService.createProducerKeychainKey({
        producerKeychainId: notProducerKeychain.id,
        authData: mockAuthData,
        keySeed,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnProducerKeychain(
        producerId,
        notProducerKeychain.id
      )
    );
  });
  it("should throw userWithoutSecurityPrivileges if the Security user is not found", async () => {
    await addOneProducerKeychain(mockProducerKeychain);

    mockSelfcareV2ClientCall({
      value: [],
      mockedFor: "Service",
    });

    expect(
      authorizationService.createProducerKeychainKey({
        producerKeychainId: mockProducerKeychain.id,
        authData: mockAuthData,
        keySeed,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      userWithoutSecurityPrivileges(mockAuthData.organizationId, userId)
    );
  });
  it("should throw tooManyKeysPerProducerKeychain if the keys number is greater than maxKeysPerProducerKeychain ", async () => {
    function get30Keys(): Key[] {
      return Array.from({ length: 100 }).map(getMockKey);
    }
    const producerKeychainWith30Keys: ProducerKeychain = {
      ...getMockProducerKeychain(),
      keys: get30Keys(),
      producerId,
      users: [userId],
    };

    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Service",
    });

    await addOneProducerKeychain(producerKeychainWith30Keys);

    expect(
      authorizationService.createProducerKeychainKey({
        producerKeychainId: producerKeychainWith30Keys.id,
        authData: mockAuthData,
        keySeed,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      tooManyKeysPerProducerKeychain(
        producerKeychainWith30Keys.id,
        producerKeychainWith30Keys.keys.length + 1
      )
    );
  });
  it("should throw userNotFound if the user doesn't exist ", async () => {
    const noUsersProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
    };

    await addOneProducerKeychain(noUsersProducerKeychain);

    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Service",
    });

    expect(
      authorizationService.createProducerKeychainKey({
        producerKeychainId: noUsersProducerKeychain.id,
        authData: mockAuthData,
        keySeed,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      userNotFound(mockAuthData.userId, mockAuthData.selfcareId)
    );
  });
  it("should throw notAllowedPrivateKeyException if the key is a private key", async () => {
    const privateKey = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }).privateKey;

    const privateBase64Key = Buffer.from(
      privateKey.export({ type: "pkcs1", format: "pem" })
    ).toString("base64url");

    const keySeedByPrivateKey: authorizationApi.KeySeed = {
      name: "key seed",
      use: "ENC",
      key: privateBase64Key,
      alg: "",
    };

    await addOneProducerKeychain(mockProducerKeychain);

    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Service",
    });

    expect(
      authorizationService.createProducerKeychainKey({
        producerKeychainId: mockProducerKeychain.id,
        authData: mockAuthData,
        keySeed: keySeedByPrivateKey,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(notAllowedPrivateKeyException());
  });
  it("should throw keyAlreadyExists if the kid already exists in the keys of that producer keychain ", async () => {
    const key: Key = {
      ...getMockKey(),
      kid: calculateKid(createJWK(keySeed.key)),
    };

    const producerKeychainWithDuplicateKey: ProducerKeychain = {
      ...mockProducerKeychain,
      keys: [key],
    };
    await addOneProducerKeychain(producerKeychainWithDuplicateKey);

    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Service",
    });

    expect(
      authorizationService.createProducerKeychainKey({
        producerKeychainId: producerKeychainWithDuplicateKey.id,
        authData: mockAuthData,
        keySeed,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(keyAlreadyExists(key.kid));
  });
  it("should throw keyAlreadyExists if the kid already exists in the keys of a different producer keychain ", async () => {
    const key: Key = {
      ...getMockKey(),
      kid: calculateKid(createJWK(keySeed.key)),
    };

    const producerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      id: generateId(),
    };

    const producerKeychainWithDuplicateKey: ProducerKeychain = {
      ...mockProducerKeychain,
      id: generateId(),
      keys: [key],
    };
    await addOneProducerKeychain(producerKeychain);
    await addOneProducerKeychain(producerKeychainWithDuplicateKey);

    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Service",
    });

    expect(
      authorizationService.createProducerKeychainKey({
        producerKeychainId: producerKeychain.id,
        authData: mockAuthData,
        keySeed,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(keyAlreadyExists(key.kid));
  });
  it("should throw keyAlreadyExists if the kid already exists in a client", async () => {
    const key: Key = {
      ...getMockKey(),
      kid: calculateKid(createJWK(keySeed.key)),
    };

    const producerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      id: generateId(),
    };

    const clientWithDuplicateKey: Client = { ...getMockClient(), keys: [key] };
    await addOneProducerKeychain(producerKeychain);
    await addOneClient(clientWithDuplicateKey);

    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Service",
    });

    expect(
      authorizationService.createProducerKeychainKey({
        producerKeychainId: producerKeychain.id,
        authData: mockAuthData,
        keySeed,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(keyAlreadyExists(key.kid));
  });
  it("should throw invalidKey if the key is not an RSA key", async () => {
    const notRSAKey = crypto.generateKeyPairSync("ed25519", {
      modulusLength: 2048,
    }).publicKey;

    const notRSAPemKey = Buffer.from(
      notRSAKey.export({ type: "spki", format: "pem" })
    ).toString("base64url");

    const keySeed: authorizationApi.KeySeed = {
      name: "key seed",
      use: "ENC",
      key: notRSAPemKey,
      alg: "",
    };

    await addOneProducerKeychain(mockProducerKeychain);

    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Service",
    });

    expect(
      authorizationService.createProducerKeychainKey({
        producerKeychainId: mockProducerKeychain.id,
        authData: mockAuthData,
        keySeed,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(invalidKey(keySeed.key, "Not an RSA key"));
  });
  it("should throw invalidKey if the key doesn't have the delimiters", async () => {
    const keySeed: authorizationApi.KeySeed = {
      name: "key seed",
      use: "ENC",
      key: `Ck1JSUJDZ0tDQVFFQXF1c1hpYUtuR2RmbnZyZ21WNDlGK2lJR0lOa0tUQ0FJQTZ0d3NVUzNzaWVxdXlQRk80QmMKcVhZSUE2cXZyWDJxc21hOElTS2RMbkt5azBFNXczQ0JOZmZCcUs2ZE9pYm5xZGxEVndnZDZEWm1HY2VWWWFoYQp6QnpqbFdXcllmNEUrTUNvZ1FiUEFYTytOa0Z0M1c3cVhMTFFCYzBYTXlIelQzTlBtQlpJTktRMS9hd05iR3dYCnJJSGlyVnBqZHVpNzJRb3hjR1VBMW5JallRTW9iQ3VBMHg1L3dFL29KblFZZ1g1NVg3SnRKaTQ2dmx0VlpiVVMKckZiWkdlRUIzMEF1NUV6a0U0NUpLVGpTZnVmclJEZDJzcFByKzJiYmFibFFsY1lSYnloaHVpeVR2cU1pSGZmKwplZ2JJNGpseVFSTExhUXdEeThzOHd2NDNWNUtzNmtmVGVRSURBUUFCCgo=`,
      alg: "",
    };

    await addOneProducerKeychain(mockProducerKeychain);

    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Service",
    });

    expect(
      authorizationService.createProducerKeychainKey({
        producerKeychainId: mockProducerKeychain.id,
        authData: mockAuthData,
        keySeed,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      invalidKey(keySeed.key, "error:1E08010C:DECODER routines::unsupported")
    );
  });
});
