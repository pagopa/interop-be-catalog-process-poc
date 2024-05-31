import { Mechanism } from "kafkajs";
import { AwsCredentialIdentity, Provider } from "@aws-sdk/types";
import { TYPE } from "./constants.js";
import { createAuthenticator } from "./create-authenticator.js";

export type Options = {
  /**
   * The AWS region in which the Kafka broker exists.
   */
  region: string;
  /**
   * Provides the time period, in seconds, for which the generated presigned URL is valid.
   *
   * @default 900
   */
  ttl?: string;
  /**
   * Is a string passed in by the client library to describe the client.
   *
   * @default MSK_IAM
   */
  userAgent?: string;
  /**
   * @default fromNodeProviderChain()
   */
  credentials?: AwsCredentialIdentity | Provider<AwsCredentialIdentity>;
};

export const createMechanism = (
  options: Options,
  mechanism: string = TYPE,
): Mechanism => ({
  mechanism,
  authenticationProvider: createAuthenticator(options),
});
