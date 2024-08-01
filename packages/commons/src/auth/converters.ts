import {
  ClientKey,
  ClientJWKKey,
  missingRequiredJWKClaim,
  ProducerKeychainKey,
  ProducerKeychainJWKKey,
} from "pagopa-interop-models";
import { createJWK } from "./jwk.js";

export const clientKeyToClientJWKKey = (key: ClientKey): ClientJWKKey => {
  const jwk = createJWK(key.encodedPem);
  if (!jwk.e || !jwk.kty || !jwk.n) {
    throw missingRequiredJWKClaim();
  }
  return {
    clientId: key.clientId,
    kid: key.kid,
    use: key.use,
    alg: key.algorithm,
    e: jwk.e,
    kty: jwk.kty,
    n: jwk.n,
  };
};

export const producerKeychainKeyToProducerKeychainJWKKey = (
  key: ProducerKeychainKey
): ProducerKeychainJWKKey => {
  const jwk = createJWK(key.encodedPem);
  if (!jwk.e || !jwk.kty || !jwk.n) {
    throw missingRequiredJWKClaim();
  }
  return {
    producerKeychainId: key.producerKeychainId,
    kid: key.kid,
    use: key.use,
    alg: key.algorithm,
    e: jwk.e,
    kty: jwk.kty,
    n: jwk.n,
  };
};
