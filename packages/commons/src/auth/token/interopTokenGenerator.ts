/* eslint-disable max-params */
import { Algorithm, JwtHeader, JwtPayload } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { userRoles } from "../authData.js";
import { buildPrivateKeysKidHolder } from "../keys/keyHolder.js";
import { buildSignerService } from "../signerService.js";
import { logger } from "../../index.js";
import { jwtSeedConfig } from "../../config/jwtConfig.js";
import { InternalToken, TokenSeed } from "./token.js";

export type InteropTokenGenerator = {
  generateInternalToken: () => Promise<InternalToken>;
};

const createInternalTokenWithKid = (
  algorithm: Algorithm,
  kid: string,
  subject: string,
  audience: string[],
  tokenIssuer: string,
  validityDurationSeconds: number
): TokenSeed => {
  const issuedAt = new Date();
  return {
    id: uuidv4(),
    algorithm,
    kid,
    subject,
    issuer: tokenIssuer,
    issuedAt: issuedAt.getTime() / 1000,
    nbf: issuedAt.getTime() / 1000,
    expireAt: issuedAt.setSeconds(
      issuedAt.getSeconds() + validityDurationSeconds
    ),
    audience,
    customClaims: new Map([["role", userRoles.INTERNAL_ROLE]]),
  };
};

export const buildInteropTokenGenerator = (): InteropTokenGenerator => {
  // Hosting all the dependencies to collect all process env reading at one time
  const kidHolder = buildPrivateKeysKidHolder();
  const signerService = buildSignerService();
  const { subject, audience, tokenIssuer, secondsToExpire } = jwtSeedConfig();

  const createSignedJWT = async (
    seed: TokenSeed,
    kid: string
  ): Promise<string> => {
    const customHeaders = { use: "sig" };
    const jwtHeaders: JwtHeader = {
      alg: seed.algorithm,
      kid: seed.kid,
      typ: "at+jwt",
    };

    const headers = { ...jwtHeaders, ...customHeaders };

    const payload: JwtPayload = {
      ...seed.customClaims,
      jti: seed.id,
      iss: seed.issuer,
      aud: seed.audience,
      sub: seed.subject,
      iat: seed.issuedAt,
      nbf: seed.nbf,
      exp: seed.expireAt,
    };

    const encodedHeader = Buffer.from(JSON.stringify(headers)).toString(
      "base64url"
    );
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      "base64url"
    );
    const serializedToken = `${encodedHeader}.${encodedPayload}`;
    const signature = await signerService.signWithRSA256(kid, serializedToken);

    logger.info(`Interop internal Token generated`);
    return `${serializedToken}.${signature}`;
  };

  const generateInternalToken = async (): Promise<InternalToken> => {
    try {
      const privateKid = kidHolder.getPrivateKeyKidByAlgorithm("RS256");

      const tokenSeed = createInternalTokenWithKid(
        "RS256",
        privateKid,
        subject,
        audience,
        tokenIssuer,
        secondsToExpire
      );

      const signedJwt = await createSignedJWT(tokenSeed, privateKid);

      return {
        serialized: signedJwt,
        jti: tokenSeed.id,
        iat: tokenSeed.issuedAt,
        exp: tokenSeed.expireAt,
        nbf: tokenSeed.nbf,
        expIn: secondsToExpire,
        alg: "RS256",
        kid: privateKid,
        aud: audience,
        sub: subject,
        iss: tokenIssuer,
      };
    } catch (error) {
      throw new Error(
        `Invalid clientAssertion provided for jwt token generation ${error}`
      );
    }
  };

  return {
    generateInternalToken,
  };
};
