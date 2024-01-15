import { EachMessagePayload } from "kafkajs";
import { consumerConfig, logger } from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { decodeKafkaAgreementMessage } from "pagopa-interop-models";
import { handleMessage } from "./agreementConsumerService.js";

const config = consumerConfig();

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  try {
    await handleMessage(decodeKafkaAgreementMessage(message));

    logger.info(
      `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
    );
  } catch (e) {
    logger.error(
      `Error during message handling. Partition number: ${partition}. Offset: ${message.offset}, ${e}`
    );
  }
}

await runConsumer(config, processMessage).catch(logger.error);
