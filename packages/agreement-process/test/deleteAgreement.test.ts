/* eslint-disable functional/no-let */
import { fileManagerDeleteError, genericLogger } from "pagopa-interop-commons";
import {
  addSomeRandomDelegations,
  decodeProtobufPayload,
  getMockAgreement,
  getMockDelegation,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import {
  AgreementDeletedV2,
  AgreementId,
  agreementState,
  delegationKind,
  delegationState,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { agreementDeletableStates } from "../src/model/domain/agreement-validators.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegateConsumer,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import {
  addOneAgreement,
  addOneDelegation,
  agreementService,
  fileManager,
  getMockConsumerDocument,
  readLastAgreementEvent,
  uploadDocument,
} from "./utils.js";

describe("delete agreement", () => {
  it.each(agreementDeletableStates)(
    "should succeed when requester is Consumer and the Agreement is in a deletable state (%s)",
    async (state) => {
      vi.spyOn(fileManager, "delete");
      const agreementId = generateId<AgreementId>();
      const consumerDocuments = [
        getMockConsumerDocument(agreementId, "doc1"),
        getMockConsumerDocument(agreementId, "doc2"),
      ];
      const agreement = {
        ...getMockAgreement(),
        id: agreementId,
        state,
        consumerDocuments,
      };
      await addOneAgreement(agreement);

      await Promise.all(
        consumerDocuments.map((doc) =>
          uploadDocument(agreementId, doc.id, doc.name)
        )
      );

      const authData = getRandomAuthData(agreement.consumerId);
      await agreementService.deleteAgreementById(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      });

      const agreementEvent = await readLastAgreementEvent(agreement.id);

      expect(agreementEvent).toMatchObject({
        type: "AgreementDeleted",
        event_version: 2,
        version: "1",
        stream_id: agreement.id,
      });

      const agreementDeletedId = decodeProtobufPayload({
        messageType: AgreementDeletedV2,
        payload: agreementEvent.data,
      }).agreement?.id;

      expect(agreementDeletedId).toEqual(agreement.id);

      const filePaths = await fileManager.listFiles(
        config.s3Bucket,
        genericLogger
      );

      consumerDocuments.forEach((doc) => {
        expect(fileManager.delete).toHaveBeenCalledWith(
          config.s3Bucket,
          doc.path,
          genericLogger
        );

        expect(filePaths).not.toContain(doc.path);
      });
    }
  );

  it("should succeed when requester is Consumer Delegate and the Agreement is in a deletable state", async () => {
    vi.spyOn(fileManager, "delete");
    const agreementId = generateId<AgreementId>();
    const consumerDocuments = [
      getMockConsumerDocument(agreementId, "doc1"),
      getMockConsumerDocument(agreementId, "doc2"),
    ];

    const agreement = {
      ...getMockAgreement(),
      id: agreementId,
      state: randomArrayItem(agreementDeletableStates),
      consumerDocuments,
    };

    const delegateId = generateId<TenantId>();
    const authData = getRandomAuthData(delegateId);

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: agreement.eserviceId,
      delegatorId: agreement.consumerId,
      delegateId,
      state: delegationState.active,
    });

    await addOneAgreement(agreement);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(agreement, addOneDelegation);

    await Promise.all(
      consumerDocuments.map((doc) =>
        uploadDocument(agreementId, doc.id, doc.name)
      )
    );

    await agreementService.deleteAgreementById(agreement.id, {
      authData,
      serviceName: "",
      correlationId: generateId(),
      logger: genericLogger,
    });

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    expect(agreementEvent).toMatchObject({
      type: "AgreementDeleted",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const agreementDeletedId = decodeProtobufPayload({
      messageType: AgreementDeletedV2,
      payload: agreementEvent.data,
    }).agreement?.id;

    expect(agreementDeletedId).toEqual(agreement.id);

    const filePaths = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    // eslint-disable-next-line sonarjs/no-identical-functions
    consumerDocuments.forEach((doc) => {
      expect(fileManager.delete).toHaveBeenCalledWith(
        config.s3Bucket,
        doc.path,
        genericLogger
      );

      expect(filePaths).not.toContain(doc.path);
    });
  });

  it("should throw organizationIsNotTheConsumer when the requester is the Consumer but there is a Consumer Delegation", async () => {
    const authData = getRandomAuthData();

    const agreement = {
      ...getMockAgreement(),
      consumerId: authData.organizationId,
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: agreement.eserviceId,
      delegatorId: agreement.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOneAgreement(agreement);
    await addOneDelegation(delegation);

    await expect(
      agreementService.deleteAgreementById(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationIsNotTheDelegateConsumer(
        authData.organizationId,
        delegation.id
      )
    );
  });

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    await addOneAgreement(getMockAgreement());
    const authData = getRandomAuthData();
    const agreementId = generateId<AgreementId>();
    await expect(
      agreementService.deleteAgreementById(agreementId, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw organizationIsNotTheConsumer when the requester is not the Consumer", async () => {
    const authData = getRandomAuthData();
    const agreement = getMockAgreement();
    await addOneAgreement(agreement);
    await expect(
      agreementService.deleteAgreementById(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationIsNotTheConsumer(authData.organizationId)
    );
  });

  it("should throw agreementNotInExpectedState when the agreement is not in a deletable state", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (s) => !agreementDeletableStates.includes(s)
        )
      ),
    };
    await addOneAgreement(agreement);
    const authData = getRandomAuthData(agreement.consumerId);
    await expect(
      agreementService.deleteAgreementById(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });

  it("should fail if the file deletion fails", async () => {
    // eslint-disable-next-line functional/immutable-data
    config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure

    const agreementId = generateId<AgreementId>();
    const agreement = {
      ...getMockAgreement(),
      id: agreementId,
      state: randomArrayItem(agreementDeletableStates),
      consumerDocuments: [getMockConsumerDocument(agreementId, "doc1")],
    };
    await addOneAgreement(agreement);
    await expect(
      agreementService.deleteAgreementById(agreement.id, {
        authData: getRandomAuthData(agreement.consumerId),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      fileManagerDeleteError(
        agreement.consumerDocuments[0].path,
        config.s3Bucket,
        new Error("The specified bucket does not exist")
      )
    );
  });
});
