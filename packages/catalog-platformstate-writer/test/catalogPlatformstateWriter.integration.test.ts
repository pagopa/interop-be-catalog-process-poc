import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  ClientId,
  Descriptor,
  EService,
  EServiceDescriptorActivatedV2,
  EServiceDescriptorArchivedV2,
  EServiceDescriptorPublishedV2,
  EServiceDescriptorSuspendedV2,
  EServiceEventEnvelope,
  EServiceId,
  ItemState,
  PlatformStatesCatalogEntry,
  PurposeId,
  TenantId,
  TokenGenerationStatesClientPurposeEntry,
  clientKind,
  descriptorState,
  generateId,
  itemState,
  toEServiceV2,
} from "pagopa-interop-models";
import {
  CreateTableCommand,
  CreateTableInput,
  DeleteTableCommand,
  DeleteTableInput,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  getMockDescriptor,
  getMockEService,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  readCatalogEntry,
  readTokenStateEntriesByEserviceIdAndDescriptorId,
  sleep,
  writeCatalogEntry,
  writeTokenStateEntry,
} from "../src/utils.js";
import { handleMessageV2 } from "../src/consumerServiceV2.js";

import { config } from "./utils.js";

describe("database test", async () => {
  const dynamoDBClient = new DynamoDBClient({
    credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    region: "eu-central-1",
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    endpoint: `http://${config!.tokenGenerationReadModelDbHost}:${
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      config!.tokenGenerationReadModelDbPort
    }`,
  });
  beforeEach(async () => {
    const platformTableDefinition: CreateTableInput = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      TableName: config!.tokenGenerationReadModelTableNamePlatform,
      AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    };
    const command1 = new CreateTableCommand(platformTableDefinition);
    await dynamoDBClient.send(command1);

    const tokenGenerationTableDefinition: CreateTableInput = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      TableName: config!.tokenGenerationReadModelTableNameTokenGeneration,
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "GSIPK_eserviceId_descriptorId", AttributeType: "S" },
      ],
      KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
      GlobalSecondaryIndexes: [
        {
          // TODO: change index name
          IndexName: "gsiIndex",
          KeySchema: [
            {
              AttributeName: "GSIPK_eserviceId_descriptorId",
              KeyType: "HASH",
            },
          ],
          Projection: {
            NonKeyAttributes: [],
            ProjectionType: "ALL",
          },
          // ProvisionedThroughput: {
          //   ReadCapacityUnits: 5,
          //   WriteCapacityUnits: 5,
          // },
        },
      ],
    };
    const command2 = new CreateTableCommand(tokenGenerationTableDefinition);
    const result = await dynamoDBClient.send(command2);
    console.log(result);

    // const tablesResult = await dynamoDBClient.listTables();
    // console.log(tablesResult.TableNames);
  });
  afterEach(async () => {
    const tableToDelete1: DeleteTableInput = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      TableName: config!.tokenGenerationReadModelTableNamePlatform,
    };
    const tableToDelete2: DeleteTableInput = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      TableName: config!.tokenGenerationReadModelTableNameTokenGeneration,
    };
    const command1 = new DeleteTableCommand(tableToDelete1);
    await dynamoDBClient.send(command1);
    const command2 = new DeleteTableCommand(tableToDelete2);
    await dynamoDBClient.send(command2);
  });
  const mockDate = new Date();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  describe("Events V2", async () => {
    const mockEService = getMockEService();
    it.only("EServiceDescriptorActivated", async () => {
      const suspendedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it"],
        interface: getMockDocument(),
        state: descriptorState.suspended,
        publishedAt: new Date(),
        suspendedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [suspendedDescriptor],
      };
      // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

      const publishedDescriptor: Descriptor = {
        ...suspendedDescriptor,
        publishedAt: new Date(),
        suspendedAt: new Date(),
        state: descriptorState.published,
      };
      const updatedEService: EService = {
        ...eservice,
        descriptors: [publishedDescriptor],
      };
      const payload: EServiceDescriptorActivatedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: publishedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const catalogEntryPrimaryKey = `ESERVICEDESCRIPTOR#${eservice.id}#${publishedDescriptor.id}`;
      const previousStateEntry: PlatformStatesCatalogEntry = {
        PK: catalogEntryPrimaryKey,
        state: itemState.inactive,
        descriptorAudience: publishedDescriptor.audience[0],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      // TODO: replace last generateId() with kid
      const tokenStateEntryPK1 = `CLIENTKID#${generateId<ClientId>()}#${generateId()}`;
      const eserviceId_descriptorId = `${eservice.id}#${publishedDescriptor.id}`;
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          PK: tokenStateEntryPK1,
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience[0],
          updatedAt: new Date().toISOString(),
          consumerId: generateId(),
          agreementId: generateId(),
          purposeVersionId: generateId(),
          GSIPK_consumerId_eserviceId: `${generateId<TenantId>()}#${generateId<EServiceId>()}`,
          clientKind: clientKind.consumer,
          publicKey: "PEM",
          GSIPK_clientId: generateId(),
          GSIPK_kid: "KID",
          GSIPK_clientId_purposeId: `${generateId<ClientId>()}#${generateId<PurposeId>()}`,
          agreementState: "ACTIVE",
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          GSIPK_purposeId: generateId(),
          purposeState: itemState.inactive,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = `CLIENTKID#${generateId<ClientId>()}#${generateId()}`;
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          PK: tokenStateEntryPK2,
          descriptorState: itemState.active,
          descriptorAudience: publishedDescriptor.audience[0],
          updatedAt: new Date().toISOString(),
          consumerId: generateId(),
          agreementId: generateId(),
          purposeVersionId: generateId(),
          GSIPK_consumerId_eserviceId: `${generateId<TenantId>()}#${generateId<EServiceId>()}`,
          clientKind: clientKind.consumer,
          publicKey: "PEM",
          GSIPK_clientId: generateId(),
          GSIPK_kid: "KID",
          GSIPK_clientId_purposeId: `${generateId<ClientId>()}#${generateId<PurposeId>()}`,
          agreementState: "ACTIVE",
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          GSIPK_purposeId: generateId(),
          purposeState: itemState.inactive,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      await sleep(1000, mockDate);
      await handleMessageV2(message, dynamoDBClient);

      // platform-states
      const retrievedCatalogEntry = await readCatalogEntry(
        catalogEntryPrimaryKey,
        dynamoDBClient
      );
      const expectedCatalogEntry: PlatformStatesCatalogEntry = {
        ...previousStateEntry,
        state: itemState.active,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedCatalogEntry).toEqual(expectedCatalogEntry);

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStateEntriesByEserviceIdAndDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );
      const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry1,
          descriptorState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry2,
          descriptorState: itemState.active,
          updatedAt: new Date().toISOString(),
        };

      // TODO: this works, but arrayContaining must have the exact objects
      // expect.arrayContaining([expectedTokenStateEntry2, expectedTokenStateEntry2]) also passes the test
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry2,
          expectedTokenStateEntry1,
        ])
      );
    });

    it("EServiceDescriptorArchived", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it"],
        interface: getMockDocument(),
        state: descriptorState.published,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [publishedDescriptor],
      };
      // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

      const archivedDescriptor: Descriptor = {
        ...publishedDescriptor,
        archivedAt: new Date(),
        state: descriptorState.archived,
      };
      const updatedEService: EService = {
        ...eservice,
        descriptors: [archivedDescriptor],
      };
      const payload: EServiceDescriptorArchivedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: archivedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorArchived",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const primaryKey = `ESERVICEDESCRIPTOR#${updatedEService.id}#${publishedDescriptor.id}`;
      const previousStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        descriptorAudience: publishedDescriptor.audience[0],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);

      const eserviceId_descriptorId = `${eservice.id}#${publishedDescriptor.id}`;
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          PK: "TO DO client kid purpose 1",
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience[0],
          updatedAt: new Date().toISOString(),
          consumerId: generateId(),
          agreementId: generateId(),
          purposeVersionId: generateId(),
          GSIPK_consumerId_eserviceId: `${generateId<TenantId>()}#${generateId<EServiceId>()}`,
          clientKind: clientKind.consumer,
          publicKey: "PEM",
          GSIPK_clientId: generateId(),
          GSIPK_kid: "KID",
          GSIPK_clientId_purposeId: `${generateId<ClientId>()}#${generateId<PurposeId>()}`,
          agreementState: "ACTIVE",
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          GSIPK_purposeId: generateId(),
          purposeState: itemState.inactive,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          PK: "TO DO client kid purpose 2",
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience[0],
          updatedAt: new Date().toISOString(),
          consumerId: generateId(),
          agreementId: generateId(),
          purposeVersionId: generateId(),
          GSIPK_consumerId_eserviceId: `${generateId<TenantId>()}#${generateId<EServiceId>()}`,
          clientKind: clientKind.consumer,
          publicKey: "PEM",
          GSIPK_clientId: generateId(),
          GSIPK_kid: "KID",
          GSIPK_clientId_purposeId: `${generateId<ClientId>()}#${generateId<PurposeId>()}`,
          agreementState: "ACTIVE",
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          GSIPK_purposeId: generateId(),
          purposeState: itemState.inactive,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);
      await sleep(1000, mockDate);

      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      expect(retrievedEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStateEntriesByEserviceIdAndDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );
      const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry1,
          descriptorState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry2,
          descriptorState: itemState.inactive,
        };
      expect(retrievedTokenStateEntries).toEqual([
        expectedTokenStateEntry2,
        expectedTokenStateEntry1, // To do: understand how these are sorted
      ]);
    });

    it("EServiceDescriptorPublished", async () => {
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it"],
        interface: getMockDocument(),
        state: descriptorState.draft,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [draftDescriptor],
      };
      // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

      const publishedDescriptor: Descriptor = {
        ...draftDescriptor,
        publishedAt: new Date(),
        state: descriptorState.published,
      };
      const updatedEService: EService = {
        ...eservice,
        descriptors: [publishedDescriptor],
      };
      const payload: EServiceDescriptorPublishedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: publishedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorPublished",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, dynamoDBClient);

      const primaryKey = `ESERVICEDESCRIPTOR#${updatedEService.id}#${publishedDescriptor.id}`;
      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      const expectedEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.active,
        descriptorAudience: publishedDescriptor.audience[0],
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedEntry).toEqual(expectedEntry);
    });

    it("EServiceDescriptorSuspended", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it"],
        interface: getMockDocument(),
        state: descriptorState.published,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [publishedDescriptor],
      };
      // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

      const suspendedDescriptor: Descriptor = {
        ...publishedDescriptor,
        suspendedAt: new Date(),
        state: descriptorState.suspended,
      };
      const updatedEService: EService = {
        ...eservice,
        descriptors: [suspendedDescriptor],
      };
      const payload: EServiceDescriptorSuspendedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: suspendedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorSuspended",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const primaryKey = `ESERVICEDESCRIPTOR#${updatedEService.id}#${publishedDescriptor.id}`;
      const previousStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.active,
        descriptorAudience: publishedDescriptor.audience[0],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);
      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      const expectedEntry: PlatformStatesCatalogEntry = {
        ...previousStateEntry,
        state: itemState.inactive,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedEntry).toEqual(expectedEntry);
    });
  });
});
