/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  readLastEventByStreamId,
  decodeProtobufPayload,
  getMockTenant,
  getMockDescriptorPublished,
  getMockEService,
  getMockAgreement,
  getMockPurposeVersion,
  getMockPurpose,
  getMockValidRiskAnalysisForm,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  purposeVersionState,
  Purpose,
  generateId,
  toPurposeV2,
  PurposeActivatedV2,
  Tenant,
  Descriptor,
  EService,
  Agreement,
  agreementState,
  PurposeVersion,
  toReadModelEService,
  eserviceMode,
} from "pagopa-interop-models";
import {
  agreementNotFound,
  eserviceNotFound,
  missingRiskAnalysis,
  organizationIsNotTheConsumer,
  organizationNotAllowed,
  tenantKindNotFound,
  tenantNotFound,
  unchangedDailyCalls,
} from "../src/model/domain/errors.js";
import { addOnePurpose } from "./utils.js";
import {
  agreements,
  eservices,
  postgresDB,
  purposeService,
  purposes,
  tenants,
} from "./purposeService.integration.test.js";

export const testCreatePurposeVersion = (): ReturnType<typeof describe> =>
  describe("createPurposeVersion", () => {
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

      mockEServiceDescriptor = getMockDescriptorPublished();

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
        state: purposeVersionState.active,
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

    it("should write on event-store for the creation of a new purpose version", async () => {
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      const purposeVersion = await purposeService.createPurposeVersion({
        purposeId: mockPurpose.id,
        seed: {
          dailyCalls: 20,
        },
        organizationId: mockPurpose.consumerId,
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
        versions: [
          {
            ...mockPurposeVersion,
            state: purposeVersionState.archived,
            updatedAt: new Date(),
          },
          purposeVersion,
        ],
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeActivatedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    });

    it("should throw unchangedDailyCalls if the new request daily calls are the same of the previous version", async () => {
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(
        async () =>
          await purposeService.createPurposeVersion({
            purposeId: mockPurpose.id,
            seed: {
              dailyCalls: 10,
            },
            organizationId: mockPurpose.consumerId,
            correlationId: generateId(),
          })
      ).rejects.toThrowError(unchangedDailyCalls(mockPurpose.id));
    });

    it("should throw organizationIsNotTheConsumer if the caller is not the consumer", async () => {
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.createPurposeVersion({
          purposeId: mockPurpose.id,
          seed: {
            dailyCalls: 1000,
          },
          organizationId: mockEService.producerId,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(
        organizationIsNotTheConsumer(mockEService.producerId)
      );
    });

    it("should throw eserviceNotFound if the e-service does not exists in the readmodel", async () => {
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      // await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.createPurposeVersion({
          purposeId: mockPurpose.id,
          seed: {
            dailyCalls: 20,
          },
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(eserviceNotFound(mockEService.id));
    });

    it("should throw organizationNotAllowed if the caller is neither the producer or the consumer of the purpose", async () => {
      const anotherTenant: Tenant = { ...getMockTenant(), kind: "PA" };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);
      await writeInReadmodel(anotherTenant, tenants);

      expect(async () => {
        await purposeService.createPurposeVersion({
          purposeId: mockPurpose.id,
          seed: {
            dailyCalls: 20,
          },
          organizationId: anotherTenant.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(organizationNotAllowed(anotherTenant.id));
    });

    it("should throw agreementNotFound if the caller has no agreement associated with the purpose in the read model", async () => {
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      // await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.createPurposeVersion({
          purposeId: mockPurpose.id,
          seed: {
            dailyCalls: 20,
          },
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(
        agreementNotFound(mockEService.id, mockConsumer.id)
      );
    });

    it.each([
      agreementState.archived,
      agreementState.draft,
      agreementState.missingCertifiedAttributes,
      agreementState.pending,
      agreementState.rejected,
      agreementState.suspended,
    ])(
      "should throw agreementNotFound if the caller has the agreement with state %s associated with the purpose",
      async (state) => {
        const agreement: Agreement = { ...mockAgreement, state };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);
        await writeInReadmodel(agreement, agreements);
        await writeInReadmodel(mockConsumer, tenants);
        await writeInReadmodel(mockProducer, tenants);

        expect(async () => {
          await purposeService.createPurposeVersion({
            purposeId: mockPurpose.id,
            seed: {
              dailyCalls: 20,
            },
            organizationId: mockPurpose.consumerId,
            correlationId: generateId(),
          });
        }).rejects.toThrowError(
          agreementNotFound(mockEService.id, mockConsumer.id)
        );
      }
    );

    it("should throw tenantNotFound if the purpose consumer is not found in the readmodel", async () => {
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      // await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.createPurposeVersion({
          purposeId: mockPurpose.id,
          seed: {
            dailyCalls: 20,
          },
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(tenantNotFound(mockConsumer.id));
    });

    it("should throw tenantNotFound if the purpose producer is not found in the readmodel", async () => {
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      // await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.createPurposeVersion({
          purposeId: mockPurpose.id,
          seed: {
            dailyCalls: 20,
          },
          organizationId: mockPurpose.consumerId,
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
        await purposeService.createPurposeVersion({
          purposeId: mockPurpose.id,
          seed: {
            dailyCalls: 20,
          },
          organizationId: mockPurpose.consumerId,
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
        await purposeService.createPurposeVersion({
          purposeId: mockPurpose.id,
          seed: {
            dailyCalls: 20,
          },
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(tenantKindNotFound(producer.id));
    });

    it("should throw missingRiskAnalysis if there is no risk-analysis version and the passed daily calls does not surpass the descriptor limits", async () => {
      const purpose: Purpose = {
        ...mockPurpose,
        riskAnalysisForm: undefined,
      };

      await addOnePurpose(purpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.createPurposeVersion({
          purposeId: mockPurpose.id,
          seed: {
            dailyCalls: 20,
          },
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(missingRiskAnalysis(purpose.id));
    });

    it("should create a new purpose waiting for approval version if the new version surpasses the e-service daily calls per consumer limit", async () => {
      const descriptor: Descriptor = {
        ...mockEServiceDescriptor,
        dailyCallsPerConsumer: 99,
      };
      const eservice = { ...mockEService, descriptors: [descriptor] };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(eservice), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      const purposeVersion = await purposeService.createPurposeVersion({
        purposeId: mockPurpose.id,
        seed: {
          dailyCalls: 1000,
        },
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
      });

      expect(purposeVersion.state).toEqual(
        purposeVersionState.waitingForApproval
      );
    });
  });
