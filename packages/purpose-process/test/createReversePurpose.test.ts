/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it, vi } from "vitest";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockDelegation,
  getMockDescriptor,
  getMockDocument,
  getMockPurpose,
  getMockTenant,
  getMockValidRiskAnalysis,
  getRandomAuthData,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Descriptor,
  EService,
  Purpose,
  PurposeAddedV2,
  RiskAnalysis,
  RiskAnalysisId,
  Tenant,
  agreementState,
  descriptorState,
  eserviceMode,
  generateId,
  purposeVersionState,
  tenantKind,
  toPurposeV2,
  unsafeBrandId,
  delegationKind,
  delegationState,
  TenantId,
} from "pagopa-interop-models";
import {
  genericLogger,
  unexpectedRulesVersionError,
} from "pagopa-interop-commons";
import { purposeApi } from "pagopa-interop-api-clients";
import {
  agreementNotFound,
  duplicatedPurposeTitle,
  eServiceModeNotAllowed,
  eserviceRiskAnalysisNotFound,
  missingFreeOfChargeReason,
  organizationIsNotTheConsumer,
  riskAnalysisValidationFailed,
  tenantKindNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  getMockEService,
  purposeService,
  readLastPurposeEvent,
} from "./utils.js";

describe("createReversePurpose", () => {
  it("should write in event-store for the creation of a reverse purpose", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const consumer = getMockTenant();
    const producer: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: getMockDocument(),
    };

    const mockRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
      riskAnalysis: [mockRiskAnalysis],
      descriptors: [mockDescriptor],
      mode: eserviceMode.receive,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      state: agreementState.active,
    };

    const reversePurposeSeed: purposeApi.EServicePurposeSeed = {
      eServiceId: mockEService.id,
      consumerId: consumer.id,
      riskAnalysisId: mockRiskAnalysis.id,
      title: "test purpose title",
      description: "test purpose description",
      isFreeOfCharge: true,
      freeOfChargeReason: "test",
      dailyCalls: 1,
    };

    await addOneEService(mockEService);
    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneAgreement(mockAgreement);

    const { purpose, isRiskAnalysisValid } =
      await purposeService.createReversePurpose(reversePurposeSeed, {
        authData: getRandomAuthData(consumer.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      });

    const writtenEvent = await readLastPurposeEvent(purpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "0",
      type: "PurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = {
      versions: [
        {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          createdAt: new Date(),
          state: purposeVersionState.draft,
          dailyCalls: reversePurposeSeed.dailyCalls,
        },
      ],
      id: purpose.id,
      createdAt: new Date(),
      eserviceId: unsafeBrandId(reversePurposeSeed.eServiceId),
      consumerId: unsafeBrandId(reversePurposeSeed.consumerId),
      title: reversePurposeSeed.title,
      description: reversePurposeSeed.description,
      isFreeOfCharge: reversePurposeSeed.isFreeOfCharge,
      freeOfChargeReason: reversePurposeSeed.freeOfChargeReason,
      riskAnalysisForm: {
        ...mockRiskAnalysis.riskAnalysisForm,
        riskAnalysisId: mockRiskAnalysis.id,
      },
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toEqual(true);

    vi.useRealTimers();
  });
  it("should succeed when requester is Consumer Delegate and the creation of the purpose is reversed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const consumer = getMockTenant();
    const producer: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

    const delegateTenant = { ...getMockTenant(), kind: tenantKind.PA };

    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: getMockDocument(),
    };

    const mockRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
      riskAnalysis: [mockRiskAnalysis],
      descriptors: [mockDescriptor],
      mode: eserviceMode.receive,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      state: agreementState.active,
    };

    const reversePurposeSeed: purposeApi.EServicePurposeSeed = {
      eServiceId: mockEService.id,
      consumerId: consumer.id,
      riskAnalysisId: mockRiskAnalysis.id,
      title: "test purpose title",
      description: "test purpose description",
      isFreeOfCharge: true,
      freeOfChargeReason: "test",
      dailyCalls: 1,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockEService.id,
      delegatorId: mockAgreement.consumerId,
      delegateId: delegateTenant.id,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);
    await addOneTenant(delegateTenant);
    await addOneEService(mockEService);
    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneAgreement(mockAgreement);

    const { purpose, isRiskAnalysisValid } =
      await purposeService.createReversePurpose(reversePurposeSeed, {
        authData: getRandomAuthData(delegateTenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      });

    const writtenEvent = await readLastPurposeEvent(purpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "0",
      type: "PurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = {
      versions: [
        {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          createdAt: new Date(),
          state: purposeVersionState.draft,
          dailyCalls: reversePurposeSeed.dailyCalls,
        },
      ],
      id: purpose.id,
      createdAt: new Date(),
      eserviceId: unsafeBrandId(reversePurposeSeed.eServiceId),
      consumerId: unsafeBrandId(reversePurposeSeed.consumerId),
      delegationId: delegation.id,
      title: reversePurposeSeed.title,
      description: reversePurposeSeed.description,
      isFreeOfCharge: reversePurposeSeed.isFreeOfCharge,
      freeOfChargeReason: reversePurposeSeed.freeOfChargeReason,
      riskAnalysisForm: {
        ...mockRiskAnalysis.riskAnalysisForm,
        riskAnalysisId: mockRiskAnalysis.id,
      },
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toEqual(true);

    vi.useRealTimers();
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the creation of the purpose is reversed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

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

    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: getMockDocument(),
    };

    const mockRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
      riskAnalysis: [mockRiskAnalysis],
      descriptors: [mockDescriptor],
      mode: eserviceMode.receive,
    };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegatorId: producer.id,
      delegateId: producerDelegate.id,
      state: delegationState.active,
    });

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

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockEService.id,
      delegatorId: consumer.id,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      state: agreementState.active,
    };

    const reversePurposeSeed: purposeApi.EServicePurposeSeed = {
      eServiceId: mockEService.id,
      consumerId: mockAgreement.consumerId,
      riskAnalysisId: mockRiskAnalysis.id,
      title: "test purpose title",
      description: "test purpose description",
      isFreeOfCharge: true,
      freeOfChargeReason: "test",
      dailyCalls: 1,
    };

    await addOneEService(mockEService);
    await addOneDelegation(consumerDelegation);
    await addOneDelegation(producerDelegation);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneTenant(consumerDelegate);
    await addOneTenant(producerDelegate);
    await addOneAgreement(mockAgreement);

    const { purpose, isRiskAnalysisValid } =
      await purposeService.createReversePurpose(reversePurposeSeed, {
        authData: getRandomAuthData(consumerDelegate.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      });

    const writtenEvent = await readLastPurposeEvent(purpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "0",
      type: "PurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = {
      versions: [
        {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          createdAt: new Date(),
          state: purposeVersionState.draft,
          dailyCalls: reversePurposeSeed.dailyCalls,
        },
      ],
      id: purpose.id,
      createdAt: new Date(),
      eserviceId: unsafeBrandId(reversePurposeSeed.eServiceId),
      consumerId: unsafeBrandId(reversePurposeSeed.consumerId),
      delegationId: consumerDelegation.id,
      title: reversePurposeSeed.title,
      description: reversePurposeSeed.description,
      isFreeOfCharge: reversePurposeSeed.isFreeOfCharge,
      freeOfChargeReason: reversePurposeSeed.freeOfChargeReason,
      riskAnalysisForm: {
        ...mockRiskAnalysis.riskAnalysisForm,
        riskAnalysisId: mockRiskAnalysis.id,
      },
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toEqual(true);

    vi.useRealTimers();
  });
  it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
    const consumer = { ...getMockTenant(), kind: tenantKind.PA };
    const producer: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: getMockDocument(),
    };

    const mockRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
      riskAnalysis: [mockRiskAnalysis],
      descriptors: [mockDescriptor],
      mode: eserviceMode.receive,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      state: agreementState.active,
    };

    const reversePurposeSeed: purposeApi.EServicePurposeSeed = {
      eServiceId: mockEService.id,
      consumerId: consumer.id,
      riskAnalysisId: mockRiskAnalysis.id,
      title: "test purpose title",
      description: "test purpose description",
      isFreeOfCharge: true,
      freeOfChargeReason: "test",
      dailyCalls: 1,
    };

    await addOneEService(mockEService);
    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneAgreement(mockAgreement);

    expect(
      purposeService.createReversePurpose(reversePurposeSeed, {
        authData: getRandomAuthData(producer.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(organizationIsNotTheConsumer(producer.id));
  });
  it("should throw eserviceModeNotAllowed if the eservice is in deliver mode", async () => {
    const consumer = getMockTenant();
    const producer: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: getMockDocument(),
    };

    const mockRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
      riskAnalysis: [mockRiskAnalysis],
      descriptors: [mockDescriptor],
      mode: eserviceMode.deliver,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      state: agreementState.active,
    };

    const reversePurposeSeed: purposeApi.EServicePurposeSeed = {
      eServiceId: mockEService.id,
      consumerId: consumer.id,
      riskAnalysisId: mockRiskAnalysis.id,
      title: "test purpose title",
      description: "test purpose description",
      isFreeOfCharge: true,
      freeOfChargeReason: "test",
      dailyCalls: 1,
    };

    await addOneEService(mockEService);
    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneAgreement(mockAgreement);

    expect(
      purposeService.createReversePurpose(reversePurposeSeed, {
        authData: getRandomAuthData(consumer.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(
      eServiceModeNotAllowed(mockEService.id, eserviceMode.receive)
    );
  });
  it("should throw riskAnalysisNotFound if the selected riskAnalysis doesn't exist in that eservice", async () => {
    const consumer = getMockTenant();
    const producer: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: getMockDocument(),
    };

    const randomRiskAnalysisId: RiskAnalysisId = generateId();
    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
      riskAnalysis: [],
      descriptors: [mockDescriptor],
      mode: eserviceMode.receive,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      state: agreementState.active,
    };

    const reversePurposeSeed: purposeApi.EServicePurposeSeed = {
      eServiceId: mockEService.id,
      consumerId: consumer.id,
      riskAnalysisId: randomRiskAnalysisId,
      title: "test purpose title",
      description: "test purpose description",
      isFreeOfCharge: true,
      freeOfChargeReason: "test",
      dailyCalls: 1,
    };

    await addOneEService(mockEService);
    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneAgreement(mockAgreement);

    expect(
      purposeService.createReversePurpose(reversePurposeSeed, {
        authData: getRandomAuthData(consumer.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(
      eserviceRiskAnalysisNotFound(mockEService.id, randomRiskAnalysisId)
    );
  });
  it("should throw missingFreeOfChargeReason if freeOfChargeReason has been omitted", async () => {
    const consumer = getMockTenant();
    const producer: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: getMockDocument(),
    };

    const mockRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
      riskAnalysis: [mockRiskAnalysis],
      descriptors: [mockDescriptor],
      mode: eserviceMode.receive,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      state: agreementState.active,
    };

    const reversePurposeSeed: purposeApi.EServicePurposeSeed = {
      eServiceId: mockEService.id,
      consumerId: consumer.id,
      riskAnalysisId: mockRiskAnalysis.id,
      title: "test purpose title",
      description: "test purpose description",
      isFreeOfCharge: true,
      freeOfChargeReason: "",
      dailyCalls: 1,
    };

    await addOneEService(mockEService);
    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneAgreement(mockAgreement);

    expect(
      purposeService.createReversePurpose(reversePurposeSeed, {
        authData: getRandomAuthData(consumer.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(missingFreeOfChargeReason());
  });
  it("should throw tenantKindNotFound if the tenant kind doesn't exist", async () => {
    const consumer = getMockTenant();
    const producer: Tenant = { ...getMockTenant(), kind: undefined };

    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: getMockDocument(),
    };

    const mockRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
      riskAnalysis: [mockRiskAnalysis],
      descriptors: [mockDescriptor],
      mode: eserviceMode.receive,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      state: agreementState.active,
    };

    const reversePurposeSeed: purposeApi.EServicePurposeSeed = {
      eServiceId: mockEService.id,
      consumerId: consumer.id,
      riskAnalysisId: mockRiskAnalysis.id,
      title: "test purpose title",
      description: "test purpose description",
      isFreeOfCharge: true,
      freeOfChargeReason: "test",
      dailyCalls: 1,
    };

    await addOneEService(mockEService);
    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneAgreement(mockAgreement);

    expect(
      purposeService.createReversePurpose(reversePurposeSeed, {
        authData: getRandomAuthData(consumer.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(tenantKindNotFound(producer.id));
  });
  it("should throw agreementNotFound if the requester doesn't have an agreement for the selected eservice", async () => {
    const consumer = getMockTenant();
    const producer: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: getMockDocument(),
    };

    const mockRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
      riskAnalysis: [mockRiskAnalysis],
      descriptors: [mockDescriptor],
      mode: eserviceMode.receive,
    };

    const reversePurposeSeed: purposeApi.EServicePurposeSeed = {
      eServiceId: mockEService.id,
      consumerId: consumer.id,
      riskAnalysisId: mockRiskAnalysis.id,
      title: "test purpose title",
      description: "test purpose description",
      isFreeOfCharge: true,
      freeOfChargeReason: "test",
      dailyCalls: 1,
    };

    await addOneEService(mockEService);
    await addOneTenant(producer);
    await addOneTenant(consumer);

    expect(
      purposeService.createReversePurpose(reversePurposeSeed, {
        authData: getRandomAuthData(consumer.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(agreementNotFound(mockEService.id, consumer.id));
  });
  it("should throw duplicatedPurposeTitle if a purpose with the same name already exists", async () => {
    const consumer = getMockTenant();
    const producer: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: getMockDocument(),
    };

    const mockRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
      riskAnalysis: [mockRiskAnalysis],
      descriptors: [mockDescriptor],
      mode: eserviceMode.receive,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      state: agreementState.active,
    };

    const purposeTitle = "test purpose title";
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      title: purposeTitle,
      eserviceId: mockEService.id,
      consumerId: consumer.id,
    };

    const reversePurposeSeed: purposeApi.EServicePurposeSeed = {
      eServiceId: mockEService.id,
      consumerId: consumer.id,
      riskAnalysisId: mockRiskAnalysis.id,
      title: purposeTitle,
      description: "test purpose description",
      isFreeOfCharge: true,
      freeOfChargeReason: "test",
      dailyCalls: 1,
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneAgreement(mockAgreement);

    expect(
      purposeService.createReversePurpose(reversePurposeSeed, {
        authData: getRandomAuthData(consumer.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(duplicatedPurposeTitle(purposeTitle));
  });
  it("should throw riskAnalysisValidationFailed if the risk analysis is not valid", async () => {
    const consumer = getMockTenant();
    const producer: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: getMockDocument(),
    };

    const validRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);

    const mockRiskAnalysis: RiskAnalysis = {
      ...validRiskAnalysis,
      riskAnalysisForm: {
        ...validRiskAnalysis.riskAnalysisForm,
        version: "7",
      },
    };
    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
      riskAnalysis: [mockRiskAnalysis],
      descriptors: [mockDescriptor],
      mode: eserviceMode.receive,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      state: agreementState.active,
    };

    const reversePurposeSeed: purposeApi.EServicePurposeSeed = {
      eServiceId: mockEService.id,
      consumerId: consumer.id,
      riskAnalysisId: mockRiskAnalysis.id,
      title: "test purpose title",
      description: "test purpose description",
      isFreeOfCharge: true,
      freeOfChargeReason: "test",
      dailyCalls: 1,
    };

    await addOneEService(mockEService);
    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneAgreement(mockAgreement);

    expect(
      purposeService.createReversePurpose(reversePurposeSeed, {
        authData: getRandomAuthData(consumer.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([
        unexpectedRulesVersionError(mockRiskAnalysis.riskAnalysisForm.version),
      ])
    );
  });
});
