/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  TenantDelegatedConsumerFeatureRemovedV2,
  TenantId,
  operationForbidden,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/dist/eventStoreTestUtils.js";
import { getMockAuthData, getMockTenant } from "pagopa-interop-commons-test";
import {
  tenantDoesNotHaveFeature,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import { addOneTenant, postgresDB, tenantService } from "./utils.js";

describe("removeTenantDelegatedConsumerFeature", async () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  config.delegationsAllowedOrigins = ["IPA", "TEST"];
  it.each(config.delegationsAllowedOrigins)(
    "Should correctly remove the feature (origin: %s)",
    async (origin) => {
      const mockTenant: Tenant = {
        ...getMockTenant(),
        externalId: {
          value: generateId(),
          origin,
        },
        features: [
          {
            type: "DelegatedConsumer",
            availabilityTimestamp: new Date(),
          },
        ],
      };
      await addOneTenant(mockTenant);
      await tenantService.removeTenantDelegatedConsumerFeature({
        organizationId: mockTenant.id,
        correlationId: generateId(),
        authData: getMockAuthData(mockTenant.id),
        logger: genericLogger,
      });
      const writtenEvent = await readLastEventByStreamId(
        mockTenant.id,
        "tenant",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: mockTenant.id,
        version: "1",
        type: "TenantDelegatedConsumerFeatureRemoved",
        event_version: 2,
      });

      const writtenPayload:
        | TenantDelegatedConsumerFeatureRemovedV2
        | undefined = protobufDecoder(
        TenantDelegatedConsumerFeatureRemovedV2
      ).parse(writtenEvent.data);

      const updatedTenant: Tenant = {
        ...mockTenant,
        features: [],
        updatedAt: new Date(),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    }
  );
  it("Should throw tenantNotFound if the requester tenant doesn't exist", async () => {
    const organizationId = generateId<TenantId>();
    expect(
      tenantService.removeTenantDelegatedConsumerFeature({
        organizationId,
        correlationId: generateId(),
        authData: getMockAuthData(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(organizationId));
  });
  it("Should throw tenantDoesNotHaveFeature if the requester tenant doesn't have the delegated consumer feature", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      features: [],
    };

    await addOneTenant(tenant);

    expect(
      tenantService.removeTenantDelegatedConsumerFeature({
        organizationId: tenant.id,
        correlationId: generateId(),
        authData: getMockAuthData(tenant.id),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      tenantDoesNotHaveFeature(tenant.id, "DelegatedConsumer")
    );
  });
  it("Should throw operationForbidden if the requester tenant has externalId origin not compliant", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedConsumer",
          availabilityTimestamp: new Date(),
        },
      ],
    };
    await addOneTenant(tenant);

    expect(
      tenantService.removeTenantDelegatedConsumerFeature({
        organizationId: tenant.id,
        correlationId: generateId(),
        authData: {
          ...getMockAuthData(tenant.id),
          externalId: { origin: "UNKNOWN", value: "test" },
        },
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationForbidden);
  });
});
