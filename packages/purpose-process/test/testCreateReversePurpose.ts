/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it, vi } from "vitest";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockDescriptor,
  getMockDocument,
  getMockTenant,
  getMockValidRiskAnalysis,
  readLastEventByStreamId,
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
  purposeVersionState,
  tenantKind,
  toPurposeV2,
  toReadModelEService,
  unsafeBrandId,
} from "pagopa-interop-models";
import { unexpectedRulesVersionError } from "pagopa-interop-commons";
import { ApiReversePurposeSeed } from "../src/model/domain/models.js";
import {
  agreementNotFound,
  eServiceModeNotAllowed,
  eserviceRiskAnalysisNotFound,
  missingFreeOfChargeReason,
  organizationIsNotTheConsumer,
  riskAnalysisValidationFailed,
  tenantKindNotFound,
} from "../src/model/domain/errors.js";
import { getMockEService } from "./utils.js";
import {
  agreements,
  eservices,
  postgresDB,
  purposeService,
  tenants,
} from "./purposeService.integration.test.js";

export const testCreateReversePurpose = (): ReturnType<typeof describe> =>
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

      const reversePurposeSeed: ApiReversePurposeSeed = {
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
      await writeInReadmodel(producer, tenants);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockAgreement, agreements);

      const { purpose } = await purposeService.createReversePurpose(
        consumer.id,
        reversePurposeSeed,
        generateId()
      );

      const writtenEvent = await readLastEventByStreamId(
        purpose.id,
        "purpose",
        postgresDB
      );

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
        riskAnalysisForm: mockRiskAnalysis.riskAnalysisForm,
      };

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

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

      const reversePurposeSeed: ApiReversePurposeSeed = {
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
      await writeInReadmodel(producer, tenants);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockAgreement, agreements);

      expect(
        purposeService.createReversePurpose(
          producer.id,
          reversePurposeSeed,
          generateId()
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

      const reversePurposeSeed: ApiReversePurposeSeed = {
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
      await writeInReadmodel(producer, tenants);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockAgreement, agreements);

      expect(
        purposeService.createReversePurpose(
          consumer.id,
          reversePurposeSeed,
          generateId()
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

      const reversePurposeSeed: ApiReversePurposeSeed = {
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
      await writeInReadmodel(producer, tenants);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockAgreement, agreements);

      expect(
        purposeService.createReversePurpose(
          consumer.id,
          reversePurposeSeed,
          generateId()
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

      const reversePurposeSeed: ApiReversePurposeSeed = {
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
      await writeInReadmodel(producer, tenants);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockAgreement, agreements);

      expect(
        purposeService.createReversePurpose(
          consumer.id,
          reversePurposeSeed,
          generateId()
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

      const reversePurposeSeed: ApiReversePurposeSeed = {
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
      await writeInReadmodel(producer, tenants);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockAgreement, agreements);

      expect(
        purposeService.createReversePurpose(
          consumer.id,
          reversePurposeSeed,
          generateId()
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

      const reversePurposeSeed: ApiReversePurposeSeed = {
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
      await writeInReadmodel(producer, tenants);
      await writeInReadmodel(consumer, tenants);

      expect(
        purposeService.createReversePurpose(
          consumer.id,
          reversePurposeSeed,
          generateId()
        )
      ).rejects.toThrowError(agreementNotFound(mockEService.id, consumer.id));
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

      const reversePurposeSeed: ApiReversePurposeSeed = {
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
      await writeInReadmodel(producer, tenants);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockAgreement, agreements);

      expect(
        purposeService.createReversePurpose(
          consumer.id,
          reversePurposeSeed,
          generateId()
        )
      ).rejects.toThrowError(
        riskAnalysisValidationFailed([
          unexpectedRulesVersionError(
            mockRiskAnalysis.riskAnalysisForm.version
          ),
        ])
      );
    });
  });
