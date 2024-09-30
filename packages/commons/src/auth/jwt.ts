import jwt, { JwtHeader, JwtPayload, Secret } from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { invalidClaim, jwtDecodingError } from "pagopa-interop-models";
import { JWTConfig, Logger } from "../index.js";
import { AuthData, AuthToken, getAuthDataFromToken } from "./authData.js";

export const decodeJwtToken = (
  jwtToken: string,
  logger?: Logger
): JwtPayload | null => {
  try {
    return jwt.decode(jwtToken, { json: true });
  } catch (err) {
    logger?.error(`Error decoding JWT token: ${err}`);
    throw jwtDecodingError(err);
  }
};

export const decodeJwtTokenHeaders = (
  jwtToken: string,
  logger?: Logger
): JwtHeader | undefined => {
  try {
    const decoded = jwt.decode(jwtToken, { complete: true });
    return decoded?.header;
  } catch (err) {
    logger?.error(`Error decoding JWT token: ${err}`);
    throw jwtDecodingError(err);
  }
};

export const readAuthDataFromJwtToken = (jwtToken: string): AuthData => {
  const decoded = decodeJwtToken(jwtToken);
  const token = AuthToken.safeParse(decoded);
  if (token.success === false) {
    throw invalidClaim(token.error);
  } else {
    return getAuthDataFromToken(token.data);
  }
};

const getKey = async (
  clients: jwksClient.JwksClient[],
  kid: string,
  logger: Logger
): Promise<Secret> => {
  logger.info(`Getting signing key for kid ${kid}`);
  for (const client of clients) {
    try {
      const signingKey = await client.getSigningKey(kid);
      return signingKey.getPublicKey();
    } catch (error) {
      // Continue to the next client
      logger.info(`Skip Jwks client`);
    }
  }

  logger.error(`Error getting signing key`);
  return Promise.reject();
};

export const verifyJwtToken = async (
  jwtToken: string,
  jwksClients: jwksClient.JwksClient[],
  logger: Logger
): Promise<boolean> => {
  try {
    const { acceptedAudiences } = JWTConfig.parse(process.env);

    const jwtHeader = decodeJwtTokenHeaders(jwtToken, logger);
    if (!jwtHeader?.kid) {
      logger.warn("Token verification failed: missing kid");
      return Promise.reject(false);
    }

    const secret: Secret = await getKey(jwksClients, jwtHeader.kid, logger);

    return new Promise((resolve, _reject) => {
      jwt.verify(
        jwtToken,
        secret,
        {
          audience: acceptedAudiences,
        },
        function (err, _decoded) {
          if (err) {
            logger.warn(`Token verification failed: ${err}`);
            return resolve(false);
          }
          return resolve(true);
        }
      );
    });
  } catch (error) {
    logger.error(`Error verifying JWT token: ${error}`);
    return Promise.reject(false);
  }
};

export const hasPermission = (
  permissions: string[],
  authData: AuthData
): boolean =>
  authData.userRoles.some((role: string) => permissions.includes(role));
