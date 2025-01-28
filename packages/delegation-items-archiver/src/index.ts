import { EachMessagePayload } from "kafkajs";
import {
  decodeKafkaMessage,
  InteropTokenGenerator,
  logger,
  ReadModelRepository,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import {
  CorrelationId,
  DelegationEvent,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV2 } from "./delegationItemsArchiverConsumerServiceV2.js";
import { config } from "./config/config.js";
import { getInteropBeClients } from "./clients/clientsProvider.js";
import { readModelServiceBuilder } from "./readModelService.js";

const refreshableToken = new RefreshableInteropToken(
  new InteropTokenGenerator(config)
);
await refreshableToken.init();

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, DelegationEvent);

  const correlationId = decodedMessage.correlation_id
    ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
    : generateId<CorrelationId>();

  const loggerInstance = logger({
    serviceName: "delegation-items-archiver",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId,
  });
  loggerInstance.debug(decodedMessage);

  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );

  await match(decodedMessage)
    .with({ event_version: 2 }, (msg) =>
      handleMessageV2(
        {
          decodedMessage: msg,
          refreshableToken,
          partition,
          offset: message.offset,
          logger: loggerInstance,
          correlationId,
          readModelService,
        },
        getInteropBeClients()
      )
    )
    .exhaustive();
}

await runConsumer(config, [config.delegationTopic], processMessage);
