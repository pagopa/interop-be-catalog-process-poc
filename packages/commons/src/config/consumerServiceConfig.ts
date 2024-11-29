import { z } from "zod";
import { KafkaConfig } from "./kafkaConfig.js";
import { ReadModelDbConfig } from "./readmodelDbConfig.js";
import { TokenGenerationReadModelDbConfig } from "./tokenGenerationReadmodelDbConfig.js";

export const KafkaConsumerConfig = KafkaConfig.and(
  z
    .object({
      KAFKA_GROUP_ID: z.string(),
      TOPIC_STARTING_OFFSET: z
        .union([z.literal("earliest"), z.literal("latest")])
        .default("latest"),
      RESET_CONSUMER_OFFSETS: z.string().default("false"),
    })
    .transform((c) => ({
      kafkaGroupId: c.KAFKA_GROUP_ID,
      topicStartingOffset: c.TOPIC_STARTING_OFFSET,
      resetConsumerOffsets: c.RESET_CONSUMER_OFFSETS.toLowerCase() === "true",
    }))
);
export type KafkaConsumerConfig = z.infer<typeof KafkaConsumerConfig>;

export const KafkaBatchConsumerConfig = KafkaConsumerConfig.and(
  z
    .object({
      AVERAGE_KAFKA_MESSAGE_SIZE_IN_BYTES: z.coerce.number(),
      MESSAGES_TO_READ_PER_BATCH: z.coerce.number(),
      MAX_WAIT_KAFKA_BATCH_MILLIS: z.coerce.number(),
    })
    .transform((c) => ({
      averageKafkaMessageSizeInBytes: c.AVERAGE_KAFKA_MESSAGE_SIZE_IN_BYTES,
      messagesToReadPerBatch: c.MESSAGES_TO_READ_PER_BATCH,
      maxWaitKafkaBatchMillis: c.MAX_WAIT_KAFKA_BATCH_MILLIS,
    }))
);
export type KafkaBatchConsumerConfig = z.infer<typeof KafkaBatchConsumerConfig>;

export const ReadModelWriterConfig = KafkaConsumerConfig.and(ReadModelDbConfig);
export type ReadModelWriterConfig = z.infer<typeof ReadModelWriterConfig>;

export const PlatformStateWriterConfig = KafkaConsumerConfig.and(
  TokenGenerationReadModelDbConfig
);
export type PlatformStateWriterConfig = z.infer<
  typeof PlatformStateWriterConfig
>;
