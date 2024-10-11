import {
  ApiKey,
  ClientAssertion,
  ConsumerKey,
  validateClientKindAndPlatformState,
  validateRequestParameters,
  verifyClientAssertion,
  verifyClientAssertionSignature,
} from "pagopa-interop-client-assertion-validation";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  clientKidPrefix,
  clientKidPurposePrefix,
  clientKindTokenStates,
  EServiceId,
  generateId,
  genericInternalError,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesClientPurposeEntry,
  TokenGenerationStatesGenericEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { match } from "ts-pattern";
import { b64ByteUrlEncode, b64UrlEncode } from "pagopa-interop-commons";
import { KMSClient, SignCommand, SignCommandInput } from "@aws-sdk/client-kms";
import {
  InteropJwtHeader,
  InteropJwtPayload,
  InteropToken,
} from "./model/domain/models.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tokenServiceBuilder(
  dynamoDBClient: DynamoDBClient,
  kmsClient: KMSClient
) {
  return {
    async generateToken(
      request: authorizationServerApi.AccessTokenRequest
    ): Promise<boolean> {
      const { errors: parametersErrors } = validateRequestParameters({
        client_assertion: request.client_assertion,
        client_assertion_type: request.client_assertion_type,
        grant_type: request.grant_type,
        client_id: request.client_id,
      });

      const { data: jwt, errors: clientAssertionErrors } =
        verifyClientAssertion(request.client_assertion, request.client_id);

      if (parametersErrors || clientAssertionErrors) {
        return Promise.resolve(false);
      }

      const clientId = jwt.payload.sub;
      const kid = jwt.header.kid;
      const purposeId = jwt.payload.purposeId;

      const pk = purposeId
        ? makeTokenGenerationStatesClientKidPurposePK({
            clientId,
            kid,
            purposeId,
          })
        : makeTokenGenerationStatesClientKidPK({ clientId, kid });

      const key = await retrieveKey(dynamoDBClient, pk);

      const { errors: clientSignatureErrors } = verifyClientAssertionSignature(
        request.client_assertion,
        key
      );
      if (clientSignatureErrors) {
        return Promise.resolve(false);
      }

      const { errors: platformStateErrors } =
        validateClientKindAndPlatformState(key, jwt);
      if (platformStateErrors) {
        return Promise.resolve(false);
      }

      await actualGenerateToken(kmsClient, jwt, [], 0, {});
      return false;
    },
  };
}

export type TokenService = ReturnType<typeof tokenServiceBuilder>;

export const retrieveKey = async (
  dynamoDBClient: DynamoDBClient,
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): Promise<ConsumerKey | ApiKey> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: "token-generation-states",
  };

  try {
    // TODO should we use try/catch in every dynamoDB query?
    const command = new GetItemCommand(input);
    const data: GetItemCommandOutput = await dynamoDBClient.send(command);

    if (!data.Item) {
      throw genericInternalError("key not found");
    } else {
      const unmarshalled = unmarshall(data.Item);
      const tokenGenerationEntry =
        TokenGenerationStatesGenericEntry.safeParse(unmarshalled);

      if (!tokenGenerationEntry.success) {
        throw genericInternalError(
          `Unable to parse token generation entry item: result ${JSON.stringify(
            tokenGenerationEntry
          )} - data ${JSON.stringify(data)} `
        );
      }

      match(tokenGenerationEntry.data)
        .when(
          (entry) =>
            entry.clientKind === clientKindTokenStates.consumer &&
            entry.PK.startsWith(clientKidPurposePrefix),
          () => {
            const clientKidPurposeEntry =
              tokenGenerationEntry.data as TokenGenerationStatesClientPurposeEntry;
            if (
              !clientKidPurposeEntry.GSIPK_purposeId ||
              !clientKidPurposeEntry.purposeState ||
              !clientKidPurposeEntry.agreementId ||
              !clientKidPurposeEntry.agreementState ||
              !clientKidPurposeEntry.GSIPK_eserviceId_descriptorId ||
              !clientKidPurposeEntry.descriptorState
            ) {
              throw genericInternalError("");
            }

            const key: ConsumerKey = {
              kid: clientKidPurposeEntry.GSIPK_kid,
              purposeId: clientKidPurposeEntry.GSIPK_purposeId,
              clientId: clientKidPurposeEntry.GSIPK_clientId,
              consumerId: clientKidPurposeEntry.consumerId,
              publicKey: clientKidPurposeEntry.publicKey,
              algorithm: "RS256" /* TODO pass this as a parameter? */,
              clientKind: clientKindTokenStates.consumer, // TODO this doesn't work with clientKidPurpose Entry.clientKind, but it should be already validated in the "when"
              purposeState: clientKidPurposeEntry.purposeState,
              agreementId: clientKidPurposeEntry.agreementId,
              agreementState: clientKidPurposeEntry.agreementState,
              eServiceId: unsafeBrandId<EServiceId>(
                clientKidPurposeEntry.GSIPK_eserviceId_descriptorId.split(
                  "#"
                )[0]
              ),
              descriptorState: clientKidPurposeEntry.descriptorState,
            };
            return key;
          }
        )
        .when(
          (entry) =>
            entry.clientKind === clientKindTokenStates.consumer &&
            entry.PK.startsWith(clientKidPrefix),
          () => {
            throw genericInternalError("TODO create specific error");
          }
        )
        .when(
          (entry) =>
            entry.clientKind === clientKindTokenStates.api &&
            entry.PK.startsWith(clientKidPurposePrefix),
          () => {
            throw genericInternalError("TODO create specific error");
          }
        )
        .when(
          (entry) =>
            entry.clientKind === clientKindTokenStates.api &&
            entry.PK.startsWith(clientKidPrefix),
          () => {
            const clientKidEntry =
              tokenGenerationEntry.data as TokenGenerationStatesClientEntry;

            const key: ApiKey = {
              kid: clientKidEntry.GSIPK_kid,
              clientId: clientKidEntry.GSIPK_clientId,
              consumerId: clientKidEntry.consumerId,
              publicKey: clientKidEntry.publicKey,
              algorithm: "RS256", // TODO pass this as a parameter?,
              clientKind: clientKindTokenStates.api, // TODO this doesn't work with clientKidEntry.clientKind, but it should be already validated in the "when"
            };
            return key;
          }
        )
        .run();

      throw genericInternalError("unexpected token entry");
    }
  } catch (error) {
    // error handling.
    // TODO Handle both dynamodb errors and throw error for empty public key
    console.log(error);
    throw error;
  }
};

export const actualGenerateToken = async (
  kmsClient: KMSClient,
  clientAssertion: ClientAssertion,
  audience: string[],
  tokenDurationInSeconds: number,
  // eslint-disable-next-line @typescript-eslint/ban-types
  customClaims: Object
): Promise<InteropToken> => {
  const currentTimestamp = Date.now();

  const header: InteropJwtHeader = {
    alg: "RS256",
    use: "sig",
    typ: "at+jwt",
    kid: config.GENERATED_INTEROP_TOKEN_KID,
  };

  const payload: InteropJwtPayload = {
    jti: generateId(),
    iss: config.GENERATED_INTEROP_TOKEN_ISSUER,
    aud: audience,
    sub: clientAssertion.payload.sub,
    iat: currentTimestamp,
    nbf: currentTimestamp,
    exp: currentTimestamp + tokenDurationInSeconds * 1000,
    ...customClaims,
  };

  const serializedToken = `${b64UrlEncode(
    JSON.stringify(header)
  )}.${b64UrlEncode(JSON.stringify(payload))}`;

  const commandParams: SignCommandInput = {
    KeyId: config.GENERATED_INTEROP_TOKEN_KID,
    Message: new TextEncoder().encode(serializedToken),
    SigningAlgorithm: config.GENERATED_INTEROP_TOKEN_ALGORITHM,
  };

  const command = new SignCommand(commandParams);
  const response = await kmsClient.send(command);

  if (!response.Signature) {
    throw Error("Signature failed");
  }

  const jwtSignature = b64ByteUrlEncode(response.Signature);

  return {
    header,
    payload,
    serialized: `${serializedToken}.${jwtSignature}`,
  };
};
