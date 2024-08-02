/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  ClientId,
  UserId,
  unsafeBrandId,
  EServiceId,
  ProducerKeychainId,
} from "../brandedIds.js";
import { ClientKindV2, ClientV2 } from "../gen/v2/authorization/client.js";
import { ProducerKeychainV2 } from "../gen/v2/authorization/producer-keychain.js";
import {
  KeyUseV2,
  ClientKeyV2,
  ProducerKeyV2,
} from "../gen/v2/authorization/key.js";
import { bigIntToDate } from "../utils.js";
import { Client, ClientKind, clientKind, ClientKey } from "./client.js";
import { ProducerKeychain, ProducerKey } from "./producerKeychain.js";
import { KeyUse, keyUse } from "./key.js";

const fromKeyUseV2 = (input: KeyUseV2): KeyUse => {
  switch (input) {
    case KeyUseV2.SIG:
      return keyUse.sig;
    case KeyUseV2.ENC:
      return keyUse.enc;
  }
};

export const fromClientKeyV2 = (input: ClientKeyV2): ClientKey => ({
  ...input,
  clientId: unsafeBrandId<ClientId>(input.clientId),
  userId: unsafeBrandId<UserId>(input.userId),
  use: fromKeyUseV2(input.use),
  createdAt: bigIntToDate(input.createdAt),
});

export const fromClientKindV2 = (input: ClientKindV2): ClientKind => {
  switch (input) {
    case ClientKindV2.CONSUMER:
      return clientKind.consumer;
    case ClientKindV2.API:
      return clientKind.api;
  }
};

export const fromClientV2 = (input: ClientV2): Client => ({
  ...input,
  id: unsafeBrandId(input.id),
  consumerId: unsafeBrandId(input.consumerId),
  purposes: input.purposes.map((purposeId) => unsafeBrandId(purposeId)),
  users: input.users.map(unsafeBrandId<UserId>),
  kind: fromClientKindV2(input.kind),
  createdAt: bigIntToDate(input.createdAt),
  keys: input.keys.map(fromClientKeyV2),
});

export const fromProducerKeyV2 = (input: ProducerKeyV2): ProducerKey => ({
  ...input,
  producerKeychainId: unsafeBrandId<ProducerKeychainId>(
    input.producerKeychainId
  ),
  userId: unsafeBrandId<UserId>(input.userId),
  use: fromKeyUseV2(input.use),
  createdAt: bigIntToDate(input.createdAt),
});

export const fromProducerKeychainV2 = (
  input: ProducerKeychainV2
): ProducerKeychain => ({
  ...input,
  id: unsafeBrandId(input.id),
  producerId: unsafeBrandId(input.producerId),
  createdAt: bigIntToDate(input.createdAt),
  eservices: input.eservices.map(unsafeBrandId<EServiceId>),
  users: input.users.map(unsafeBrandId<UserId>),
  keys: input.keys.map(fromProducerKeyV2),
});
