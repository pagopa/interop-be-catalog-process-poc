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
  getMockAuthData,
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
  toReadModelAgreement,
  PurposeVersionActivatedV2,
  toReadModelTenant,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  genericLogger,
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
import { apiPurposeVersionToPurposeVersion } from "../src/model/domain/apiConverter.js";
import {
  agreements,
  eservices,
  postgresDB,
  purposeService,
  tenants,
} from "./utils.js";
import { addOnePurpose } from "./utils.js";
import { mockPurposeRouterRequest } from "./supertestSetup.js";

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
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const purposeVersion = await mockPurposeRouterRequest.post({
      path: "/purposes/:purposeId/versions/:versionId/activate",
      pathParams: {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
      },
      authData: getMockAuthData(mockProducer.id),
    });

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionActivated",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [apiPurposeVersionToPurposeVersion(purposeVersion)],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionActivatedV2,
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

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const purposeVersion = await mockPurposeRouterRequest.post({
      path: "/purposes/:purposeId/versions/:versionId/activate",
      pathParams: {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
      },
      authData: getMockAuthData(mockConsumer.id),
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
      versions: [apiPurposeVersionToPurposeVersion(purposeVersion)],
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

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const purposeVersion = await mockPurposeRouterRequest.post({
      path: "/purposes/:purposeId/versions/:versionId/activate",
      pathParams: {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
      },
      authData: getMockAuthData(mockProducer.id),
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
      versions: [apiPurposeVersionToPurposeVersion(purposeVersion)],
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

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const purposeVersion = await mockPurposeRouterRequest.post({
      path: "/purposes/:purposeId/versions/:versionId/activate",
      pathParams: {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
      },
      authData: getMockAuthData(mockConsumer.id),
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
      versions: [
        purposeVersionMock,
        apiPurposeVersionToPurposeVersion(purposeVersion),
      ],
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

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const purposeVersion = await mockPurposeRouterRequest.post({
      path: "/purposes/:purposeId/versions/:versionId/activate",
      pathParams: {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
      },
      authData: getMockAuthData(mockConsumer.id),
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
      versions: [apiPurposeVersionToPurposeVersion(purposeVersion)],
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

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const purposeVersion = await mockPurposeRouterRequest.post({
      path: "/purposes/:purposeId/versions/:versionId/activate",
      pathParams: {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
      },
      authData: getMockAuthData(mockConsumer.id),
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
      versions: [apiPurposeVersionToPurposeVersion(purposeVersion)],
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

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const purposeVersion = await mockPurposeRouterRequest.post({
      path: "/purposes/:purposeId/versions/:versionId/activate",
      pathParams: {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
      },
      authData: getMockAuthData(mockConsumer.id),
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
      versions: [apiPurposeVersionToPurposeVersion(purposeVersion)],
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

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: purpose.id,
        versionId: purposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(organizationIsNotTheProducer(mockConsumer.id));
  });

  it("should throw organizationIsNotTheConsumer if the caller is the producer trying to activate a draft purpose version", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = { ...mockPurpose, versions: [purposeVersion] };

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: purpose.id,
        versionId: purposeVersion.id,
        organizationId: mockProducer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(organizationIsNotTheConsumer(mockProducer.id));
  });

  it("should throw tenantKindNotFound if the purpose consumer has no kind", async () => {
    const consumer = { ...mockConsumer, kind: undefined };

    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.deliver,
    };

    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
    };

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(eservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(consumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: consumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(tenantKindNotFound(consumer.id));
  });

  it("should throw missingRiskAnalysis if the purpose has no risk analysis", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
      riskAnalysisForm: undefined,
    };

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(missingRiskAnalysis(mockPurpose.id));
  });

  it("should throw eserviceNotFound if the e-service does not exists in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(eserviceNotFound(mockEService.id));
  });

  it("should throw agreementNotFound if the caller has no agreement associated with the purpose in the read model", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = { ...mockPurpose, versions: [purposeVersion] };

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
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

      await addOnePurpose(purpose);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(toReadModelAgreement(agreement), agreements);
      await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
      await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockConsumer.id,
          correlationId: generateId(),
          logger: genericLogger,
        });
      }).rejects.toThrowError(
        agreementNotFound(mockEService.id, mockConsumer.id)
      );
    }
  );

  it("should throw organizationNotAllowed if the caller is neither the producer or the consumer of the purpose", async () => {
    const anotherTenant: Tenant = { ...getMockTenant(), kind: "PA" };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);
    await writeInReadmodel(toReadModelTenant(anotherTenant), tenants);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: anotherTenant.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(organizationNotAllowed(anotherTenant.id));
  });

  it("should throw missingRiskAnalysis if the purpose is in draft and has no risk analysis", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
      riskAnalysisForm: undefined,
    };

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: purpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
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

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

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
        logger: genericLogger,
      });
    }).rejects.toThrowError(
      riskAnalysisValidationFailed(
        result.type === "invalid" ? result.issues : []
      )
    );
  });

  it("should throw tenantNotFound if the purpose consumer is not found in the readmodel", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
    };

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(tenantNotFound(mockConsumer.id));
  });

  it("should throw tenantNotFound if the purpose producer is not found in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockProducer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(tenantNotFound(mockProducer.id));
  });

  it("should throw tenantKindNotFound if e-service mode is DELIVER and the tenant consumer has no kind", async () => {
    const consumer: Tenant = { ...mockConsumer, kind: undefined };
    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.deliver,
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(eservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(consumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockProducer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(tenantKindNotFound(consumer.id));
  });

  it("should throw tenantKindNotFound if e-service mode is RECEIVE and the tenant producer has no kind", async () => {
    const producer: Tenant = { ...mockProducer, kind: undefined };
    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.receive,
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(eservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(producer), tenants);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockProducer.id,
        correlationId: generateId(),
        logger: genericLogger,
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

      await addOnePurpose(purpose);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
      await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
      await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: purpose.id,
          versionId: purposeVersion.id,
          organizationId: mockProducer.id,
          correlationId: generateId(),
          logger: genericLogger,
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

      await addOnePurpose(purpose);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
      await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
      await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: purpose.id,
          versionId: purposeVersion.id,
          organizationId: mockConsumer.id,
          correlationId: generateId(),
          logger: genericLogger,
        });
      }).rejects.toThrowError(organizationNotAllowed(mockConsumer.id));
    }
  );
});
