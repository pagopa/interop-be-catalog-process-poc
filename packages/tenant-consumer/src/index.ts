import { EachMessagePayload } from "kafkajs";
import { logger, consumerConfig } from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { decodeKafkaMessage } from "./model/models.js";
import { handleMessage } from "./consumerService.js";

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  try {
    await handleMessage(decodeKafkaMessage(message));
    logger.info(
      `Read model was updated in partition number ${partition}, with offset ${message.offset}`
    );
  } catch (e) {
    logger.error(
      `Error during message handling in partition number ${partition}, with offset ${message.offset}, ${e}`
    );
  }
}

const config = consumerConfig();
await runConsumer(config, processMessage).catch(logger.error);
