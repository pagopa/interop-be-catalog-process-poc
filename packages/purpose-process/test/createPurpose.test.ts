/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  Agreement,
  Descriptor,
  EService,
  Purpose,
  PurposeAddedV2,
  RiskAnalysisForm,
  Tenant,
  agreementState,
  descriptorState,
  generateId,
  purposeVersionState,
  tenantKind,
  toPurposeV2,
  toReadModelEService,
  toReadModelAgreement,
  unsafeBrandId,
  toReadModelTenant,
  TenantId,
  delegationKind,
  delegationState,
} from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
import { describe, expect, it, vi } from "vitest";
import {
  writeInReadmodel,
  getMockValidRiskAnalysisForm,
  decodeProtobufPayload,
  getMockAgreement,
  getMockTenant,
  getMockPurpose,
  getMockDescriptor,
  getRandomAuthData,
  getMockDelegation,
} from "pagopa-interop-commons-test";
import {
  genericLogger,
  unexpectedRulesVersionError,
} from "pagopa-interop-commons";
import {
  missingFreeOfChargeReason,
  tenantKindNotFound,
  tenantNotFound,
  riskAnalysisValidationFailed,
  agreementNotFound,
  duplicatedPurposeTitle,
  organizationIsNotTheConsumer,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  agreements,
  buildRiskAnalysisFormSeed,
  eservices,
  getMockEService,
  purposeService,
  readLastPurposeEvent,
  tenants,
} from "./utils.js";

describe("createPurpose", () => {
  const tenant: Tenant = {
    ...getMockTenant(),
    kind: tenantKind.PA,
  };

  const descriptor1: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
    version: "",
  };

  const eService1: EService = {
    ...getMockEService(),
    producerId: tenant.id,
    descriptors: [descriptor1],
  };

  const agreementEservice1 = getMockAgreement(
    eService1.id,
    tenant.id,
    agreementState.active
  );

  const mockValidRiskAnalysisForm = getMockValidRiskAnalysisForm(tenantKind.PA);

  const purposeSeed: purposeApi.PurposeSeed = {
    eserviceId: eService1.id,
    consumerId: agreementEservice1.consumerId,
    title: "test",
    dailyCalls: 10,
    description: "test",
    isFreeOfCharge: true,
    freeOfChargeReason: "reason",
    riskAnalysisForm: buildRiskAnalysisFormSeed(mockValidRiskAnalysisForm),
  };
  it("should write on event-store for the creation of a purpose", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    await writeInReadmodel(toReadModelTenant(tenant), tenants);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );
    await writeInReadmodel(toReadModelEService(eService1), eservices);

    const { purpose, isRiskAnalysisValid } = await purposeService.createPurpose(
      purposeSeed,
      {
        authData: getRandomAuthData(
          unsafeBrandId<TenantId>(purposeSeed.consumerId)
        ),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(purpose.id);

    if (!writtenEvent) {
      fail("Update failed: purpose not found in event-store");
    }

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

    const expectedRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      id: unsafeBrandId(purpose.riskAnalysisForm!.id),
      singleAnswers: mockValidRiskAnalysisForm.singleAnswers.map(
        (answer, i) => ({
          ...answer,
          id: purpose.riskAnalysisForm!.singleAnswers[i].id,
        })
      ),
      multiAnswers: mockValidRiskAnalysisForm.multiAnswers.map((answer, i) => ({
        ...answer,
        id: purpose.riskAnalysisForm!.multiAnswers[i].id,
      })),
    };

    const expectedPurpose: Purpose = {
      title: purposeSeed.title,
      id: unsafeBrandId(purpose.id),
      createdAt: new Date(),
      eserviceId: unsafeBrandId(purposeSeed.eserviceId),
      consumerId: unsafeBrandId(purposeSeed.consumerId),
      description: purposeSeed.description,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          dailyCalls: purposeSeed.dailyCalls,
          createdAt: new Date(),
        },
      ],
      isFreeOfCharge: true,
      freeOfChargeReason: purposeSeed.freeOfChargeReason,
      riskAnalysisForm: expectedRiskAnalysisForm,
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(true);

    vi.useRealTimers();
  });
  it("should succeed when requester is Consumer Delegate and the Purpose was created successfully", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const delegateTenant = { ...getMockTenant(), kind: tenantKind.PA };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eService1.id,
      delegatorId: unsafeBrandId<TenantId>(purposeSeed.consumerId),
      delegateId: delegateTenant.id,
      state: delegationState.active,
    });

    await addOneTenant(delegateTenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);
    await addOneDelegation(delegation);

    const { purpose, isRiskAnalysisValid } = await purposeService.createPurpose(
      purposeSeed,
      {
        authData: getRandomAuthData(delegateTenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(purpose.id);

    if (!writtenEvent) {
      fail("Update failed: purpose not found in event-store");
    }

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

    const expectedRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      id: unsafeBrandId(purpose.riskAnalysisForm!.id),
      singleAnswers: mockValidRiskAnalysisForm.singleAnswers.map(
        (answer, i) => ({
          ...answer,
          id: purpose.riskAnalysisForm!.singleAnswers[i].id,
        })
      ),
      multiAnswers: mockValidRiskAnalysisForm.multiAnswers.map((answer, i) => ({
        ...answer,
        id: purpose.riskAnalysisForm!.multiAnswers[i].id,
      })),
    };

    const expectedPurpose: Purpose = {
      title: purposeSeed.title,
      id: unsafeBrandId(purpose.id),
      createdAt: new Date(),
      eserviceId: unsafeBrandId(purposeSeed.eserviceId),
      consumerId: unsafeBrandId(purposeSeed.consumerId),
      delegationId: delegation.id,
      description: purposeSeed.description,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          dailyCalls: purposeSeed.dailyCalls,
          createdAt: new Date(),
        },
      ],
      isFreeOfCharge: true,
      freeOfChargeReason: purposeSeed.freeOfChargeReason,
      riskAnalysisForm: expectedRiskAnalysisForm,
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(purpose).toEqual(expectedPurpose);
    expect(isRiskAnalysisValid).toBe(true);

    vi.useRealTimers();
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the Purpose was created successfully", async () => {
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

    const eservice: EService = {
      ...getMockEService(),
      producerId: producerDelegate.id,
      descriptors: [descriptor1],
    };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
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
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    const agreement: Agreement = {
      ...getMockAgreement(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      state: agreementState.active,
    };

    const delegatePurposeSeed: purposeApi.PurposeSeed = {
      ...purposeSeed,
      eserviceId: eservice.id,
      consumerId: agreement.consumerId,
    };

    await addOneTenant(consumerDelegate);
    await addOneTenant(producerDelegate);
    await addOneAgreement(agreement);
    await addOneEService(eservice);
    await addOneDelegation(consumerDelegation);
    await addOneDelegation(producerDelegation);

    const { purpose, isRiskAnalysisValid } = await purposeService.createPurpose(
      delegatePurposeSeed,
      {
        authData: getRandomAuthData(consumerDelegate.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastPurposeEvent(purpose.id);

    if (!writtenEvent) {
      fail("Update failed: purpose not found in event-store");
    }

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

    const expectedRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      id: unsafeBrandId(purpose.riskAnalysisForm!.id),
      singleAnswers: mockValidRiskAnalysisForm.singleAnswers.map(
        (answer, i) => ({
          ...answer,
          id: purpose.riskAnalysisForm!.singleAnswers[i].id,
        })
      ),
      multiAnswers: mockValidRiskAnalysisForm.multiAnswers.map((answer, i) => ({
        ...answer,
        id: purpose.riskAnalysisForm!.multiAnswers[i].id,
      })),
    };

    const expectedPurpose: Purpose = {
      title: delegatePurposeSeed.title,
      id: unsafeBrandId(purpose.id),
      createdAt: new Date(),
      eserviceId: unsafeBrandId(delegatePurposeSeed.eserviceId),
      consumerId: unsafeBrandId(delegatePurposeSeed.consumerId),
      delegationId: consumerDelegation.id,
      description: delegatePurposeSeed.description,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          dailyCalls: delegatePurposeSeed.dailyCalls,
          createdAt: new Date(),
        },
      ],
      isFreeOfCharge: true,
      freeOfChargeReason: delegatePurposeSeed.freeOfChargeReason,
      riskAnalysisForm: expectedRiskAnalysisForm,
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(purpose).toEqual(expectedPurpose);
    expect(isRiskAnalysisValid).toBe(true);

    vi.useRealTimers();
  });
  it("should throw missingFreeOfChargeReason if the freeOfChargeReason is empty", async () => {
    const seed: purposeApi.PurposeSeed = {
      ...purposeSeed,
      freeOfChargeReason: undefined,
    };

    expect(
      purposeService.createPurpose(seed, {
        authData: getRandomAuthData(
          unsafeBrandId<TenantId>(purposeSeed.consumerId)
        ),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(missingFreeOfChargeReason());
  });
  it("should throw tenantKindNotFound if the kind doesn't exists", async () => {
    const tenantWithoutKind: Tenant = {
      ...tenant,
      kind: undefined,
    };

    const eService: EService = {
      ...eService1,
      producerId: tenantWithoutKind.id,
    };

    const agreementEservice = getMockAgreement(
      eService.id,
      tenantWithoutKind.id
    );

    const seed: purposeApi.PurposeSeed = {
      ...purposeSeed,
      eserviceId: eService.id,
      consumerId: agreementEservice.consumerId,
    };

    await writeInReadmodel(toReadModelTenant(tenantWithoutKind), tenants);
    await writeInReadmodel(toReadModelAgreement(agreementEservice), agreements);
    await writeInReadmodel(toReadModelEService(eService), eservices);

    expect(
      purposeService.createPurpose(seed, {
        authData: getRandomAuthData(
          unsafeBrandId<TenantId>(purposeSeed.consumerId)
        ),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(tenantKindNotFound(tenantWithoutKind.id));
  });
  it("should throw tenantNotFound if the tenant doesn't exists", async () => {
    expect(
      purposeService.createPurpose(purposeSeed, {
        authData: getRandomAuthData(
          unsafeBrandId<TenantId>(purposeSeed.consumerId)
        ),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });
  it("should throw agreementNotFound if the agreement doesn't exists ", async () => {
    const descriptor: Descriptor = {
      ...descriptor1,
      id: generateId(),
    };

    const eService: EService = {
      ...eService1,
      producerId: tenant.id,
      id: generateId(),
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...agreementEservice1,
      id: generateId(),
      eserviceId: eService.id,
      descriptorId: descriptor.id,
      producerId: eService.producerId,
      consumerId: tenant.id,
      state: agreementState.draft,
    };

    const seed: purposeApi.PurposeSeed = {
      ...purposeSeed,
      eserviceId: eService.id,
      consumerId: agreement.consumerId,
    };

    await writeInReadmodel(toReadModelTenant(tenant), tenants);
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);
    await writeInReadmodel(toReadModelEService(eService), eservices);

    expect(
      purposeService.createPurpose(seed, {
        authData: getRandomAuthData(unsafeBrandId<TenantId>(seed.consumerId)),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(agreementNotFound(eService.id, tenant.id));
  });
  it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
    await writeInReadmodel(toReadModelTenant(tenant), tenants);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );
    await writeInReadmodel(toReadModelEService(getMockEService()), eservices);

    const seed: purposeApi.PurposeSeed = {
      ...purposeSeed,
      consumerId: generateId(),
    };

    expect(
      purposeService.createPurpose(seed, {
        authData: getRandomAuthData(
          unsafeBrandId<TenantId>(purposeSeed.consumerId)
        ),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(organizationIsNotTheConsumer(tenant.id));
  });
  it("should throw riskAnalysisValidationFailed if the purpose has a non valid risk analysis ", async () => {
    await writeInReadmodel(toReadModelTenant(tenant), tenants);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );
    await writeInReadmodel(toReadModelEService(eService1), eservices);

    const mockInvalidRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      version: "0",
    };

    const seed: purposeApi.PurposeSeed = {
      ...purposeSeed,
      riskAnalysisForm: buildRiskAnalysisFormSeed(mockInvalidRiskAnalysisForm),
    };

    expect(
      purposeService.createPurpose(seed, {
        authData: getRandomAuthData(unsafeBrandId<TenantId>(seed.consumerId)),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([
        unexpectedRulesVersionError(mockInvalidRiskAnalysisForm.version),
      ])
    );
  });
  it("should throw duplicatedPurposeName if a purpose with same name alreay exists", async () => {
    const existingPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: unsafeBrandId(purposeSeed.eserviceId),
      consumerId: unsafeBrandId(purposeSeed.consumerId),
      title: purposeSeed.title,
    };

    await addOnePurpose(existingPurpose);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );
    await writeInReadmodel(toReadModelEService(eService1), eservices);

    expect(
      purposeService.createPurpose(purposeSeed, {
        authData: getRandomAuthData(
          unsafeBrandId<TenantId>(purposeSeed.consumerId)
        ),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(duplicatedPurposeTitle(purposeSeed.title));
  });
});
