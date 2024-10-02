/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { fail } from "assert";
import {
  DynamoDBClient,
  PutItemCommand,
  PutItemInput,
  ScanCommand,
  ScanCommandOutput,
  ScanInput,
} from "@aws-sdk/client-dynamodb";
import {
  DescriptorId,
  EServiceId,
  generateId,
  genericInternalError,
  GSIPKConsumerIdEServiceId,
  itemState,
  makeGSIPKConsumerIdEServiceId,
  PlatformStatesAgreementEntry,
  PlatformStatesAgreementPK,
  PlatformStatesCatalogEntry,
  TenantId,
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import { inject, vi } from "vitest";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { z } from "zod";

export const config = inject("tokenGenerationReadModelConfig");

export const sleep = (ms: number, mockDate = new Date()): Promise<void> =>
  new Promise((resolve) => {
    vi.useRealTimers();
    setTimeout(resolve, ms);
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

export const writeTokenStateEntry = async (
  tokenStateEntry: TokenGenerationStatesClientPurposeEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  if (!config) {
    fail();
  }
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: tokenStateEntry.PK,
      },
      ...(tokenStateEntry.descriptorState
        ? {
            descriptorState: {
              S: tokenStateEntry.descriptorState,
            },
          }
        : {}),
      ...(tokenStateEntry.descriptorAudience
        ? {
            descriptorAudience: {
              L: tokenStateEntry.descriptorAudience.map((item) => ({
                S: item,
              })),
            },
          }
        : {}),
      ...(tokenStateEntry.descriptorVoucherLifespan
        ? {
            descriptorVoucherLifespan: {
              N: tokenStateEntry.descriptorVoucherLifespan.toString(),
            },
          }
        : {}),
      updatedAt: {
        S: tokenStateEntry.updatedAt,
      },
      consumerId: {
        S: tokenStateEntry.consumerId,
      },
      agreementId: {
        S: tokenStateEntry.agreementId!,
      },
      purposeVersionId: {
        S: tokenStateEntry.purposeVersionId!,
      },
      ...(tokenStateEntry.GSIPK_consumerId_eserviceId
        ? {
            GSIPK_consumerId_eserviceId: {
              S: tokenStateEntry.GSIPK_consumerId_eserviceId,
            },
          }
        : {}),
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
        S: tokenStateEntry.GSIPK_clientId_purposeId!,
      },
      agreementState: {
        S: tokenStateEntry.agreementState!,
      },
      ...(tokenStateEntry.GSIPK_eserviceId_descriptorId
        ? {
            GSIPK_eserviceId_descriptorId: {
              S: tokenStateEntry.GSIPK_eserviceId_descriptorId,
            },
          }
        : {}),
      GSIPK_purposeId: {
        S: tokenStateEntry.GSIPK_purposeId!,
      },
      purposeState: {
        S: tokenStateEntry.purposeState!,
      },
    },
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const readAllTokenStateItems = async (
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
  if (!config) {
    fail();
  }

  const readInput: ScanInput = {
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const commandQuery = new ScanCommand(readInput);
  const data: ScanCommandOutput = await dynamoDBClient.send(commandQuery);

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
        L: catalogEntry.descriptorAudience.map((item) => ({
          S: item,
        })),
      },
      descriptorVoucherLifespan: {
        N: catalogEntry.descriptorVoucherLifespan.toString(),
      },
      version: {
        N: catalogEntry.version.toString(),
      },
      updatedAt: {
        S: catalogEntry.updatedAt,
      },
    },
    TableName: config!.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const getMockAgreementEntry = (
  primaryKey: PlatformStatesAgreementPK,
  GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId(
    {
      consumerId: generateId<TenantId>(),
      eserviceId: generateId<EServiceId>(),
    }
  )
): PlatformStatesAgreementEntry => ({
  PK: primaryKey,
  state: itemState.inactive,
  version: 1,
  updatedAt: new Date().toISOString(),
  GSIPK_consumerId_eserviceId,
  GSISK_agreementTimestamp: new Date().toISOString(),
  agreementDescriptorId: generateId<DescriptorId>(),
});
