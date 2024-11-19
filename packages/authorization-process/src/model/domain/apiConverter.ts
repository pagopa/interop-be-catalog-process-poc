import { authorizationApi } from "pagopa-interop-api-clients";
import {
  Client,
  ClientKind,
  Key,
  KeyUse,
  clientKind,
  keyUse,
  ProducerKeychain,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export const clientKindToApiClientKind = (
  kind: ClientKind
): authorizationApi.ClientKind =>
  match<ClientKind, authorizationApi.ClientKind>(kind)
    .with(clientKind.consumer, () => "CONSUMER")
    .with(clientKind.api, () => "API")
    .exhaustive();

export const apiClientKindToClientKind = (
  kind: authorizationApi.ClientKind
): ClientKind =>
  match<authorizationApi.ClientKind, ClientKind>(kind)
    .with("CONSUMER", () => clientKind.consumer)
    .with("API", () => clientKind.api)
    .exhaustive();

export const keyUseToApiKeyUse = (kid: KeyUse): authorizationApi.KeyUse =>
  match<KeyUse, authorizationApi.KeyUse>(kid)
    .with(keyUse.enc, () => "ENC")
    .with(keyUse.sig, () => "SIG")
    .exhaustive();

export function clientToApiClientWithKeys(
  client: Client,
  { showUsers }: { showUsers: boolean }
): authorizationApi.ClientWithKeys {
  return {
    client: {
      id: client.id,
      name: client.name,
      consumerId: client.consumerId,
      users: showUsers ? client.users : [],
      createdAt: client.createdAt.toJSON(),
      purposes: client.purposes,
      kind: clientKindToApiClientKind(client.kind),
      description: client.description,
    },
    keys: client.keys.map(keyToApiKey),
  };
}

export function clientToApiClient(
  client: Client,
  { showUsers }: { showUsers: boolean }
): authorizationApi.Client {
  return {
    id: client.id,
    name: client.name,
    consumerId: client.consumerId,
    users: showUsers ? client.users : [],
    createdAt: client.createdAt.toJSON(),
    purposes: client.purposes,
    kind: clientKindToApiClientKind(client.kind),
    description: client.description,
  };
}

export function producerKeychainToApiProducerKeychain(
  producerKeychain: ProducerKeychain,
  { showUsers }: { showUsers: boolean }
): authorizationApi.ProducerKeychain {
  return {
    id: producerKeychain.id,
    name: producerKeychain.name,
    producerId: producerKeychain.producerId,
    users: showUsers ? producerKeychain.users : [],
    createdAt: producerKeychain.createdAt.toJSON(),
    eservices: producerKeychain.eservices,
    description: producerKeychain.description,
    keys: producerKeychain.keys.map(keyToApiKey),
  };
}

export const keyToApiKey = (key: Key): authorizationApi.Key => ({
  name: key.name,
  createdAt: key.createdAt.toJSON(),
  kid: key.kid,
  encodedPem: key.encodedPem,
  algorithm: key.algorithm,
  use: keyUseToApiKeyUse(key.use),
  userId: key.userId,
});

export const ApiKeyUseToKeyUse = (kid: authorizationApi.KeyUse): KeyUse =>
  match<authorizationApi.KeyUse, KeyUse>(kid)
    .with("ENC", () => keyUse.enc)
    .with("SIG", () => keyUse.sig)
    .exhaustive();

export const apiKeyToKey = (key: authorizationApi.Key): Key => ({
  ...key,
  createdAt: new Date(key.createdAt),
  userId: unsafeBrandId(key.userId),
  use: ApiKeyUseToKeyUse(key.use),
});
