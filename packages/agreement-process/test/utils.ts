/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { randomInt } from "crypto";
import {
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
  ReadEvent,
  readEventByStreamIdAndVersion,
  randomArrayItem,
  getMockDelegation,
  getMockTenant,
  getRandomAuthData,
} from "pagopa-interop-commons-test";
import { afterAll, afterEach, expect, inject, vi } from "vitest";
import {
  Agreement,
  AgreementEvent,
  AgreementId,
  EService,
  Tenant,
  toAgreementV2,
  toReadModelEService,
  toReadModelTenant,
  toReadModelAgreement,
  AgreementDocumentId,
  generateId,
  AgreementDocument,
  Attribute,
  toReadModelAttribute,
  TenantId,
  Delegation,
  AgreementStamp,
  UserId,
  delegationKind,
  delegationState,
} from "pagopa-interop-models";
import { agreementApi } from "pagopa-interop-api-clients";
import {
  AuthData,
  formatDateyyyyMMddHHmmss,
  genericLogger,
  initPDFGenerator,
  launchPuppeteerBrowser,
} from "pagopa-interop-commons";
import puppeteer, { Browser } from "puppeteer";
import { subDays } from "date-fns";
import { match } from "ts-pattern";
import { z } from "zod";
import { agreementServiceBuilder } from "../src/services/agreementService.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { config } from "../src/config/config.js";
import { contractBuilder } from "../src/services/agreementContractBuilder.js";

export const { cleanup, readModelRepository, postgresDB, fileManager } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig"),
    inject("fileManagerConfig")
  );

afterEach(cleanup);

const testBrowserInstance: Browser = await launchPuppeteerBrowser({
  pipe: true,
});
const closeTestBrowserInstance = async (): Promise<void> =>
  await testBrowserInstance.close();

afterAll(closeTestBrowserInstance);

vi.spyOn(puppeteer, "launch").mockImplementation(
  async () => testBrowserInstance
);

export const { agreements, attributes, eservices, tenants, delegations } =
  readModelRepository;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const pdfGenerator = await initPDFGenerator();

export const agreementContractBuilder = contractBuilder(
  readModelService,
  pdfGenerator,
  fileManager,
  config,
  genericLogger
);

export const agreementService = agreementServiceBuilder(
  postgresDB,
  readModelService,
  fileManager,
  pdfGenerator
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
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeInReadmodel(delegation, delegations);
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
    {
      bucket: config.s3Bucket,
      path: documentDestinationPath,
      resourceId: documentId,
      name,
      content: Buffer.from("large-document-file"),
    },
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

export function getMockContract(
  agreementId: AgreementId,
  consumerId: TenantId,
  producerId: TenantId
): AgreementDocument {
  const id = generateId<AgreementDocumentId>();
  const createdAt = new Date();
  const contractDocumentName = `${consumerId}_${producerId}_${formatDateyyyyMMddHHmmss(
    createdAt
  )}_agreement_contract.pdf`;
  return {
    id,
    contentType: "application/pdf",
    createdAt,
    path: `${config.agreementContractsPath}/${agreementId}/${id}/${contractDocumentName}`,
    prettyName: "Richiesta di fruizione",
    name: contractDocumentName,
  };
}

export function getMockApiTenantCertifiedAttribute(): agreementApi.TenantAttribute {
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

export function getMockApiTenantDeclaredAttribute(): agreementApi.TenantAttribute {
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

export function getMockApiTenantVerifiedAttribute(): agreementApi.TenantAttribute {
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

export const getRandomPastStamp = (
  userId: UserId = generateId<UserId>()
): AgreementStamp => ({
  who: userId,
  when: subDays(new Date(), randomInt(10)),
});

export const requesterIs = {
  producer: "Producer",
  consumer: "Consumer",
  delegateProducer: "DelegateProducer",
  delegateConsumer: "DelegateConsumer",
} as const;
export const RequesterIs = z.enum([
  Object.values(requesterIs)[0],
  ...Object.values(requesterIs).slice(1),
]);
export type RequesterIs = z.infer<typeof RequesterIs>;

export const authDataAndDelegationsFromRequesterIs = (
  requesterIs: RequesterIs,
  agreement: Agreement
): {
  authData: AuthData;
  producerDelegation: Delegation | undefined;
  delegateProducer: Tenant | undefined;
  consumerDelegation: Delegation | undefined;
  delegateConsumer: Tenant | undefined;
} =>
  match(requesterIs)
    .with("Producer", () => ({
      authData: getRandomAuthData(agreement.producerId),
      producerDelegation: undefined,
      delegateProducer: undefined,
      consumerDelegation: undefined,
      delegateConsumer: undefined,
    }))
    .with("Consumer", () => ({
      authData: getRandomAuthData(agreement.consumerId),
      producerDelegation: undefined,
      delegateProducer: undefined,
      consumerDelegation: undefined,
      delegateConsumer: undefined,
    }))
    .with("DelegateProducer", () => {
      const delegateProducer = getMockTenant();
      const producerDelegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegatorId: agreement.producerId,
        delegateId: delegateProducer.id,
        state: delegationState.active,
        eserviceId: agreement.eserviceId,
      });

      return {
        authData: getRandomAuthData(delegateProducer.id),
        producerDelegation,
        delegateProducer,
        consumerDelegation: undefined,
        delegateConsumer: undefined,
      };
    })
    .with("DelegateConsumer", () => {
      const delegateConsumer = getMockTenant();
      const consumerDelegation = getMockDelegation({
        kind: delegationKind.delegatedConsumer,
        delegatorId: agreement.consumerId,
        delegateId: delegateConsumer.id,
        state: delegationState.active,
        eserviceId: agreement.eserviceId,
      });
      return {
        authData: getRandomAuthData(delegateConsumer.id),
        consumerDelegation,
        delegateConsumer,
        producerDelegation: undefined,
        delegateProducer: undefined,
      };
    })
    .exhaustive();

export async function addDelegationsAndDelegates({
  producerDelegation,
  delegateProducer,
  consumerDelegation,
  delegateConsumer,
}: {
  producerDelegation: Delegation | undefined;
  delegateProducer: Tenant | undefined;
  consumerDelegation: Delegation | undefined;
  delegateConsumer: Tenant | undefined;
}): Promise<void> {
  if (producerDelegation && delegateProducer) {
    await addOneDelegation(producerDelegation);
    await addOneTenant(delegateProducer);
  }

  if (consumerDelegation && delegateConsumer) {
    await addOneDelegation(consumerDelegation);
    await addOneTenant(delegateConsumer);
  }
}
