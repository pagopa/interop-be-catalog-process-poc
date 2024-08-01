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
  ProducerKeychainKeyAddedV2,
  ProducerKeychainKey,
} from "pagopa-interop-models";
import { AuthData, genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockProducerKeychainKey,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test/index.js";
import { getMockProducerKeychain } from "pagopa-interop-commons-test";
import {
  authorizationApi,
  selfcareV2ClientApi,
} from "pagopa-interop-api-clients";
import {
  producerKeychainNotFound,
  invalidKey,
  keyAlreadyExists,
  userNotFound,
  userWithoutSecurityPrivileges,
  organizationNotAllowedOnProducerKeychain,
  tooManyKeysPerProducerKeychain,
} from "../src/model/domain/errors.js";
import { calculateKid, createJWK } from "../../commons/src/auth/jwk.js";
import {
  addOneProducerKeychain,
  authorizationService,
  postgresDB,
  selfcareV2Client,
} from "./utils.js";

describe("createProducerKeychainKeys", () => {
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

  const keysSeeds: authorizationApi.KeysSeed = [keySeed];

  function mockSelfcareV2ClientCall(
    value: Awaited<
      ReturnType<typeof selfcareV2Client.getInstitutionProductUsersUsingGET>
    >
  ): void {
    selfcareV2Client.getInstitutionProductUsersUsingGET = vi.fn(
      async () => value
    );
  }

  const mockSelfCareUsers: selfcareV2ClientApi.UserResource = {
    id: generateId(),
    name: "test",
    roles: [],
    email: "test@test.it",
    surname: "surname_test",
  };

  const mockAuthData: AuthData = {
    organizationId: producerId,
    selfcareId: generateId(),
    externalId: {
      value: "",
      origin: "",
    },
    userId,
    userRoles: [],
  };

  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    users: [userId],
    producerId,
  };

  it("should create the keys and add them to the producer keychain", async () => {
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneProducerKeychain(mockProducerKeychain);

    const producerKeychain =
      await authorizationService.createProducerKeychainKeys({
        producerKeychainId: mockProducerKeychain.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      });

    const writtenEvent = await readLastEventByStreamId(
      producerKeychain.id,
      '"authorization"',
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: producerKeychain.id,
      version: "1",
      type: "ProducerKeychainKeyAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainKeyAddedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.producerKeychainId).toEqual(producerKeychain.id);
    expect(writtenPayload.kid).toEqual(writtenPayload.kid);
  });
  it("should throw producerKeychainNotFound if the producer keychain doesn't exist ", async () => {
    await addOneProducerKeychain(getMockProducerKeychain());
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.createProducerKeychainKeys({
        producerKeychainId: mockProducerKeychain.id,
        authData: mockAuthData,
        keysSeeds,
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
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    expect(
      authorizationService.createProducerKeychainKeys({
        producerKeychainId: notProducerKeychain.id,
        authData: mockAuthData,
        keysSeeds,
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

    mockSelfcareV2ClientCall([]);

    expect(
      authorizationService.createProducerKeychainKeys({
        producerKeychainId: mockProducerKeychain.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      userWithoutSecurityPrivileges(mockAuthData.organizationId, userId)
    );
  });
  it("should throw tooManyKeysPerProducerKeychain if the keys number is greater than maxKeysPerProducerKeychain ", async () => {
    function get30Keys(): ProducerKeychainKey[] {
      return Array.from({ length: 100 }).map(getMockProducerKeychainKey);
    }
    const producerKeychainWith30Keys: ProducerKeychain = {
      ...getMockProducerKeychain(),
      keys: get30Keys(),
      producerId,
      users: [userId],
    };

    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneProducerKeychain(producerKeychainWith30Keys);

    expect(
      authorizationService.createProducerKeychainKeys({
        producerKeychainId: producerKeychainWith30Keys.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      tooManyKeysPerProducerKeychain(
        producerKeychainWith30Keys.id,
        producerKeychainWith30Keys.keys.length + keysSeeds.length
      )
    );
  });
  it("should throw userNotFound if the user doesn't exist ", async () => {
    const noUsersProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
    };

    await addOneProducerKeychain(noUsersProducerKeychain);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.createProducerKeychainKeys({
        producerKeychainId: noUsersProducerKeychain.id,
        authData: mockAuthData,
        keysSeeds,
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

    const keysSeeds: authorizationApi.KeysSeed = [keySeedByPrivateKey];

    await addOneProducerKeychain(mockProducerKeychain);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.createProducerKeychainKeys({
        producerKeychainId: mockProducerKeychain.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(notAllowedPrivateKeyException());
  });
  it("should throw keyAlreadyExists if the kid already exists in the keys of that producer keychain ", async () => {
    const key: ProducerKeychainKey = {
      ...getMockProducerKeychainKey(),
      kid: calculateKid(createJWK(keySeed.key)),
    };

    const producerKeychainWithDuplicateKey: ProducerKeychain = {
      ...mockProducerKeychain,
      keys: [key],
    };
    await addOneProducerKeychain(producerKeychainWithDuplicateKey);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    expect(
      authorizationService.createProducerKeychainKeys({
        producerKeychainId: producerKeychainWithDuplicateKey.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(keyAlreadyExists(key.kid));
  });
  it("should throw keyAlreadyExists if the kid already exists in the keys of a different producer keychain ", async () => {
    const key: ProducerKeychainKey = {
      ...getMockProducerKeychainKey(),
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

    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    expect(
      authorizationService.createProducerKeychainKeys({
        producerKeychainId: producerKeychain.id,
        authData: mockAuthData,
        keysSeeds,
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

    const keysSeeds: authorizationApi.KeysSeed = [keySeed];

    await addOneProducerKeychain(mockProducerKeychain);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.createProducerKeychainKeys({
        producerKeychainId: mockProducerKeychain.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(invalidKey());
  });
  it("should throw invalidKey if the key doesn't have the delimiters", async () => {
    const keySeed: authorizationApi.KeySeed = {
      name: "key seed",
      use: "ENC",
      key: `Ck1JSUJDZ0tDQVFFQXF1c1hpYUtuR2RmbnZyZ21WNDlGK2lJR0lOa0tUQ0FJQTZ0d3NVUzNzaWVxdXlQRk80QmMKcVhZSUE2cXZyWDJxc21hOElTS2RMbkt5azBFNXczQ0JOZmZCcUs2ZE9pYm5xZGxEVndnZDZEWm1HY2VWWWFoYQp6QnpqbFdXcllmNEUrTUNvZ1FiUEFYTytOa0Z0M1c3cVhMTFFCYzBYTXlIelQzTlBtQlpJTktRMS9hd05iR3dYCnJJSGlyVnBqZHVpNzJRb3hjR1VBMW5JallRTW9iQ3VBMHg1L3dFL29KblFZZ1g1NVg3SnRKaTQ2dmx0VlpiVVMKckZiWkdlRUIzMEF1NUV6a0U0NUpLVGpTZnVmclJEZDJzcFByKzJiYmFibFFsY1lSYnloaHVpeVR2cU1pSGZmKwplZ2JJNGpseVFSTExhUXdEeThzOHd2NDNWNUtzNmtmVGVRSURBUUFCCgo=`,
      alg: "",
    };

    const keysSeeds: authorizationApi.KeysSeed = [keySeed];

    await addOneProducerKeychain(mockProducerKeychain);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.createProducerKeychainKeys({
        producerKeychainId: mockProducerKeychain.id,
        authData: mockAuthData,
        keysSeeds,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      invalidKey(keySeed.key, "error:1E08010C:DECODER routines::unsupported")
    );
  });
});
