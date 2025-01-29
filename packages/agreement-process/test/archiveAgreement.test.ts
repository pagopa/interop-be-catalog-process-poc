import { fail } from "assert";
import { genericLogger } from "pagopa-interop-commons";
import {
  addSomeRandomDelegations,
  decodeProtobufPayload,
  getMockAgreement,
  getMockDelegation,
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
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegateConsumer,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  agreementService,
  readLastAgreementEvent,
} from "./utils.js";

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

    const returnedAgreement = await agreementService.archiveAgreement(
      agreement.id,
      {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );
    const agreementId = returnedAgreement.id;

    expect(agreementId).toBeDefined();
    const actualAgreementData = await readLastAgreementEvent(agreementId);

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

    expect(actualAgreement).toMatchObject(
      toAgreementV2(expectedAgreemenentArchived)
    );

    expect(actualAgreement).toEqual(toAgreementV2(returnedAgreement));

    vi.useRealTimers();
  });

  it("should succeed when the requester is the consumer delegate and the agreement is in an archivable state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const delegateId = generateId<TenantId>();
    const authData = getRandomAuthData(delegateId);

    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementArchivableStates),
    };

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

    const returnedAgreement = await agreementService.archiveAgreement(
      agreement.id,
      {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );

    const agreementId = returnedAgreement.id;

    expect(agreementId).toBeDefined();

    const actualAgreementData = await readLastAgreementEvent(agreementId);

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

    expect(actualAgreement).toMatchObject(
      toAgreementV2(expectedAgreemenentArchived)
    );

    expect(actualAgreement).toEqual(toAgreementV2(returnedAgreement));

    vi.useRealTimers();
  });

  it("should throw organizationIsNotTheDelegateConsumer when the requester is the consumer but there is a consumer delegation", async () => {
    const authData = getRandomAuthData();

    const agreement = {
      ...getMockAgreement(),
      consumerId: authData.organizationId,
      state: randomArrayItem(agreementArchivableStates),
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
      agreementService.archiveAgreement(agreement.id, {
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

  it("should throw a organizationIsNotTheConsumer error when the requester is not the Agreement consumer", async () => {
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
    ).rejects.toThrowError(
      organizationIsNotTheConsumer(authData.organizationId)
    );
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
