import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  decodeKafkaMessage,
  InteropTokenGenerator,
  logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  fromTenantV2,
  generateId,
  missingKafkaMessageDataError,
  TenantEvent,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { agreementApi } from "pagopa-interop-api-clients";
import { config } from "./config/config.js";
import { toApiCompactTenant } from "./converters.js";

const agreementProcessClient = agreementApi.createAgreementApiClient(
  config.agreementProcessUrl
);

const refreshableToken = new RefreshableInteropToken(
  new InteropTokenGenerator(config)
);
await refreshableToken.init();

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMsg = decodeKafkaMessage(message, TenantEvent);
  const correlationId: CorrelationId = decodedMsg.correlation_id
    ? unsafeBrandId(decodedMsg.correlation_id)
    : generateId();

  const loggerInstance = logger({
    serviceName: "compute-agreements-consumer",
    eventType: decodedMsg.type,
    eventVersion: decodedMsg.event_version,
    streamId: decodedMsg.stream_id,
    correlationId,
  });

  await match(decodedMsg)
    .with(
      {
        event_version: 2,
        type: P.union(
          "TenantCertifiedAttributeRevoked",
          "TenantCertifiedAttributeAssigned",
          "TenantDeclaredAttributeAssigned",
          "TenantDeclaredAttributeRevoked",
          "TenantVerifiedAttributeAssigned",
          "TenantVerifiedAttributeRevoked"
        ),
      },
      async ({ data: { tenant, attributeId } }) => {
        if (tenant) {
          loggerInstance.info(
            `Processing ${decodedMsg.type} message - Partition number: ${partition} - Offset: ${message.offset}`
          );
          const token = (await refreshableToken.get()).serialized;

          await agreementProcessClient.computeAgreementsByAttribute(
            {
              attributeId: unsafeBrandId(attributeId),
              consumer: toApiCompactTenant(fromTenantV2(tenant)),
            },
            {
              headers: {
                "X-Correlation-Id": correlationId,
                Authorization: `Bearer ${token}`,
              },
            }
          );
        } else {
          throw missingKafkaMessageDataError("tenant", decodedMsg.type);
        }
      }
    )
    .with(
      {
        event_version: 2,
        type: P.union(
          "TenantOnboarded",
          "TenantOnboardDetailsUpdated",
          "TenantVerifiedAttributeExtensionUpdated",
          "TenantVerifiedAttributeExpirationUpdated",
          "TenantKindUpdated",
          "MaintenanceTenantDeleted",
          "MaintenanceTenantUpdated",
          "TenantMailDeleted",
          "TenantMailAdded",
          "MaintenanceTenantPromotedToCertifier",
          "TenantDelegatedProducerFeatureAdded",
          "TenantDelegatedProducerFeatureRemoved",
          "TenantDelegatedConsumerFeatureAdded",
          "TenantDelegatedConsumerFeatureRemoved"
        ),
      },
      () => Promise.resolve()
    )
    .with({ event_version: 1 }, () => Promise.resolve())
    .exhaustive();
}

await runConsumer(config, [config.tenantTopic], processMessage);
