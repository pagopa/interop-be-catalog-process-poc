/* eslint-disable functional/no-let */
import { generateMock } from "@anatine/zod-mock";
import { fileManagerDeleteError, genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import {
  Agreement,
  AgreementConsumerDocumentAddedV2,
  AgreementConsumerDocumentRemovedV2,
  AgreementDocument,
  AgreementDocumentId,
  AgreementId,
  EServiceId,
  TenantId,
  agreementState,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import { agreementConsumerDocumentChangeValidStates } from "../src/model/domain/agreement-validators.js";
import {
  agreementDocumentAlreadyExists,
  agreementDocumentNotFound,
  agreementNotFound,
  documentChangeNotAllowed,
  operationNotAllowed,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import {
  addOneAgreement,
  agreementService,
  fileManager,
  getMockConsumerDocument,
  readLastAgreementEvent,
} from "./utils.js";
import { mockAgreementRouterRequest } from "./supertestSetup.js";

describe("agreement consumer document", () => {
  describe("get", () => {
    let agreement1: Agreement;

    beforeEach(async () => {
      agreement1 = {
        ...getMockAgreement(),
        consumerDocuments: [
          generateMock(AgreementDocument),
          generateMock(AgreementDocument),
        ],
      };

      await addOneAgreement(agreement1);
      await addOneAgreement(getMockAgreement());
    });

    it("should succed when the requester is the consumer or producer", async () => {
      const authData = getRandomAuthData(
        randomArrayItem([agreement1.consumerId, agreement1.producerId])
      );

      const result = await mockAgreementRouterRequest.get({
        path: "/agreements/:agreementId/consumer-documents/:documentId",
        pathParams: {
          agreementId: agreement1.id,
          documentId: agreement1.consumerDocuments[0].id,
        },
        authData,
      });

      const consumerDocumentsWithCorrectDate = {
        ...result,
        createdAt: new Date(result.createdAt),
      };
      expect(consumerDocumentsWithCorrectDate).toEqual(
        agreement1.consumerDocuments[0]
      );
    });

    it("should throw an agreementNotFound error when the agreement does not exist", async () => {
      const agreementId = generateId<AgreementId>();
      const authData = getRandomAuthData(agreement1.consumerId);
      await addOneAgreement(getMockAgreement());
      await expect(
        agreementService.getAgreementConsumerDocument(
          agreementId,
          agreement1.consumerDocuments[0].id,
          {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(agreementNotFound(agreementId));
    });

    it("should throw an operationNotAllowed error when the requester is not the consumer or producer", async () => {
      const authData = getRandomAuthData(generateId<TenantId>());

      await expect(
        agreementService.getAgreementConsumerDocument(
          agreement1.id,
          agreement1.consumerDocuments[0].id,
          {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
    });

    it("should throw an agreementDocumentNotFound error when the document does not exist", async () => {
      const authData = getRandomAuthData(agreement1.consumerId);
      const agreementDocumentId = generateId<AgreementDocumentId>();
      await expect(
        agreementService.getAgreementConsumerDocument(
          agreement1.id,
          agreementDocumentId,
          {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(
        agreementDocumentNotFound(agreementDocumentId, agreement1.id)
      );
    });
  });

  describe("add", () => {
    it("should succeed on happy path", async () => {
      const authData = getRandomAuthData();
      const organizationId = authData.organizationId;
      const agreement = getMockAgreement(
        generateId<EServiceId>(),
        organizationId
      );

      const consumerDocument = getMockConsumerDocument(agreement.id);

      await addOneAgreement(agreement);

      const returnedConsumerDocument =
        await agreementService.addConsumerDocument(
          agreement.id,
          consumerDocument,
          {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          }
        );
      const { data: payload } = await readLastAgreementEvent(agreement.id);

      const actualConsumerDocument = decodeProtobufPayload({
        messageType: AgreementConsumerDocumentAddedV2,
        payload,
      });

      const expectedConsumerDocument = {
        ...consumerDocument,
        createdAt: returnedConsumerDocument.createdAt,
      };

      const expectedAgreement = {
        ...agreement,
        consumerDocuments: [
          ...agreement.consumerDocuments,
          expectedConsumerDocument,
        ],
      };

      expect(actualConsumerDocument).toMatchObject({
        agreement: toAgreementV2(expectedAgreement),
        documentId: consumerDocument.id,
      });

      expect(actualConsumerDocument).toEqual({
        agreement: toAgreementV2({
          ...agreement,
          consumerDocuments: [
            ...agreement.consumerDocuments,
            returnedConsumerDocument,
          ],
        }),
        documentId: returnedConsumerDocument.id,
      });
    });

    it("should throw an agreementNotFound error when the agreement does not exist", async () => {
      const authData = getRandomAuthData();
      await addOneAgreement(getMockAgreement());

      const wrongAgreementId = generateId<AgreementId>();
      const consumerDocument = getMockConsumerDocument(wrongAgreementId);
      const actualConsumerDocument = agreementService.addConsumerDocument(
        wrongAgreementId,
        consumerDocument,
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      );

      await expect(actualConsumerDocument).rejects.toThrowError(
        agreementNotFound(wrongAgreementId)
      );
    });

    it("should throw an operationNotAllowed if is not consumer", async () => {
      const authData = getRandomAuthData();
      const organizationId = authData.organizationId;
      const agreement = getMockAgreement();

      const consumerDocument = getMockConsumerDocument(agreement.id);

      await addOneAgreement(agreement);

      const actualConsumerDocument = agreementService.addConsumerDocument(
        agreement.id,
        consumerDocument,
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      );

      await expect(actualConsumerDocument).rejects.toThrowError(
        operationNotAllowed(organizationId)
      );
    });

    it("should throw a documentChangeNotAllowed if state not draft or pending", async () => {
      const authData = getRandomAuthData();
      const organizationId = authData.organizationId;

      const agreementConsumerDocumentChangeFailureState = randomArrayItem(
        Object.values(agreementState).filter(
          (state) => !agreementConsumerDocumentChangeValidStates.includes(state)
        )
      );

      const agreement = getMockAgreement(
        generateId<EServiceId>(),
        organizationId,
        agreementConsumerDocumentChangeFailureState
      );

      const consumerDocument = getMockConsumerDocument(agreement.id);

      await addOneAgreement(agreement);

      const actualConsumerDocument = agreementService.addConsumerDocument(
        agreement.id,
        consumerDocument,
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      );

      await expect(actualConsumerDocument).rejects.toThrowError(
        documentChangeNotAllowed(agreement.state)
      );
    });

    it("should throw a agreementDocumentAlreadyExists if document already exists", async () => {
      const authData = getRandomAuthData();
      const organizationId = authData.organizationId;
      let agreement = getMockAgreement(
        generateId<EServiceId>(),
        organizationId
      );
      const consumerDocument = getMockConsumerDocument(agreement.id);
      agreement = {
        ...agreement,
        consumerDocuments: [consumerDocument],
      };

      await addOneAgreement(agreement);

      const actualConsumerDocument = agreementService.addConsumerDocument(
        agreement.id,
        consumerDocument,
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      );
      await expect(actualConsumerDocument).rejects.toThrowError(
        agreementDocumentAlreadyExists(agreement.id)
      );
    });
  });

  describe("remove", () => {
    let agreement1: Agreement;
    beforeEach(async () => {
      const agreementId = generateId<AgreementId>();
      agreement1 = {
        ...getMockAgreement(),
        id: agreementId,
        consumerDocuments: [getMockConsumerDocument(agreementId, "doc1")],
      };

      await addOneAgreement(agreement1);
    });

    it("should succeed on happy path", async () => {
      const authData = getRandomAuthData(agreement1.consumerId);
      const consumerDocument = agreement1.consumerDocuments[0];

      await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: `${config.consumerDocumentsPath}/${agreement1.id}`,
          resourceId: agreement1.consumerDocuments[0].id,
          name: agreement1.consumerDocuments[0].name,
          content: Buffer.from("test content"),
        },
        genericLogger
      );

      // Check that the file is stored in the bucket before removing it
      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toContain(agreement1.consumerDocuments[0].path);

      const returnedAgreementId =
        await agreementService.removeAgreementConsumerDocument(
          agreement1.id,
          consumerDocument.id,
          {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          }
        );

      // Check that the file is removed from the bucket after removing it
      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toMatchObject([]);

      const { data: payload } = await readLastAgreementEvent(agreement1.id);

      const actualConsumerDocument = decodeProtobufPayload({
        messageType: AgreementConsumerDocumentRemovedV2,
        payload,
      });

      const expectedAgreement = { ...agreement1, consumerDocuments: [] };

      expect(actualConsumerDocument).toMatchObject({
        agreement: toAgreementV2(expectedAgreement),
        documentId: consumerDocument.id,
      });
      expect(actualConsumerDocument.agreement?.id).toEqual(returnedAgreementId);
    });

    it("should throw an agreementNotFound error when the agreement does not exist", async () => {
      const authData = getRandomAuthData();
      const notExistentAgreement = getMockAgreement();

      const removeAgreementConsumerDocument =
        agreementService.removeAgreementConsumerDocument(
          notExistentAgreement.id,
          getMockConsumerDocument(notExistentAgreement.id).id,
          {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          }
        );

      await expect(removeAgreementConsumerDocument).rejects.toThrowError(
        agreementNotFound(notExistentAgreement.id)
      );
    });

    it("should throw an operationNotAllowed if is not consumer", async () => {
      const authData = getRandomAuthData();

      const removeAgreementConsumerDocument =
        agreementService.removeAgreementConsumerDocument(
          agreement1.id,
          agreement1.consumerDocuments[0].id,
          {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          }
        );

      await expect(removeAgreementConsumerDocument).rejects.toThrowError(
        operationNotAllowed(authData.organizationId)
      );
    });

    it("should throw a documentChangeNotAllowed if state not draft or pending", async () => {
      const authData = getRandomAuthData(agreement1.consumerId);

      const agreementConsumerDocumentChangeFailureState = randomArrayItem(
        Object.values(agreementState).filter(
          (state) => !agreementConsumerDocumentChangeValidStates.includes(state)
        )
      );
      const agreement = {
        ...agreement1,
        id: generateId<AgreementId>(),
        state: agreementConsumerDocumentChangeFailureState,
      };

      await addOneAgreement(agreement);

      const removeAgreementConsumerDocument =
        agreementService.removeAgreementConsumerDocument(
          agreement.id,
          agreement.consumerDocuments[0].id,
          {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          }
        );

      await expect(removeAgreementConsumerDocument).rejects.toThrowError(
        documentChangeNotAllowed(agreement.state)
      );
    });

    it("should throw a agreementDocumentNotFound if document does not exist", async () => {
      const authData = getRandomAuthData(agreement1.consumerId);
      const notExistendDocumentId = generateId<AgreementDocumentId>();

      const removeAgreementConsumerDocument =
        agreementService.removeAgreementConsumerDocument(
          agreement1.id,
          notExistendDocumentId,
          {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          }
        );
      await expect(removeAgreementConsumerDocument).rejects.toThrowError(
        agreementDocumentNotFound(notExistendDocumentId, agreement1.id)
      );
    });

    it("should fail if the file deletion fails", async () => {
      // eslint-disable-next-line functional/immutable-data
      config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure
      const authData = getRandomAuthData(agreement1.consumerId);
      const consumerDocument = agreement1.consumerDocuments[0];

      await expect(
        agreementService.removeAgreementConsumerDocument(
          agreement1.id,
          consumerDocument.id,
          {
            authData,
            serviceName: "",
            correlationId: generateId(),
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(
        fileManagerDeleteError(
          agreement1.consumerDocuments[0].path,
          config.s3Bucket,
          new Error("The specified bucket does not exist")
        )
      );
    });
  });
});
