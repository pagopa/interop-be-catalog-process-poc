/* eslint-disable functional/no-let */
/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable @typescript-eslint/no-floating-promises */

import {
  getMockPurposeVersion,
  getMockPurpose,
  getMockTenant,
  getMockDescriptorPublished,
  getMockEService,
  getMockAgreement,
  getMockValidRiskAnalysisForm,
  writeInReadmodel,
  readLastEventByStreamId,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test";
import {
  PurposeVersion,
  purposeVersionState,
  Purpose,
  generateId,
  Tenant,
  EService,
  Agreement,
  Descriptor,
  agreementState,
  toReadModelEService,
  TenantKind,
  PurposeActivatedV2,
  toPurposeV2,
  PurposeVersionUnsuspendedByConsumerV2,
  PurposeVersionUnsuspendedByProducerV2,
  PurposeVersionOverQuotaUnsuspendedV2,
  PurposeWaitingForApprovalV2,
  eserviceMode,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  riskAnalysisFormToRiskAnalysisFormToValidate,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  tenantKindNotFound,
  missingRiskAnalysis,
  eserviceNotFound,
  organizationNotAllowed,
  riskAnalysisValidationFailed,
  organizationIsNotTheProducer,
  organizationIsNotTheConsumer,
  tenantNotFound,
  agreementNotFound,
} from "../src/model/domain/errors.js";
import {
  agreements,
  eservices,
  postgresDB,
  purposeService,
  purposes,
  tenants,
} from "./purposeService.integration.test.js";
import { addOnePurpose } from "./utils.js";

export const testActivatePurposeVersion = (): ReturnType<typeof describe> =>
  describe("activatePurposeVersion", () => {
    let mockConsumer: Tenant;
    let mockProducer: Tenant;
    let mockEService: EService;
    let mockAgreement: Agreement;
    let mockPurpose: Purpose;
    let mockPurposeVersion: PurposeVersion;
    let mockEServiceDescriptor: Descriptor;

    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      mockConsumer = {
        ...getMockTenant(),
        kind: "PA",
      };

      mockProducer = {
        ...getMockTenant(),
        kind: "PA",
      };

      mockEServiceDescriptor = {
        ...getMockDescriptorPublished(),
        dailyCallsPerConsumer: 20,
      };

      mockEService = {
        ...getMockEService(),
        producerId: mockProducer.id,
        descriptors: [mockEServiceDescriptor],
      };

      mockAgreement = {
        ...getMockAgreement(),
        eserviceId: mockEService.id,
        consumerId: mockConsumer.id,
        descriptorId: mockEService.descriptors[0].id,
        state: agreementState.active,
      };

      mockPurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.waitingForApproval,
      };

      mockPurpose = {
        ...getMockPurpose(),
        riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
        consumerId: mockAgreement.consumerId,
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("should write on event-store for the activation of a purpose version in the waiting for approval state", async () => {
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      const purposeVersion = await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockProducer.id,
        correlationId: generateId(),
      });

      const writtenEvent = await readLastEventByStreamId(
        mockPurpose.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "1",
        type: "PurposeActivated",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [purposeVersion],
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeActivatedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    });

    it("should write on event-store for the activation of a purpose version in suspended from consumer state", async () => {
      const purposeVersionMock: PurposeVersion = {
        ...mockPurposeVersion,
        state: purposeVersionState.suspended,
        suspendedAt: new Date(),
      };
      const purpose: Purpose = {
        ...mockPurpose,
        suspendedByConsumer: true,
        suspendedByProducer: false,
        versions: [purposeVersionMock],
      };

      await addOnePurpose(purpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      const purposeVersion = await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
      });

      const writtenEvent = await readLastEventByStreamId(
        mockPurpose.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "1",
        type: "PurposeVersionUnsuspendedByConsumer",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [purposeVersion],
        suspendedByConsumer: false,
        suspendedByProducer: false,
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeVersionUnsuspendedByConsumerV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    });

    it("should write on event-store for the activation of a purpose version in suspended from producer state", async () => {
      const purposeVersionMock: PurposeVersion = {
        ...mockPurposeVersion,
        state: purposeVersionState.suspended,
        suspendedAt: new Date(),
      };
      const purpose: Purpose = {
        ...mockPurpose,
        suspendedByConsumer: false,
        suspendedByProducer: true,
        versions: [purposeVersionMock],
      };

      await addOnePurpose(purpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      const purposeVersion = await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockProducer.id,
        correlationId: generateId(),
      });

      const writtenEvent = await readLastEventByStreamId(
        mockPurpose.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "1",
        type: "PurposeVersionUnsuspendedByProducer",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [purposeVersion],
        suspendedByConsumer: false,
        suspendedByProducer: false,
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeVersionUnsuspendedByProducerV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    });

    it("should write on event-store for the activation of a purpose version in suspended from consumer state while the version daily calls are beyond the descriptor limits ", async () => {
      const purposeVersionMock: PurposeVersion = {
        ...mockPurposeVersion,
        state: purposeVersionState.suspended,
        dailyCalls: 9999,
        suspendedAt: new Date(),
      };
      const purpose: Purpose = {
        ...mockPurpose,
        suspendedByConsumer: true,
        suspendedByProducer: false,
        versions: [purposeVersionMock],
      };

      await addOnePurpose(purpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      const purposeVersion = await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
      });

      const writtenEvent = await readLastEventByStreamId(
        mockPurpose.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "1",
        type: "PurposeVersionOverQuotaUnsuspended",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [purposeVersionMock, purposeVersion],
        suspendedByConsumer: true,
        suspendedByProducer: false,
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeVersionOverQuotaUnsuspendedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    });

    it("should write on event-store for the activation of a purpose version in suspended from consumer and producer state while the version daily calls are beyond the descriptor limits ", async () => {
      const purposeVersionMock: PurposeVersion = {
        ...mockPurposeVersion,
        state: purposeVersionState.suspended,
        dailyCalls: 9999,
        suspendedAt: new Date(),
      };
      const purpose: Purpose = {
        ...mockPurpose,
        suspendedByConsumer: true,
        suspendedByProducer: true,
        versions: [purposeVersionMock],
      };

      await addOnePurpose(purpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      const purposeVersion = await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
      });

      const writtenEvent = await readLastEventByStreamId(
        mockPurpose.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "1",
        type: "PurposeVersionUnsuspendedByConsumer",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [purposeVersion],
        suspendedByConsumer: false,
        suspendedByProducer: true,
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeVersionUnsuspendedByConsumerV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    });

    it("should write on event-store for the activation of a purpose version in draft while the version daily calls are beyond the descriptor limits ", async () => {
      const purposeVersionMock: PurposeVersion = {
        ...mockPurposeVersion,
        state: purposeVersionState.draft,
        dailyCalls: 9999,
        suspendedAt: new Date(),
      };
      const purpose: Purpose = {
        ...mockPurpose,
        versions: [purposeVersionMock],
      };

      await addOnePurpose(purpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      const purposeVersion = await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
      });

      const writtenEvent = await readLastEventByStreamId(
        mockPurpose.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "1",
        type: "PurposeWaitingForApproval",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [purposeVersion],
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeWaitingForApprovalV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    });

    it("should write on event-store for the activation of a purpose version in draft", async () => {
      const purposeVersionMock: PurposeVersion = {
        ...mockPurposeVersion,
        state: purposeVersionState.draft,
      };
      const purpose: Purpose = {
        ...mockPurpose,
        versions: [purposeVersionMock],
      };

      await addOnePurpose(purpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      const purposeVersion = await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
      });

      const writtenEvent = await readLastEventByStreamId(
        mockPurpose.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "1",
        type: "PurposeActivated",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [purposeVersion],
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeActivatedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    });

    it("should throw organizationIsNotTheProducer if the caller is the consumer trying to activate a waiting for approval purpose version", async () => {
      const purposeVersion: PurposeVersion = {
        ...mockPurposeVersion,
        state: purposeVersionState.waitingForApproval,
      };
      const purpose: Purpose = { ...mockPurpose, versions: [purposeVersion] };

      await addOnePurpose(purpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: purpose.id,
          versionId: purposeVersion.id,
          organizationId: mockConsumer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(organizationIsNotTheProducer(mockConsumer.id));
    });

    it("should organizationIsNotTheConsumer if the caller is the producer trying to activate a draft purpose version", async () => {
      const purposeVersion: PurposeVersion = {
        ...mockPurposeVersion,
        state: purposeVersionState.draft,
      };
      const purpose: Purpose = { ...mockPurpose, versions: [purposeVersion] };

      await addOnePurpose(purpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: purpose.id,
          versionId: purposeVersion.id,
          organizationId: mockProducer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(organizationIsNotTheConsumer(mockProducer.id));
    });

    it("should throw tenantKindNotFound if the purpose consumer has no kind", async () => {
      const consumer = { ...mockConsumer, kind: undefined };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: consumer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(tenantKindNotFound(consumer.id));
    });

    it("should throw missingRiskAnalysis if the purpose has no risk analysis", async () => {
      const purpose: Purpose = { ...mockPurpose, riskAnalysisForm: undefined };

      await addOnePurpose(purpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockConsumer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(missingRiskAnalysis(mockPurpose.id));
    });

    it("should throw eserviceNotFound if the e-service does not exists in the readmodel", async () => {
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      // await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockConsumer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(eserviceNotFound(mockEService.id));
    });

    it("should throw agreementNotFound if the caller has no agreement associated with the purpose in the read model", async () => {
      const purposeVersion: PurposeVersion = {
        ...mockPurposeVersion,
        state: purposeVersionState.draft,
      };
      const purpose: Purpose = { ...mockPurpose, versions: [purposeVersion] };

      await addOnePurpose(purpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      // await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockConsumer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(
        agreementNotFound(mockEService.id, mockConsumer.id)
      );
    });

    it.each(
      Object.values(agreementState).filter(
        (state) => state !== agreementState.active
      )
    )(
      "should throw agreementNotFound if the caller has the agreement with state %s associated with the purpose",
      async (state) => {
        const agreement: Agreement = { ...mockAgreement, state };

        const purposeVersion: PurposeVersion = {
          ...mockPurposeVersion,
          state: purposeVersionState.draft,
        };
        const purpose: Purpose = { ...mockPurpose, versions: [purposeVersion] };

        await addOnePurpose(purpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);
        await writeInReadmodel(agreement, agreements);
        await writeInReadmodel(mockConsumer, tenants);
        await writeInReadmodel(mockProducer, tenants);

        expect(async () => {
          await purposeService.activatePurposeVersion({
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
            organizationId: mockConsumer.id,
            correlationId: generateId(),
          });
        }).rejects.toThrowError(
          agreementNotFound(mockEService.id, mockConsumer.id)
        );
      }
    );

    it("should throw organizationNotAllowed if the caller is neither the producer or the consumer of the purpose", async () => {
      const anotherTenant: Tenant = { ...getMockTenant(), kind: "PA" };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);
      await writeInReadmodel(anotherTenant, tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: anotherTenant.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(organizationNotAllowed(anotherTenant.id));
    });

    it.only("should throw missingRiskAnalysis if the purpose is in draft and has no risk analysis", async () => {
      const purposeVersion: PurposeVersion = {
        ...mockPurposeVersion,
        state: purposeVersionState.draft,
      };
      const purpose: Purpose = {
        ...mockPurpose,
        versions: [purposeVersion],
        riskAnalysisForm: undefined,
      };

      await addOnePurpose(purpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: purpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockConsumer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(missingRiskAnalysis(purpose.id));
    });

    it("should throw riskAnalysisValidationFailed if the purpose is in draft and has an invalid risk analysis", async () => {
      const riskAnalysisForm = getMockValidRiskAnalysisForm("GSP");

      const purposeVersion: PurposeVersion = {
        ...mockPurposeVersion,
        state: purposeVersionState.draft,
      };
      const purpose: Purpose = {
        ...mockPurpose,
        versions: [purposeVersion],
        riskAnalysisForm,
      };

      await addOnePurpose(purpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      const result = validateRiskAnalysis(
        riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysisForm),
        false,
        mockConsumer.kind as TenantKind
      );

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: purpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockConsumer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(
        riskAnalysisValidationFailed(
          result.type === "invalid" ? result.issues : []
        )
      );
    });

    it("should throw tenantNotFound if the purpose consumer is not found in the readmodel", async () => {
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockConsumer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(tenantNotFound(mockConsumer.id));
    });

    it("should throw tenantNotFound if the purpose producer is not found in the readmodel", async () => {
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockProducer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(tenantNotFound(mockProducer.id));
    });

    it("should throw tenantKindNotFound if e-service mode is DELIVER and the tenant consumer has no kind", async () => {
      const consumer: Tenant = { ...mockConsumer, kind: undefined };
      const eservice: EService = {
        ...mockEService,
        mode: eserviceMode.deliver,
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(eservice), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockProducer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(tenantKindNotFound(consumer.id));
    });

    it("should throw tenantKindNotFound if e-service mode is RECEIVE and the tenant producer has no kind", async () => {
      const producer: Tenant = { ...mockProducer, kind: undefined };
      const eservice: EService = {
        ...mockEService,
        mode: eserviceMode.receive,
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(eservice), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(producer, tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockProducer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(tenantKindNotFound(producer.id));
    });

    it.each([
      purposeVersionState.active,
      purposeVersionState.archived,
      purposeVersionState.rejected,
    ])(
      `should throw organizationNotAllowed if the purpose version is in %s state and the caller is the producer`,
      async (state) => {
        const purposeVersion: PurposeVersion = {
          ...mockPurposeVersion,
          state,
        };
        const purpose: Purpose = { ...mockPurpose, versions: [purposeVersion] };

        await addOnePurpose(purpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);
        await writeInReadmodel(mockAgreement, agreements);
        await writeInReadmodel(mockConsumer, tenants);
        await writeInReadmodel(mockProducer, tenants);

        expect(async () => {
          await purposeService.activatePurposeVersion({
            purposeId: purpose.id,
            versionId: purposeVersion.id,
            organizationId: mockProducer.id,
            correlationId: generateId(),
          });
        }).rejects.toThrowError(organizationNotAllowed(mockProducer.id));
      }
    );

    it.each([
      purposeVersionState.active,
      purposeVersionState.archived,
      purposeVersionState.rejected,
    ])(
      `should throw organizationNotAllowed if the purpose version is in %s state and the caller is the consumer`,
      async (state) => {
        const purposeVersion: PurposeVersion = {
          ...mockPurposeVersion,
          state,
        };
        const purpose: Purpose = { ...mockPurpose, versions: [purposeVersion] };

        await addOnePurpose(purpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);
        await writeInReadmodel(mockAgreement, agreements);
        await writeInReadmodel(mockConsumer, tenants);
        await writeInReadmodel(mockProducer, tenants);

        expect(async () => {
          await purposeService.activatePurposeVersion({
            purposeId: purpose.id,
            versionId: purposeVersion.id,
            organizationId: mockConsumer.id,
            correlationId: generateId(),
          });
        }).rejects.toThrowError(organizationNotAllowed(mockConsumer.id));
      }
    );
  });
