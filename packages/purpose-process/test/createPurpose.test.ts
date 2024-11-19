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
  tenantKind,
  toReadModelEService,
  toReadModelAgreement,
  unsafeBrandId,
  toReadModelTenant,
  TenantId,
  fromPurposeV2,
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
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  genericLogger,
  unexpectedRulesVersionError,
} from "pagopa-interop-commons";
import {
  missingFreeOfChargeReason,
  tenantKindNotFound,
  tenantNotFound,
  organizationIsNotTheConsumer,
  riskAnalysisValidationFailed,
  agreementNotFound,
  duplicatedPurposeTitle,
} from "../src/model/domain/errors.js";
import { purposeToApiPurpose } from "../src/model/domain/apiConverter.js";
import {
  addOnePurpose,
  agreements,
  buildRiskAnalysisFormSeed,
  eservices,
  getMockEService,
  purposeService,
  readLastPurposeEvent,
  tenants,
} from "./utils.js";
import { mockPurposeRouterRequest } from "./supertestSetup.js";

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
    title: "test purposeSeed",
    dailyCalls: 10,
    description: "test description purposeSeed",
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

    const purpose = await mockPurposeRouterRequest.post({
      path: "/purposes",
      body: { ...purposeSeed },
      authData: getMockAuthData(
        unsafeBrandId<TenantId>(purposeSeed.consumerId)
      ),
    });

    const writtenEvent = await readLastPurposeEvent(unsafeBrandId(purpose.id));

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

    const expectedRiskAnalysisForm: purposeApi.RiskAnalysisForm = {
      riskAnalysisId: purpose.riskAnalysisForm?.riskAnalysisId,
      version: purposeSeed.riskAnalysisForm!.version,
      answers: purposeSeed.riskAnalysisForm!.answers,
    };

    const apiExpectedPurpose: purposeApi.Purpose = {
      title: purposeSeed.title,
      id: unsafeBrandId(purpose.id),
      createdAt: new Date().toISOString(),
      eserviceId: unsafeBrandId(purposeSeed.eserviceId),
      consumerId: unsafeBrandId(purposeSeed.consumerId),
      description: purposeSeed.description,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeApi.PurposeVersionState.Values.DRAFT,
          dailyCalls: purposeSeed.dailyCalls,
          createdAt: new Date().toISOString(),
        },
      ],
      isFreeOfCharge: true,
      freeOfChargeReason: purposeSeed.freeOfChargeReason,
      riskAnalysisForm: expectedRiskAnalysisForm,
      isRiskAnalysisValid: true,
    };

    expect(purpose).toEqual(apiExpectedPurpose);
    expect(
      purposeToApiPurpose(fromPurposeV2(writtenPayload.purpose!), true)
    ).toEqual(purpose);
    expect(purpose.isRiskAnalysisValid).toBe(true);

    vi.useRealTimers();
  });
  it("should throw missingFreeOfChargeReason if the freeOfChargeReason is empty", async () => {
    const seed: purposeApi.PurposeSeed = {
      ...purposeSeed,
      freeOfChargeReason: undefined,
    };

    expect(
      purposeService.createPurpose(
        seed,
        unsafeBrandId(purposeSeed.consumerId),
        generateId(),
        genericLogger
      )
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
      purposeService.createPurpose(
        seed,
        unsafeBrandId(purposeSeed.consumerId),
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(tenantKindNotFound(tenantWithoutKind.id));
  });
  it("should throw tenantNotFound if the tenant doesn't exists", async () => {
    expect(
      purposeService.createPurpose(
        purposeSeed,
        unsafeBrandId(purposeSeed.consumerId),
        generateId(),
        genericLogger
      )
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
      purposeService.createPurpose(
        seed,
        unsafeBrandId(seed.consumerId),
        generateId(),
        genericLogger
      )
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
      purposeService.createPurpose(
        seed,
        unsafeBrandId(purposeSeed.consumerId),
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      organizationIsNotTheConsumer(unsafeBrandId(purposeSeed.consumerId))
    );
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
      purposeService.createPurpose(
        seed,
        unsafeBrandId(purposeSeed.consumerId),
        generateId(),
        genericLogger
      )
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
      purposeService.createPurpose(
        purposeSeed,
        unsafeBrandId(purposeSeed.consumerId),
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(duplicatedPurposeTitle(purposeSeed.title));
  });
});
