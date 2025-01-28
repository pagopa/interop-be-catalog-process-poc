import { EachMessagePayload } from "kafkajs";
import {
  logger,
  decodeKafkaMessage,
  initDB,
  readmodelRepositorySQL,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import {
  CorrelationId,
  EServiceEvent,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV2 } from "./consumerServiceV2.js";
import { config } from "./config/config.js";

const connection = initDB({
  username: "root",
  password: "root",
  host: "localhost",
  port: 6002,
  database: "root",
  schema: "readmodel",
  useSSL: false,
});

const readModelRepositorySQL = readmodelRepositorySQL(connection);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, EServiceEvent);

  const loggerInstance = logger({
    serviceName: "catalog-readmodel-writer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id
      ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
      : generateId<CorrelationId>(),
  });

  await match(decodedMessage)
    .with({ event_version: 1 }, (msg) => Promise.resolve(msg))
    .with({ event_version: 2 }, (msg) =>
      handleMessageV2(msg, readModelRepositorySQL)
    )
    .exhaustive();

  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.catalogTopic], processMessage);
