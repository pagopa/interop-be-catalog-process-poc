import {
  APIEndpoint,
  DelegationTopicConfig,
  KafkaConsumerConfig,
  ReadModelDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const APIProcessServerConfig = z
  .object({
    AGREEMENT_PROCESS_URL: APIEndpoint,
    PURPOSE_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    agreementProcessUrl: c.AGREEMENT_PROCESS_URL,
    purposeProcessUrl: c.PURPOSE_PROCESS_URL,
  }));

const DelegationItemsArchiverConfig = APIProcessServerConfig.and(
  DelegationTopicConfig
)
  .and(TokenGenerationConfig)
  .and(KafkaConsumerConfig)
  .and(ReadModelDbConfig);

export type DelegationItemsArchiverConfig = z.infer<
  typeof DelegationItemsArchiverConfig
>;
export const config: DelegationItemsArchiverConfig =
  DelegationItemsArchiverConfig.parse(process.env);
