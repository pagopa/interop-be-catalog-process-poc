import {
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
  ReadEvent,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import { afterEach, expect, inject } from "vitest";
import {
  Agreement,
  AgreementEvent,
  AgreementId,
  EService,
  Tenant,
  toAgreementV2,
  toReadModelEService,
  toReadModelAgreement,
  AgreementDocumentId,
  generateId,
  AgreementDocument,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { agreementServiceBuilder } from "../src/services/agreementService.js";
import { agreementQueryBuilder } from "../src/services/readmodel/agreementQuery.js";
import { attributeQueryBuilder } from "../src/services/readmodel/attributeQuery.js";
import { eserviceQueryBuilder } from "../src/services/readmodel/eserviceQuery.js";
import { readModelServiceBuilder } from "../src/services/readmodel/readModelService.js";
import { tenantQueryBuilder } from "../src/services/readmodel/tenantQuery.js";
import { config } from "../src/utilities/config.js";

export const { cleanup, ...testSetupServices } = setupTestContainersVitest(
  inject("readModelConfig"),
  inject("eventStoreConfig"),
  inject("fileManagerConfig"),
  inject("loggerConfig")
);

afterEach(cleanup);

const readModelRepository = testSetupServices.readModelRepository!;
const postgresDB = testSetupServices.postgresDB!;
const fileManager = testSetupServices.fileManager!;

export const agreements = readModelRepository.agreements;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;

export const readModelService = readModelServiceBuilder(readModelRepository);

const eserviceQuery = eserviceQueryBuilder(readModelService);
const agreementQuery = agreementQueryBuilder(readModelService);
const tenantQuery = tenantQueryBuilder(readModelService);
const attributeQuery = attributeQueryBuilder(readModelService);

export const agreementService = agreementServiceBuilder(
  postgresDB,
  agreementQuery,
  tenantQuery,
  eserviceQuery,
  attributeQuery,
  fileManager
);
export const writeAgreementInEventstore = async (
  agreement: Agreement
): Promise<void> => {
  const agreementEvent: AgreementEvent = {
    type: "AgreementAdded",
    event_version: 2,
    data: { agreement: toAgreementV2(agreement) },
  };
  const eventToWrite: StoredEvent<AgreementEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: agreementEvent.data.agreement!.id,
    version: 0,
    event: agreementEvent,
  };

  await writeInEventstore(eventToWrite, "agreement", postgresDB);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeAgreementInEventstore(agreement);
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(tenant, tenants);
};

export const readLastAgreementEvent = async (
  agreementId: AgreementId
): Promise<ReadEvent<AgreementEvent>> =>
  await readLastEventByStreamId(agreementId, "agreement", postgresDB);

export const readAgreementEventByVersion = async (
  agreementId: AgreementId,
  version: number
): Promise<ReadEvent<AgreementEvent>> =>
  await readEventByStreamIdAndVersion(
    agreementId,
    version,
    "agreement",
    postgresDB
  );

export async function uploadDocument(
  agreementId: AgreementId,
  documentId: AgreementDocumentId,
  name: string
): Promise<void> {
  const documentDestinationPath = `${config.consumerDocumentsPath}/${agreementId}`;
  await fileManager.storeBytes(
    config.s3Bucket,
    documentDestinationPath,
    documentId,
    name,
    Buffer.from("large-document-file"),
    genericLogger
  );
  expect(
    await fileManager.listFiles(config.s3Bucket, genericLogger)
  ).toContainEqual(
    `${config.consumerDocumentsPath}/${agreementId}/${documentId}/${name}`
  );
}

export function getMockConsumerDocument(
  agreementId: AgreementId,
  name: string = "mockDocument"
): AgreementDocument {
  const id = generateId<AgreementDocumentId>();
  return {
    id,
    name,
    path: `${config.consumerDocumentsPath}/${agreementId}/${id}/${name}`,
    prettyName: "pretty name",
    contentType: "application/pdf",
    createdAt: new Date(),
  };
}
