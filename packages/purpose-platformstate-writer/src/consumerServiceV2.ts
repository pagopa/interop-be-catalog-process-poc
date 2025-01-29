import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  fromPurposeV2,
  ItemState,
  makePlatformStatesPurposePK,
  missingKafkaMessageDataError,
  PlatformStatesPurposeEntry,
  PlatformStatesPurposePK,
  Purpose,
  PurposeEventEnvelopeV2,
  PurposeV2,
  PurposeVersionId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";
import {
  deletePlatformPurposeEntry,
  getPurposeStateFromPurposeVersions,
  readPlatformPurposeEntry,
  updatePurposeDataInPlatformStatesEntry,
  updatePurposeDataInTokenGenStatesEntries,
  writePlatformPurposeEntry,
  updateTokenGenStatesEntriesWithPurposeAndPlatformStatesData,
  getLastSuspendedOrActivatedPurposeVersion,
} from "./utils.js";

export async function handleMessageV2(
  message: PurposeEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> {
  await match(message)
    .with(
      { type: "PurposeActivated" },
      { type: "PurposeVersionActivated" },
      async (msg) => {
        const { purpose, primaryKey, purposeState, existingPurposeEntry } =
          await getPurposeData({
            dynamoDBClient,
            purposeV2: msg.data.purpose,
            msgType: msg.type,
          });

        const purposeVersion = getLastSuspendedOrActivatedPurposeVersion(
          purpose.versions
        );

        if (existingPurposeEntry) {
          if (existingPurposeEntry.version > msg.version) {
            // Stops processing if the message is older than the purpose entry
            logger.info(
              `Skipping processing of entry ${existingPurposeEntry.PK}. Reason: a more recent entry already exists`
            );
            return Promise.resolve();
          } else {
            // platform-states
            await updatePurposeDataInPlatformStatesEntry({
              dynamoDBClient,
              primaryKey,
              purposeState,
              purposeVersionId: purposeVersion.id,
              version: msg.version,
              logger,
            });
          }
        } else {
          // platform-states
          const purposeEntry: PlatformStatesPurposeEntry = {
            PK: primaryKey,
            state: purposeState,
            purposeVersionId: purposeVersion.id,
            purposeEserviceId: purpose.eserviceId,
            purposeConsumerId: purpose.consumerId,
            version: msg.version,
            updatedAt: new Date().toISOString(),
          };
          await writePlatformPurposeEntry(dynamoDBClient, purposeEntry, logger);
        }

        // token-generation-states
        await updateTokenGenStatesEntriesWithPurposeAndPlatformStatesData(
          dynamoDBClient,
          purpose,
          purposeState,
          purposeVersion.id,
          logger
        );
      }
    )
    .with(
      { type: "NewPurposeVersionActivated" },
      { type: "PurposeVersionSuspendedByConsumer" },
      { type: "PurposeVersionSuspendedByProducer" },
      { type: "PurposeVersionUnsuspendedByConsumer" },
      { type: "PurposeVersionUnsuspendedByProducer" },
      async (msg) => {
        const { purpose, primaryKey, purposeState, existingPurposeEntry } =
          await getPurposeData({
            dynamoDBClient,
            purposeV2: msg.data.purpose,
            msgType: msg.type,
          });

        const purposeVersionId = unsafeBrandId<PurposeVersionId>(
          msg.data.versionId
        );

        if (
          !existingPurposeEntry ||
          existingPurposeEntry.version > msg.version
        ) {
          // Stops processing if the message is older than the purpose entry or if it doesn't exist
          logger.info(
            `Skipping processing of entry ${primaryKey}. Reason: ${
              !existingPurposeEntry
                ? "entry not found in platform-states"
                : "a more recent entry already exists"
            }`
          );
          return Promise.resolve();
        } else {
          // platform-states
          await updatePurposeDataInPlatformStatesEntry({
            dynamoDBClient,
            primaryKey,
            purposeState,
            purposeVersionId,
            version: msg.version,
            logger,
          });

          // token-generation-states
          await updatePurposeDataInTokenGenStatesEntries({
            dynamoDBClient,
            purposeId: purpose.id,
            purposeState,
            purposeVersionId,
            logger,
          });
        }
      }
    )
    .with(
      { type: "PurposeArchived" },
      { type: "PurposeVersionArchivedByRevokedDelegation" },
      async (msg) => {
        const { purpose, primaryKey } = await getPurposeData({
          dynamoDBClient,
          purposeV2: msg.data.purpose,
          msgType: msg.type,
        });

        // platform-states
        await deletePlatformPurposeEntry(dynamoDBClient, primaryKey, logger);

        // token-generation-states
        await updatePurposeDataInTokenGenStatesEntries({
          dynamoDBClient,
          purposeId: purpose.id,
          purposeState: getPurposeStateFromPurposeVersions(purpose.versions),
          purposeVersionId: unsafeBrandId(msg.data.versionId),
          logger,
        });
      }
    )
    .with(
      { type: "DraftPurposeDeleted" },
      { type: "WaitingForApprovalPurposeDeleted" },
      { type: "PurposeAdded" },
      { type: "DraftPurposeUpdated" },
      { type: "NewPurposeVersionWaitingForApproval" },
      { type: "PurposeVersionOverQuotaUnsuspended" },
      { type: "PurposeVersionRejected" },
      { type: "PurposeWaitingForApproval" },
      { type: "WaitingForApprovalPurposeVersionDeleted" },
      { type: "PurposeCloned" },
      { type: "PurposeDeletedByRevokedDelegation" },
      () => Promise.resolve()
    )
    .exhaustive();
}

const getPurposeData = async ({
  dynamoDBClient,
  purposeV2,
  msgType,
}: {
  dynamoDBClient: DynamoDBClient;
  purposeV2: PurposeV2 | undefined;
  msgType: string;
}): Promise<{
  purpose: Purpose;
  primaryKey: PlatformStatesPurposePK;
  purposeState: ItemState;
  existingPurposeEntry: PlatformStatesPurposeEntry | undefined;
}> => {
  if (!purposeV2) {
    throw missingKafkaMessageDataError("purpose", msgType);
  }
  const purpose = fromPurposeV2(purposeV2);
  const primaryKey = makePlatformStatesPurposePK(purpose.id);

  const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);
  const existingPurposeEntry = await readPlatformPurposeEntry(
    dynamoDBClient,
    primaryKey
  );

  return { purpose, primaryKey, purposeState, existingPurposeEntry };
};
