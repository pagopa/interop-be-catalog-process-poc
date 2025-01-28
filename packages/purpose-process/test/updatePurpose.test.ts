/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  genericLogger,
  unexpectedRulesVersionError,
} from "pagopa-interop-commons";
import {
  randomArrayItem,
  getMockTenant,
  getMockPurpose,
  getMockPurposeVersion,
  getMockValidRiskAnalysisForm,
  getMockValidRiskAnalysis,
  decodeProtobufPayload,
  getRandomAuthData,
  getMockDelegation,
  addSomeRandomDelegations,
  getMockAgreement,
} from "pagopa-interop-commons-test/index.js";
import {
  tenantKind,
  Tenant,
  EService,
  Purpose,
  purposeVersionState,
  generateId,
  DraftPurposeUpdatedV2,
  toPurposeV2,
  PurposeId,
  unsafeBrandId,
  TenantId,
  EServiceId,
  RiskAnalysis,
  eserviceMode,
  delegationKind,
  delegationState,
  Agreement,
  DelegationId,
} from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  purposeNotFound,
  organizationIsNotTheConsumer,
  purposeNotInDraftState,
  eserviceNotFound,
  eServiceModeNotAllowed,
  missingFreeOfChargeReason,
  tenantNotFound,
  tenantKindNotFound,
  riskAnalysisValidationFailed,
  duplicatedPurposeTitle,
  organizationIsNotTheDelegatedConsumer,
  puroposeDelegationNotFound,
} from "../src/model/domain/errors.js";
import {
  getMockEService,
  buildRiskAnalysisSeed,
  addOnePurpose,
  createUpdatedPurpose,
  readLastPurposeEvent,
  purposeService,
  addOneDelegation,
  addOneTenant,
  addOneEService,
  addOneAgreement,
} from "./utils.js";

describe("updatePurpose and updateReversePurpose", () => {
  const tenantType = randomArrayItem(Object.values(tenantKind));
  let tenant: Tenant;
  let eServiceDeliver: EService;
  let eServiceReceive: EService;
  let purposeForReceive: Purpose;
  let purposeForDeliver: Purpose;
  let validRiskAnalysis: RiskAnalysis;
  let purposeUpdateContent: purposeApi.PurposeUpdateContent;
  let reversePurposeUpdateContent: purposeApi.ReversePurposeUpdateContent;

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    tenant = {
      ...getMockTenant(),
      kind: tenantType,
    };

    eServiceDeliver = {
      ...getMockEService(),
      mode: eserviceMode.deliver,
      producerId: tenant.id,
    };

    eServiceReceive = {
      ...getMockEService(),
      mode: eserviceMode.receive,
      producerId: tenant.id,
    };

    purposeForReceive = {
      ...getMockPurpose(),
      eserviceId: eServiceReceive.id,
      consumerId: tenant.id,
      versions: [
        { ...getMockPurposeVersion(), state: purposeVersionState.draft },
      ],
      riskAnalysisForm: {
        ...getMockValidRiskAnalysisForm(tenantType),
        id: generateId(),
      },
    };

    purposeForDeliver = {
      ...getMockPurpose(),
      eserviceId: eServiceDeliver.id,
      consumerId: tenant.id,
      versions: [
        { ...getMockPurposeVersion(), state: purposeVersionState.draft },
      ],
    };

    validRiskAnalysis = getMockValidRiskAnalysis(tenantType);

    purposeUpdateContent = {
      title: "test",
      dailyCalls: 10,
      description: "test",
      isFreeOfCharge: false,
      riskAnalysisForm: buildRiskAnalysisSeed(validRiskAnalysis),
    };

    reversePurposeUpdateContent = {
      ...purposeUpdateContent,
    };
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should write on event store for the update of a purpose of an e-service in mode DELIVER (including title change)", async () => {
    await addOnePurpose(purposeForDeliver);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    const { purpose, isRiskAnalysisValid } = await purposeService.updatePurpose(
      purposeForDeliver.id,
      purposeUpdateContent,
      {
        authData: getRandomAuthData(tenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(purposeForDeliver.id);

    expect(writtenEvent).toMatchObject({
      stream_id: purposeForDeliver.id,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = createUpdatedPurpose(
      purposeForDeliver,
      purposeUpdateContent,
      validRiskAnalysis,
      writtenPayload.purpose!.riskAnalysisForm!
    );

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(true);
  });
  it("Should write on event store for the update of a purpose of an e-service in mode DELIVER (no title change)", async () => {
    await addOnePurpose(purposeForDeliver);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    const updateContentWithoutTitle = {
      ...purposeUpdateContent,
      title: purposeForDeliver.title,
    };

    const { purpose, isRiskAnalysisValid } = await purposeService.updatePurpose(
      purposeForDeliver.id,
      updateContentWithoutTitle,
      {
        authData: getRandomAuthData(tenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(purposeForDeliver.id);

    expect(writtenEvent).toMatchObject({
      stream_id: purposeForDeliver.id,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = createUpdatedPurpose(
      purposeForDeliver,
      updateContentWithoutTitle,
      validRiskAnalysis,
      writtenPayload.purpose!.riskAnalysisForm!
    );

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(true);
  });
  it("Should write on event store for the update of a purpose of an e-service in mode RECEIVE (including title change)", async () => {
    await addOnePurpose(purposeForReceive);
    await addOneEService(eServiceReceive);
    await addOneTenant(tenant);

    const { purpose, isRiskAnalysisValid } =
      await purposeService.updateReversePurpose(
        purposeForReceive.id,
        reversePurposeUpdateContent,
        {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      );

    const writtenEvent = await readLastPurposeEvent(purposeForReceive.id);
    expect(writtenEvent).toMatchObject({
      stream_id: purposeForReceive.id,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = createUpdatedPurpose(
      purposeForReceive,
      reversePurposeUpdateContent,
      validRiskAnalysis,
      writtenPayload.purpose!.riskAnalysisForm!
    );

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(true);
  });
  it("should succeed when requester is Consumer Delegate and the Purpose is in a updatable state and the e-service is in mode DELIVER", async () => {
    const authData = getRandomAuthData();

    const delegatePurpose: Purpose = {
      ...purposeForDeliver,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: delegatePurpose.eserviceId,
      delegatorId: delegatePurpose.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });

    await addOnePurpose(delegatePurpose);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(delegatePurpose, addOneDelegation);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    const updateContentWithoutTitle = {
      ...purposeUpdateContent,
      title: delegatePurpose.title,
    };

    const { purpose, isRiskAnalysisValid } = await purposeService.updatePurpose(
      delegatePurpose.id,
      updateContentWithoutTitle,
      {
        authData,
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(delegatePurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = createUpdatedPurpose(
      delegatePurpose,
      updateContentWithoutTitle,
      validRiskAnalysis,
      writtenPayload.purpose!.riskAnalysisForm!
    );

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(true);
  });
  it("should succeed when requester is Consumer Delegate and the Purpose is in a updatable state and the e-service is in mode RECEIVE", async () => {
    const authData = getRandomAuthData();

    const delegatePurpose: Purpose = {
      ...purposeForReceive,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: delegatePurpose.eserviceId,
      delegatorId: delegatePurpose.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });

    await addOnePurpose(delegatePurpose);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(purposeForDeliver, addOneDelegation);
    await addOneEService(eServiceReceive);
    await addOneTenant(tenant);

    const { purpose, isRiskAnalysisValid } =
      await purposeService.updateReversePurpose(
        delegatePurpose.id,
        reversePurposeUpdateContent,
        {
          authData,
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      );

    const writtenEvent = await readLastPurposeEvent(delegatePurpose.id);
    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = createUpdatedPurpose(
      delegatePurpose,
      reversePurposeUpdateContent,
      validRiskAnalysis,
      writtenPayload.purpose!.riskAnalysisForm!
    );

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(true);
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the Purpose is in a updatable state and the e-service is in mode DELIVER", async () => {
    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };
    const producerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };
    const consumer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };
    const consumerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };

    const eservice: EService = {
      ...getMockEService(),
      mode: eserviceMode.deliver,
      producerId: producer.id,
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
    };
    const delegatePurpose: Purpose = {
      ...purposeForDeliver,
      consumerId: consumer.id,
      eserviceId: eservice.id,
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

    const updateContentWithoutTitle = {
      ...purposeUpdateContent,
      title: delegatePurpose.title,
    };

    const { purpose, isRiskAnalysisValid } = await purposeService.updatePurpose(
      delegatePurpose.id,
      updateContentWithoutTitle,
      {
        authData: getRandomAuthData(consumerDelegate.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(delegatePurpose.id);
    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = createUpdatedPurpose(
      delegatePurpose,
      updateContentWithoutTitle,
      validRiskAnalysis,
      writtenPayload.purpose!.riskAnalysisForm!
    );

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(true);
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the Purpose is in a updatable state and the e-service is in mode RECEIVE", async () => {
    const producerDelegator = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };
    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };
    const consumerDelegator = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };
    const consumer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };

    const eservice: EService = {
      ...getMockEService(),
      mode: eserviceMode.receive,
      producerId: producer.id,
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
    };
    const delegatePurpose: Purpose = {
      ...purposeForReceive,
      consumerId: consumer.id,
      eserviceId: eservice.id,
    };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: producerDelegator.id,
      delegateId: producer.id,
      state: delegationState.active,
    });

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumerDelegator.id,
      delegateId: consumer.id,
      state: delegationState.active,
    });

    await addOneTenant(producerDelegator);
    await addOneTenant(producer);
    await addOneTenant(consumerDelegator);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOnePurpose(delegatePurpose);
    await addOneDelegation(producerDelegation);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(delegatePurpose, addOneDelegation);

    const { purpose, isRiskAnalysisValid } =
      await purposeService.updateReversePurpose(
        delegatePurpose.id,
        reversePurposeUpdateContent,
        {
          authData: getRandomAuthData(consumer.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      );

    const writtenEvent = await readLastPurposeEvent(delegatePurpose.id);
    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = createUpdatedPurpose(
      delegatePurpose,
      reversePurposeUpdateContent,
      validRiskAnalysis,
      writtenPayload.purpose!.riskAnalysisForm!
    );

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(true);
  });
  it("Should throw purposeNotFound if the purpose doesn't exist", async () => {
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    const purposeId: PurposeId = unsafeBrandId(generateId());

    expect(
      purposeService.updatePurpose(purposeId, purposeUpdateContent, {
        authData: getRandomAuthData(tenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(purposeNotFound(purposeId));
  });
  it("Should throw organizationIsNotTheConsumer if the organization is not the consumer", async () => {
    const mockPurpose: Purpose = {
      ...purposeForDeliver,
      consumerId: generateId(),
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    const organizationId: TenantId = unsafeBrandId(generateId());

    expect(
      purposeService.updatePurpose(mockPurpose.id, purposeUpdateContent, {
        authData: getRandomAuthData(organizationId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(organizationIsNotTheConsumer(organizationId));
  });
  it.each(
    Object.values(purposeVersionState).filter(
      (state) => state !== purposeVersionState.draft
    )
  )(
    "Should throw purposeNotInDraftState if the purpose is in state %s",
    async (state) => {
      const mockPurpose: Purpose = {
        ...purposeForDeliver,
        versions: [{ ...getMockPurposeVersion(state) }],
      };

      await addOnePurpose(mockPurpose);
      await addOneEService(eServiceDeliver);
      await addOneTenant(tenant);

      expect(
        purposeService.updatePurpose(mockPurpose.id, purposeUpdateContent, {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        })
      ).rejects.toThrowError(purposeNotInDraftState(mockPurpose.id));
    }
  );
  it("Should throw duplicatedPurposeTitle if the purpose title already exists", async () => {
    const purposeWithDuplicatedTitle = {
      ...purposeForDeliver,
      id: unsafeBrandId<PurposeId>(generateId()),
      title: "duplicated",
    };
    await addOnePurpose(purposeForDeliver);
    await addOnePurpose(purposeWithDuplicatedTitle);

    expect(
      purposeService.updatePurpose(
        purposeForDeliver.id,
        {
          ...purposeUpdateContent,
          title: purposeWithDuplicatedTitle.title,
        },
        {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      duplicatedPurposeTitle(purposeWithDuplicatedTitle.title)
    );
  });
  it("Should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const eserviceId: EServiceId = unsafeBrandId(generateId());
    const mockPurpose: Purpose = {
      ...purposeForDeliver,
      eserviceId,
    };

    await addOnePurpose(mockPurpose);
    await addOneTenant(tenant);

    expect(
      purposeService.updatePurpose(mockPurpose.id, purposeUpdateContent, {
        authData: getRandomAuthData(tenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(eserviceNotFound(eserviceId));
  });
  it("should throw eServiceModeNotAllowed if the eService mode is incorrect when expecting DELIVER", async () => {
    await addOnePurpose(purposeForReceive);
    await addOneEService(eServiceReceive);
    await addOneTenant(tenant);

    expect(
      purposeService.updatePurpose(purposeForReceive.id, purposeUpdateContent, {
        authData: getRandomAuthData(tenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(
      eServiceModeNotAllowed(eServiceReceive.id, "Deliver")
    );
  });
  it("should throw eServiceModeNotAllowed if the eService mode is incorrect when expecting RECEIVE", async () => {
    await addOnePurpose(purposeForDeliver);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updateReversePurpose(
        purposeForDeliver.id,
        reversePurposeUpdateContent,
        {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      eServiceModeNotAllowed(eServiceDeliver.id, "Receive")
    );
  });
  it("Should throw missingFreeOfChargeReason if isFreeOfCharge is true but freeOfChargeReason is missing", async () => {
    await addOnePurpose(purposeForDeliver);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updatePurpose(
        purposeForDeliver.id,
        {
          ...purposeUpdateContent,
          isFreeOfCharge: true,
        },
        {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(missingFreeOfChargeReason());
  });
  it("Should throw tenantNotFound if the tenant does not exist", async () => {
    await addOnePurpose(purposeForDeliver);
    await addOneEService(eServiceDeliver);
    expect(
      purposeService.updatePurpose(purposeForDeliver.id, purposeUpdateContent, {
        authData: getRandomAuthData(tenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(tenantNotFound(tenant.id));

    await addOnePurpose(purposeForReceive);
    await addOneEService(eServiceReceive);

    expect(
      purposeService.updateReversePurpose(
        purposeForReceive.id,
        reversePurposeUpdateContent,
        {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });
  it("Should throw tenantKindNotFound if the tenant kind does not exist", async () => {
    const mockTenant = {
      ...tenant,
      kind: undefined,
    };

    await addOnePurpose(purposeForDeliver);
    await addOneEService(eServiceDeliver);
    await addOneTenant(mockTenant);

    expect(
      purposeService.updatePurpose(purposeForDeliver.id, purposeUpdateContent, {
        authData: getRandomAuthData(mockTenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
  });
  it("Should throw riskAnalysisValidationFailed if the risk analysis is not valid in updatePurpose", async () => {
    await addOnePurpose(purposeForDeliver);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    const invalidRiskAnalysis: RiskAnalysis = {
      ...validRiskAnalysis,
      riskAnalysisForm: {
        ...validRiskAnalysis.riskAnalysisForm,
        version: "0",
      },
    };

    const mockPurposeUpdateContent: purposeApi.PurposeUpdateContent = {
      ...purposeUpdateContent,
      riskAnalysisForm: buildRiskAnalysisSeed(invalidRiskAnalysis),
    };

    expect(
      purposeService.updatePurpose(
        purposeForDeliver.id,
        mockPurposeUpdateContent,
        {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([unexpectedRulesVersionError("0")])
    );
  });
  it("Should throw riskAnalysisValidationFailed if the risk analysis is not valid in updateReversePurpose", async () => {
    const purposeWithInvalidRiskAnalysis: Purpose = {
      ...purposeForReceive,
      riskAnalysisForm: {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ...purposeForReceive.riskAnalysisForm!,
        version: "0",
      },
    };

    await addOnePurpose(purposeWithInvalidRiskAnalysis);
    await addOneEService(eServiceReceive);
    await addOneTenant(tenant);

    expect(
      purposeService.updateReversePurpose(
        purposeWithInvalidRiskAnalysis.id,
        reversePurposeUpdateContent,
        {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([unexpectedRulesVersionError("0")])
    );
  });
  it("should throw organizationIsNotTheDelegatedConsumer when the requester is the Consumer and is updating a purpose created by the delegate in updatePurpose", async () => {
    const authData = getRandomAuthData();

    const delegatePurpose: Purpose = {
      ...purposeForDeliver,
      consumerId: authData.organizationId,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: delegatePurpose.eserviceId,
      delegatorId: delegatePurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(delegatePurpose);
    await addOneDelegation(delegation);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);
    expect(
      purposeService.updatePurpose(delegatePurpose.id, purposeUpdateContent, {
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
  it("should throw organizationIsNotTheDelegatedConsumer when the requester is the Consumer and is updating a purpose created by the delegate in updateReversePurpose", async () => {
    const authData = getRandomAuthData();

    const delegatePurpose: Purpose = {
      ...purposeForReceive,
      consumerId: authData.organizationId,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: delegatePurpose.eserviceId,
      delegatorId: delegatePurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(delegatePurpose);
    await addOneDelegation(delegation);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updateReversePurpose(
        delegatePurpose.id,
        reversePurposeUpdateContent,
        {
          authData,
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      organizationIsNotTheDelegatedConsumer(
        authData.organizationId,
        delegation.id
      )
    );
  });
  it("should throw puroposeDelegationNotFound when the requester is the Consumer, is updating a purpose created by a delegate in updatePurpose, but the delegation cannot be found", async () => {
    const authData = getRandomAuthData();

    const delegatePurpose: Purpose = {
      ...purposeForDeliver,
      consumerId: tenant.id,
      delegationId: generateId<DelegationId>(),
    };

    await addOnePurpose(delegatePurpose);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updatePurpose(
        delegatePurpose.id,
        reversePurposeUpdateContent,
        {
          authData,
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      puroposeDelegationNotFound(
        delegatePurpose.id,
        delegatePurpose.delegationId!
      )
    );
  });
  it("should throw puroposeDelegationNotFound when the requester is the Consumer, is updating a purpose created by a delegate in updateReversePurpose, but the delegation cannot be found", async () => {
    const authData = getRandomAuthData();

    const delegatePurpose: Purpose = {
      ...purposeForReceive,
      consumerId: tenant.id,
      delegationId: generateId<DelegationId>(),
    };

    await addOnePurpose(delegatePurpose);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updateReversePurpose(
        delegatePurpose.id,
        reversePurposeUpdateContent,
        {
          authData,
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      puroposeDelegationNotFound(
        delegatePurpose.id,
        delegatePurpose.delegationId!
      )
    );
  });
  it("should throw organizationIsNotTheConsumer when the requester is a delegate for the eservice and there is no delegationId in the purpose in updatePurpose", async () => {
    const delegatePurpose: Purpose = {
      ...purposeForReceive,
      consumerId: tenant.id,
      delegationId: undefined,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: delegatePurpose.eserviceId,
      delegatorId: delegatePurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(delegatePurpose);
    await addOneDelegation(delegation);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updatePurpose(
        delegatePurpose.id,
        reversePurposeUpdateContent,
        {
          authData: getRandomAuthData(delegation.delegateId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(organizationIsNotTheConsumer(delegation.delegateId));
  });
  it("should throw organizationIsNotTheConsumer when the requester is a delegate for the eservice and there is no delegationId in the purpose in updateReversePurpose", async () => {
    const delegatePurpose: Purpose = {
      ...purposeForReceive,
      consumerId: tenant.id,
      delegationId: undefined,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: delegatePurpose.eserviceId,
      delegatorId: delegatePurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(delegatePurpose);
    await addOneDelegation(delegation);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updateReversePurpose(
        delegatePurpose.id,
        reversePurposeUpdateContent,
        {
          authData: getRandomAuthData(delegation.delegateId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(organizationIsNotTheConsumer(delegation.delegateId));
  });
  it("should throw organizationIsNotTheDelegatedConsumer when the requester is a delegate for the eservice and there is a delegationId in purpose but for a different delegationId (a different delegate) in updatePurpose", async () => {
    const purpose: Purpose = {
      ...purposeForReceive,
      consumerId: tenant.id,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: generateId<DelegationId>(),
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    const purposeDelegation = getMockDelegation({
      id: purpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(purpose);
    await addOneDelegation(delegation);
    await addOneDelegation(purposeDelegation);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updatePurpose(purpose.id, reversePurposeUpdateContent, {
        authData: getRandomAuthData(delegation.delegateId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(
      organizationIsNotTheDelegatedConsumer(
        delegation.delegateId,
        purpose.delegationId
      )
    );
  });
  it("should throw organizationIsNotTheDelegatedConsumer when the requester is a delegate for the eservice and there is a delegationId in purpose but for a different delegationId (a different delegate) in updateReversePurpose", async () => {
    const purpose: Purpose = {
      ...purposeForReceive,
      consumerId: tenant.id,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: generateId<DelegationId>(),
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    const purposeDelegation = getMockDelegation({
      id: purpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(purpose);
    await addOneDelegation(delegation);
    await addOneDelegation(purposeDelegation);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updateReversePurpose(
        purpose.id,
        reversePurposeUpdateContent,
        {
          authData: getRandomAuthData(delegation.delegateId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      organizationIsNotTheDelegatedConsumer(
        delegation.delegateId,
        purpose.delegationId
      )
    );
  });
});
