/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  generateId,
  Tenant,
  protobufDecoder,
  operationForbidden,
  tenantKind,
  unsafeBrandId,
  TenantOnboardDetailsUpdatedV2,
  TenantOnboardedV2,
  toTenantV2,
  CorrelationId,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  SCP,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { getMockAuthData, getMockTenant } from "pagopa-interop-commons-test";
import { selfcareIdConflict } from "../src/model/domain/errors.js";
import { addOneTenant, readLastTenantEvent, tenantService } from "./utils.js";
import { mockSelfcareTenantRouterRequest } from "./supertestSetup.js";

describe("selfcareUpsertTenant", async () => {
  const mockTenant = getMockTenant();
  const correlationId: CorrelationId = generateId();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should update the tenant if it exists", async () => {
    await addOneTenant(mockTenant);
    const selfcareId = mockTenant.selfcareId!;
    const tenantSeed: tenantApi.SelfcareTenantSeed = {
      externalId: {
        origin: mockTenant.externalId.origin,
        value: mockTenant.externalId.value,
      },
      name: "A tenant",
      selfcareId,
      onboardedAt: mockTenant.onboardedAt!.toISOString(),
      subUnitType: mockTenant.subUnitType,
    };

    await mockSelfcareTenantRouterRequest.post({
      path: "/selfcare/tenants",
      body: { ...tenantSeed },
      authData: getMockAuthData(mockTenant.id),
    });

    const writtenEvent = await readLastTenantEvent(mockTenant.id);
    if (!writtenEvent) {
      fail("Update failed: tenant not found in event-store");
    }
    expect(writtenEvent).toMatchObject({
      stream_id: mockTenant.id,
      version: "1",
      type: "TenantOnboardDetailsUpdated",
    });
    const writtenPayload: TenantOnboardDetailsUpdatedV2 | undefined =
      protobufDecoder(TenantOnboardDetailsUpdatedV2).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...mockTenant,
      selfcareId,
      kind: tenantKind.PA,
      updatedAt: new Date(),
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });
  it.each([PUBLIC_ADMINISTRATIONS_IDENTIFIER, SCP, "Private"])(
    "Should create a tenant with origin %s if it does not exist",
    async (origin) => {
      const tenantSeed = {
        externalId: {
          origin,
          value: "0",
        },
        name: "A tenant",
        selfcareId: generateId(),
        onboardedAt: mockTenant.onboardedAt!.toISOString(),
        subUnitType: mockTenant.subUnitType,
      };

      const { id } = await mockSelfcareTenantRouterRequest.post({
        path: "/selfcare/tenants",
        body: { ...tenantSeed },
        authData: getMockAuthData(),
      });

      expect(id).toBeDefined();
      const writtenEvent = await readLastTenantEvent(unsafeBrandId(id));
      if (!writtenEvent) {
        fail("Creation failed: tenant not found in event-store");
      }
      expect(writtenEvent).toMatchObject({
        stream_id: id,
        version: "0",
        type: "TenantOnboarded",
      });
      const writtenPayload: TenantOnboardedV2 | undefined = protobufDecoder(
        TenantOnboardedV2
      ).parse(writtenEvent.data);

      const expectedTenant: Tenant = {
        externalId: tenantSeed.externalId,
        id: unsafeBrandId(id),
        kind: origin === SCP ? tenantKind.SCP : undefined,
        selfcareId: tenantSeed.selfcareId,
        onboardedAt: mockTenant.onboardedAt!,
        createdAt: new Date(),
        name: tenantSeed.name,
        attributes: [],
        features: [],
        mails: [],
      };

      expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
    }
  );
  it("should throw operation forbidden if role isn't internal and the requester is another tenant", async () => {
    await addOneTenant(mockTenant);
    const tenantSeed: tenantApi.SelfcareTenantSeed = {
      externalId: {
        origin: "IPA",
        value: mockTenant.externalId.value,
      },
      name: "A tenant",
      selfcareId: mockTenant.selfcareId!,
      onboardedAt: mockTenant.onboardedAt!.toISOString(),
      subUnitType: mockTenant.subUnitType,
    };
    expect(
      tenantService.selfcareUpsertTenant(tenantSeed, {
        authData: getMockAuthData(),
        correlationId,
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw selfcareIdConflict error if the given and existing selfcareId differ", async () => {
    const mockTenant = getMockTenant();
    await addOneTenant(mockTenant);
    const newTenantSeed = {
      name: mockTenant.name,
      externalId: {
        origin: "IPA",
        value: mockTenant.externalId.value,
      },
      selfcareId: generateId(),
      onboardedAt: mockTenant.onboardedAt!.toISOString(),
      subUnitType: mockTenant.subUnitType,
    };
    expect(
      tenantService.selfcareUpsertTenant(newTenantSeed, {
        authData: getMockAuthData(mockTenant.id),
        correlationId,
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      selfcareIdConflict({
        tenantId: mockTenant.id,
        existingSelfcareId: mockTenant.selfcareId!,
        newSelfcareId: newTenantSeed.selfcareId,
      })
    );
  });
});
