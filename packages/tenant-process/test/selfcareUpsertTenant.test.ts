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
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { selfcareIdConflict } from "../src/model/domain/errors.js";
import { getTenantKind } from "../src/services/validators.js";
import {
  addOneTenant,
  getMockAuthData,
  getMockTenant,
  readLastTenantEvent,
  tenantService,
} from "./utils.js";

describe("selfcareUpsertTenant", async () => {
  const mockTenant = getMockTenant();
  const correlationId = generateId();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should update the tenant if it exists", async () => {
    await addOneTenant(mockTenant);
    const kind = tenantKind.PA;
    const selfcareId = mockTenant.selfcareId!;
    const tenantSeed: tenantApi.SelfcareTenantSeed = {
      externalId: {
        origin: mockTenant.externalId.origin,
        value: mockTenant.externalId.value,
      },
      name: "A tenant",
      selfcareId,
    };
    await tenantService.selfcareUpsertTenant(tenantSeed, {
      authData: getMockAuthData(mockTenant.id),
      correlationId,
      serviceName: "",
      logger: genericLogger,
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
      kind,
      updatedAt: new Date(),
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });
  it("Should create a tenant if it does not exist", async () => {
    const tenantSeed = {
      externalId: {
        origin: "Nothing",
        value: "0",
      },
      name: "A tenant",
      selfcareId: generateId(),
    };
    const id = await tenantService.selfcareUpsertTenant(tenantSeed, {
      authData: getMockAuthData(),
      correlationId,
      serviceName: "",
      logger: genericLogger,
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
      kind: getTenantKind([], tenantSeed.externalId),
      selfcareId: tenantSeed.selfcareId,
      onboardedAt: new Date(),
      createdAt: new Date(),
      name: tenantSeed.name,
      attributes: [],
      features: [],
      mails: [],
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
  });
  it("should throw operation forbidden if role isn't internal and the requester is another tenant", async () => {
    await addOneTenant(mockTenant);
    const tenantSeed: tenantApi.SelfcareTenantSeed = {
      externalId: {
        origin: "IPA",
        value: mockTenant.externalId.value,
      },
      name: "A tenant",
      selfcareId: mockTenant.selfcareId!,
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
