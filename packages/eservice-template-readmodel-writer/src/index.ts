import { EachMessagePayload } from "kafkajs";
import {
  logger,
  ReadModelRepository,
  decodeKafkaMessage,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import {
  CorrelationId,
  EServiceTemplateEvent,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV2 } from "./consumerServiceV2.js";
import { config } from "./config/config.js";

const { eserviceTemplates } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, EServiceTemplateEvent);

  const loggerInstance = logger({
    serviceName: "eservice-template-readmodel-writer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id
      ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
      : generateId<CorrelationId>(),
  });

  await match(decodedMessage)
    .with({ event_version: 2 }, (msg) =>
      handleMessageV2(msg, eserviceTemplates)
    )
    .exhaustive();

  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.eserviceTemplateTopic], processMessage);
