/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import crypto from "crypto";
import { fail } from "assert";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockTokenStatesClientPurposeEntry,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTokenStatesClientEntry,
  writeTokenStateEntry,
  writeTokenStateClientEntry,
  getMockClientAssertion,
} from "pagopa-interop-commons-test";
import {
  AgreementId,
  ClientId,
  clientKindTokenStates,
  EServiceId,
  GeneratedTokenAuditDetails,
  generateId,
  itemState,
  makeGSIPKKid,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  Purpose,
  PurposeId,
  purposeVersionState,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientPurposeEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { formatDateyyyyMMdd, genericLogger } from "pagopa-interop-commons";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import { config } from "../src/config/config.js";
import {
  clientAssertionRequestValidationFailed,
  clientAssertionSignatureValidationFailed,
  clientAssertionValidationFailed,
  fallbackAuditFailed,
  invalidTokenClientKidPurposeEntry,
  keyTypeMismatch,
  platformStateValidationFailed,
  tokenGenerationStatesEntryNotFound,
} from "../src/model/domain/errors.js";
import { inactiveEService } from "../../client-assertion-validation/dist/errors.js";
import {
  configTokenGenerationStates,
  dynamoDBClient,
  fileManager,
  getMockAccessTokenRequest,
  mockKMSClient,
  mockProducer,
  tokenService,
} from "./utils.js";

describe("authorization server tests", () => {
  if (!configTokenGenerationStates) {
    fail();
  }
  beforeEach(async () => {
    await buildDynamoDBTables(dynamoDBClient);
    mockKMSClient.send.mockImplementation(async () => ({
      Signature: "mock signature",
    }));
  });
  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
    vi.restoreAllMocks();
  });

  it("should throw clientAssertionRequestValidationFailed", async () => {
    const { jws } = await getMockClientAssertion();

    const clientId = generateId<ClientId>();
    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion_type: "wrong-client-assertion-type",
      client_assertion: jws,
      client_id: clientId,
    };
    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(clientAssertionRequestValidationFailed(clientId));
  });

  it("should throw clientAssertionValidationFailed", async () => {
    const { jws } = await getMockClientAssertion({
      standardClaimsOverride: { iat: undefined },
    });

    const clientId = generateId<ClientId>();
    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };
    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(clientAssertionValidationFailed(clientId));
  });

  it("should throw tokenGenerationStatesEntryNotFound", async () => {
    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();
    const { jws, clientAssertion } = await getMockClientAssertion({
      standardClaimsOverride: { sub: clientId },
      customClaims: { purposeId },
    });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const entryPK = makeTokenGenerationStatesClientKidPurposePK({
      clientId,
      kid: clientAssertion.header.kid!,
      purposeId,
    });
    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(tokenGenerationStatesEntryNotFound(entryPK));
  });

  it("should throw invalidTokenClientKidPurposeEntry", async () => {
    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion } = await getMockClientAssertion({
      standardClaimsOverride: { sub: clientId },
      customClaims: { purposeId },
    });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId,
      }
    );

    const tokenClientPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
      ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
      agreementId: undefined,
    };

    await writeTokenStateEntry(tokenClientPurposeEntry, dynamoDBClient);
    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(
      invalidTokenClientKidPurposeEntry(tokenClientPurposeEntry.PK)
    );
  });

  it("should throw keyTypeMismatch - clientKid entry with consumer kind", async () => {
    const clientId = generateId<ClientId>();
    const { jws, clientAssertion } = await getMockClientAssertion({
      standardClaimsOverride: { sub: clientId },
    });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
      clientId,
      kid: clientAssertion.header.kid!,
    });

    const tokenClientKidEntry: TokenGenerationStatesClientEntry = {
      ...getMockTokenStatesClientEntry(tokenClientKidPK),
      clientKind: clientKindTokenStates.consumer,
    };

    await writeTokenStateClientEntry(tokenClientKidEntry, dynamoDBClient);

    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(
      keyTypeMismatch(tokenClientKidEntry.PK, clientKindTokenStates.consumer)
    );
  });

  it("should throw keyTypeMismatch - clientKidPurpose entry with api kind", async () => {
    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion } = await getMockClientAssertion({
      standardClaimsOverride: { sub: clientId },
      customClaims: { purposeId },
    });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId,
      }
    );

    const tokenClientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
      {
        ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
        clientKind: clientKindTokenStates.api,
      };

    await writeTokenStateEntry(tokenClientKidPurposeEntry, dynamoDBClient);

    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(
      keyTypeMismatch(tokenClientKidPurposeEntry.PK, clientKindTokenStates.api)
    );
  });

  it("should throw clientAssertionSignatureValidationFailed", async () => {
    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion } = await getMockClientAssertion({
      standardClaimsOverride: { sub: clientId },
      customClaims: { purposeId },
    });

    const splitJws = jws.split(".");
    const jwsWithWrongSignature = `${splitJws[0]}.${splitJws[1]}.wrong-singature`;

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jwsWithWrongSignature,
      client_id: clientId,
    };

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId,
      }
    );

    const tokenClientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
      getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK);

    await writeTokenStateEntry(tokenClientKidPurposeEntry, dynamoDBClient);

    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(
      clientAssertionSignatureValidationFailed(request.client_id)
    );
  });

  it("should throw platformStateValidationFailed", async () => {
    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion, publicKeyEncodedPem } =
      await getMockClientAssertion({
        standardClaimsOverride: { sub: clientId },
        customClaims: { purposeId },
      });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId,
      }
    );

    const tokenClientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
      {
        ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
        descriptorState: itemState.inactive,
        publicKey: publicKeyEncodedPem,
      };

    await writeTokenStateEntry(tokenClientKidPurposeEntry, dynamoDBClient);

    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(
      platformStateValidationFailed([inactiveEService().detail])
    );
  });

  it("should block the request because of the rate limiter", async () => {
    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion, publicKeyEncodedPem } =
      await getMockClientAssertion({
        standardClaimsOverride: { sub: clientId },
        customClaims: { purposeId },
      });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId,
      }
    );

    const tokenClientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
      {
        ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
        publicKey: publicKeyEncodedPem,
      };

    await writeTokenStateEntry(tokenClientKidPurposeEntry, dynamoDBClient);
    // eslint-disable-next-line functional/no-let
    for (let i = 0; i < config.rateLimiterMaxRequests; i++) {
      const response = await tokenService.generateToken(
        request,
        generateId(),
        genericLogger
      );
      expect(response.limitReached).toBe(false);
      expect(response.rateLimiterStatus.remainingRequests).toBe(
        config.rateLimiterMaxRequests - i - 1
      );
    }

    const responseAfterLimitExceeded = await tokenService.generateToken(
      request,
      generateId(),
      genericLogger
    );

    expect(responseAfterLimitExceeded).toEqual({
      limitReached: true,
      rateLimitedTenantId: tokenClientKidPurposeEntry.consumerId,
      token: undefined,
      rateLimiterStatus: {
        maxRequests: config.rateLimiterMaxRequests,
        rateInterval: config.rateLimiterRateInterval,
        remainingRequests: 0,
      },
    });
  });

  it("should throw error during token signing - consumer key", async () => {
    const uuid = crypto.randomUUID();
    const uuidSpy = vi.spyOn(crypto, "randomUUID");
    uuidSpy.mockReturnValue(uuid);

    mockKMSClient.send.mockImplementationOnce(() =>
      Promise.resolve({ signature: undefined })
    );

    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion, publicKeyEncodedPem } =
      await getMockClientAssertion({
        standardClaimsOverride: { sub: clientId },
        customClaims: { purposeId },
      });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId,
      }
    );

    const tokenClientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
      {
        ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
        clientKind: clientKindTokenStates.consumer,
        publicKey: publicKeyEncodedPem,
      };

    await writeTokenStateEntry(tokenClientKidPurposeEntry, dynamoDBClient);

    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(
      Error("JWT Signature failed. Empty signature returned")
    );
  });

  it("should throw tokenSigningFailed - api key", async () => {
    const uuid = crypto.randomUUID();
    const uuidSpy = vi.spyOn(crypto, "randomUUID");
    uuidSpy.mockReturnValue(uuid);

    mockKMSClient.send.mockImplementationOnce(() =>
      Promise.resolve({ signature: undefined })
    );

    const clientId = generateId<ClientId>();

    const { jws, clientAssertion, publicKeyEncodedPem } =
      await getMockClientAssertion({
        standardClaimsOverride: { sub: clientId },
      });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
      clientId,
      kid: clientAssertion.header.kid!,
    });

    const tokenClientKidEntry: TokenGenerationStatesClientEntry = {
      ...getMockTokenStatesClientEntry(tokenClientKidPK),
      clientKind: clientKindTokenStates.api,
      publicKey: publicKeyEncodedPem,
    };

    await writeTokenStateClientEntry(tokenClientKidEntry, dynamoDBClient);

    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(
      Error("JWT Signature failed. Empty signature returned")
    );
  });

  it("should throw fallbackAuditFailed - consumer key - kafka audit failed and fallback audit failed", async () => {
    const uuid = crypto.randomUUID();
    const uuidSpy = vi.spyOn(crypto, "randomUUID");
    uuidSpy.mockReturnValue(uuid);

    mockProducer.send.mockImplementationOnce(async () => Promise.reject());
    vi.spyOn(fileManager, "storeBytes").mockImplementationOnce(() =>
      Promise.reject()
    );

    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion, publicKeyEncodedPem } =
      await getMockClientAssertion({
        standardClaimsOverride: { sub: clientId },
        customClaims: { purposeId },
      });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId,
      }
    );

    const tokenClientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
      {
        ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
        publicKey: publicKeyEncodedPem,
      };

    await writeTokenStateEntry(tokenClientKidPurposeEntry, dynamoDBClient);

    expect(
      tokenService.generateToken(request, generateId(), genericLogger)
    ).rejects.toThrowError(fallbackAuditFailed(clientId));
  });

  it("should succeed - consumer key - kafka audit failed and fallback audit succeeded", async () => {
    mockProducer.send.mockImplementation(async () => Promise.reject());

    const purposeId = generateId<PurposeId>();
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion, publicKeyEncodedPem } =
      await getMockClientAssertion({
        standardClaimsOverride: { sub: clientId },
        customClaims: { purposeId },
      });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId,
      }
    );

    const tokenClientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
      {
        ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
        publicKey: publicKeyEncodedPem,
      };

    await writeTokenStateEntry(tokenClientKidPurposeEntry, dynamoDBClient);

    const fileListBeforeAudit = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(fileListBeforeAudit).toHaveLength(0);

    const uuid = crypto.randomUUID();
    const uuidSpy = vi.spyOn(crypto, "randomUUID");
    uuidSpy.mockReturnValue(uuid);

    const correlationId = generateId();
    const response = await tokenService.generateToken(
      request,
      correlationId,
      genericLogger
    );

    const date = new Date();
    const ymdDate = formatDateyyyyMMdd(date);

    const fileListAfterAudit = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(fileListAfterAudit).toHaveLength(1);
    const file = fileListAfterAudit[0];
    const split = file.split("_");
    expect(split[0]).toEqual(`token-details/${ymdDate}/${ymdDate}`);

    const fileContent = await fileManager.get(
      config.s3Bucket,
      file,
      genericLogger
    );

    const decodedFileContent = new TextDecoder().decode(fileContent);
    const parsedDecodedFileContent = JSON.parse(decodedFileContent);

    const expectedMessageBody: GeneratedTokenAuditDetails = {
      jwtId: generateId(),
      correlationId,
      issuedAt: parsedDecodedFileContent.issuedAt,
      clientId,
      organizationId: tokenClientKidPurposeEntry.consumerId,
      agreementId: unsafeBrandId<AgreementId>(
        tokenClientKidPurposeEntry.agreementId!
      ),
      eserviceId: unsafeBrandId<EServiceId>(
        tokenClientKidPurposeEntry.GSIPK_eserviceId_descriptorId!.split("#")[0]
      ),
      descriptorId: unsafeBrandId(
        tokenClientKidPurposeEntry.GSIPK_eserviceId_descriptorId!.split("#")[1]
      ),
      purposeId: tokenClientKidPurposeEntry.GSIPK_purposeId!,
      purposeVersionId: tokenClientKidPurposeEntry.purposeVersionId!,
      algorithm: "RS256",
      keyId: config.generatedInteropTokenKid,
      audience: tokenClientKidPurposeEntry.descriptorAudience!.join(","),
      subject: clientId,
      notBefore: parsedDecodedFileContent.notBefore,
      expirationTime: parsedDecodedFileContent.expirationTime,
      issuer: config.generatedInteropTokenIssuer,
      clientAssertion: {
        algorithm: clientAssertion.header.alg,
        audience: [clientAssertion.payload.aud].flat().join(","),
        expirationTime: clientAssertion.payload.exp!,
        issuedAt: clientAssertion.payload.iat!,
        issuer: clientAssertion.payload.iss!,
        jwtId: clientAssertion.payload.jti!,
        keyId: clientAssertion.header.kid!,
        subject: unsafeBrandId(clientAssertion.payload.sub!),
      },
    };
    expect(parsedDecodedFileContent).toEqual(expectedMessageBody);
    expect(response.limitReached).toBe(false);
    expect(response.token).toBeDefined(); // TODO check expected token?
    expect(response.rateLimiterStatus).toEqual({
      maxRequests: config.rateLimiterMaxRequests,
      rateInterval: config.rateLimiterRateInterval,
      remainingRequests: config.rateLimiterMaxRequests - 1,
    });
  });

  it("should succeed - consumer key - kafka audit succeeded", async () => {
    mockProducer.send.mockImplementationOnce(async () => [
      { topic: config.tokenAuditingTopic, partition: 0, errorCode: 0 },
    ]);
    mockKMSClient.send.mockImplementationOnce(async () => ({
      Signature: "mock signature",
    }));

    vi.spyOn(mockProducer, "send");
    vi.spyOn(fileManager, "storeBytes");

    const purpose: Purpose = {
      ...getMockPurpose(),
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };
    const clientId = generateId<ClientId>();

    const { jws, clientAssertion, publicKeyEncodedPem } =
      await getMockClientAssertion({
        standardClaimsOverride: {
          sub: clientId,
        },
        customClaims: { purposeId: purpose.id },
      });

    const tokenClientKidPurposePK = makeTokenGenerationStatesClientKidPurposePK(
      {
        clientId,
        kid: clientAssertion.header.kid!,
        purposeId: purpose.id,
      }
    );
    const tokenClientPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
      ...getMockTokenStatesClientPurposeEntry(tokenClientKidPurposePK),
      consumerId: purpose.consumerId,
      GSIPK_purposeId: purpose.id,
      purposeState: itemState.active,
      purposeVersionId: purpose.versions[0].id,
      agreementState: itemState.active,
      descriptorState: itemState.active,
      GSIPK_clientId: clientId,
      GSIPK_kid: makeGSIPKKid(clientAssertion.header.kid!),
      publicKey: publicKeyEncodedPem,
    };

    await writeTokenStateEntry(tokenClientPurposeEntry, dynamoDBClient);

    const request = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const uuid = crypto.randomUUID();
    const uuidSpy = vi.spyOn(crypto, "randomUUID");
    uuidSpy.mockReturnValue(uuid);

    const correlationId = generateId();
    const result = await tokenService.generateToken(
      request,
      correlationId,
      genericLogger
    );

    expect(result.token).toBeDefined();

    expect(result.limitReached).toBe(false);
    expect(result.token).toBeDefined(); // TODO check expected token?
    expect(result.rateLimiterStatus).toEqual({
      maxRequests: config.rateLimiterMaxRequests,
      rateInterval: config.rateLimiterRateInterval,
      remainingRequests: config.rateLimiterMaxRequests - 1,
    });

    const fileList = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(fileList).toHaveLength(0);
    expect(fileManager.storeBytes).not.toHaveBeenCalled();

    const actualMessageSent = mockProducer.send.mock.calls[0][0]
      .messages[0] as { key: string; value: string };

    const parsedAuditSent = JSON.parse(actualMessageSent.value);

    const expectedMessageBody: GeneratedTokenAuditDetails = {
      jwtId: generateId(),
      correlationId,
      issuedAt: parsedAuditSent.issuedAt,
      clientId,
      organizationId: tokenClientPurposeEntry.consumerId,
      agreementId: unsafeBrandId<AgreementId>(
        tokenClientPurposeEntry.agreementId!
      ),
      eserviceId: unsafeBrandId<EServiceId>(
        tokenClientPurposeEntry.GSIPK_eserviceId_descriptorId!.split("#")[0]
      ),
      descriptorId: unsafeBrandId(
        tokenClientPurposeEntry.GSIPK_eserviceId_descriptorId!.split("#")[1]
      ),
      purposeId: tokenClientPurposeEntry.GSIPK_purposeId!,
      purposeVersionId: tokenClientPurposeEntry.purposeVersionId!,
      algorithm: "RS256",
      keyId: config.generatedInteropTokenKid,
      audience: tokenClientPurposeEntry.descriptorAudience!.join(","),
      subject: clientId,
      notBefore: parsedAuditSent.notBefore,
      expirationTime: parsedAuditSent.expirationTime,
      issuer: config.generatedInteropTokenIssuer,
      clientAssertion: {
        algorithm: clientAssertion.header.alg,
        audience: [clientAssertion.payload.aud].flat().join(","),
        expirationTime: clientAssertion.payload.exp!,
        issuedAt: clientAssertion.payload.iat!,
        issuer: clientAssertion.payload.iss!,
        jwtId: clientAssertion.payload.jti!,
        keyId: clientAssertion.header.kid!,
        subject: unsafeBrandId(clientAssertion.payload.sub!),
      },
    };

    expect(parsedAuditSent).toEqual(expectedMessageBody);
  });

  it("should succeed - api key - no audit", async () => {
    vi.spyOn(fileManager, "storeBytes");

    const clientId = generateId<ClientId>();

    const { jws, clientAssertion, publicKeyEncodedPem } =
      await getMockClientAssertion({
        standardClaimsOverride: { sub: clientId },
      });

    const request: authorizationServerApi.AccessTokenRequest = {
      ...(await getMockAccessTokenRequest()),
      client_assertion: jws,
      client_id: clientId,
    };

    const tokenClientKidK = makeTokenGenerationStatesClientKidPK({
      clientId,
      kid: clientAssertion.header.kid!,
    });

    const tokenClientKidEntry: TokenGenerationStatesClientEntry = {
      ...getMockTokenStatesClientEntry(tokenClientKidK),
      clientKind: clientKindTokenStates.api,
      publicKey: publicKeyEncodedPem,
    };

    await writeTokenStateClientEntry(tokenClientKidEntry, dynamoDBClient);

    const fileListBefore = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(fileListBefore).toHaveLength(0);

    const response = await tokenService.generateToken(
      request,
      generateId(),
      genericLogger
    );

    const fileListAfter = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(fileListAfter).toHaveLength(0);
    expect(fileManager.storeBytes).not.toHaveBeenCalled();

    expect(response.limitReached).toBe(false);
    expect(response.token).toBeDefined(); // TODO check expected token?
    expect(response.rateLimiterStatus).toEqual({
      maxRequests: config.rateLimiterMaxRequests,
      rateInterval: config.rateLimiterRateInterval,
      remainingRequests: config.rateLimiterMaxRequests - 1,
    });
  });
});
