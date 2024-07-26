import { z } from "zod";
import { ClientId, PurposeId, TenantId, UserId } from "../brandedIds.js";
import { JWKKey, Key } from "./key.js";

export const ClientKey = Key.extend({
  clientId: ClientId,
});

export type ClientKey = z.infer<typeof ClientKey>;

export const clientKind = {
  consumer: "Consumer",
  api: "Api",
} as const;
export const ClientKind = z.enum([
  Object.values(clientKind)[0],
  ...Object.values(clientKind).slice(1),
]);
export type ClientKind = z.infer<typeof ClientKind>;

export const ClientJWKKey = JWKKey.extend({
  clientId: ClientId,
});

export type ClientJWKKey = z.infer<typeof ClientJWKKey>;

export const Client = z.object({
  id: ClientId,
  consumerId: TenantId,
  name: z.string(),
  purposes: z.array(PurposeId),
  description: z.string().optional(),
  users: z.array(UserId),
  kind: ClientKind,
  createdAt: z.coerce.date(),
  keys: z.array(ClientKey),
});

export type Client = z.infer<typeof Client>;
