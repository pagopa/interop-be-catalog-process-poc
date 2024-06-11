import crypto, { JsonWebKey } from "crypto";
import {
  jwkDecodingError,
  notAllowedPrivateKeyException,
} from "pagopa-interop-models";

export const decodeBase64ToPem = (base64String: string): string => {
  try {
    const cleanedBase64 = base64String.trim();
    const decodedBytes = Buffer.from(cleanedBase64, "base64");
    return `${decodedBytes.toString("utf-8")}`;
  } catch (error) {
    throw jwkDecodingError(error);
  }
};

// This method is to check if the key is public and to create the JWK If you don't add the if condition, createPublicKey turns any key into a public key
export const createJWK = (pemKey: string): JsonWebKey => {
  if (pemKey.includes("-----BEGIN RSA PUBLIC KEY-----")) {
    return crypto.createPublicKey(pemKey).export({ format: "jwk" });
  } else {
    throw notAllowedPrivateKeyException();
  }
};

export const calculateKid = (jwk: JsonWebKey): string => {
  const jwkString = JSON.stringify(jwk);
  return crypto.createHash("sha256").update(jwkString).digest("base64");
};
