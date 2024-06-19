import { z } from "zod";
import { AWSConfig } from "./awsConfig.js";
import { KafkaConfig } from "./kafkaConfig.js";
import { ReadModelDbConfig } from "./readmodelDbConfig.js";

export const KafkaConsumerConfig = KafkaConfig.and(AWSConfig).and(
  z
    .object({
      MESSAGE_STARTING_OFFSET: z
        .union([z.literal("earliest"), z.literal("latest")])
        .default("latest"),
    })
    .transform((c) => ({
      messageStartingOffset: c.MESSAGE_STARTING_OFFSET,
    }))
);
export type KafkaConsumerConfig = z.infer<typeof KafkaConsumerConfig>;
export const kafkaConsumerConfig: () => KafkaConsumerConfig = () =>
  KafkaConsumerConfig.parse(process.env);

export const ReadModelWriterConfig = KafkaConsumerConfig.and(ReadModelDbConfig);
export type ReadModelWriterConfig = z.infer<typeof ReadModelWriterConfig>;
export const readModelWriterConfig: () => ReadModelWriterConfig = () =>
  ReadModelWriterConfig.parse(process.env);
