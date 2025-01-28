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
  AuthorizationTopicConfig,
} from "pagopa-interop-commons";
import {
  kafkaMessageProcessError,
  genericInternalError,
  EServiceEventEnvelopeV2,
  EServiceEventV2,
  AgreementEventV2,
  AgreementEventEnvelopeV2,
  PurposeEventEnvelopeV2,
  PurposeEventV2,
  missingKafkaMessageDataError,
  AuthorizationEventV2,
  unsafeBrandId,
  ClientId,
  UserId,
  PurposeId,
  fromClientV2,
  CorrelationId,
  generateId,
} from "pagopa-interop-models";
import { authorizationManagementApi } from "pagopa-interop-api-clients";
import {
  AuthorizationService,
  authorizationServiceBuilder,
} from "./authorizationService.js";
import { config } from "./config/config.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "./readModelService.js";
import { buildAuthorizationManagementClients } from "./authorizationManagementClient.js";
import {
  getDescriptorFromEvent,
  getAgreementFromEvent,
  agreementStateToClientState,
  getPurposeFromEvent,
  getPurposeVersionFromEvent,
  getClientFromEvent,
  descriptorStateToClientState,
  purposeStateToClientState,
} from "./utils.js";

export async function sendCatalogAuthUpdate(
  decodedMessage: EServiceEventEnvelopeV2,
  authService: AuthorizationService,
  logger: Logger,
  correlationId: CorrelationId
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union(
          "EServiceDescriptorPublished",
          "EServiceDescriptorActivated",
          "EServiceDescriptorApprovedByDelegator"
        ),
      },
      async (msg) => {
        const data = getDescriptorFromEvent(msg, decodedMessage.type);
        await authService.updateEServiceState(
          authorizationManagementApi.ClientComponentState.Values.ACTIVE,
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
          authorizationManagementApi.ClientComponentState.Values.INACTIVE,
          data.descriptor.id,
          data.eserviceId,
          data.descriptor.audience,
          data.descriptor.voucherLifespan,
          logger,
          correlationId
        );
      }
    )
    .with({ type: "EServiceDescriptorQuotasUpdated" }, async (msg) => {
      const data = getDescriptorFromEvent(msg, decodedMessage.type);
      await authService.updateEServiceState(
        descriptorStateToClientState(data.descriptor.state),
        data.descriptor.id,
        data.eserviceId,
        data.descriptor.audience,
        data.descriptor.voucherLifespan,
        logger,
        correlationId
      );
    })
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
          "EServiceDescriptorAttributesUpdated",
          "EServiceDescriptionUpdated",
          "EServiceIsDelegableEnabled",
          "EServiceIsDelegableDisabled",
          "EServiceIsClientAccessDelegableEnabled",
          "EServiceIsClientAccessDelegableDisabled",
          "EServiceNameUpdated",
          "EServiceDescriptorSubmittedByDelegate",
          "EServiceDescriptorRejectedByDelegator"
        ),
      },
      () => {
        logger.info(`No auth update needed for ${decodedMessage.type} message`);
      }
    )
    .exhaustive();
}

export async function sendAgreementAuthUpdate(
  decodedMessage: AgreementEventEnvelopeV2,
  readModelService: ReadModelService,
  authService: AuthorizationService,
  logger: Logger,
  correlationId: CorrelationId
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
          "AgreementArchivedByRevokedDelegation"
        ),
      },
      async (msg) => {
        const agreement = getAgreementFromEvent(msg, decodedMessage.type);

        await authService.updateAgreementState(
          agreementStateToClientState(agreement.state),
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

      const eserviceClientState = descriptorStateToClientState(
        descriptor.state
      );

      await authService.updateAgreementAndEServiceStates(
        agreementStateToClientState(agreement.state),
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
          "AgreementSetMissingCertifiedAttributesByPlatform",
          "AgreementArchivedByUpgrade",
          "AgreementDeletedByRevokedDelegation"
        ),
      },
      () => {
        logger.info(`No auth update needed for ${decodedMessage.type} message`);
      }
    )
    .exhaustive();
}

export async function sendPurposeAuthUpdate(
  decodedMessage: PurposeEventEnvelopeV2,
  readModelService: ReadModelService,
  authService: AuthorizationService,
  logger: Logger,
  correlationId: CorrelationId
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
          "WaitingForApprovalPurposeDeleted",
          "PurposeDeletedByRevokedDelegation"
        ),
      },
      async (msg): Promise<void> => {
        const purpose = getPurposeFromEvent(msg, msg.type);

        const purposeClientsIds =
          await readModelService.getClientsIdsFromPurpose(purpose.id);

        await Promise.all(
          purposeClientsIds.map((clientId) =>
            authService.deletePurposeFromClient(
              clientId,
              purpose.id,
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
          "PurposeVersionActivated",
          "PurposeArchived",
          "PurposeVersionArchivedByRevokedDelegation"
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
          purposeStateToClientState(purposeVersion.state),
          logger,
          correlationId
        );
      }
    )
    .with(
      {
        type: "PurposeActivated",
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
          purposeStateToClientState(purposeVersion.state),
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
          "NewPurposeVersionWaitingForApproval",
          "PurposeCloned",
          "PurposeVersionRejected",
          "PurposeWaitingForApproval"
        ),
      },
      () => {
        logger.info(`No auth update needed for ${decodedMessage.type} message`);
      }
    )
    .exhaustive();
}

export async function sendAuthorizationAuthUpdate(
  decodedMessage: AuthorizationEventV2,
  authService: AuthorizationService,
  readModelService: ReadModelService,
  logger: Logger,
  correlationId: CorrelationId
): Promise<void> {
  await match(decodedMessage)
    .with({ type: "ClientAdded" }, async (msg): Promise<void> => {
      const client = getClientFromEvent(msg, msg.type);

      if (!client) {
        throw missingKafkaMessageDataError("client", msg.type);
      }
      await authService.addClient(client, logger, correlationId);
    })
    .with({ type: "ClientDeleted" }, async (msg): Promise<void> => {
      const clientId = unsafeBrandId<ClientId>(msg.data.clientId);

      if (!clientId) {
        throw missingKafkaMessageDataError("client", msg.type);
      }
      await authService.deleteClient(clientId, logger, correlationId);
    })
    .with({ type: "ClientKeyAdded" }, async (msg) => {
      if (!msg.data.client) {
        throw missingKafkaMessageDataError("client", msg.type);
      }
      const client = fromClientV2(msg.data.client);
      const clientId = client.id;
      const kid = msg.data.kid;
      const key = client.keys.find((key) => key.kid === kid);
      if (!key) {
        throw missingKafkaMessageDataError("client", msg.type);
      }
      await authService.addClientKey(clientId, key, logger, correlationId);
    })
    .with({ type: "ClientKeyDeleted" }, async (msg) => {
      if (!msg.data.client) {
        throw missingKafkaMessageDataError("client", msg.type);
      }
      const clientId = unsafeBrandId<ClientId>(msg.data.client.id);
      const kid = msg.data.kid;

      await authService.deleteClientKey(clientId, kid, logger, correlationId);
    })
    .with({ type: "ClientUserAdded" }, async (msg) => {
      if (!msg.data.client) {
        throw missingKafkaMessageDataError("client", msg.type);
      }
      const clientId = unsafeBrandId<ClientId>(msg.data.client.id);
      const userId = unsafeBrandId<UserId>(msg.data.userId);

      await authService.addClientUser(clientId, userId, logger, correlationId);
    })
    .with({ type: "ClientUserDeleted" }, async (msg) => {
      if (!msg.data.client) {
        throw missingKafkaMessageDataError("client", msg.type);
      }
      const clientId = unsafeBrandId<ClientId>(msg.data.client.id);
      const userId = unsafeBrandId<UserId>(msg.data.userId);

      await authService.deleteClientUser(
        clientId,
        userId,
        logger,
        correlationId
      );
    })
    .with({ type: "ClientPurposeAdded" }, async (msg) => {
      if (!msg.data.client) {
        throw missingKafkaMessageDataError("client", msg.type);
      }
      const clientId = unsafeBrandId<ClientId>(msg.data.client.id);
      const purposeId = unsafeBrandId<PurposeId>(msg.data.purposeId);
      await authService.addClientPurpose(
        clientId,
        purposeId,
        readModelService,
        logger,
        correlationId
      );
    })
    .with({ type: "ClientPurposeRemoved" }, async (msg) => {
      if (!msg.data.client) {
        throw missingKafkaMessageDataError("client", msg.type);
      }
      const clientId = unsafeBrandId<ClientId>(msg.data.client.id);
      const purposeId = unsafeBrandId<PurposeId>(msg.data.purposeId);

      await authService.deletePurposeFromClient(
        clientId,
        purposeId,
        logger,
        correlationId
      );
    })
    .with(
      { type: "ProducerKeychainAdded" },
      { type: "ProducerKeychainDeleted" },
      { type: "ProducerKeychainKeyAdded" },
      { type: "ProducerKeychainKeyDeleted" },
      { type: "ProducerKeychainUserAdded" },
      { type: "ProducerKeychainUserDeleted" },
      { type: "ProducerKeychainEServiceAdded" },
      { type: "ProducerKeychainEServiceRemoved" },
      () => Promise.resolve
    )
    .exhaustive();
}

// eslint-disable-next-line max-params
function processMessage(
  catalogTopicConfig: CatalogTopicConfig,
  agreementTopicConfig: AgreementTopicConfig,
  purposeTopicConfig: PurposeTopicConfig,
  authorizationTopicConfig: AuthorizationTopicConfig,
  readModelService: ReadModelService,
  authService: AuthorizationService
) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    try {
      const { decodedMessage, updater } = match(messagePayload.topic)
        .with(catalogTopicConfig.catalogTopic, () => {
          const decodedMessage = decodeKafkaMessage(
            messagePayload.message,
            EServiceEventV2
          );

          const updater = sendCatalogAuthUpdate.bind(
            null,
            decodedMessage,
            authService
          );

          return { decodedMessage, updater };
        })
        .with(agreementTopicConfig.agreementTopic, () => {
          const decodedMessage = decodeKafkaMessage(
            messagePayload.message,
            AgreementEventV2
          );

          const updater = sendAgreementAuthUpdate.bind(
            null,
            decodedMessage,
            readModelService,
            authService
          );

          return { decodedMessage, updater };
        })
        .with(purposeTopicConfig.purposeTopic, () => {
          const decodedMessage = decodeKafkaMessage(
            messagePayload.message,
            PurposeEventV2
          );

          const updater = sendPurposeAuthUpdate.bind(
            null,
            decodedMessage,
            readModelService,
            authService
          );

          return { decodedMessage, updater };
        })
        .with(authorizationTopicConfig.authorizationTopic, () => {
          const decodedMessage = decodeKafkaMessage(
            messagePayload.message,
            AuthorizationEventV2
          );

          const updater = sendAuthorizationAuthUpdate.bind(
            null,
            decodedMessage,
            authService,
            readModelService
          );

          return { decodedMessage, updater };
        })
        .otherwise(() => {
          throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
        });

      const correlationId: CorrelationId = decodedMessage.correlation_id
        ? unsafeBrandId(decodedMessage.correlation_id)
        : generateId();

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

      await updater(loggerInstance, correlationId);
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
  const authMgmtClients = buildAuthorizationManagementClients(
    config.authorizationManagementUrl
  );
  const tokenGenerator = new InteropTokenGenerator(config);
  const refreshableToken = new RefreshableInteropToken(tokenGenerator);
  await refreshableToken.init();

  const authService = authorizationServiceBuilder(
    authMgmtClients,
    refreshableToken
  );

  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );
  await runConsumer(
    config,
    [
      config.catalogTopic,
      config.agreementTopic,
      config.purposeTopic,
      config.authorizationTopic,
    ],
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
      {
        authorizationTopic: config.authorizationTopic,
      },
      readModelService,
      authService
    )
  );
} catch (e) {
  genericLogger.error(`An error occurred during initialization:\n${e}`);
}
