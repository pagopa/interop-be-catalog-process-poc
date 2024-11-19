/* eslint-disable functional/no-let */
import { fail } from "assert";
import {
  getMockAgreement,
  getRandomAuthData,
  decodeProtobufPayload,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  AgreementId,
  DraftAgreementUpdatedV2,
  agreementState,
  fromAgreementV2,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  operationNotAllowed,
} from "../src/model/domain/errors.js";
import { agreementUpdatableStates } from "../src/model/domain/agreement-validators.js";
import { apiAgreementToAgreement } from "../src/model/domain/apiConverter.js";
import {
  addOneAgreement,
  agreementService,
  expectedAgreementWithCorrectDate,
  readLastAgreementEvent,
} from "./utils.js";
import { mockAgreementRouterRequest } from "./supertestSetup.js";

describe("update agreement", () => {
  it("should succeed when requester is Consumer and the Agreement is in an updatable state", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementUpdatableStates),
    };
    await addOneAgreement(agreement);
    const authData = getRandomAuthData(agreement.consumerId);
    const apiReturnedAgreement = await mockAgreementRouterRequest.post({
      path: "/agreements/:agreementId/update",
      pathParams: { agreementId: agreement.id },
      body: { consumerNotes: "Updated consumer notes" },
      authData,
    });

    const returnedAgreement = apiAgreementToAgreement(apiReturnedAgreement);

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    expect(agreementEvent).toMatchObject({
      type: "DraftAgreementUpdated",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementUptaded = decodeProtobufPayload({
      messageType: DraftAgreementUpdatedV2,
      payload: agreementEvent.data,
    }).agreement;

    if (!actualAgreementUptaded) {
      fail("impossible to decode DraftAgreementUpdatedV2 data");
    }

    const expectedActualAgreementUptadedWithCorrectDate =
      expectedAgreementWithCorrectDate({
        expectedAgreement: fromAgreementV2(actualAgreementUptaded),
        agreement,
        agreementReturnValue: returnedAgreement,
      });

    expect(actualAgreementUptaded).toMatchObject({
      ...toAgreementV2(agreement),
      consumerNotes: "Updated consumer notes",
    });
    expect(expectedActualAgreementUptadedWithCorrectDate).toMatchObject(
      returnedAgreement
    );
  });

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    await addOneAgreement(getMockAgreement());

    const authData = getRandomAuthData();
    const agreementId = generateId<AgreementId>();
    await expect(
      agreementService.updateAgreement(
        agreementId,
        { consumerNotes: "Updated consumer notes" },
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw operationNotAllowed when the requester is not the Consumer", async () => {
    const authData = getRandomAuthData();
    const agreement = getMockAgreement();
    await addOneAgreement(agreement);
    await expect(
      agreementService.updateAgreement(
        agreement.id,
        { consumerNotes: "Updated consumer notes" },
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw agreementNotInExpectedState when the agreement is not in an updatable state", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (s) => !agreementUpdatableStates.includes(s)
        )
      ),
    };
    await addOneAgreement(agreement);
    const authData = getRandomAuthData(agreement.consumerId);
    await expect(
      agreementService.updateAgreement(
        agreement.id,
        { consumerNotes: "Updated consumer notes" },
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });
});
