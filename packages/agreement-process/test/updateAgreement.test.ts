/* eslint-disable functional/no-let */
import {
  getMockAgreement,
  getRandomAuthData,
  decodeProtobufPayload,
  randomArrayItem,
  getMockDelegation,
  addSomeRandomDelegations,
} from "pagopa-interop-commons-test";
import {
  AgreementId,
  DraftAgreementUpdatedV2,
  TenantId,
  agreementState,
  delegationKind,
  delegationState,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegateConsumer,
} from "../src/model/domain/errors.js";
import { agreementUpdatableStates } from "../src/model/domain/agreement-validators.js";
import {
  addOneAgreement,
  addOneDelegation,
  agreementService,
  readLastAgreementEvent,
} from "./utils.js";

describe("update agreement", () => {
  it("should succeed when requester is Consumer and the Agreement is in an updatable state", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementUpdatableStates),
    };
    await addOneAgreement(agreement);
    const authData = getRandomAuthData(agreement.consumerId);
    const returnedAgreement = await agreementService.updateAgreement(
      agreement.id,
      { consumerNotes: "Updated consumer notes" },
      {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

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

    expect(actualAgreementUptaded).toMatchObject({
      ...toAgreementV2(agreement),
      consumerNotes: "Updated consumer notes",
    });
    expect(actualAgreementUptaded).toMatchObject(
      toAgreementV2(returnedAgreement)
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

  it("should throw organizationIsNotTheConsumer when the requester is not the Consumer", async () => {
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
    ).rejects.toThrowError(
      organizationIsNotTheConsumer(authData.organizationId)
    );
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

  it("should succeed when requester is Consumer Delegate and the Agreement is in an updatable state", async () => {
    const authData = getRandomAuthData();
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementUpdatableStates),
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: agreement.eserviceId,
      delegatorId: agreement.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });
    await addOneAgreement(agreement);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(agreement, addOneDelegation);

    const returnedAgreement = await agreementService.updateAgreement(
      agreement.id,
      { consumerNotes: "Updated consumer notes" },
      {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    expect(agreementEvent).toMatchObject({
      type: "DraftAgreementUpdated",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementUpdated = decodeProtobufPayload({
      messageType: DraftAgreementUpdatedV2,
      payload: agreementEvent.data,
    }).agreement;

    expect(actualAgreementUpdated).toMatchObject({
      ...toAgreementV2(agreement),
      consumerNotes: "Updated consumer notes",
    });
    expect(actualAgreementUpdated).toMatchObject(
      toAgreementV2(returnedAgreement)
    );
  });

  it("should throw organizationIsNotTheDelegateConsumer when the requester is the Consumer but there is a Consumer Delegation", async () => {
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
      organizationIsNotTheDelegateConsumer(
        authData.organizationId,
        delegation.id
      )
    );
  });
});
