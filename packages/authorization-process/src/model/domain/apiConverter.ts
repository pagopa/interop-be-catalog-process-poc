import {
  Client,
  ClientKind,
  Key,
  KeyUse,
  clientKind,
  keyUse,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  ApiClient,
  ApiClientWithKeys,
  ApiClientKind,
  ApiKey,
  ApiKeyUse,
} from "./models.js";

export const ClientKindToApiClientKind = (kind: ClientKind): ApiClientKind =>
  match<ClientKind, ApiClientKind>(kind)
    .with(clientKind.consumer, () => "CONSUMER")
    .with(clientKind.api, () => "API")
    .exhaustive();

export const KeyUseToApiKeyUse = (kid: KeyUse): ApiKeyUse =>
  match<KeyUse, ApiKeyUse>(kid)
    .with(keyUse.enc, () => "ENC")
    .with(keyUse.sig, () => "SIG")
    .exhaustive();

export const clientToApiClient = (
  client: Client,
  withKeys: boolean
): ApiClient | ApiClientWithKeys => ({
  id: client.id,
  name: client.name,
  consumerId: client.consumerId,
  users: client.users,
  createdAt: client.createdAt.toJSON(),
  purposes: client.purposes,
  kind: ClientKindToApiClientKind(client.kind),
  description: client.description ? client.description : undefined,
  ...(withKeys ? { keys: [client.keys] } : {}),
});

export const keyToApiKey = (key: Key): ApiKey => ({
  name: key.name,
  createdAt: key.createdAt.toJSON(),
  kid: key.kid,
  encodedPem: key.encodedPem,
  algorithm: key.algorithm,
  use: KeyUseToApiKeyUse(key.use),
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  userId: key.userId!, // TODO Double check
});
