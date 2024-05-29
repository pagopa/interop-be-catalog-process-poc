/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { P, match } from "ts-pattern";
import { EachMessagePayload } from "kafkajs";
import {
  logger,
  CatalogTopicConfig,
  Logger,
  genericLogger,
  AgreementTopicConfig,
  ReadModelRepository,
  InteropTokenGenerator,
  RefreshableInteropToken,
  decodeKafkaMessage,
  PurposeTopicConfig,
} from "pagopa-interop-commons";
import {
  kafkaMessageProcessError,
  genericInternalError,
  descriptorState,
  EServiceEventEnvelopeV2,
  EServiceEventV2,
  AgreementEventV2,
  AgreementEventEnvelopeV2,
  PurposeEventEnvelopeV2,
  PurposeEventV2,
  purposeVersionState,
  missingKafkaMessageDataError,
  EventEnvelope,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import {
  AuthorizationService,
  authorizationServiceBuilder,
} from "./authorizationService.js";
import { ApiClientComponent } from "./model/models.js";
import { config } from "./utilities/config.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "./readModelService.js";
import { authorizationManagementClientBuilder } from "./authorizationManagementClient.js";
import {
  getDescriptorFromEvent,
  getAgreementFromEvent,
  agreementStateToClientState,
  getPurposeFromEvent,
  getPurposeVersionFromEvent,
} from "./utils.js";

export async function sendAgreementAuthUpdate(
  decodedMessage: AgreementEventEnvelopeV2,
  readModelService: ReadModelService,
  authService: AuthorizationService,
  logger: Logger,
  correlationId: string
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union(
          "AgreementSubmitted",
          "AgreementActivated",
          "AgreementUnsuspendedByPlatform",
          "AgreementUnsuspendedByConsumer",
          "AgreementUnsuspendedByProducer",
          "AgreementSuspendedByPlatform",
          "AgreementSuspendedByConsumer",
          "AgreementSuspendedByProducer",
          "AgreementArchivedByConsumer",
          "AgreementArchivedByUpgrade"
        ),
      },
      async (msg) => {
        const agreement = getAgreementFromEvent(msg, decodedMessage.type);

        await authService.updateAgreementState(
          agreementStateToClientState(agreement),
          agreement.id,
          agreement.eserviceId,
          agreement.consumerId,
          logger,
          correlationId
        );
      }
    )
    .with({ type: "AgreementUpgraded" }, async (msg) => {
      const agreement = getAgreementFromEvent(msg, decodedMessage.type);
      const eservice = await readModelService.getEServiceById(
        agreement.eserviceId
      );
      if (!eservice) {
        throw genericInternalError(
          `Unable to find EService with id ${agreement.eserviceId}`
        );
      }

      const descriptor = eservice.descriptors.find(
        (d) => d.id === agreement.descriptorId
      );
      if (!descriptor) {
        throw genericInternalError(
          `Unable to find descriptor with id ${agreement.descriptorId}`
        );
      }

      const eserviceClientState = match(descriptor.state)
        .with(
          descriptorState.published,
          descriptorState.deprecated,
          () => ApiClientComponent.Values.ACTIVE
        )
        .otherwise(() => ApiClientComponent.Values.INACTIVE);

      await authService.updateAgreementAndEServiceStates(
        agreementStateToClientState(agreement),
        eserviceClientState,
        agreement.id,
        agreement.eserviceId,
        agreement.descriptorId,
        agreement.consumerId,
        descriptor.audience,
        descriptor.voucherLifespan,
        logger,
        correlationId
      );
    })
    .with(
      {
        type: P.union(
          "AgreementAdded",
          "AgreementDeleted",
          "AgreementRejected",
          "DraftAgreementUpdated",
          "AgreementConsumerDocumentAdded",
          "AgreementConsumerDocumentRemoved",
          "AgreementSetDraftByPlatform",
          "AgreementSetMissingCertifiedAttributesByPlatform"
        ),
      },
      () => {
        logger.info(`No auth update needed for ${decodedMessage.type} message`);
      }
    )
    .exhaustive();
}

export async function sendCatalogAuthUpdate(
  decodedMessage: EServiceEventEnvelopeV2,
  authService: AuthorizationService,
  logger: Logger,
  correlationId: string
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union(
          "EServiceDescriptorPublished",
          "EServiceDescriptorActivated"
        ),
      },
      async (msg) => {
        const data = getDescriptorFromEvent(msg, decodedMessage.type);
        await authService.updateEServiceState(
          ApiClientComponent.Values.ACTIVE,
          data.descriptor.id,
          data.eserviceId,
          data.descriptor.audience,
          data.descriptor.voucherLifespan,
          logger,
          correlationId
        );
      }
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorSuspended",
          "EServiceDescriptorArchived"
        ),
      },
      async (msg) => {
        const data = getDescriptorFromEvent(msg, decodedMessage.type);
        await authService.updateEServiceState(
          ApiClientComponent.Values.INACTIVE,
          data.descriptor.id,
          data.eserviceId,
          data.descriptor.audience,
          data.descriptor.voucherLifespan,
          logger,
          correlationId
        );
      }
    )
    .with(
      {
        type: P.union(
          "EServiceAdded",
          "EServiceCloned",
          "EServiceDeleted",
          "DraftEServiceUpdated",
          "EServiceDescriptorAdded",
          "EServiceDraftDescriptorDeleted",
          "EServiceDraftDescriptorUpdated",
          "EServiceDescriptorDocumentAdded",
          "EServiceDescriptorDocumentUpdated",
          "EServiceDescriptorDocumentDeleted",
          "EServiceDescriptorInterfaceAdded",
          "EServiceDescriptorInterfaceUpdated",
          "EServiceDescriptorInterfaceDeleted",
          "EServiceRiskAnalysisAdded",
          "EServiceRiskAnalysisUpdated",
          "EServiceRiskAnalysisDeleted",
          "EServiceDescriptorQuotasUpdated"
        ),
      },
      () => {
        logger.info(`No auth update needed for ${decodedMessage.type} message`);
      }
    )
    .exhaustive();
}

export async function sendCatalogPurposeUpdate(
  decodedMessage: PurposeEventEnvelopeV2,
  readModelService: ReadModelService,
  authService: AuthorizationService,
  logger: Logger,
  correlationId: string
): Promise<void> {
  await match(decodedMessage)
    /**
     * With the new purpose logic, this part should not be needed, since the purpose with the first version
     * in DRAFT or WAITING_FOR_APPROVAL, which are deletable, could not be added to any client.
     * We decided to keep this part since there are still deletable purposes added to clients in the read model.
     *
     * This whole consumer will be replaced/updated once the refactor of the authorization server will be implemented.
     */
    .with(
      {
        type: P.union(
          "DraftPurposeDeleted",
          "WaitingForApprovalPurposeDeleted"
        ),
      },
      async (msg): Promise<void> => {
        const purpose = getPurposeFromEvent(msg, msg.type);

        const purposeClients = await readModelService.getClientsPurpose(
          purpose.id
        );

        const purposeClientsIds = purposeClients.map((client) => client.id);

        await Promise.all(
          purposeClientsIds.map((clientId) =>
            authService.deletePurposeFromClient(
              purpose.id,
              clientId,
              logger,
              correlationId
            )
          )
        );
      }
    )
    .with(
      {
        type: P.union(
          "PurposeVersionSuspendedByConsumer",
          "PurposeVersionSuspendedByProducer",
          "PurposeVersionUnsuspendedByConsumer",
          "PurposeVersionUnsuspendedByProducer",
          "PurposeVersionOverQuotaUnsuspended",
          "NewPurposeVersionActivated",
          "NewPurposeVersionWaitingForApproval",
          "PurposeVersionRejected",
          "PurposeVersionActivated",
          "PurposeArchived"
        ),
      },
      async (msg): Promise<void> => {
        const { purposeId, purposeVersion } = getPurposeVersionFromEvent(
          msg,
          msg.type
        );

        await authService.updatePurposeState(
          purposeId,
          purposeVersion.id,
          purposeVersion.state === purposeVersionState.active
            ? "ACTIVE"
            : "INACTIVE",
          logger,
          correlationId
        );
      }
    )
    .with(
      {
        type: P.union("PurposeActivated", "PurposeWaitingForApproval"),
      },
      async (msg): Promise<void> => {
        const purpose = getPurposeFromEvent(msg, msg.type);

        const purposeVersion = purpose.versions[0];

        if (!purposeVersion) {
          throw missingKafkaMessageDataError("purposeVersion", msg.type);
        }

        await authService.updatePurposeState(
          purpose.id,
          purposeVersion.id,
          purposeVersion.state === purposeVersionState.active
            ? "ACTIVE"
            : "INACTIVE",
          logger,
          correlationId
        );
      }
    )
    .with(
      {
        type: P.union(
          "PurposeAdded",
          "DraftPurposeUpdated",
          "WaitingForApprovalPurposeVersionDeleted",
          "PurposeCloned"
        ),
      },
      () => {
        logger.info(`No auth update needed for ${decodedMessage.type} message`);
      }
    )
    .exhaustive();
}

function processMessage(
  catalogTopicConfig: CatalogTopicConfig,
  agreementTopicConfig: AgreementTopicConfig,
  purposeTopicConfig: PurposeTopicConfig,
  readModelService: ReadModelService,
  authService: AuthorizationService
) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    try {
      function getLoggerInstanceAndCorrelationId(
        decodedMessage: EventEnvelope<{ type: string; event_version: number }>
      ): { correlationId: string; loggerInstance: Logger } {
        const correlationId = decodedMessage.correlation_id || uuidv4();

        const loggerInstance = logger({
          serviceName: "authorization-updater",
          eventType: decodedMessage.type,
          eventVersion: decodedMessage.event_version,
          streamId: decodedMessage.stream_id,
          correlationId,
        });

        loggerInstance.info(
          `Processing ${decodedMessage.type} message - Partition number: ${messagePayload.partition} - Offset: ${messagePayload.message.offset}`
        );

        return { loggerInstance, correlationId };
      }

      await match(messagePayload.topic)
        .with(catalogTopicConfig.catalogTopic, async () => {
          const decodedMessage = decodeKafkaMessage(
            messagePayload.message,
            EServiceEventV2
          );
          const { correlationId, loggerInstance } =
            getLoggerInstanceAndCorrelationId(decodedMessage);
          await sendCatalogAuthUpdate(
            decodedMessage,
            authService,
            loggerInstance,
            correlationId
          );
        })
        .with(agreementTopicConfig.agreementTopic, async () => {
          const decodedMessage = decodeKafkaMessage(
            messagePayload.message,
            AgreementEventV2
          );
          const { correlationId, loggerInstance } =
            getLoggerInstanceAndCorrelationId(decodedMessage);
          await sendAgreementAuthUpdate(
            decodedMessage,
            readModelService,
            authService,
            loggerInstance,
            correlationId
          );
        })
        .with(purposeTopicConfig.purposeTopic, async () => {
          const decodedMessage = decodeKafkaMessage(
            messagePayload.message,
            PurposeEventV2
          );
          const { correlationId, loggerInstance } =
            getLoggerInstanceAndCorrelationId(decodedMessage);
          await sendCatalogPurposeUpdate(
            decodedMessage,
            readModelService,
            authService,
            loggerInstance,
            correlationId
          );
        })
        .otherwise(() => {
          throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
        });
    } catch (e) {
      throw kafkaMessageProcessError(
        messagePayload.topic,
        messagePayload.partition,
        messagePayload.message.offset,
        e
      );
    }
  };
}

try {
  const authMgmtClient = authorizationManagementClientBuilder(
    config.authorizationManagementUrl
  );
  const tokenGenerator = new InteropTokenGenerator(config);
  const refreshableToken = new RefreshableInteropToken(tokenGenerator);
  await refreshableToken.init();

  const authService = authorizationServiceBuilder(
    authMgmtClient,
    refreshableToken
  );

  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );
  await runConsumer(
    config,
    [config.catalogTopic, config.agreementTopic],
    processMessage(
      {
        catalogTopic: config.catalogTopic,
      },
      {
        agreementTopic: config.agreementTopic,
      },
      {
        purposeTopic: config.purposeTopic,
      },
      readModelService,
      authService
    )
  );
} catch (e) {
  genericLogger.error(`An error occurred during initialization:\n${e}`);
}
