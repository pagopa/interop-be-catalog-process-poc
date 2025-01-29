/* eslint-disable functional/no-let */
import {
  ReadEvent,
  readEventByStreamIdAndVersion,
  readLastEventByStreamId,
  setupTestContainersVitest,
  StoredEvent,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Delegation,
  DelegationEvent,
  DelegationId,
  EService,
  Tenant,
  toDelegationV2,
  toReadModelAgreement,
  toReadModelEService,
  toReadModelTenant,
} from "pagopa-interop-models";
import { afterAll, afterEach, inject, vi } from "vitest";
import {
  initPDFGenerator,
  launchPuppeteerBrowser,
} from "pagopa-interop-commons";
import puppeteer, { Browser } from "puppeteer";
import { delegationServiceBuilder } from "../src/services/delegationService.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";

export const { cleanup, readModelRepository, postgresDB, fileManager } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig"),
    inject("fileManagerConfig")
  );
afterEach(cleanup);

export const { delegations, agreements, eservices, tenants } =
  readModelRepository;

export const readModelService = readModelServiceBuilder(readModelRepository);

const testBrowserInstance: Browser = await launchPuppeteerBrowser({
  pipe: true,
});
const closeTestBrowserInstance = async (): Promise<void> =>
  await testBrowserInstance.close();

afterAll(closeTestBrowserInstance);
afterAll(() => {
  vi.useRealTimers();
});

vi.spyOn(puppeteer, "launch").mockImplementation(
  async () => testBrowserInstance
);

export const pdfGenerator = await initPDFGenerator();

export const delegationService = delegationServiceBuilder(
  readModelService,
  postgresDB,
  pdfGenerator,
  fileManager
);

export const writeSubmitDelegationInEventstore = async (
  delegation: Delegation
): Promise<void> => {
  const createProducerDelegationEvent: DelegationEvent = {
    type: "ProducerDelegationSubmitted",
    event_version: 2,
    data: {
      delegation: toDelegationV2(delegation),
    },
  };

  const eventToWrite: StoredEvent<DelegationEvent> = {
    stream_id: delegation.id,
    version: 0,
    event: createProducerDelegationEvent,
  };

  await writeInEventstore(eventToWrite, "delegation", postgresDB);
};

export const readLastDelegationEvent = async (
  delegationId: DelegationId
): Promise<ReadEvent<DelegationEvent>> =>
  await readLastEventByStreamId(delegationId, "delegation", postgresDB);

export const readDelegationEventByVersion = async (
  delegationId: DelegationId,
  version: number
): Promise<ReadEvent<DelegationEvent>> =>
  await readEventByStreamIdAndVersion(
    delegationId,
    version,
    "delegation",
    postgresDB
  );

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeSubmitDelegationInEventstore(delegation);
  await writeInReadmodel(delegation, delegations);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
};
export const addOneEservice = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
};
