import { authorizationServerApi } from "pagopa-interop-api-clients";
import { decode, JwtPayload, verify } from "jsonwebtoken";
import { PurposeId } from "pagopa-interop-models";
import { ClientAssertion, ConsumerKey, Key } from "./types.js";
const CLIENT_ASSERTION_AUDIENCE = "";

export const validateRequestParameters = (
  request: authorizationServerApi.AccessTokenRequest
): boolean => {
  const expectedClientAssertionType: string =
    "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
  const expectedClientCredentialsGrantType: string = "client_credentials";

  if (request.client_assertion_type !== expectedClientAssertionType) {
    throw Error(
      `Unexpected client assertion type. Received ${request.client_assertion_type}`
    );
  } else if (request.grant_type !== expectedClientCredentialsGrantType) {
    throw Error(`Unexpected grant type. Received ${request.grant_type}`);
  }

  return true;
};

export const verifyClientAssertion = (
  clientAssertionJws: string,
  clientId: string | undefined
): ClientAssertion => {
  const decoded = decode(clientAssertionJws, { complete: true, json: true });

  const validateAudience = (aud: string | string[] | undefined): string[] => {
    if (aud === CLIENT_ASSERTION_AUDIENCE) {
      return [aud];
    }

    if (!Array.isArray(aud)) {
      throw Error("Audience must be an array");
    }

    if (!aud.includes(CLIENT_ASSERTION_AUDIENCE)) {
      throw Error("Unexpected client assertion audience");
    }

    return aud;
  };

  if (!decoded) {
    throw Error("Invalid format for Client assertion");
  }

  if (typeof decoded.payload === "string") {
    throw Error("Unexpected client assertion payload");
  }

  if (!decoded.payload.jti) {
    throw Error("JTI must be present in client assertion header");
  }

  if (!decoded.payload.iat) {
    throw Error("IAT must be present in client assertion header");
  }

  if (!decoded.payload.exp) {
    throw Error("EXP must be present in client assertion header");
  }

  if (!decoded.payload.iss) {
    throw Error("ISS must be present in client assertion header");
  }

  if (!decoded.payload.sub) {
    throw Error("Subject is mandatory in client assertion");
  }

  if (clientId && decoded.payload.sub !== clientId) {
    throw Error("Client Id must be equal to client assertion subject");
  }

  if (
    decoded.payload.purposeId &&
    !PurposeId.safeParse(decoded.payload.purposeId).success
  ) {
    throw Error("Wrong purpose id format in client assertion");
  }

  if (!decoded.header.kid) {
    throw Error("Kid must be present in client assertion header");
  }

  return {
    header: {
      kid: decoded.header.kid,
      alg: decoded.header.alg,
    },
    payload: {
      sub: decoded.payload.sub,
      purposeId: decoded.payload.purposeId,
      jti: decoded.payload.jti,
      iat: decoded.payload.iat,
      iss: decoded.payload.iss,
      aud: validateAudience(decoded.payload.aud),
      exp: decoded.payload.exp, // TODO Check unit of measure
    },
  };
};

export const b64Decode = (str: string): string =>
  Buffer.from(str, "base64").toString("binary");

export const verifyClientAssertionSignature = (
  clientAssertionJws: string,
  key: Key
): JwtPayload => {
  const result = verify(clientAssertionJws, b64Decode(key.publicKey), {
    algorithms: [key.algorithm],
  });

  // TODO Improve this
  if (typeof result === "string") {
    throw Error("Unexpected assertion verification result");
  } else {
    return result;
  }
  // TODO Handle error codes. See https://github.com/auth0/node-jsonwebtoken#errors--codes

  // to do should it be a try/catch?
};

export const assertValidPlatformState = (key: ConsumerKey): void => {
  if (key.agreementState !== "ACTIVE") {
    throw Error("Invalid agreement state");
  }
  if (key.descriptorState !== "ACTIVE") {
    throw Error("Invalid eservice state");
  }
  if (key.purposeState !== "ACTIVE") {
    throw Error("Invalid purpose state");
  }
};
