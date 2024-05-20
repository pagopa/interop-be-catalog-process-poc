/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { unsafeBrandId } from "../brandedIds.js";
import { ClientKindV2, ClientV2 } from "../gen/v2/authorization/client.js";
import { KeyUseV2, KeyV2 } from "../gen/v2/authorization/key.js";
import { bigIntToDate } from "../utils.js";
import { Client, ClientKind, clientKind } from "./client.js";
import { Key, KeyUse, keyUse } from "./key.js";

const fromKeyUseV2 = (input: KeyUseV2): KeyUse => {
  switch (input) {
    case KeyUseV2.SIG:
      return keyUse.sig;
    case KeyUseV2.ENC:
      return keyUse.enc;
  }
};

export const fromKeyV2 = (input: KeyV2): Key => ({
  ...input,
  use: fromKeyUseV2(input.use),
  createdAt: new Date(input.createdAt),
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
  consumerId: unsafeBrandId(input.consumerId),
  purposes: input.purposes.map((purposeId) => unsafeBrandId(purposeId)),
  kind: fromClientKindV2(input.kind),
  createdAt: bigIntToDate(input.createdAt!),
  keys: input.keys.map(fromKeyV2),
});
