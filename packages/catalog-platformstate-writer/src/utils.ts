import {
  descriptorState,
  DescriptorState,
  genericInternalError,
  GSIPKEServiceIdDescriptorId,
  itemState,
  ItemState,
  PlatformStatesCatalogEntry,
  PlatformStatesEServiceDescriptorPK,
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import {
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

// TO DO scrivere test per vedere se funziona come upsert o solo come update
export const writeCatalogEntry = async (
  catalogEntry: PlatformStatesCatalogEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: catalogEntry.PK,
      },
      state: {
        S: catalogEntry.state,
      },
      descriptorAudience: {
        S: catalogEntry.descriptorAudience,
      },
      version: {
        N: catalogEntry.version.toString(),
      },
      updatedAt: {
        S: catalogEntry.updatedAt,
      },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
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

export const deleteCatalogEntry = async (
  primaryKey: PlatformStatesEServiceDescriptorPK,
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

/*
export const readAllItems = async (
  dynamoDBClient: DynamoDBClient
): Promise<ScanCommandOutput> => {
  const readInput: ScanInput = {
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const commandQuery = new ScanCommand(readInput);
  const read: ScanCommandOutput = await dynamoDBClient.send(commandQuery);
  return read;
};
*/

export const descriptorStateToClientState = (
  state: DescriptorState
): ItemState =>
  state === descriptorState.published || state === descriptorState.deprecated
    ? itemState.active
    : itemState.inactive;

export const updateDescriptorStateInPlatformStatesEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesEServiceDescriptorPK,
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
      ":newUpdateAt": {
        S: new Date().toISOString(),
      },
    },
    ExpressionAttributeNames: {
      "#state": "state",
    },
    UpdateExpression:
      "SET #state = :newState, version = :newVersion, updatedAt = :newUpdateAt",
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ReturnValues: "ALL_NEW",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
};

export const writeTokenStateEntry = async (
  tokenStateEntry: TokenGenerationStatesClientPurposeEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: tokenStateEntry.PK,
      },
      descriptorState: {
        S: tokenStateEntry.descriptorState,
      },
      descriptorAudience: {
        S: tokenStateEntry.descriptorAudience,
      },
      updatedAt: {
        S: tokenStateEntry.updatedAt,
      },
      consumerId: {
        S: tokenStateEntry.consumerId,
      },
      agreementId: {
        S: tokenStateEntry.agreementId,
      },
      purposeVersionId: {
        S: tokenStateEntry.purposeVersionId,
      },
      GSIPK_consumerId_eserviceId: {
        S: tokenStateEntry.GSIPK_consumerId_eserviceId,
      },
      clientKind: {
        S: tokenStateEntry.clientKind,
      },
      publicKey: {
        S: tokenStateEntry.publicKey,
      },
      GSIPK_clientId: {
        S: tokenStateEntry.GSIPK_clientId,
      },
      GSIPK_kid: {
        S: tokenStateEntry.GSIPK_kid,
      },
      GSIPK_clientId_purposeId: {
        S: tokenStateEntry.GSIPK_clientId_purposeId,
      },
      agreementState: {
        S: tokenStateEntry.agreementState,
      },
      GSIPK_eserviceId_descriptorId: {
        S: tokenStateEntry.GSIPK_eserviceId_descriptorId,
      },
      GSIPK_purposeId: {
        S: tokenStateEntry.GSIPK_purposeId,
      },
      purposeState: {
        S: tokenStateEntry.purposeState,
      },
    },
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

/*
export const readTokenStateEntryByEServiceIdAndDescriptorId = async (
  eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenerationStatesClientPurposeEntry | undefined> => {
  const input: QueryInput = {
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
    IndexName: "GSIPK_eserviceId_descriptorId", // Use the name of your Global Secondary Index
    KeyConditionExpression: `GSIPK_eserviceId_descriptorId = :gsiValue`,
    ExpressionAttributeValues: {
      ":gsiValue": { S: eserviceId_descriptorId },
    },
    ScanIndexForward: false,
  };
  const command = new QueryCommand(input);
  const data: QueryCommandOutput = await dynamoDBClient.send(command);

  if (!data.Items) {
    return undefined;
  } else {
    const unmarshalled = unmarshall(data.Items[0]);
    const tokenStateEntry =
      TokenGenerationStatesClientPurposeEntry.safeParse(unmarshalled);

    if (!tokenStateEntry.success) {
      throw genericInternalError(
        `Unable to parse token state entry item: result ${JSON.stringify(
          tokenStateEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return tokenStateEntry.data;
  }
};
*/

export const readTokenStateEntriesByEserviceIdAndDescriptorId = async (
  eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
  const input: QueryInput = {
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
    IndexName: "GSIPK_eserviceId_descriptorId", // Use the name of your Global Secondary Index
    KeyConditionExpression: `GSIPK_eserviceId_descriptorId = :gsi_value`,
    ExpressionAttributeValues: {
      ":gsi_value": { S: eserviceId_descriptorId },
    },
    // ExpressionAttributeNames: {
    //   "#gsi": "GSIPK_eserviceId_descriptorId",
    // },
    ScanIndexForward: false,
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
    return tokenStateEntries.data;
  }
};

export const updateDescriptorStateInTokenGenerationStatesTable = async (
  eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
  descriptorState: DescriptorState,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const entriesToUpdate =
    await readTokenStateEntriesByEserviceIdAndDescriptorId(
      eserviceId_descriptorId,
      dynamoDBClient
    );

  for (const entry of entriesToUpdate) {
    const input: UpdateItemInput = {
      ConditionExpression: "attribute_exists(GSIPK_eserviceId_descriptorId)",
      Key: {
        PK: {
          S: entry.PK,
        },
      },
      ExpressionAttributeValues: {
        ":newState": {
          S: descriptorStateToClientState(descriptorState),
        },
        ":newUpdateAt": {
          S: new Date().toISOString(),
        },
      },
      UpdateExpression:
        "SET descriptorState = :newState, updatedAt = :newUpdateAt",
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      ReturnValues: "ALL_NEW",
    };
    const command = new UpdateItemCommand(input);
    await dynamoDBClient.send(command);
  }
};
