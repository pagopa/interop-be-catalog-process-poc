import {
  CorrelationId,
  generateId,
  missingKafkaMessageDataError,
  PurposeEventEnvelopeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  getInteropHeaders,
  logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { getInteropBeClients } from "./clients/clientsProvider.js";

const { authorizationClient } = getInteropBeClients();

export async function handleMessageV2({
  decodedKafkaMessage,
  refreshableToken,
  partition,
  offset,
}: {
  decodedKafkaMessage: PurposeEventEnvelopeV2;
  refreshableToken: RefreshableInteropToken;
  partition: number;
  offset: string;
}): Promise<void> {
  await match(decodedKafkaMessage)
    .with(
      { type: "PurposeArchived" },
      { type: "PurposeVersionArchivedByRevokedDelegation" },
      async (purposeMsg) => {
        const correlationId = purposeMsg.correlation_id
          ? unsafeBrandId<CorrelationId>(purposeMsg.correlation_id)
          : generateId<CorrelationId>();

        const loggerInstance = logger({
          serviceName: "client-purpose-updater",
          eventType: purposeMsg.type,
          eventVersion: purposeMsg.event_version,
          streamId: purposeMsg.stream_id,
          correlationId,
        });

        loggerInstance.info(
          `Processing ${purposeMsg.type} message - Partition number: ${partition} - Offset: ${offset}`
        );

        const token = (await refreshableToken.get()).serialized;

        if (!purposeMsg.data.purpose) {
          throw missingKafkaMessageDataError("purpose", purposeMsg.type);
        }

        await authorizationClient.client.removePurposeFromClients(undefined, {
          params: { purposeId: purposeMsg.data.purpose.id },
          headers: getInteropHeaders({
            token,
            correlationId,
          }),
        });
      }
    )
    .with(
      { type: "PurposeAdded" },
      { type: "DraftPurposeUpdated" },
      { type: "NewPurposeVersionActivated" },
      { type: "NewPurposeVersionWaitingForApproval" },
      { type: "PurposeActivated" },
      { type: "PurposeVersionOverQuotaUnsuspended" },
      { type: "PurposeVersionRejected" },
      { type: "PurposeVersionSuspendedByConsumer" },
      { type: "PurposeVersionSuspendedByProducer" },
      { type: "PurposeVersionUnsuspendedByConsumer" },
      { type: "PurposeVersionUnsuspendedByProducer" },
      { type: "PurposeWaitingForApproval" },
      { type: "WaitingForApprovalPurposeVersionDeleted" },
      { type: "PurposeVersionActivated" },
      { type: "PurposeCloned" },
      { type: "DraftPurposeDeleted" },
      { type: "WaitingForApprovalPurposeDeleted" },
      { type: "PurposeDeletedByRevokedDelegation" },
      () => Promise.resolve
    )
    .exhaustive();
}
