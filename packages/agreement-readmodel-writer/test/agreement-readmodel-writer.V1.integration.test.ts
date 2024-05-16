/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { generateMock } from "@anatine/zod-mock";
import {
  AgreementCollection,
  ReadModelRepository,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import {
  getMockAgreement,
  mongoDBContainer,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  AgreementAddedV1,
  AgreementConsumerDocumentAddedV1,
  AgreementConsumerDocumentRemovedV1,
  AgreementContractAddedV1,
  AgreementDeletedV1,
  AgreementDocument,
  AgreementEventEnvelope,
  AgreementStateV1,
  AgreementUpdatedV1,
  generateId,
  toReadModelAgreement,
} from "pagopa-interop-models";
import { StartedTestContainer } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import { toAgreementDocumentV1 } from "./protobufConverterToV1.js";

describe("events V1", async () => {
  let agreements: AgreementCollection;
  let startedMongoDBContainer: StartedTestContainer;

  const config = readModelWriterConfig();
  beforeAll(async () => {
    startedMongoDBContainer = await mongoDBContainer(config).start();

    config.readModelDbPort = startedMongoDBContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    agreements = readModelRepository.agreements;
  });

  afterEach(async () => {
    await agreements.deleteMany({});
  });

  afterAll(async () => {
    await startedMongoDBContainer.stop();
  });

  it("should create an agreement", async () => {
    const id = generateId();
    const newAgreement: AgreementAddedV1 = {
      agreement: {
        id,
        eserviceId: generateId(),
        descriptorId: generateId(),
        producerId: generateId(),
        consumerId: generateId(),
        state: AgreementStateV1.ACTIVE,
        certifiedAttributes: [],
        declaredAttributes: [],
        verifiedAttributes: [],
        createdAt: BigInt(new Date().getTime()),
        consumerDocuments: [],
      },
    };
    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: id,
      version: 1,
      type: "AgreementAdded",
      data: newAgreement,
      log_date: new Date(),
    };
    await handleMessageV1(message, agreements);

    const agreement = await agreements.findOne({
      "data.id": id.toString(),
    });

    expect(agreement?.data).toMatchObject({
      id: newAgreement.agreement?.id,
      eserviceId: newAgreement.agreement?.eserviceId,
      descriptorId: newAgreement.agreement?.descriptorId,
      producerId: newAgreement.agreement?.producerId,
      consumerId: newAgreement.agreement?.consumerId,
    });
  });

  it("should delete an agreement", async () => {
    const agreement = getMockAgreement();
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);

    const agreementDeleted: AgreementDeletedV1 = {
      agreementId: agreement.id,
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementDeleted",
      data: agreementDeleted,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreements);

    const actualAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(actualAgreement).toBeNull();
  });

  it("should update an agreement", async () => {
    const agreement = getMockAgreement();
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);

    const agreementUpdated: AgreementUpdatedV1 = {
      agreement: {
        id: agreement.id,
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
        producerId: agreement.producerId,
        consumerId: agreement.consumerId,
        state: AgreementStateV1.SUSPENDED,
        certifiedAttributes: [],
        declaredAttributes: [],
        verifiedAttributes: [],
        createdAt: BigInt(new Date().getTime()),
        consumerDocuments: [],
      },
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementUpdated",
      data: agreementUpdated,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreements);

    const actualAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(actualAgreement).not.toBeNull();

    expect(actualAgreement?.data).toMatchObject({
      id: agreementUpdated.agreement?.id,
      eserviceId: agreementUpdated.agreement?.eserviceId,
      descriptorId: agreementUpdated.agreement?.descriptorId,
      producerId: agreementUpdated.agreement?.producerId,
      consumerId: agreementUpdated.agreement?.consumerId,
      state: "Suspended",
      certifiedAttributes: agreementUpdated.agreement?.certifiedAttributes,
      declaredAttributes: agreementUpdated.agreement?.declaredAttributes,
      verifiedAttributes: agreementUpdated.agreement?.verifiedAttributes,
      createdAt: new Date(
        Number(agreementUpdated.agreement?.createdAt)
      ).toISOString(),
      consumerDocuments: agreementUpdated.agreement?.consumerDocuments,
    });
  });

  it("should add a consumer document to an agreement", async () => {
    const agreement = getMockAgreement();
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);

    const agreementConsumerDocument = generateMock(AgreementDocument);

    const consumerDocumentAdded: AgreementConsumerDocumentAddedV1 = {
      document: toAgreementDocumentV1(agreementConsumerDocument),
      agreementId: agreement.id,
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementConsumerDocumentAdded",
      data: consumerDocumentAdded,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreements);

    const actualAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(actualAgreement).not.toBeNull();

    expect(actualAgreement?.data).toMatchObject(
      toReadModelAgreement({
        ...agreement,
        consumerDocuments: [
          ...agreement.consumerDocuments,
          agreementConsumerDocument,
        ],
      })
    );
  });

  it("should remove a consumer document from an agreement", async () => {
    const agreementConsumerDocument = generateMock(AgreementDocument);
    const agreement = {
      ...getMockAgreement(),
      consumerDocuments: [agreementConsumerDocument],
    };
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);

    const consumerDocumentRemoved: AgreementConsumerDocumentRemovedV1 = {
      documentId: agreementConsumerDocument.id,
      agreementId: agreement.id,
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementConsumerDocumentRemoved",
      data: consumerDocumentRemoved,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreements);

    const actualAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(actualAgreement).not.toBeNull();

    expect(
      actualAgreement?.data.consumerDocuments.map((cd) => cd.id)
    ).not.toContain(agreementConsumerDocument.id);
  });

  it("should add an agreement contract", async () => {
    const agreementContract = generateMock(AgreementDocument);
    const agreement = getMockAgreement();
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);

    const agreementContractAdded: AgreementContractAddedV1 = {
      contract: toAgreementDocumentV1(agreementContract),
      agreementId: agreement.id,
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementContractAdded",
      data: agreementContractAdded,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreements);

    const actualAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(actualAgreement).not.toBeNull();

    expect(actualAgreement?.data).toMatchObject(
      toReadModelAgreement({
        ...agreement,
        contract: agreementContract,
      })
    );
  });
});
