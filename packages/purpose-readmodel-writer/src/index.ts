/* eslint-disable functional/immutable-data */
import { EachMessagePayload } from "kafkajs";
import {
  logger,
  ReadModelRepository,
  readModelWriterConfig,
  decodeKafkaMessage,
  purposeTopicConfig,
  runWithContext,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { PurposeEvent } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV1 } from "./purposeConsumerServiceV1.js";
import { handleMessageV2 } from "./purposeConsumerServiceV2.js";

const config = readModelWriterConfig();
const { purposeTopic } = purposeTopicConfig();
const { purposes } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, PurposeEvent);

  await runWithContext(
    {
      messageData: {
        eventType: decodedMessage.type,
        eventVersion: decodedMessage.event_version,
        streamId: decodedMessage.stream_id,
      },
      correlationId: decodedMessage.correlation_id,
    },
    async () => {
      await match(decodedMessage)
        .with({ event_version: 1 }, (msg) => handleMessageV1(msg, purposes))
        .with({ event_version: 2 }, (msg) => handleMessageV2(msg, purposes))
        .exhaustive();

      logger.info(
        `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
      );
    }
  );
}

await runConsumer(config, [purposeTopic], processMessage);
