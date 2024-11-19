/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { AuthData, genericLogger } from "pagopa-interop-commons";
import {
  getMockAuthData,
  getMockTenant,
  readEventByStreamIdAndVersion,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  generateId,
  tenantKind,
  protobufDecoder,
  Tenant,
  toTenantV2,
  Attribute,
  unsafeBrandId,
  toReadModelAttribute,
  TenantCertifiedAttributeAssignedV2,
  tenantAttributeType,
} from "pagopa-interop-models";
import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantNotFoundByExternalId,
} from "../src/model/domain/errors.js";
import { toApiTenant } from "../src/model/domain/apiConverter.js";
import {
  addOneTenant,
  tenantService,
  readLastTenantEvent,
  attributes,
  postgresDB,
} from "./utils.js";
import { mockInternalTenantRouterRequest } from "./supertestSetup.js";

describe("internalUpsertTenant", async () => {
  const tenantSeed: tenantApi.InternalTenantSeed = {
    externalId: {
      origin: "IPA",
      value: "123456",
    },
    name: "A tenant",
    certifiedAttributes: [{ origin: "ORIGIN", code: "CODE" }],
  };

  const attribute1: Attribute = {
    name: "an Attribute",
    id: generateId(),
    kind: "Certified",
    description: "",
    origin: "ORIGIN",
    code: "CODE",
    creationTime: new Date(),
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });
  it("Should add the certified attribute if the Tenant doesn't have it", async () => {
    const mockTenant: Tenant = {
      ...getMockTenant(),
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      kind: tenantKind.PA,
    };

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: mockTenant.id,
      userRoles: ["internal"],
    };

    await writeInReadmodel(toReadModelAttribute(attribute1), attributes);
    await addOneTenant(mockTenant);

    const returnedTenant = await mockInternalTenantRouterRequest.post({
      path: "/internal/tenants",
      body: { ...tenantSeed },
      authData,
    });

    const writtenEvent = await readEventByStreamIdAndVersion(
      mockTenant.id,
      1,
      "tenant",
      postgresDB
    );
    if (!writtenEvent) {
      fail("Update failed: tenant not found in event-store");
    }
    expect(writtenEvent).toMatchObject({
      stream_id: mockTenant.id,
      version: "1",
      type: "TenantCertifiedAttributeAssigned",
    });
    const writtenPayload: TenantCertifiedAttributeAssignedV2 | undefined =
      protobufDecoder(TenantCertifiedAttributeAssignedV2).parse(
        writtenEvent?.data
      );

    const expectedTenant: Tenant = {
      ...mockTenant,
      kind: tenantKind.PA,
      updatedAt: new Date(),
      attributes: [
        {
          assignmentTimestamp: new Date(),
          id: attribute1.id,
          type: tenantAttributeType.CERTIFIED,
          revocationTimestamp: undefined,
        },
      ],
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
    expect(returnedTenant).toEqual(toApiTenant(expectedTenant));
  });

  it("Should re-assign the attributes if they were revoked", async () => {
    const mockTenant: Tenant = {
      ...getMockTenant(),
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      kind: tenantKind.PA,
    };

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: mockTenant.id,
      userRoles: ["internal"],
    };
    const tenantSeed2: tenantApi.InternalTenantSeed = {
      ...tenantSeed,
      certifiedAttributes: [
        ...tenantSeed.certifiedAttributes,
        { origin: "ORIGIN 2", code: "CODE 2" },
      ],
    };

    const attribute2: Attribute = {
      name: "an Attribute 2",
      id: generateId(),
      kind: "Certified",
      description: "",
      origin: "ORIGIN 2",
      code: "CODE 2",
      creationTime: new Date(),
    };

    await writeInReadmodel(toReadModelAttribute(attribute1), attributes);
    await writeInReadmodel(toReadModelAttribute(attribute2), attributes);

    const tenant: Tenant = {
      ...mockTenant,
      attributes: [
        {
          type: tenantAttributeType.CERTIFIED,
          id: attribute1.id,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
        {
          type: tenantAttributeType.CERTIFIED,
          id: attribute2.id,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
    };

    await addOneTenant(tenant);

    const returnedTenant = await mockInternalTenantRouterRequest.post({
      path: "/internal/tenants",
      body: { ...tenantSeed2 },
      authData,
    });

    const writtenEvent = await readLastTenantEvent(mockTenant.id);
    if (!writtenEvent) {
      fail("Update failed: tenant not found in event-store");
    }
    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "2",
      type: "TenantCertifiedAttributeAssigned",
    });
    const writtenPayload: TenantCertifiedAttributeAssignedV2 | undefined =
      protobufDecoder(TenantCertifiedAttributeAssignedV2).parse(
        writtenEvent?.data
      );

    const expectedTenant: Tenant = {
      ...mockTenant,
      kind: tenantKind.PA,
      updatedAt: new Date(),
      attributes: [
        {
          assignmentTimestamp: new Date(),
          id: attribute1.id,
          type: tenantAttributeType.CERTIFIED,
          revocationTimestamp: undefined,
        },
        {
          assignmentTimestamp: new Date(),
          id: attribute2.id,
          type: tenantAttributeType.CERTIFIED,
          revocationTimestamp: undefined,
        },
      ],
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
    expect(returnedTenant).toEqual(toApiTenant(expectedTenant));
  });
  it("Should throw certifiedAttributeAlreadyAssigned if the attribute was already assigned", async () => {
    const tenantAlreadyAssigned: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          id: attribute1.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: undefined,
        },
      ],
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      kind: tenantKind.PA,
    };

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: tenantAlreadyAssigned.id,
      userRoles: ["internal"],
    };

    await writeInReadmodel(toReadModelAttribute(attribute1), attributes);
    await addOneTenant(tenantAlreadyAssigned);
    expect(
      tenantService.internalUpsertTenant(tenantSeed, {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      certifiedAttributeAlreadyAssigned(
        unsafeBrandId(attribute1.id),
        unsafeBrandId(tenantAlreadyAssigned.id)
      )
    );
  });
  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    const mockTenant: Tenant = {
      ...getMockTenant(),
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      kind: tenantKind.PA,
    };

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: mockTenant.id,
      userRoles: ["internal"],
    };
    await writeInReadmodel(toReadModelAttribute(attribute1), attributes);
    expect(
      tenantService.internalUpsertTenant(tenantSeed, {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      tenantNotFoundByExternalId(
        mockTenant.externalId.origin,
        mockTenant.externalId.value
      )
    );
  });
  it("Should throw attributeNotFound error if the attribute doesn't exist", async () => {
    const mockTenant: Tenant = {
      ...getMockTenant(),
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      kind: tenantKind.PA,
    };

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: mockTenant.id,
      userRoles: ["internal"],
    };
    await addOneTenant(mockTenant);

    expect(
      tenantService.internalUpsertTenant(tenantSeed, {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      attributeNotFound(
        `${tenantSeed.certifiedAttributes[0].origin}/${tenantSeed.certifiedAttributes[0].code}`
      )
    );
  });
});
