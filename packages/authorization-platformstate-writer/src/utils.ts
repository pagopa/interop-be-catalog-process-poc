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
import {
  AgreementId,
  ClientId,
  clientKind,
  ClientKind,
  clientKindTokenGenStates,
  ClientKindTokenGenStates,
  genericInternalError,
  GSIPKClientIdPurposeId,
  GSIPKConsumerIdEServiceId,
  GSIPKKid,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesAgreementPK,
  PlatformStatesAgreementWithGSIPKConsumerIdEServiceIdProjection,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesClientPK,
  PlatformStatesEServiceDescriptorPK,
  PlatformStatesPurposeEntry,
  PlatformStatesPurposePK,
  PurposeId,
  TokenGenerationStatesApiClient,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesConsumerClient,
  TokenGenStatesConsumerClientWithGSIPKClientIdProjection,
  TokenGenStatesConsumerClientWithGSIPKClientIdPurposeIdProjection,
  TokenGenStatesGenericClientWithGSIPKClientIdProjection,
  TokenGenStatesGenericClientWithGSIPKKidProjection,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { z } from "zod";
import { config } from "./config/config.js";

export const deleteEntriesFromTokenGenStatesByKid = async (
  GSIPK_kid: GSIPKKid,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const runPaginatedQuery = async (
    GSIPK_kid: GSIPKKid,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<void> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Kid",
      KeyConditionExpression: `GSIPK_kid = :GSIPK_kid`,
      ExpressionAttributeValues: {
        ":GSIPK_kid": { S: GSIPK_kid },
      },
      ExclusiveStartKey: exclusiveStartKey,
    };
    const command = new QueryCommand(input);
    const data: QueryCommandOutput = await dynamoDBClient.send(command);
    if (!data.Items) {
      throw genericInternalError(
        `Unable to read token-generation-states entries: result ${JSON.stringify(
          data
        )} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const tokenGenStatesEntries = z
        .array(TokenGenStatesGenericClientWithGSIPKKidProjection)
        .safeParse(unmarshalledItems);

      if (!tokenGenStatesEntries.success) {
        throw genericInternalError(
          `Unable to parse token-generation-states entries: result ${JSON.stringify(
            tokenGenStatesEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      for (const entry of tokenGenStatesEntries.data) {
        await deleteClientEntryFromTokenGenerationStates(
          entry.PK,
          dynamoDBClient
        );
      }

      if (data.LastEvaluatedKey) {
        await runPaginatedQuery(
          GSIPK_kid,
          dynamoDBClient,
          data.LastEvaluatedKey
        );
      }
    }
  };

  await runPaginatedQuery(GSIPK_kid, dynamoDBClient, undefined);
};

export const deleteClientEntryFromPlatformStates = async (
  pk: PlatformStatesClientPK,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: DeleteItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new DeleteItemCommand(input);
  await dynamoDBClient.send(command);
};

export const deleteEntriesFromTokenGenStatesByClientId = async (
  GSIPK_client: ClientId,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const runPaginatedQuery = async (
    GSIPK_client: ClientId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<void> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Client",
      KeyConditionExpression: `GSIPK_clientId = :GSIPK_clientId`,
      ExpressionAttributeValues: {
        ":GSIPK_clientId": { S: GSIPK_client },
      },
      ExclusiveStartKey: exclusiveStartKey,
    };
    const command = new QueryCommand(input);
    const data: QueryCommandOutput = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read token-generation-states entries: result ${JSON.stringify(
          data
        )} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const tokenGenStatesEntries = z
        .array(TokenGenStatesGenericClientWithGSIPKClientIdProjection)
        .safeParse(unmarshalledItems);

      if (!tokenGenStatesEntries.success) {
        throw genericInternalError(
          `Unable to parse token-generation-states entries: result ${JSON.stringify(
            tokenGenStatesEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      for (const entry of tokenGenStatesEntries.data) {
        await deleteClientEntryFromTokenGenerationStates(
          entry.PK,
          dynamoDBClient
        );
      }

      if (data.LastEvaluatedKey) {
        await runPaginatedQuery(
          GSIPK_client,
          dynamoDBClient,
          data.LastEvaluatedKey
        );
      }
    }
  };

  await runPaginatedQuery(GSIPK_client, dynamoDBClient, undefined);
};

export const deleteClientEntryFromTokenGenerationStates = async (
  entryToDeletePK:
    | TokenGenerationStatesClientKidPK
    | TokenGenerationStatesClientKidPurposePK,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: DeleteItemInput = {
    Key: {
      PK: { S: entryToDeletePK },
    },
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new DeleteItemCommand(input);
  await dynamoDBClient.send(command);
};

export const readPlatformClientEntry = async (
  primaryKey: PlatformStatesClientPK,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesClientEntry | undefined> => {
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
    const clientEntry = PlatformStatesClientEntry.safeParse(unmarshalled);

    if (!clientEntry.success) {
      throw genericInternalError(
        `Unable to parse platform-states client entry: result ${JSON.stringify(
          clientEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return clientEntry.data;
  }
};

const readTokenGenStatesConsumerClientsByGSIPKClientPurpose = async (
  GSIPK_clientId_purposeId: GSIPKClientIdPurposeId,
  dynamoDBClient: DynamoDBClient,
  exclusiveStartKey?: Record<string, AttributeValue>
): Promise<{
  tokenGenStatesEntries: TokenGenStatesConsumerClientWithGSIPKClientIdPurposeIdProjection[];
  lastEvaluatedKey: Record<string, AttributeValue> | undefined;
}> => {
  const input: QueryInput = {
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
    IndexName: "ClientPurpose",
    KeyConditionExpression: `GSIPK_clientId_purposeId = :GSIPK_clientId_purposeId`,
    ExpressionAttributeValues: {
      ":GSIPK_clientId_purposeId": { S: GSIPK_clientId_purposeId },
    },
    ExclusiveStartKey: exclusiveStartKey,
  };
  const command = new QueryCommand(input);
  const data: QueryCommandOutput = await dynamoDBClient.send(command);

  if (!data.Items) {
    throw genericInternalError(
      `Unable to read token-generation-states entries: result ${JSON.stringify(
        data
      )} `
    );
  } else {
    const unmarshalledItems = data.Items.map((item) => unmarshall(item));

    const tokenGenStatesEntries = z
      .array(TokenGenStatesConsumerClientWithGSIPKClientIdPurposeIdProjection)
      .safeParse(unmarshalledItems);

    if (!tokenGenStatesEntries.success) {
      throw genericInternalError(
        `Unable to parse token-generation-states entries: result ${JSON.stringify(
          tokenGenStatesEntries
        )} - data ${JSON.stringify(data)} `
      );
    }
    return {
      tokenGenStatesEntries: tokenGenStatesEntries.data,
      lastEvaluatedKey: data.LastEvaluatedKey,
    };
  }
};

export const deleteEntriesFromTokenGenStatesByGSIPKClientIdPurposeId = async (
  GSIPK_clientId_purposeId: GSIPKClientIdPurposeId,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const runPaginatedQuery = async (
    GSIPK_clientId_purposeId: GSIPKClientIdPurposeId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<void> => {
    const res = await readTokenGenStatesConsumerClientsByGSIPKClientPurpose(
      GSIPK_clientId_purposeId,
      dynamoDBClient,
      exclusiveStartKey
    );

    for (const entry of res.tokenGenStatesEntries) {
      await deleteClientEntryFromTokenGenerationStates(
        entry.PK,
        dynamoDBClient
      );
    }

    if (res.lastEvaluatedKey) {
      await runPaginatedQuery(
        GSIPK_clientId_purposeId,
        dynamoDBClient,
        res.lastEvaluatedKey
      );
    }
  };
  await runPaginatedQuery(GSIPK_clientId_purposeId, dynamoDBClient);
};

export const convertEntriesToClientKidInTokenGenerationStates = async (
  GSIPK_clientId_purposeId: GSIPKClientIdPurposeId,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const runPaginatedQuery = async (
    GSIPK_clientId_purposeId: GSIPKClientIdPurposeId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<
    TokenGenStatesConsumerClientWithGSIPKClientIdPurposeIdProjection[]
  > => {
    const res = await readTokenGenStatesConsumerClientsByGSIPKClientPurpose(
      GSIPK_clientId_purposeId,
      dynamoDBClient,
      exclusiveStartKey
    );

    // convert entries
    for (const entry of res.tokenGenStatesEntries) {
      const newEntry: TokenGenerationStatesConsumerClient = {
        PK: makeTokenGenerationStatesClientKidPK({
          clientId: entry.GSIPK_clientId,
          kid: entry.GSIPK_kid,
        }),
        consumerId: entry.consumerId,
        clientKind: entry.clientKind,
        publicKey: entry.publicKey,
        GSIPK_clientId: entry.GSIPK_clientId,
        GSIPK_kid: entry.GSIPK_kid,
        updatedAt: new Date().toISOString(),
      };

      // write the new one
      await writeTokenGenStatesConsumerClient(newEntry, dynamoDBClient);

      // delete the old one
      await deleteClientEntryFromTokenGenerationStates(
        entry.PK,
        dynamoDBClient
      );
    }

    if (!res.lastEvaluatedKey) {
      return res.tokenGenStatesEntries;
    } else {
      return [
        ...res.tokenGenStatesEntries,
        ...(await runPaginatedQuery(
          GSIPK_clientId_purposeId,
          dynamoDBClient,
          res.lastEvaluatedKey
        )),
      ];
    }
  };
  await runPaginatedQuery(GSIPK_clientId_purposeId, dynamoDBClient);
};

export const writeTokenGenStatesApiClient = async (
  tokenGenStatesApiClient: TokenGenerationStatesApiClient,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: tokenGenStatesApiClient.PK,
      },
      updatedAt: {
        S: tokenGenStatesApiClient.updatedAt,
      },
      consumerId: {
        S: tokenGenStatesApiClient.consumerId,
      },
      clientKind: {
        S: tokenGenStatesApiClient.clientKind,
      },
      publicKey: {
        S: tokenGenStatesApiClient.publicKey,
      },
      GSIPK_clientId: {
        S: tokenGenStatesApiClient.GSIPK_clientId,
      },
      GSIPK_kid: {
        S: tokenGenStatesApiClient.GSIPK_kid,
      },
    },
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const readPlatformCatalogEntry = async (
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
        `Unable to parse platform-states catalog entry: result ${JSON.stringify(
          catalogEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return catalogEntry.data;
  }
};

export const readPlatformAgreementEntryByGSIPKConsumerIdEServiceId = async (
  gsiPKConsumerIdEServiceId: GSIPKConsumerIdEServiceId,
  dynamoDBClient: DynamoDBClient
): Promise<
  PlatformStatesAgreementWithGSIPKConsumerIdEServiceIdProjection | undefined
> => {
  const input: QueryInput = {
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    IndexName: "Agreement",
    KeyConditionExpression: `GSIPK_consumerId_eserviceId = :GSIPK_consumerId_eserviceId`,
    ExpressionAttributeValues: {
      ":GSIPK_consumerId_eserviceId": { S: gsiPKConsumerIdEServiceId },
    },
    ScanIndexForward: false,
  };
  const command = new QueryCommand(input);
  const data: QueryCommandOutput = await dynamoDBClient.send(command);

  if (!data.Items) {
    return undefined;
  } else {
    const unmarshalledItems = data.Items.map((item) => unmarshall(item));
    const platformAgreementEntries = z
      .array(PlatformStatesAgreementWithGSIPKConsumerIdEServiceIdProjection)
      .safeParse(unmarshalledItems);

    if (platformAgreementEntries.success) {
      return platformAgreementEntries.data[0];
    } else {
      throw genericInternalError(
        `Unable to parse platform-states agreement entries: result ${JSON.stringify(
          platformAgreementEntries
        )} `
      );
    }
  }
};

export const readPlatformPurposeEntry = async (
  primaryKey: PlatformStatesPurposePK,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesPurposeEntry | undefined> => {
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
    const purposeEntry = PlatformStatesPurposeEntry.safeParse(unmarshalled);

    if (!purposeEntry.success) {
      throw genericInternalError(
        `Unable to parse platform-states purpose entry: result ${JSON.stringify(
          purposeEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return purposeEntry.data;
  }
};

export const upsertTokenGenStatesConsumerClient = async (
  tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    Item: {
      PK: {
        S: tokenGenStatesConsumerClient.PK,
      },
      ...(tokenGenStatesConsumerClient.descriptorState
        ? {
            descriptorState: {
              S: tokenGenStatesConsumerClient.descriptorState,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.descriptorAudience
        ? {
            descriptorAudience: {
              L: tokenGenStatesConsumerClient.descriptorAudience.map(
                (item) => ({
                  S: item,
                })
              ),
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.descriptorVoucherLifespan
        ? {
            descriptorVoucherLifespan: {
              N: tokenGenStatesConsumerClient.descriptorVoucherLifespan.toString(),
            },
          }
        : {}),
      updatedAt: {
        S: tokenGenStatesConsumerClient.updatedAt,
      },
      consumerId: {
        S: tokenGenStatesConsumerClient.consumerId,
      },
      ...(tokenGenStatesConsumerClient.agreementId
        ? {
            agreementId: {
              S: tokenGenStatesConsumerClient.agreementId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.purposeVersionId
        ? {
            purposeVersionId: {
              S: tokenGenStatesConsumerClient.purposeVersionId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.GSIPK_consumerId_eserviceId
        ? {
            GSIPK_consumerId_eserviceId: {
              S: tokenGenStatesConsumerClient.GSIPK_consumerId_eserviceId,
            },
          }
        : {}),
      clientKind: {
        S: tokenGenStatesConsumerClient.clientKind,
      },
      publicKey: {
        S: tokenGenStatesConsumerClient.publicKey,
      },
      GSIPK_clientId: {
        S: tokenGenStatesConsumerClient.GSIPK_clientId,
      },
      GSIPK_kid: {
        S: tokenGenStatesConsumerClient.GSIPK_kid,
      },
      ...(tokenGenStatesConsumerClient.GSIPK_clientId_purposeId
        ? {
            GSIPK_clientId_purposeId: {
              S: tokenGenStatesConsumerClient.GSIPK_clientId_purposeId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.agreementState
        ? {
            agreementState: {
              S: tokenGenStatesConsumerClient.agreementState,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.GSIPK_eserviceId_descriptorId
        ? {
            GSIPK_eserviceId_descriptorId: {
              S: tokenGenStatesConsumerClient.GSIPK_eserviceId_descriptorId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.GSIPK_purposeId
        ? {
            GSIPK_purposeId: {
              S: tokenGenStatesConsumerClient.GSIPK_purposeId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.purposeState
        ? {
            purposeState: {
              S: tokenGenStatesConsumerClient.purposeState,
            },
          }
        : {}),
    },
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const writeTokenGenStatesConsumerClient = async (
  tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: tokenGenStatesConsumerClient.PK,
      },
      ...(tokenGenStatesConsumerClient.descriptorState
        ? {
            descriptorState: {
              S: tokenGenStatesConsumerClient.descriptorState,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.descriptorAudience
        ? {
            descriptorAudience: {
              L: tokenGenStatesConsumerClient.descriptorAudience.map(
                (item) => ({
                  S: item,
                })
              ),
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.descriptorVoucherLifespan
        ? {
            descriptorVoucherLifespan: {
              N: tokenGenStatesConsumerClient.descriptorVoucherLifespan.toString(),
            },
          }
        : {}),
      updatedAt: {
        S: tokenGenStatesConsumerClient.updatedAt,
      },
      consumerId: {
        S: tokenGenStatesConsumerClient.consumerId,
      },
      ...(tokenGenStatesConsumerClient.agreementId
        ? {
            agreementId: {
              S: tokenGenStatesConsumerClient.agreementId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.purposeVersionId
        ? {
            purposeVersionId: {
              S: tokenGenStatesConsumerClient.purposeVersionId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.GSIPK_consumerId_eserviceId
        ? {
            GSIPK_consumerId_eserviceId: {
              S: tokenGenStatesConsumerClient.GSIPK_consumerId_eserviceId,
            },
          }
        : {}),
      clientKind: {
        S: tokenGenStatesConsumerClient.clientKind,
      },
      publicKey: {
        S: tokenGenStatesConsumerClient.publicKey,
      },
      GSIPK_clientId: {
        S: tokenGenStatesConsumerClient.GSIPK_clientId,
      },
      GSIPK_kid: {
        S: tokenGenStatesConsumerClient.GSIPK_kid,
      },
      ...(tokenGenStatesConsumerClient.GSIPK_clientId_purposeId
        ? {
            GSIPK_clientId_purposeId: {
              S: tokenGenStatesConsumerClient.GSIPK_clientId_purposeId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.agreementState
        ? {
            agreementState: {
              S: tokenGenStatesConsumerClient.agreementState,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.GSIPK_eserviceId_descriptorId
        ? {
            GSIPK_eserviceId_descriptorId: {
              S: tokenGenStatesConsumerClient.GSIPK_eserviceId_descriptorId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.GSIPK_purposeId
        ? {
            GSIPK_purposeId: {
              S: tokenGenStatesConsumerClient.GSIPK_purposeId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.purposeState
        ? {
            purposeState: {
              S: tokenGenStatesConsumerClient.purposeState,
            },
          }
        : {}),
    },
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const clientKindToTokenGenerationStatesClientKind = (
  kind: ClientKind
): ClientKindTokenGenStates =>
  match<ClientKind, ClientKindTokenGenStates>(kind)
    .with(clientKind.consumer, () => clientKindTokenGenStates.consumer)
    .with(clientKind.api, () => clientKindTokenGenStates.api)
    .exhaustive();

export const writePlatformClientEntry = async (
  clientEntry: PlatformStatesClientEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: clientEntry.PK,
      },
      state: {
        S: clientEntry.state,
      },
      clientPurposesIds: {
        L: clientEntry.clientPurposesIds.map((purposeId) => ({
          S: purposeId,
        })),
      },
      clientKind: {
        S: clientEntry.clientKind,
      },
      clientConsumerId: {
        S: clientEntry.clientConsumerId,
      },
      version: {
        N: clientEntry.version.toString(),
      },
      updatedAt: {
        S: clientEntry.updatedAt,
      },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const readConsumerClientEntriesInTokenGenerationStates = async (
  GSIPK_clientId: ClientId,
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenStatesGenericClientWithGSIPKClientIdProjection[]> => {
  const runPaginatedQuery = async (
    GSIPK_clientId: ClientId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenStatesGenericClientWithGSIPKClientIdProjection[]> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Client",
      KeyConditionExpression: `GSIPK_clientId = :GSIPK_clientId`,
      ExpressionAttributeValues: {
        ":GSIPK_clientId": { S: GSIPK_clientId },
      },
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false,
    };
    const command = new QueryCommand(input);
    const data: QueryCommandOutput = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read token-generation-states client entries: result ${JSON.stringify(
          data
        )} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const clientEntries = z
        .array(TokenGenStatesConsumerClientWithGSIPKClientIdProjection)
        .safeParse(unmarshalledItems);

      if (!clientEntries.success) {
        throw genericInternalError(
          `Unable to parse token-generation-states entries: result ${JSON.stringify(
            clientEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      if (!data.LastEvaluatedKey) {
        return clientEntries.data;
      } else {
        return [
          ...clientEntries.data,
          ...(await runPaginatedQuery(
            GSIPK_clientId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(GSIPK_clientId, dynamoDBClient, undefined);
};

export const setClientPurposeIdsInPlatformStatesEntry = async (
  {
    primaryKey,
    version,
    clientPurposeIds,
  }: {
    primaryKey: PlatformStatesClientPK;
    version: number;
    clientPurposeIds: PurposeId[];
  },
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: UpdateItemInput = {
    ConditionExpression: "attribute_exists(PK)",
    Key: {
      PK: {
        S: primaryKey,
      },
    },
    ExpressionAttributeValues: {
      ":clientPurposesIds": {
        L: clientPurposeIds.map((purposeId) => ({
          S: purposeId,
        })),
      },
      ":newVersion": {
        N: version.toString(),
      },
      ":newUpdatedAt": {
        S: new Date().toISOString(),
      },
    },
    UpdateExpression:
      "SET clientPurposesIds = :clientPurposesIds, updatedAt = :newUpdatedAt, version = :newVersion",
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
};

export const extractKidFromTokenGenStatesEntryPK = (
  pk: TokenGenerationStatesClientKidPK | TokenGenerationStatesClientKidPurposePK
): string => pk.split("#")[2];

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

export const retrievePlatformStatesByPurpose = async (
  purposeId: PurposeId,
  dynamoDBClient: DynamoDBClient
): Promise<{
  purposeEntry?: PlatformStatesPurposeEntry;
  agreementEntry?: PlatformStatesAgreementWithGSIPKConsumerIdEServiceIdProjection;
  catalogEntry?: PlatformStatesCatalogEntry;
}> => {
  const purposePK = makePlatformStatesPurposePK(purposeId);
  const purposeEntry = await readPlatformPurposeEntry(
    purposePK,
    dynamoDBClient
  );

  if (!purposeEntry) {
    return {
      purposeEntry: undefined,
    };
  }

  const agreementGSI = makeGSIPKConsumerIdEServiceId({
    eserviceId: purposeEntry.purposeEserviceId,
    consumerId: purposeEntry.purposeConsumerId,
  });

  const agreementEntry =
    await readPlatformAgreementEntryByGSIPKConsumerIdEServiceId(
      agreementGSI,
      dynamoDBClient
    );

  if (!agreementEntry) {
    return {
      purposeEntry,
      agreementEntry: undefined,
    };
  }

  const catalogPK = makePlatformStatesEServiceDescriptorPK({
    eserviceId: purposeEntry.purposeEserviceId,
    descriptorId: agreementEntry.agreementDescriptorId,
  });
  const catalogEntry = await readPlatformCatalogEntry(
    catalogPK,
    dynamoDBClient
  );

  if (!catalogEntry) {
    return {
      purposeEntry,
      agreementEntry,
      catalogEntry: undefined,
    };
  }
  return {
    purposeEntry,
    agreementEntry,
    catalogEntry,
  };
};

export const upsertPlatformClientEntry = async (
  entry: PlatformStatesClientEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    Item: {
      PK: {
        S: entry.PK,
      },
      state: {
        S: entry.state,
      },
      clientPurposesIds: {
        L: entry.clientPurposesIds.map((purposeId) => ({
          S: purposeId,
        })),
      },
      clientKind: {
        S: entry.clientKind,
      },
      clientConsumerId: {
        S: entry.clientConsumerId,
      },
      version: {
        N: entry.version.toString(),
      },
      updatedAt: {
        S: entry.updatedAt,
      },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const upsertTokenGenStatesApiClient = async (
  entry: TokenGenerationStatesApiClient,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    Item: {
      PK: {
        S: entry.PK,
      },
      consumerId: {
        S: entry.consumerId,
      },
      clientKind: {
        S: entry.clientKind,
      },
      publicKey: {
        S: entry.publicKey,
      },
      GSIPK_clientId: {
        S: entry.GSIPK_clientId,
      },
      GSIPK_kid: {
        S: entry.GSIPK_kid,
      },
      updatedAt: {
        S: entry.updatedAt,
      },
    },
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const updateTokenGenStatesDataForSecondRetrieval = async ({
  dynamoDBClient,
  entry,
  purposeEntry,
  agreementEntry,
  catalogEntry,
}: {
  dynamoDBClient: DynamoDBClient;
  entry: TokenGenerationStatesConsumerClient;
  purposeEntry?: PlatformStatesPurposeEntry;
  agreementEntry?: PlatformStatesAgreementWithGSIPKConsumerIdEServiceIdProjection;
  catalogEntry?: PlatformStatesCatalogEntry;
}): Promise<void> => {
  const setIfChanged = <K extends keyof TokenGenerationStatesConsumerClient>(
    key: K,
    newValue: TokenGenerationStatesConsumerClient[K]
  ): Partial<TokenGenerationStatesConsumerClient> => {
    const oldValue = entry[key];

    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      return !oldValue.every((value) => newValue.includes(value))
        ? { [key]: newValue }
        : {};
    }

    return oldValue !== newValue ? { [key]: newValue } : {};
  };
  const updatedFields: Partial<TokenGenerationStatesConsumerClient> = {
    ...(purposeEntry
      ? {
          ...setIfChanged(
            "GSIPK_consumerId_eserviceId",
            makeGSIPKConsumerIdEServiceId({
              consumerId: purposeEntry.purposeConsumerId,
              eserviceId: purposeEntry.purposeEserviceId,
            })
          ),
          ...setIfChanged("purposeVersionId", purposeEntry.purposeVersionId),
          ...setIfChanged("purposeState", purposeEntry.state),
        }
      : {}),
    ...(purposeEntry && agreementEntry
      ? {
          ...setIfChanged(
            "GSIPK_eserviceId_descriptorId",
            makeGSIPKEServiceIdDescriptorId({
              eserviceId: purposeEntry.purposeEserviceId,
              descriptorId: agreementEntry.agreementDescriptorId,
            })
          ),
          ...setIfChanged("agreementState", agreementEntry.state),
        }
      : {}),
    ...(catalogEntry
      ? {
          ...setIfChanged(
            "descriptorAudience",
            catalogEntry.descriptorAudience
          ),
          ...setIfChanged(
            "descriptorVoucherLifespan",
            catalogEntry.descriptorVoucherLifespan
          ),
          ...setIfChanged("descriptorState", catalogEntry.state),
        }
      : {}),
  };

  if (Object.keys(updatedFields).length > 0) {
    const { expressionAttributeValues, updateExpression } =
      generateUpdateItemInputData(updatedFields);

    const input: UpdateItemInput = {
      ConditionExpression: "attribute_exists(PK)",
      Key: {
        PK: {
          S: entry.PK,
        },
      },
      ExpressionAttributeValues: expressionAttributeValues,
      UpdateExpression: updateExpression,
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      ReturnValues: "NONE",
    };
    const command = new UpdateItemCommand(input);
    await dynamoDBClient.send(command);
  }
};

const convertValueToAttributeValue = (
  value: string | number | boolean | Array<string | number | boolean>
): AttributeValue => {
  if (typeof value === "string") {
    return { S: value };
  } else if (typeof value === "number") {
    return { N: value.toString() };
  } else if (typeof value === "boolean") {
    return { BOOL: value };
  } else if (Array.isArray(value)) {
    return { L: value.map((item) => convertValueToAttributeValue(item)) };
  } else {
    throw genericInternalError(
      `Unsupported DynamoDB type ${typeof value} while converting to AttributeValue`
    );
  }
};

const convertToExpressionAttributeValues = (
  updatedFields: Partial<TokenGenerationStatesConsumerClient>
): Record<string, AttributeValue> => {
  const expressionAttributeValues = Object.keys(updatedFields).reduce(
    (acc, key) => {
      const value = updatedFields[key as keyof typeof updatedFields];
      if (value !== undefined) {
        const dynamoKey = `:${key}`;
        return {
          ...acc,
          [dynamoKey]: convertValueToAttributeValue(value),
        };
      }
      return acc;
    },
    {}
  );

  return {
    ...expressionAttributeValues,
    ":newUpdatedAt": { S: new Date().toISOString() },
  };
};

const generateUpdateItemInputData = (
  updatedFields: Partial<TokenGenerationStatesConsumerClient>
): {
  updateExpression: string;
  expressionAttributeValues: Record<string, AttributeValue>;
} => {
  const expressionAttributeValues =
    convertToExpressionAttributeValues(updatedFields);

  const updateExpressionTmp = Object.keys(updatedFields)
    .map((key) => `${key} = :${key}`)
    .join(", ");

  const updateExpression = `SET updatedAt = :newUpdatedAt, ${updateExpressionTmp}`;

  return {
    updateExpression,
    expressionAttributeValues,
  };
};

export const createTokenGenStatesConsumerClient = ({
  tokenGenStatesClient,
  kid,
  clientId,
  purposeId,
  purposeEntry,
  agreementEntry,
  catalogEntry,
}: {
  tokenGenStatesClient: TokenGenStatesGenericClientWithGSIPKClientIdProjection;
  kid: string;
  clientId: ClientId;
  purposeId: PurposeId;
  purposeEntry?: PlatformStatesPurposeEntry;
  agreementEntry?: PlatformStatesAgreementWithGSIPKConsumerIdEServiceIdProjection;
  catalogEntry?: PlatformStatesCatalogEntry;
}): TokenGenerationStatesConsumerClient => {
  const pk = makeTokenGenerationStatesClientKidPurposePK({
    clientId,
    kid,
    purposeId,
  });

  return {
    PK: pk,
    consumerId: tokenGenStatesClient.consumerId,
    updatedAt: new Date().toISOString(),
    clientKind: clientKindTokenGenStates.consumer,
    publicKey: tokenGenStatesClient.publicKey,
    GSIPK_clientId: tokenGenStatesClient.GSIPK_clientId,
    GSIPK_kid: tokenGenStatesClient.GSIPK_kid,
    GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
      clientId,
      purposeId,
    }),
    GSIPK_purposeId: purposeId,
    ...(purposeEntry && {
      GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
        consumerId: tokenGenStatesClient.consumerId,
        eserviceId: purposeEntry.purposeEserviceId,
      }),
      purposeState: purposeEntry.state,
      purposeVersionId: purposeEntry.purposeVersionId,
    }),
    ...(purposeEntry &&
      agreementEntry && {
        agreementId: extractAgreementIdFromAgreementPK(agreementEntry.PK),
        agreementState: agreementEntry.state,
        GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
          eserviceId: purposeEntry.purposeEserviceId,
          descriptorId: agreementEntry.agreementDescriptorId,
        }),
      }),
    ...(catalogEntry && {
      descriptorState: catalogEntry.state,
      descriptorAudience: catalogEntry.descriptorAudience,
      descriptorVoucherLifespan: catalogEntry.descriptorVoucherLifespan,
    }),
  };
};
