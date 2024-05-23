import { Key, KeyUse, keyUse } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { KeyV1Notification } from "./authorizationEventNotification.js";

export const toKeyUseV1Notification = (input: KeyUse): string =>
  match(input)
    .with(keyUse.enc, () => "Enc")
    .with(keyUse.sig, () => "Sig")
    .exhaustive();

export const toKeyV1Notification = (input: Key): KeyV1Notification => ({
  ...input,
  use: "test",
  createdAt: "test",
});
