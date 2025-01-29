import { fail } from "assert";
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockDelegation,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import {
  Agreement,
  AgreementArchivedByRevokedDelegationV2,
  DelegationId,
  EServiceId,
  TenantId,
  agreementState,
  delegationKind,
  delegationState,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { agreementArchivableStates } from "../src/model/domain/agreement-validators.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  delegationNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  agreementService,
  readLastAgreementEvent,
} from "./utils.js";

describe("internal archive agreement", () => {
  it("should succeed when the agreement is in an archivable state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      randomArrayItem(agreementArchivableStates)
    );

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: agreement.eserviceId,
      delegatorId: agreement.consumerId,
      state: delegationState.active,
    });

    await addOneAgreement(agreement);
    await addOneDelegation(consumerDelegation);

    await agreementService.internalArchiveAgreementAfterDelegationRevocation(
      agreement.id,
      consumerDelegation.id,
      generateId(),
      genericLogger
    );

    const actualAgreementData = await readLastAgreementEvent(agreement.id);

    expect(actualAgreementData).toMatchObject({
      type: "AgreementArchivedByRevokedDelegation",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreement: AgreementArchivedByRevokedDelegationV2 | undefined =
      decodeProtobufPayload({
        messageType: AgreementArchivedByRevokedDelegationV2,
        payload: actualAgreementData.data,
      });

    if (!actualAgreement) {
      fail("impossible to decode AgreementArchivedV2 data");
    }

    const expectedAgreemenentArchived: Agreement = {
      ...agreement,
      state: agreementState.archived,
    };

    expect(actualAgreement).toEqual({
      agreement: toAgreementV2(expectedAgreemenentArchived),
      delegationId: consumerDelegation.id,
    });

    vi.useRealTimers();
  });

  it("should throw a agreementNotFound error when the Agreement doesn't exist", async () => {
    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      randomArrayItem(agreementArchivableStates)
    );

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: agreement.eserviceId,
      delegatorId: agreement.consumerId,
      state: delegationState.active,
    });

    await addOneDelegation(consumerDelegation);

    await expect(
      agreementService.internalArchiveAgreementAfterDelegationRevocation(
        agreement.id,
        generateId<DelegationId>(),
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(agreementNotFound(agreement.id));
  });

  it("should throw a agreementNotInExpectedState error when the Agreement is not in a archivable states", async () => {
    const notArchivableState = randomArrayItem(
      Object.values(agreementState).filter(
        (s) => !agreementArchivableStates.includes(s)
      )
    );
    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      notArchivableState
    );

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: agreement.eserviceId,
      delegatorId: agreement.consumerId,
      state: delegationState.active,
    });

    await addOneAgreement(agreement);
    await addOneDelegation(consumerDelegation);

    await expect(
      agreementService.internalArchiveAgreementAfterDelegationRevocation(
        agreement.id,
        consumerDelegation.id,
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, notArchivableState)
    );
  });
  it("should throw delegationNotFound when the delegation is not present", async () => {
    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      randomArrayItem(agreementArchivableStates)
    );

    await addOneAgreement(agreement);

    const invalidDelegationid = generateId<DelegationId>();

    await expect(
      agreementService.internalArchiveAgreementAfterDelegationRevocation(
        agreement.id,
        invalidDelegationid,
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(delegationNotFound(invalidDelegationid));
  });
});
