import { fail } from "assert";
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
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  getMockAgreement,
  getMockDescriptor,
  getMockPurpose,
  getMockPurposeVersion,
  readAllTokenStatesItems,
  writeTokenStatesConsumerClient,
} from "pagopa-interop-commons-test";
import {
  generateId,
  itemState,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesAgreementPK,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesPurposeEntry,
  Purpose,
  PurposeEventEnvelope,
  PurposeVersion,
  PurposeVersionActivatedV1,
  PurposeVersionArchivedV1,
  purposeVersionState,
  PurposeVersionSuspendedV1,
  TokenGenerationStatesConsumerClient,
} from "pagopa-interop-models";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockTokenStatesConsumerClient,
  toPurposeV1,
} from "pagopa-interop-commons-test";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import {
  getPurposeStateFromPurposeVersions,
  readPlatformPurposeEntry,
  writePlatformPurposeEntry,
} from "../src/utils.js";
import {
  config,
  readAllTokenEntriesByGSIPKPurposeId,
  writeAgreementEntry,
  writeCatalogEntry,
} from "./utils.js";

describe("integration tests for events V1", () => {
  if (!config) {
    fail();
  }

  const dynamoDBClient = new DynamoDBClient({
    endpoint: `http://localhost:${config.tokenGenerationReadModelDbPort}`,
  });
  beforeEach(async () => {
    await buildDynamoDBTables(dynamoDBClient);
  });
  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });
  const mockDate = new Date();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  describe("PurposeVersionActivated", () => {
    it("should insert the entry in platform states and do no operation in token-generation-states", async () => {
      const messageVersion = 1;

      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const payload: PurposeVersionActivatedV1 = {
        purpose: toPurposeV1(purpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purpose.id,
        version: messageVersion,
        type: "PurposeVersionActivated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purpose.id);
      expect(
        await readPlatformPurposeEntry(dynamoDBClient, purposeEntryPrimaryKey)
      ).toBeUndefined();

      // token-generation-states
      expect(await readAllTokenStatesItems(dynamoDBClient)).toHaveLength(0);

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey,
        state: getPurposeStateFromPurposeVersions(purpose.versions),
        purposeVersionId: purpose.versions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
        version: messageVersion,
        updatedAt: mockDate.toISOString(),
      };
      expect(retrievedPlatformPurposeEntry).toEqual(
        expectedPlatformPurposeEntry
      );

      // token-generation-states
      expect(await readAllTokenStatesItems(dynamoDBClient)).toHaveLength(0);
    });

    it("should insert the entry in platform states if it doesn't exist and update token generation states", async () => {
      const messageVersion = 1;
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purposeId = purpose.id;
      const purposeVersions = purpose.versions;
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);
      const payload: PurposeVersionActivatedV1 = {
        purpose: toPurposeV1(purpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeId,
        version: messageVersion,
        type: "PurposeVersionActivated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
      const previousPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(previousPlatformPurposeEntry).toBeUndefined();

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
        GSIPK_purposeId: purposeId,
        purposeState: itemState.inactive,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
        GSIPK_purposeId: purposeId,
        purposeState,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey,
        state: itemState.active,
        purposeVersionId: purposeVersions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformPurposeEntry).toEqual(
        expectedPlatformPurposeEntry
      );
      expect(retrievedPlatformPurposeEntry).toEqual(
        expectedPlatformPurposeEntry
      );

      // token-generation-states;
      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
      const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry1,
        purposeState: itemState.active,
        purposeVersionId: purposeVersions[0].id,
        updatedAt: new Date().toISOString(),
      };
      const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry2,
        purposeState: itemState.active,
        purposeVersionId: purposeVersions[0].id,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry1,
          expectedTokenStateEntry2,
        ])
      );
    });

    it("should do no operation if the existing table entry is more recent", async () => {
      const previousEntryVersion = 2;
      const messageVersion = 1;
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const payload: PurposeVersionActivatedV1 = {
        purpose: toPurposeV1(purpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purpose.id,
        version: messageVersion,
        type: "PurposeVersionActivated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purpose.id);
      const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey,
        state: getPurposeStateFromPurposeVersions(purpose.versions),
        purposeVersionId: purpose.versions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
        version: previousEntryVersion,
        updatedAt: mockDate.toISOString(),
      };
      await writePlatformPurposeEntry(
        dynamoDBClient,
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const purposeId = purpose.id;
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(),
        GSIPK_purposeId: purposeId,
        purposeState: itemState.inactive,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(),
        GSIPK_purposeId: purposeId,
        purposeState: itemState.inactive,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toEqual(
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);

      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          previousTokenStateEntry1,
          previousTokenStateEntry2,
        ])
      );
    });

    it("should update the entry when incoming version is more recent than existing table entry", async () => {
      const previousEntryVersion = 2;
      const messageVersion = 3;

      const lastPurposeVersionDate = mockDate;
      lastPurposeVersionDate.setDate(mockDate.getDate() + 1);
      const purposeVersions: PurposeVersion[] = [
        getMockPurposeVersion(purposeVersionState.active),
        {
          ...getMockPurposeVersion(purposeVersionState.waitingForApproval),
          createdAt: lastPurposeVersionDate,
        },
      ];
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: purposeVersions,
      };
      const purposeId = purpose.id;
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

      // platform-states
      const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
      const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey,
        state: purposeState,
        purposeVersionId: purposeVersions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
        version: previousEntryVersion,
        updatedAt: mockDate.toISOString(),
      };
      await writePlatformPurposeEntry(
        dynamoDBClient,
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(),
        GSIPK_purposeId: purposeId,
        purposeState,
        purposeVersionId: purposeVersions[0].id,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(),
        GSIPK_purposeId: purposeId,
        purposeState,
        purposeVersionId: purposeVersions[0].id,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [
          {
            ...purposeVersions[0],
            state: purposeVersionState.archived,
            updatedAt: new Date(),
          },
          {
            ...purposeVersions[1],
            state: purposeVersionState.active,
            firstActivationAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const payload: PurposeVersionActivatedV1 = {
        purpose: toPurposeV1(updatedPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeId,
        version: messageVersion,
        type: "PurposeVersionActivated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        ...previousPlatformPurposeEntry,
        state: itemState.active,
        purposeVersionId: purposeVersions[1].id,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformPurposeEntry).toEqual(
        expectedPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
      const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry1,
        purposeState: itemState.active,
        purposeVersionId: purposeVersions[1].id,
        updatedAt: new Date().toISOString(),
      };
      const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry2,
        purposeState: itemState.active,
        purposeVersionId: purposeVersions[1].id,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry1,
          expectedTokenStateEntry2,
        ])
      );
    });

    it("should update the entry state to active when the message version is more recent and the entry state is inactive", async () => {
      const previousEntryVersion = 1;
      const messageVersion = 2;

      const lastPurposeVersionDate = mockDate;
      lastPurposeVersionDate.setDate(mockDate.getDate() + 1);
      const purposeVersions: PurposeVersion[] = [
        getMockPurposeVersion(purposeVersionState.archived),
        {
          ...getMockPurposeVersion(purposeVersionState.suspended),
          createdAt: lastPurposeVersionDate,
        },
      ];
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: purposeVersions,
      };
      const purposeId = purpose.id;
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

      // platform-states
      const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
      const previousStateEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey,
        state: purposeState,
        purposeVersionId: purposeVersions[1].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
        version: previousEntryVersion,
        updatedAt: mockDate.toISOString(),
      };
      await writePlatformPurposeEntry(dynamoDBClient, previousStateEntry);

      // token-generation-states
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(),
        GSIPK_purposeId: purposeId,
        purposeState,
        purposeVersionId: purposeVersions[1].id,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(),
        GSIPK_purposeId: purposeId,
        purposeState,
        purposeVersionId: purposeVersions[1].id,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [
          purposeVersions[0],
          {
            ...purposeVersions[1],
            state: purposeVersionState.active,
            suspendedAt: undefined,
            updatedAt: new Date(),
          },
        ],
      };

      const payload: PurposeVersionActivatedV1 = {
        purpose: toPurposeV1(updatedPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeId,
        version: messageVersion,
        type: "PurposeVersionActivated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        ...previousStateEntry,
        state: itemState.active,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformPurposeEntry).toEqual(
        expectedPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
      const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry1,
        purposeState: itemState.active,
        updatedAt: new Date().toISOString(),
      };
      const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry2,
        purposeState: itemState.active,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry1,
          expectedTokenStateEntry2,
        ])
      );
    });

    it("should update the token generation states entries with the corresponding agreement and descriptor data from platform states", async () => {
      const messageVersion = 1;

      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purposeVersions = purpose.versions;
      const payload: PurposeVersionActivatedV1 = {
        purpose: toPurposeV1(purpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purpose.id,
        version: messageVersion,
        type: "PurposeVersionActivated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const mockDescriptor = getMockDescriptor();
      const mockAgreement = {
        ...getMockAgreement(purpose.eserviceId, purpose.consumerId),
        descriptorId: mockDescriptor.id,
      };
      const catalogAgreementEntryPK = makePlatformStatesAgreementPK(
        mockAgreement.id
      );
      const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
        consumerId: mockAgreement.consumerId,
        eserviceId: mockAgreement.eserviceId,
      });
      const previousAgreementEntry: PlatformStatesAgreementEntry = {
        PK: catalogAgreementEntryPK,
        state: itemState.active,
        GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: mockAgreement.descriptorId,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writeAgreementEntry(previousAgreementEntry, dynamoDBClient);

      const catalogEntryPK = makePlatformStatesEServiceDescriptorPK({
        eserviceId: purpose.eserviceId,
        descriptorId: mockDescriptor.id,
      });
      const previousDescriptorEntry: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK,
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: mockDescriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(dynamoDBClient, previousDescriptorEntry);

      // token-generation-states
      const purposeId = purpose.id;
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
        GSIPK_purposeId: purposeId,
        purposeState: itemState.inactive,
        GSIPK_consumerId_eserviceId: undefined,
        agreementId: undefined,
        agreementState: undefined,
        GSIPK_eserviceId_descriptorId: undefined,
        descriptorState: undefined,
        descriptorAudience: undefined,
        descriptorVoucherLifespan: undefined,
        updatedAt: new Date().toISOString(),
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
        GSIPK_purposeId: purposeId,
        purposeState: itemState.inactive,
        GSIPK_consumerId_eserviceId: undefined,
        agreementId: undefined,
        agreementState: undefined,
        GSIPK_eserviceId_descriptorId: undefined,
        descriptorState: undefined,
        descriptorAudience: undefined,
        descriptorVoucherLifespan: undefined,
        updatedAt: new Date().toISOString(),
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient);

      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
      const gsiPKEserviceIdDescriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: purpose.eserviceId,
        descriptorId: mockDescriptor.id,
      });
      const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry1,
        purposeState: itemState.active,
        purposeVersionId: purposeVersions[0].id,
        GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
        agreementId: mockAgreement.id,
        agreementState: previousAgreementEntry.state,
        GSIPK_eserviceId_descriptorId: gsiPKEserviceIdDescriptorId,
        descriptorState: previousDescriptorEntry.state,
        descriptorAudience: previousDescriptorEntry.descriptorAudience,
        descriptorVoucherLifespan:
          previousDescriptorEntry.descriptorVoucherLifespan,
      };
      const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry2,
        purposeState: itemState.active,
        purposeVersionId: purposeVersions[0].id,
        GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
        agreementId: mockAgreement.id,
        agreementState: previousAgreementEntry.state,
        GSIPK_eserviceId_descriptorId: gsiPKEserviceIdDescriptorId,
        descriptorState: previousDescriptorEntry.state,
        descriptorAudience: previousDescriptorEntry.descriptorAudience,
        descriptorVoucherLifespan:
          previousDescriptorEntry.descriptorVoucherLifespan,
      };
      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry1,
          expectedTokenStateEntry2,
        ])
      );
    });
  });

  describe("PurposeVersionSuspended", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
      const previousEntryVersion = 2;
      const messageVersion = 1;

      const purposeVersions: PurposeVersion[] = [
        getMockPurposeVersion(purposeVersionState.active),
      ];
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: purposeVersions,
      };
      const purposeId = purpose.id;
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

      // platform-states
      const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
      const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey,
        state: purposeState,
        purposeVersionId: purposeVersions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
        version: previousEntryVersion,
        updatedAt: mockDate.toISOString(),
      };
      await writePlatformPurposeEntry(
        dynamoDBClient,
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(),
        GSIPK_purposeId: purposeId,
        purposeState,
        purposeVersionId: purposeVersions[0].id,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(),
        GSIPK_purposeId: purposeId,
        purposeState,
        purposeVersionId: purposeVersions[0].id,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [
          {
            ...purposeVersions[0],
            state: purposeVersionState.suspended,
            suspendedAt: new Date(),
          },
        ],
      };

      const payload: PurposeVersionSuspendedV1 = {
        purpose: toPurposeV1(updatedPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeId,
        version: messageVersion,
        type: "PurposeVersionSuspended",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toEqual(
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          previousTokenStateEntry1,
          previousTokenStateEntry2,
        ])
      );
    });

    it("should update the entry when incoming version is more recent than existing table entry", async () => {
      const previousEntryVersion = 1;
      const messageVersion = 2;

      const purposeVersions: PurposeVersion[] = [
        getMockPurposeVersion(purposeVersionState.active),
      ];
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: purposeVersions,
      };
      const purposeId = purpose.id;
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

      // platform-states
      const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
      const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey,
        state: purposeState,
        purposeVersionId: purposeVersions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
        version: previousEntryVersion,
        updatedAt: mockDate.toISOString(),
      };
      await writePlatformPurposeEntry(
        dynamoDBClient,
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(),
        GSIPK_purposeId: purposeId,
        purposeState,
        purposeVersionId: purposeVersions[0].id,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(),
        GSIPK_purposeId: purposeId,
        purposeState,
        purposeVersionId: purposeVersions[0].id,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [
          {
            ...purposeVersions[0],
            state: purposeVersionState.suspended,
            suspendedAt: new Date(),
          },
        ],
      };

      const payload: PurposeVersionSuspendedV1 = {
        purpose: toPurposeV1(updatedPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeId,
        version: messageVersion,
        type: "PurposeVersionSuspended",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        ...previousPlatformPurposeEntry,
        state: itemState.inactive,
        version: messageVersion,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformPurposeEntry).toEqual(
        expectedPlatformPurposeEntry
      );

      // token-generation-states
      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
      const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry1,
        purposeState: itemState.inactive,
        updatedAt: new Date().toISOString(),
      };
      const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry2,
        purposeState: itemState.inactive,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry1,
          expectedTokenStateEntry2,
        ])
      );
    });

    it("should do no operation if the table entry doesn't exist", async () => {
      const messageVersion = 1;

      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const purposeId = purpose.id;
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);
      const purposeVersions: PurposeVersion[] = [
        getMockPurposeVersion(purposeVersionState.active),
      ];

      // platform-states
      const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
      const previousRetrievedPlatformPurposeEntry =
        await readPlatformPurposeEntry(dynamoDBClient, purposeEntryPrimaryKey);
      expect(previousRetrievedPlatformPurposeEntry).toBeUndefined();

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
        GSIPK_purposeId: purposeId,
        purposeVersionId: purposeVersions[0].id,
        purposeState,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
        GSIPK_purposeId: purposeId,
        purposeVersionId: purposeVersions[0].id,
        purposeState,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      const updatedPurposeVersions: PurposeVersion[] = [
        {
          ...purposeVersions[0],
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
        },
      ];

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: updatedPurposeVersions,
      };

      const payload: PurposeVersionSuspendedV1 = {
        purpose: toPurposeV1(updatedPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeId,
        version: messageVersion,
        type: "PurposeVersionSuspended",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      expect(
        async () => await handleMessageV1(message, dynamoDBClient)
      ).not.toThrowError();

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          previousTokenStateEntry1,
          previousTokenStateEntry2,
        ])
      );
    });
  });

  describe("PurposeVersionArchived", () => {
    it("should delete the entry from platform states and update token generation states", async () => {
      const previousEntryVersion = 1;
      const messageVersion = 2;

      const purposeVersions: PurposeVersion[] = [
        getMockPurposeVersion(purposeVersionState.active),
      ];
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: purposeVersions,
      };
      const purposeId = purpose.id;
      const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);

      // platform-states
      const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purposeId);
      const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey,
        state: purposeState,
        purposeVersionId: purposeVersions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
        version: previousEntryVersion,
        updatedAt: mockDate.toISOString(),
      };
      await writePlatformPurposeEntry(
        dynamoDBClient,
        previousPlatformPurposeEntry
      );

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
        GSIPK_purposeId: purposeId,
        purposeState,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
        GSIPK_purposeId: purposeId,
        purposeState,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [
          {
            ...purposeVersions[0],
            state: purposeVersionState.archived,
            updatedAt: new Date(),
          },
        ],
      };

      const payload: PurposeVersionArchivedV1 = {
        purpose: toPurposeV1(updatedPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeId,
        version: messageVersion,
        type: "PurposeVersionArchived",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };

      await handleMessageV1(message, dynamoDBClient);

      // platform-states
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        purposeEntryPrimaryKey
      );
      expect(retrievedPlatformPurposeEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
      const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry1,
        purposeState: itemState.inactive,
        purposeVersionId: purposeVersions[0].id,
        updatedAt: new Date().toISOString(),
      };
      const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry2,
        purposeState: itemState.inactive,
        purposeVersionId: purposeVersions[0].id,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry1,
          expectedTokenStateEntry2,
        ])
      );
    });
  });
});
