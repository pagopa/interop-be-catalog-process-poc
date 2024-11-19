/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  Attribute,
  MaintenanceTenantPromotedToCertifierV2,
  Tenant,
  generateId,
  protobufDecoder,
  toReadModelAttribute,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import { AuthData, genericLogger, userRoles } from "pagopa-interop-commons";
import {
  getMockAttribute,
  getMockAuthData,
  getMockTenant,
  readLastEventByStreamId,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  tenantNotFound,
  tenantIsAlreadyACertifier,
  certifierWithExistingAttributes,
} from "../src/model/domain/errors.js";
import { toApiTenant } from "../src/model/domain/apiConverter.js";
import {
  addOneTenant,
  attributes,
  postgresDB,
  tenantService,
} from "./utils.js";
import { mockTenantRouterRequest } from "./supertestSetup.js";

describe("addCertifierId", async () => {
  const certifierId = generateId();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the addition of the certifierId to the tenant", async () => {
    const mockTenant = getMockTenant();
    await addOneTenant(mockTenant);

    const authData: AuthData = {
      ...getMockAuthData(mockTenant.id),
      userRoles: [userRoles.MAINTENANCE_ROLE],
    };

    const returnedTenant = await mockTenantRouterRequest.post({
      path: "/maintenance/tenants/:tenantId/certifier",
      body: { certifierId },
      pathParams: { tenantId: mockTenant.id },
      authData,
    });

    const writtenEvent = await readLastEventByStreamId(
      mockTenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockTenant.id,
      version: "1",
      type: "MaintenanceTenantPromotedToCertifier",
      event_version: 2,
    });

    const writtenPayload: MaintenanceTenantPromotedToCertifierV2 | undefined =
      protobufDecoder(MaintenanceTenantPromotedToCertifierV2).parse(
        writtenEvent.data
      );

    const expectedTenant: Tenant = {
      ...mockTenant,
      features: [
        {
          type: "PersistentCertifier",
          certifierId,
        },
      ],
      updatedAt: new Date(),
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
    expect(returnedTenant).toEqual(toApiTenant(expectedTenant));
  });
  it("Should throw tenantNotFound when tenant doesn't exist", async () => {
    const mockTenant = getMockTenant();

    expect(
      tenantService.addCertifierId(
        {
          tenantId: mockTenant.id,
          certifierId,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(mockTenant.id));
  });

  it("Should throw tenantIsAlreadyACertifier if the organization is already a certifier with the same certifierId", async () => {
    const certifierTenant: Tenant = {
      ...getMockTenant(),
      features: [
        {
          type: "PersistentCertifier",
          certifierId,
        },
      ],
    };

    await addOneTenant(certifierTenant);
    expect(
      tenantService.addCertifierId(
        {
          tenantId: certifierTenant.id,
          certifierId,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      tenantIsAlreadyACertifier(certifierTenant.id, certifierId)
    );
  });

  it("Should throw certifierWithExistingAttributes if the organization has already created attributes", async () => {
    const previousCertifierId = generateId();

    const attribute: Attribute = {
      ...getMockAttribute(),
      origin: previousCertifierId,
    };

    const certifierTenant: Tenant = {
      ...getMockTenant(),
      features: [
        {
          type: "PersistentCertifier",
          certifierId: previousCertifierId,
        },
      ],
    };

    await addOneTenant(certifierTenant);
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    expect(
      tenantService.addCertifierId(
        {
          tenantId: certifierTenant.id,
          certifierId,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      certifierWithExistingAttributes(certifierTenant.id, previousCertifierId)
    );
  });
});
