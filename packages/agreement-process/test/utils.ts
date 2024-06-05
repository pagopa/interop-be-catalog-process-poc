/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
  ReadEvent,
  readEventByStreamIdAndVersion,
  randomArrayItem,
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
  Attribute,
  toReadModelAttribute,
} from "pagopa-interop-models";
import { genericLogger, initPDFGenerator } from "pagopa-interop-commons";
import { SelfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import { agreementServiceBuilder } from "../src/services/agreementService.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { config } from "../src/utilities/config.js";
import { ApiTenantAttribute } from "../src/model/types.js";

export const { cleanup, readModelRepository, postgresDB, fileManager } =
  setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig"),
    inject("fileManagerConfig")
  );

afterEach(cleanup);

export const agreements = readModelRepository.agreements;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;
export const attributes = readModelRepository.attributes;

export const readModelService = readModelServiceBuilder(readModelRepository);

const pdfGenerator = await initPDFGenerator();

export const selfcareV2ClientMock: SelfcareV2Client = {} as SelfcareV2Client;

export const agreementService = agreementServiceBuilder(
  postgresDB,
  readModelService,
  fileManager,
  pdfGenerator,
  selfcareV2ClientMock
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

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
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

export function getMockApiTenantCertifiedAttribute(): ApiTenantAttribute {
  return {
    certified: {
      id: generateId(),
      assignmentTimestamp: new Date().toISOString(),
      revocationTimestamp: randomArrayItem([
        new Date().toISOString(),
        undefined,
      ]),
    },
  };
}

export function getMockApiTenantDeclaredAttribute(): ApiTenantAttribute {
  return {
    declared: {
      id: generateId(),
      assignmentTimestamp: new Date().toISOString(),
      revocationTimestamp: randomArrayItem([
        new Date().toISOString(),
        undefined,
      ]),
    },
  };
}

export function getMockApiTenantVerifiedAttribute(): ApiTenantAttribute {
  return {
    verified: {
      id: generateId(),
      assignmentTimestamp: new Date().toISOString(),
      verifiedBy: [
        {
          id: generateId(),
          verificationDate: new Date().toISOString(),
          expirationDate: randomArrayItem([
            new Date().toISOString(),
            undefined,
          ]),
          extensionDate: randomArrayItem([new Date().toISOString(), undefined]),
        },
      ],
      revokedBy: [
        {
          id: generateId(),
          verificationDate: new Date().toISOString(),
          revocationDate: new Date().toISOString(),
          expirationDate: randomArrayItem([
            new Date().toISOString(),
            undefined,
          ]),
          extensionDate: randomArrayItem([new Date().toISOString(), undefined]),
        },
      ],
    },
  };
}
