/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  Agreement,
  DelegationId,
  DraftPurposeDeletedV2,
  EService,
  Purpose,
  PurposeId,
  PurposeVersion,
  TenantId,
  WaitingForApprovalPurposeDeletedV2,
  delegationKind,
  delegationState,
  generateId,
  purposeVersionState,
  tenantKind,
  toPurposeV2,
  toReadModelEService,
} from "pagopa-interop-models";
import {
  getMockPurpose,
  writeInReadmodel,
  decodeProtobufPayload,
  getMockPurposeVersion,
  getRandomAuthData,
  getMockDelegation,
  addSomeRandomDelegations,
  getMockTenant,
  getMockAgreement,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  organizationIsNotTheConsumer,
  purposeCannotBeDeleted,
  organizationIsNotTheDelegatedConsumer,
  puroposeDelegationNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  eservices,
  getMockEService,
  purposeService,
  readLastPurposeEvent,
} from "./utils.js";

describe("deletePurpose", () => {
  it("should write on event-store for the deletion of a purpose (no versions)", async () => {
    const mockEService = getMockEService();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    await purposeService.deletePurpose(mockPurpose.id, {
      authData: getRandomAuthData(mockPurpose.consumerId),
      correlationId: generateId(),
      logger: genericLogger,
      serviceName: "",
    });

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "DraftPurposeDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose));
  });
  it("should write on event-store for the deletion of a purpose (draft version)", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion(purposeVersionState.draft);
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    await purposeService.deletePurpose(mockPurpose.id, {
      authData: getRandomAuthData(mockPurpose.consumerId),
      correlationId: generateId(),
      logger: genericLogger,
      serviceName: "",
    });

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "DraftPurposeDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose));
  });
  it("should write on event-store for the deletion of a purpose (waitingForApproval version)", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion(
      purposeVersionState.waitingForApproval
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    await purposeService.deletePurpose(mockPurpose.id, {
      authData: getRandomAuthData(mockPurpose.consumerId),
      correlationId: generateId(),
      logger: genericLogger,
      serviceName: "",
    });

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "WaitingForApprovalPurposeDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: WaitingForApprovalPurposeDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose));
  });
  it("should succeed when requester is Consumer Delegate and the Purpose is in a deletable state", async () => {
    const authData = getRandomAuthData();
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion(purposeVersionState.draft);
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(mockPurpose, addOneDelegation);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    await purposeService.deletePurpose(mockPurpose.id, {
      authData,
      correlationId: generateId(),
      logger: genericLogger,
      serviceName: "",
    });

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "DraftPurposeDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose));
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the Purpose is in a deletable state", async () => {
    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const producerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
    };

    const mockPurposeVersion = getMockPurposeVersion(purposeVersionState.draft);

    const delegatePurpose: Purpose = {
      ...getMockPurpose(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: producer.id,
      delegateId: producerDelegate.id,
      state: delegationState.active,
    });

    const consumerDelegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOneTenant(producerDelegate);
    await addOneTenant(producer);
    await addOneTenant(consumerDelegate);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOnePurpose(delegatePurpose);
    await addOneDelegation(producerDelegation);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(delegatePurpose, addOneDelegation);

    await purposeService.deletePurpose(delegatePurpose.id, {
      authData: getRandomAuthData(consumerDelegate.id),
      correlationId: generateId(),
      logger: genericLogger,
      serviceName: "",
    });

    const writtenEvent = await readLastPurposeEvent(delegatePurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "DraftPurposeDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(delegatePurpose));
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomId: PurposeId = generateId();
    const mockPurpose = getMockPurpose();

    await addOnePurpose(mockPurpose);
    expect(
      purposeService.deletePurpose(randomId, {
        authData: getRandomAuthData(mockPurpose.consumerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(purposeNotFound(randomId));
  });
  it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
      purposeVersionState.draft
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.deletePurpose(mockPurpose.id, {
        authData: getRandomAuthData(mockEService.producerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(
      organizationIsNotTheConsumer(mockEService.producerId)
    );
  });
  it.each(
    Object.values(purposeVersionState).filter(
      (state) =>
        state !== purposeVersionState.waitingForApproval &&
        state !== purposeVersionState.draft
    )
  )(
    "should throw purposeCannotBeDeleted if the purpose has a $s version ",
    async (state) => {
      const mockEService = getMockEService();
      const mockPurposeVersion = getMockPurposeVersion(state);

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.deletePurpose(mockPurpose.id, {
          authData: getRandomAuthData(mockPurpose.consumerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        })
      ).rejects.toThrowError(purposeCannotBeDeleted(mockPurpose.id));
    }
  );
  it("should throw organizationIsNotTheDelegatedConsumer when the requester is the Consumer and is deleting a purpose created by the delegate in deletePurpose", async () => {
    const authData = getRandomAuthData();
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
      purposeVersionState.draft
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      consumerId: authData.organizationId,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });
    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.deletePurpose(mockPurpose.id, {
        authData,
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(
      organizationIsNotTheDelegatedConsumer(
        authData.organizationId,
        delegation.id
      )
    );
  });

  it("should throw puroposeDelegationNotFound when the requester is the Consumer, is deleting a purpose created by a delegate in deletePurpose, but the delegation cannot be found", async () => {
    const authData = getRandomAuthData();
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
      purposeVersionState.draft
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
      consumerId: authData.organizationId,
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.deletePurpose(mockPurpose.id, {
        authData: getRandomAuthData(mockEService.producerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      puroposeDelegationNotFound(mockPurpose.id, mockPurpose.delegationId!)
    );
  });
  it("should throw organizationIsNotTheConsumer if the requester is a delegate for the eservice and there is no delegationId in the purpose", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
      purposeVersionState.draft
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: undefined,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });
    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.deletePurpose(mockPurpose.id, {
        authData: getRandomAuthData(delegation.delegateId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(organizationIsNotTheConsumer(delegation.delegateId));
  });

  it("should throw organizationIsNotTheDelegatedConsumer if the the requester is a delegate for the eservice and there is a delegationId in purpose but for a different delegationId (a different delegate)", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
      purposeVersionState.draft
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: generateId<DelegationId>(),
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    const purposeDelegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);
    await addOneDelegation(purposeDelegation);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.deletePurpose(mockPurpose.id, {
        authData: getRandomAuthData(delegation.delegateId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(
      organizationIsNotTheDelegatedConsumer(
        delegation.delegateId,
        mockPurpose.delegationId
      )
    );
  });
});
