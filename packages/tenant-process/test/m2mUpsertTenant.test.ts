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
  toReadModelAttribute,
  TenantCertifiedAttributeAssignedV2,
  tenantAttributeType,
} from "pagopa-interop-models";
import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantIsNotACertifier,
  tenantNotFound,
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
import { mockM2MTenantRouterRequest } from "./supertestSetup.js";

describe("m2mUpsertTenant", async () => {
  const certifierId = generateId();
  const tenantSeed: tenantApi.M2MTenantSeed = {
    externalId: {
      origin: "IPA",
      value: "123456",
    },
    name: "A tenant",
    certifiedAttributes: [{ code: "CODE" }],
  };

  const attribute: Attribute = {
    name: "an Attribute",
    id: generateId(),
    kind: "Certified",
    description: "",
    origin: certifierId,
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
    const attribute2: Attribute = {
      name: "an Attribute2",
      id: generateId(),
      kind: "Certified",
      description: "",
      origin: certifierId,
      code: "CODE",
      creationTime: new Date(),
    };
    const mockTenant: Tenant = {
      ...getMockTenant(),
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      kind: tenantKind.PA,
      features: [
        {
          type: "PersistentCertifier",
          certifierId,
        },
      ],
    };

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: mockTenant.id,
      userRoles: ["m2m"],
    };

    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await writeInReadmodel(toReadModelAttribute(attribute2), attributes);

    await addOneTenant(mockTenant);

    const returnedTenant = await mockM2MTenantRouterRequest.post({
      path: "/m2m/tenants",
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
          id: attribute.id,
          type: tenantAttributeType.CERTIFIED,
          revocationTimestamp: undefined,
        },
      ],
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));

    const writtenEvent2 = await readEventByStreamIdAndVersion(
      mockTenant.id,
      2,
      "tenant",
      postgresDB
    );
    if (!writtenEvent2) {
      fail("Update failed: tenant not found in event-store");
    }
    expect(writtenEvent2).toMatchObject({
      stream_id: mockTenant.id,
      version: "2",
      type: "TenantCertifiedAttributeAssigned",
    });

    const writtenPayload2: TenantCertifiedAttributeAssignedV2 | undefined =
      protobufDecoder(TenantCertifiedAttributeAssignedV2).parse(
        writtenEvent2?.data
      );

    const expectedTenant2: Tenant = {
      ...mockTenant,
      kind: tenantKind.PA,
      updatedAt: new Date(),
      attributes: [
        {
          assignmentTimestamp: new Date(),
          id: attribute.id,
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

    expect(writtenPayload2.tenant).toEqual(toTenantV2(expectedTenant2));
    expect(returnedTenant).toEqual(toApiTenant(expectedTenant2));
  });

  it("Should re-assign the attributes if they were revoked", async () => {
    const mockTenant: Tenant = {
      ...getMockTenant(),
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      kind: tenantKind.PA,
      features: [
        {
          type: "PersistentCertifier",
          certifierId,
        },
      ],
    };

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: mockTenant.id,
      userRoles: ["m2m"],
    };

    const tenantSeed2: tenantApi.M2MTenantSeed = {
      ...tenantSeed,
      certifiedAttributes: [
        ...tenantSeed.certifiedAttributes,
        { code: "CODE 2" },
      ],
    };

    const attribute2: Attribute = {
      name: "an Attribute 2",
      id: generateId(),
      kind: "Certified",
      description: "",
      origin: certifierId,
      code: "CODE 2",
      creationTime: new Date(),
    };

    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await writeInReadmodel(toReadModelAttribute(attribute2), attributes);

    const tenant: Tenant = {
      ...mockTenant,
      attributes: [
        {
          type: tenantAttributeType.CERTIFIED,
          id: attribute.id,
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

    const returnedTenant = await mockM2MTenantRouterRequest.post({
      path: "/m2m/tenants",
      body: { ...tenantSeed2 },
      authData,
    });

    const writtenEvent = await readLastTenantEvent(tenant.id);
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
          id: attribute.id,
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
    const mockTenant: Tenant = {
      ...getMockTenant(),
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      kind: tenantKind.PA,
      features: [
        {
          type: "PersistentCertifier",
          certifierId,
        },
      ],
    };

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: mockTenant.id,
      userRoles: ["m2m"],
    };

    const tenantAlreadyAssigned: Tenant = {
      ...mockTenant,
      attributes: [
        {
          id: attribute.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: undefined,
        },
      ],
    };

    await addOneTenant(tenantAlreadyAssigned);
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    expect(
      tenantService.m2mUpsertTenant(tenantSeed, {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      certifiedAttributeAlreadyAssigned(attribute.id, tenantAlreadyAssigned.id)
    );
  });
  it("Should throw tenantNotFound if the requester doesn't exist", async () => {
    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: getMockTenant().id,
      userRoles: ["m2m"],
    };

    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    expect(
      tenantService.m2mUpsertTenant(tenantSeed, {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(authData.organizationId));
  });
  it("Should throw tenantNotFound if the tenant by externalId doesn't exist", async () => {
    const mockTenant: Tenant = {
      ...getMockTenant(),
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      kind: tenantKind.PA,
      features: [
        {
          type: "PersistentCertifier",
          certifierId,
        },
      ],
    };

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: mockTenant.id,
      userRoles: ["m2m"],
    };

    await addOneTenant(mockTenant);
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);

    const tenantSeed: tenantApi.M2MTenantSeed = {
      externalId: {
        origin: "NOT ORIGIN",
        value: "NOT CODE",
      },
      name: "A tenant",
      certifiedAttributes: [{ code: "NOT CODE" }],
    };

    expect(
      tenantService.m2mUpsertTenant(tenantSeed, {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      tenantNotFoundByExternalId(
        tenantSeed.externalId.origin,
        tenantSeed.externalId.value
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
      features: [
        {
          type: "PersistentCertifier",
          certifierId,
        },
      ],
    };

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: mockTenant.id,
      userRoles: ["m2m"],
    };

    await addOneTenant(mockTenant);
    expect(
      tenantService.m2mUpsertTenant(tenantSeed, {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      attributeNotFound(
        `${certifierId}/${tenantSeed.certifiedAttributes[0].code}`
      )
    );
  });
  it("Should throw tenantIsNotACertifier if the requester is not a certifier", async () => {
    const tenant: Tenant = getMockTenant();
    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: tenant.id,
      userRoles: ["m2m"],
    };
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await addOneTenant(tenant);
    expect(
      tenantService.m2mUpsertTenant(tenantSeed, {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantIsNotACertifier(tenant.id));
  });
});
