/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  TenantDelegatedProducerFeatureAddedV2,
  TenantId,
  operationForbidden,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/dist/eventStoreTestUtils.js";
import { getMockAuthData, getMockTenant } from "pagopa-interop-commons-test";
import {
  tenantAlreadyHasFeature,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import { addOneTenant, postgresDB, tenantService } from "./utils.js";

describe("assignTenantDelegatedProducerFeature", async () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  config.delegationsAllowedOrigins = ["IPA", "TEST"];
  it.each(config.delegationsAllowedOrigins)(
    "Should correctly assign the feature (origin: %s)",
    async (origin) => {
      const mockTenant: Tenant = {
        ...getMockTenant(),
        externalId: {
          value: generateId(),
          origin,
        },
      };
      await addOneTenant(mockTenant);
      await tenantService.assignTenantDelegatedProducerFeature({
        organizationId: mockTenant.id,
        correlationId: generateId(),
        authData: getMockAuthData(),
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
        type: "TenantDelegatedProducerFeatureAdded",
        event_version: 2,
      });

      const writtenPayload: TenantDelegatedProducerFeatureAddedV2 | undefined =
        protobufDecoder(TenantDelegatedProducerFeatureAddedV2).parse(
          writtenEvent.data
        );

      const updatedTenant: Tenant = {
        ...mockTenant,
        features: [
          ...mockTenant.features,
          {
            type: "DelegatedProducer",
            availabilityTimestamp: new Date(),
          },
        ],
        updatedAt: new Date(),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    }
  );

  it("Should throw tenantAlreadyHasDelegatedProducerFeature if the requester tenant already has the delegated producer feature", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedProducer",
          availabilityTimestamp: new Date(),
        },
      ],
    };

    await addOneTenant(tenant);

    expect(
      tenantService.assignTenantDelegatedProducerFeature({
        organizationId: tenant.id,
        correlationId: generateId(),
        authData: getMockAuthData(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      tenantAlreadyHasFeature(tenant.id, "DelegatedProducer")
    );
  });
  it("Should throw tenantNotFound if the requester tenant doesn't exist", async () => {
    const organizationId = generateId<TenantId>();
    expect(
      tenantService.assignTenantDelegatedProducerFeature({
        organizationId,
        correlationId: generateId(),
        authData: getMockAuthData(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(organizationId));
  });
  it("Should throw operationForbidden if the requester tenant has externalId origin not compliant", async () => {
    const tenant = getMockTenant();

    await addOneTenant(tenant);

    expect(
      tenantService.assignTenantDelegatedProducerFeature({
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
