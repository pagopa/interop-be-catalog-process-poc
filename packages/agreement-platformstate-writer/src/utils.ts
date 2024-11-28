import {
  AgreementId,
  agreementState,
  AgreementState,
  genericInternalError,
  GSIPKConsumerIdEServiceId,
  GSIPKEServiceIdDescriptorId,
  itemState,
  ItemState,
  PlatformStatesAgreementEntry,
  PlatformStatesAgreementPK,
  PlatformStatesCatalogEntry,
  PlatformStatesEServiceDescriptorPK,
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import {
  AttributeValue,
  DeleteItemCommand,
  DeleteItemInput,
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
  PutItemCommand,
  PutItemInput,
  QueryCommand,
  QueryCommandOutput,
  QueryInput,
  UpdateItemCommand,
  UpdateItemInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { z } from "zod";
import { config } from "./config/config.js";

export const writeAgreementEntry = async (
  agreementEntry: PlatformStatesAgreementEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: agreementEntry.PK,
      },
      state: {
        S: agreementEntry.state,
      },
      version: {
        N: agreementEntry.version.toString(),
      },
      updatedAt: {
        S: agreementEntry.updatedAt,
      },
      GSIPK_consumerId_eserviceId: {
        S: agreementEntry.GSIPK_consumerId_eserviceId,
      },
      GSISK_agreementTimestamp: {
        S: agreementEntry.GSISK_agreementTimestamp,
      },
      agreementDescriptorId: {
        S: agreementEntry.agreementDescriptorId,
      },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const readAgreementEntry = async (
  primaryKey: PlatformStatesAgreementPK,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesAgreementEntry | undefined> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: primaryKey },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

  if (!data.Item) {
    return undefined;
  } else {
    const unmarshalled = unmarshall(data.Item);
    const agreementEntry = PlatformStatesAgreementEntry.safeParse(unmarshalled);

    if (!agreementEntry.success) {
      throw genericInternalError(
        `Unable to parse agreement entry item: result ${JSON.stringify(
          agreementEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return agreementEntry.data;
  }
};

export const deleteAgreementEntry = async (
  primaryKey: PlatformStatesAgreementPK,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: DeleteItemInput = {
    Key: {
      PK: { S: primaryKey },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new DeleteItemCommand(input);
  await dynamoDBClient.send(command);
};

export const updateAgreementStateInPlatformStatesEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesAgreementPK,
  state: ItemState,
  version: number
): Promise<void> => {
  const input: UpdateItemInput = {
    ConditionExpression: "attribute_exists(PK)",
    Key: {
      PK: {
        S: primaryKey,
      },
    },
    ExpressionAttributeValues: {
      ":newState": {
        S: state,
      },
      ":newVersion": {
        N: version.toString(),
      },
      ":newUpdatedAt": {
        S: new Date().toISOString(),
      },
    },
    ExpressionAttributeNames: {
      "#state": "state",
    },
    UpdateExpression:
      "SET #state = :newState, version = :newVersion, updatedAt = :newUpdatedAt",
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
};

export const agreementStateToItemState = (state: AgreementState): ItemState =>
  state === agreementState.active ? itemState.active : itemState.inactive;

export const updateAgreementStateOnTokenStatesEntries = async ({
  entriesToUpdate,
  agreementState,
  dynamoDBClient,
}: {
  entriesToUpdate: TokenGenerationStatesClientPurposeEntry[];
  agreementState: AgreementState;
  dynamoDBClient: DynamoDBClient;
}): Promise<void> => {
  for (const entry of entriesToUpdate) {
    const input: UpdateItemInput = {
      // ConditionExpression to avoid upsert
      ConditionExpression: "attribute_exists(PK)",
      Key: {
        PK: {
          S: entry.PK,
        },
      },
      ExpressionAttributeValues: {
        ":newState": {
          S: agreementStateToItemState(agreementState),
        },
        ":newUpdatedAt": {
          S: new Date().toISOString(),
        },
      },
      UpdateExpression:
        "SET agreementState = :newState, updatedAt = :newUpdatedAt",
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      ReturnValues: "NONE",
    };
    const command = new UpdateItemCommand(input);
    await dynamoDBClient.send(command);
  }
};

export const updateAgreementStateAndDescriptorInfoOnTokenStatesEntries =
  async ({
    entriesToUpdate,
    agreementId,
    agreementState,
    dynamoDBClient,
    GSIPK_eserviceId_descriptorId,
    catalogEntry,
  }: {
    entriesToUpdate: TokenGenerationStatesClientPurposeEntry[];
    agreementId: AgreementId;
    agreementState: AgreementState;
    dynamoDBClient: DynamoDBClient;
    GSIPK_eserviceId_descriptorId: GSIPKEServiceIdDescriptorId;
    catalogEntry: PlatformStatesCatalogEntry | undefined;
  }): Promise<void> => {
    for (const entry of entriesToUpdate) {
      const additionalDescriptorInfo =
        catalogEntry &&
        (!entry.descriptorState ||
          !entry.descriptorAudience ||
          !entry.descriptorVoucherLifespan);

      const additionalAttributesToSet: Record<string, AttributeValue> =
        additionalDescriptorInfo
          ? {
              ":descriptorState": {
                S: catalogEntry.state,
              },
              ":descriptorAudience": {
                L: catalogEntry.descriptorAudience.map((item) => ({
                  S: item,
                })),
              },
              ":descriptorVoucherLifespan": {
                N: catalogEntry.descriptorVoucherLifespan.toString(),
              },
            }
          : {};
      const input: UpdateItemInput = {
        // ConditionExpression to avoid upsert
        ConditionExpression: "attribute_exists(PK)",
        Key: {
          PK: {
            S: entry.PK,
          },
        },
        ExpressionAttributeValues: {
          ":agreementId": {
            S: agreementId,
          },
          ":gsiEServiceIdDescriptorId": {
            S: GSIPK_eserviceId_descriptorId,
          },
          ":newState": {
            S: agreementStateToItemState(agreementState),
          },
          ":newUpdatedAt": {
            S: new Date().toISOString(),
          },
          ...additionalAttributesToSet,
        },
        UpdateExpression:
          "SET agreementId = :agreementId, agreementState = :newState, GSIPK_eserviceId_descriptorId = :gsiEServiceIdDescriptorId, updatedAt = :newUpdatedAt".concat(
            additionalDescriptorInfo
              ? ", descriptorState = :descriptorState, descriptorAudience = :descriptorAudience, descriptorVoucherLifespan = :descriptorVoucherLifespan"
              : ""
          ),
        TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
        ReturnValues: "NONE",
      };
      const command = new UpdateItemCommand(input);
      await dynamoDBClient.send(command);
    }
  };

export const readPlatformStateAgreementEntriesByConsumerIdEserviceId = async (
  consumerId_eserviceId: GSIPKConsumerIdEServiceId,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesAgreementEntry[]> => {
  const runPaginatedQuery = async (
    consumerId_eserviceId: GSIPKConsumerIdEServiceId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<PlatformStatesAgreementEntry[]> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNamePlatform,
      IndexName: "Agreement",
      KeyConditionExpression: `GSIPK_consumerId_eserviceId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: consumerId_eserviceId },
      },
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false,
    };
    const command = new QueryCommand(input);
    const data: QueryCommandOutput = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read platform state agreement entries: result ${JSON.stringify(
          data
        )} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const agreementEntries = z
        .array(PlatformStatesAgreementEntry)
        .safeParse(unmarshalledItems);

      if (!agreementEntries.success) {
        throw genericInternalError(
          `Unable to parse platform state entry items: result ${JSON.stringify(
            agreementEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      if (!data.LastEvaluatedKey) {
        return agreementEntries.data;
      } else {
        return [
          ...agreementEntries.data,
          ...(await runPaginatedQuery(
            consumerId_eserviceId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(
    consumerId_eserviceId,
    dynamoDBClient,
    undefined
  );
};

export const updateAgreementStateAndDescriptorInfoOnTokenStates = async ({
  GSIPK_consumerId_eserviceId,
  agreementId,
  agreementState,
  dynamoDBClient,
  GSIPK_eserviceId_descriptorId,
  catalogEntry,
}: {
  GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId;
  agreementId: AgreementId;
  agreementState: AgreementState;
  dynamoDBClient: DynamoDBClient;
  GSIPK_eserviceId_descriptorId: GSIPKEServiceIdDescriptorId;
  catalogEntry: PlatformStatesCatalogEntry | undefined;
}): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
  const runPaginatedQuery = async (
    consumerId_eserviceId: GSIPKConsumerIdEServiceId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Agreement",
      KeyConditionExpression: `GSIPK_consumerId_eserviceId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: consumerId_eserviceId },
      },
      ExclusiveStartKey: exclusiveStartKey,
    };
    const command = new QueryCommand(input);
    const data: QueryCommandOutput = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read token state entries: result ${JSON.stringify(data)} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const tokenStateEntries = z
        .array(TokenGenerationStatesClientPurposeEntry)
        .safeParse(unmarshalledItems);

      if (!tokenStateEntries.success) {
        throw genericInternalError(
          `Unable to parse token state entry item: result ${JSON.stringify(
            tokenStateEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      await updateAgreementStateAndDescriptorInfoOnTokenStatesEntries({
        entriesToUpdate: tokenStateEntries.data,
        agreementId,
        agreementState,
        dynamoDBClient,
        GSIPK_eserviceId_descriptorId,
        catalogEntry,
      });

      if (!data.LastEvaluatedKey) {
        return tokenStateEntries.data;
      } else {
        return [
          ...tokenStateEntries.data,
          ...(await runPaginatedQuery(
            consumerId_eserviceId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(
    GSIPK_consumerId_eserviceId,
    dynamoDBClient,
    undefined
  );
};

export const extractAgreementIdFromAgreementPK = (
  pk: PlatformStatesAgreementPK
): AgreementId => {
  const substrings = pk.split("#");
  const agreementId = substrings[1];
  const result = AgreementId.safeParse(agreementId);

  if (!result.success) {
    throw genericInternalError(
      `Unable to parse agreement PK: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(agreementId)} `
    );
  }
  return result.data;
};

export const updateAgreementStateOnTokenStates = async ({
  GSIPK_consumerId_eserviceId,
  agreementState,
  dynamoDBClient,
}: {
  GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId;
  agreementState: AgreementState;
  dynamoDBClient: DynamoDBClient;
}): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
  const runPaginatedQuery = async (
    consumerId_eserviceId: GSIPKConsumerIdEServiceId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Agreement",
      KeyConditionExpression: `GSIPK_consumerId_eserviceId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: consumerId_eserviceId },
      },
      ExclusiveStartKey: exclusiveStartKey,
    };
    const command = new QueryCommand(input);
    const data: QueryCommandOutput = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read token state entries: result ${JSON.stringify(data)} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const tokenStateEntries = z
        .array(TokenGenerationStatesClientPurposeEntry)
        .safeParse(unmarshalledItems);

      if (!tokenStateEntries.success) {
        throw genericInternalError(
          `Unable to parse token state entry item: result ${JSON.stringify(
            tokenStateEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      await updateAgreementStateOnTokenStatesEntries({
        entriesToUpdate: tokenStateEntries.data,
        agreementState,
        dynamoDBClient,
      });

      if (!data.LastEvaluatedKey) {
        return tokenStateEntries.data;
      } else {
        return [
          ...tokenStateEntries.data,
          ...(await runPaginatedQuery(
            consumerId_eserviceId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(
    GSIPK_consumerId_eserviceId,
    dynamoDBClient,
    undefined
  );
};

export const readCatalogEntry = async (
  primaryKey: PlatformStatesEServiceDescriptorPK,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesCatalogEntry | undefined> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: primaryKey },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

  if (!data.Item) {
    return undefined;
  } else {
    const unmarshalled = unmarshall(data.Item);
    const catalogEntry = PlatformStatesCatalogEntry.safeParse(unmarshalled);

    if (!catalogEntry.success) {
      throw genericInternalError(
        `Unable to parse catalog entry item: result ${JSON.stringify(
          catalogEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return catalogEntry.data;
  }
};

export const isLatestAgreement = async (
  GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId,
  agreementId: AgreementId,
  dynamoDBClient: DynamoDBClient
): Promise<boolean> => {
  const agreementEntries =
    await readPlatformStateAgreementEntriesByConsumerIdEserviceId(
      GSIPK_consumerId_eserviceId,
      dynamoDBClient
    );

  if (agreementEntries.length === 0) {
    return true;
  }
  const agreementIdFromEntry = extractAgreementIdFromAgreementPK(
    agreementEntries[0].PK
  );
  return agreementIdFromEntry === agreementId;
};
