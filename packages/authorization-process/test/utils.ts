import {
  ReadEvent,
  StoredEvent,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  Agreement,
  AuthorizationEvent,
  Client,
  ClientId,
  Delegation,
  EService,
  ProducerKeychain,
  ProducerKeychainId,
  Purpose,
  toClientV2,
  toProducerKeychainV2,
  toReadModelAgreement,
  toReadModelClient,
  toReadModelEService,
  toReadModelProducerKeychain,
  toReadModelPurpose,
} from "pagopa-interop-models";
import { SelfcareV2InstitutionClient } from "pagopa-interop-api-clients";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { authorizationServiceBuilder } from "../src/services/authorizationService.js";
export const { cleanup, readModelRepository, postgresDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig")
  );

afterEach(cleanup);

export const {
  agreements,
  clients,
  eservices,
  keys,
  purposes,
  tenants,
  producerKeychains,
  delegations,
} = readModelRepository;

export const readModelService = readModelServiceBuilder(readModelRepository);
export const selfcareV2Client: SelfcareV2InstitutionClient =
  {} as SelfcareV2InstitutionClient;

export const authorizationService = authorizationServiceBuilder(
  postgresDB,
  readModelService,
  selfcareV2Client
);

export const writeClientInEventstore = async (
  client: Client
): Promise<void> => {
  const authorizationtEvent: AuthorizationEvent = {
    type: "ClientAdded",
    event_version: 2,
    data: { client: toClientV2(client) },
  };
  const eventToWrite: StoredEvent<AuthorizationEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: authorizationtEvent.data.client!.id,
    version: 0,
    event: authorizationtEvent,
  };

  await writeInEventstore(eventToWrite, '"authorization"', postgresDB);
};

export const addOneClient = async (client: Client): Promise<void> => {
  await writeClientInEventstore(client);
  await writeInReadmodel(toReadModelClient(client), clients);
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await writeInReadmodel(toReadModelPurpose(purpose), purposes);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
};

export const writeProducerKeychainInEventstore = async (
  producerKeychain: ProducerKeychain
): Promise<void> => {
  const authorizationtEvent: AuthorizationEvent = {
    type: "ProducerKeychainAdded",
    event_version: 2,
    data: { producerKeychain: toProducerKeychainV2(producerKeychain) },
  };
  const eventToWrite: StoredEvent<AuthorizationEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: authorizationtEvent.data.producerKeychain!.id,
    version: 0,
    event: authorizationtEvent,
  };

  await writeInEventstore(eventToWrite, '"authorization"', postgresDB);
};

export const addOneProducerKeychain = async (
  producerKeychain: ProducerKeychain
): Promise<void> => {
  await writeProducerKeychainInEventstore(producerKeychain);
  await writeInReadmodel(
    toReadModelProducerKeychain(producerKeychain),
    producerKeychains
  );
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeInReadmodel(delegation, delegations);
};

export const readLastAuthorizationEvent = async (
  id: ClientId | ProducerKeychainId
): Promise<ReadEvent<AuthorizationEvent>> =>
  await readLastEventByStreamId(id, '"authorization"', postgresDB);
