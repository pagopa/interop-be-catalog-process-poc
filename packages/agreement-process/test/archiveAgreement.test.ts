import { fail } from "assert";
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import {
  Agreement,
  AgreementArchivedByConsumerV2,
  AgreementId,
  AgreementV2,
  EServiceId,
  TenantId,
  agreementState,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { agreementArchivableStates } from "../src/model/domain/agreement-validators.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  operationNotAllowed,
} from "../src/model/domain/errors.js";
import { apiAgreementToAgreement } from "../src/model/domain/apiConverter.js";
import {
  addOneAgreement,
  agreementService,
  expectedAgreementWithCorrectDate,
  readLastAgreementEvent,
} from "./utils.js";
import { mockAgreementRouterRequest } from "./supertestSetup.js";

describe("archive agreement", () => {
  it("should succeed when the requester is the consumer and the agreement is in an archivable state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();

    const agreement = getMockAgreement(
      eserviceId,
      authData.organizationId,
      randomArrayItem(agreementArchivableStates)
    );

    await addOneAgreement(agreement);

    const apiReturnedAgreement = await mockAgreementRouterRequest.post({
      path: "/agreements/:agreementId/archive",
      pathParams: { agreementId: agreement.id },
      authData,
    });

    const returnedAgreement = apiAgreementToAgreement(apiReturnedAgreement);

    const agreementId = returnedAgreement.id;

    expect(agreementId).toBeDefined();
    if (!agreementId) {
      fail("Unhandled error: returned agreementId is undefined");
    }

    const actualAgreementData = await readLastAgreementEvent(agreementId);

    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData).toMatchObject({
      type: "AgreementArchivedByConsumer",
      event_version: 2,
      version: "1",
      stream_id: agreementId,
    });

    const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
      messageType: AgreementArchivedByConsumerV2,
      payload: actualAgreementData.data,
    }).agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementArchivedV2 data");
    }

    const expectedAgreemenentArchived: Agreement = {
      ...agreement,
      state: agreementState.archived,
      stamps: {
        ...agreement.stamps,
        archiving: {
          who: authData.userId,
          when: new Date(),
        },
      },
    };

    const expectedAgreemenentArchivedWithCorrectDate =
      expectedAgreementWithCorrectDate({
        expectedAgreement: expectedAgreemenentArchived,
        agreement,
        agreementReturnValue: returnedAgreement,
      });

    expect(actualAgreement).toMatchObject(
      toAgreementV2(expectedAgreemenentArchived)
    );

    expect(expectedAgreemenentArchivedWithCorrectDate).toMatchObject(
      returnedAgreement
    );

    vi.useRealTimers();
  });

  it("should throw a agreementNotFound error when the Agreement doesn't exist", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();

    const agreement = getMockAgreement(
      eserviceId,
      authData.organizationId,
      randomArrayItem(agreementArchivableStates)
    );

    await addOneAgreement(agreement);

    const agreementToArchiveId = generateId<AgreementId>();

    await expect(
      agreementService.archiveAgreement(agreementToArchiveId, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementNotFound(agreementToArchiveId));
  });

  it("should throw a operationNotAllowed error when the requester is not the Agreement consumer", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();

    const agreement = getMockAgreement(
      eserviceId,
      generateId<TenantId>(),
      randomArrayItem(agreementArchivableStates)
    );

    await addOneAgreement(agreement);

    await expect(
      agreementService.archiveAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw a agreementNotInExpectedState error when the Agreement is not in a archivable states", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();

    const notArchivableState = randomArrayItem(
      Object.values(agreementState).filter(
        (s) => !agreementArchivableStates.includes(s)
      )
    );
    const agreement = getMockAgreement(
      eserviceId,
      authData.organizationId,
      notArchivableState
    );

    await addOneAgreement(agreement);

    await expect(
      agreementService.archiveAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, notArchivableState)
    );
  });
});
