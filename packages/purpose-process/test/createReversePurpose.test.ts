/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it, vi } from "vitest";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockAuthData,
  getMockDescriptor,
  getMockDocument,
  getMockPurpose,
  getMockTenant,
  getMockValidRiskAnalysis,
  writeInReadmodel,
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
  tenantKind,
  toReadModelAgreement,
  toReadModelEService,
  toReadModelPurpose,
  unsafeBrandId,
  toReadModelTenant,
  fromPurposeV2,
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
import { purposeToApiPurpose } from "../src/model/domain/apiConverter.js";
import {
  agreements,
  eservices,
  getMockEService,
  purposeService,
  purposes,
  readLastPurposeEvent,
  tenants,
} from "./utils.js";
import { mockPurposeRouterRequest } from "./supertestSetup.js";

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

    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(producer), tenants);
    await writeInReadmodel(toReadModelTenant(consumer), tenants);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    const purpose = await mockPurposeRouterRequest.post({
      path: "/reverse/purposes",
      body: { ...reversePurposeSeed },
      authData: getMockAuthData(consumer.id),
    });

    const writtenEvent = await readLastPurposeEvent(unsafeBrandId(purpose.id));

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

    // const expectedPurpose: Purpose = {
    //   versions: [
    //     {
    //       // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    //       id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
    //       createdAt: new Date(),
    //       state: purposeVersionState.draft,
    //       dailyCalls: reversePurposeSeed.dailyCalls,
    //     },
    //   ],
    //   id: purpose.id,
    //   createdAt: new Date(),
    //   eserviceId: unsafeBrandId(reversePurposeSeed.eServiceId),
    //   consumerId: unsafeBrandId(reversePurposeSeed.consumerId),
    //   title: reversePurposeSeed.title,
    //   description: reversePurposeSeed.description,
    //   isFreeOfCharge: reversePurposeSeed.isFreeOfCharge,
    //   freeOfChargeReason: reversePurposeSeed.freeOfChargeReason,
    //   riskAnalysisForm: {
    //     ...mockRiskAnalysis.riskAnalysisForm,
    //     riskAnalysisId: mockRiskAnalysis.id,
    //   },
    // };

    const expectedPurpose: purposeApi.Purpose = {
      title: reversePurposeSeed.title,
      id: unsafeBrandId(purpose.id),
      createdAt: new Date().toISOString(),
      eserviceId: unsafeBrandId(reversePurposeSeed.eServiceId),
      consumerId: unsafeBrandId(reversePurposeSeed.consumerId),
      description: reversePurposeSeed.description,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeApi.PurposeVersionState.Values.DRAFT,
          dailyCalls: reversePurposeSeed.dailyCalls,
          createdAt: new Date().toISOString(),
        },
      ],
      isFreeOfCharge: reversePurposeSeed.isFreeOfCharge,
      freeOfChargeReason: reversePurposeSeed.freeOfChargeReason,
      riskAnalysisForm: {
        ...purpose.riskAnalysisForm!,
        riskAnalysisId: mockRiskAnalysis.id,
      },
      isRiskAnalysisValid: true,
    };

    expect(purpose).toEqual(expectedPurpose);
    expect(
      purposeToApiPurpose(fromPurposeV2(writtenPayload.purpose!), true)
    ).toEqual(purpose);
    expect(purpose.isRiskAnalysisValid).toBe(true);

    vi.useRealTimers();
  });
  it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
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

    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(producer), tenants);
    await writeInReadmodel(toReadModelTenant(consumer), tenants);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      purposeService.createReversePurpose(
        producer.id,
        reversePurposeSeed,
        generateId(),
        genericLogger
      )
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

    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(producer), tenants);
    await writeInReadmodel(toReadModelTenant(consumer), tenants);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      purposeService.createReversePurpose(
        consumer.id,
        reversePurposeSeed,
        generateId(),
        genericLogger
      )
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

    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(producer), tenants);
    await writeInReadmodel(toReadModelTenant(consumer), tenants);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      purposeService.createReversePurpose(
        consumer.id,
        reversePurposeSeed,
        generateId(),
        genericLogger
      )
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

    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(producer), tenants);
    await writeInReadmodel(toReadModelTenant(consumer), tenants);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      purposeService.createReversePurpose(
        consumer.id,
        reversePurposeSeed,
        generateId(),
        genericLogger
      )
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

    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(producer), tenants);
    await writeInReadmodel(toReadModelTenant(consumer), tenants);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      purposeService.createReversePurpose(
        consumer.id,
        reversePurposeSeed,
        generateId(),
        genericLogger
      )
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

    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(producer), tenants);
    await writeInReadmodel(toReadModelTenant(consumer), tenants);

    expect(
      purposeService.createReversePurpose(
        consumer.id,
        reversePurposeSeed,
        generateId(),
        genericLogger
      )
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

    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(producer), tenants);
    await writeInReadmodel(toReadModelTenant(consumer), tenants);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      purposeService.createReversePurpose(
        consumer.id,
        reversePurposeSeed,
        generateId(),
        genericLogger
      )
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

    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(producer), tenants);
    await writeInReadmodel(toReadModelTenant(consumer), tenants);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      purposeService.createReversePurpose(
        consumer.id,
        reversePurposeSeed,
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([
        unexpectedRulesVersionError(mockRiskAnalysis.riskAnalysisForm.version),
      ])
    );
  });
});
