/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { attributeKind, toReadModelAttribute } from "pagopa-interop-models";
import {
  writeInReadmodel,
  getMockAttribute,
  readLastEventByStreamId,
  getMockTenant,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  generateId,
  Tenant,
  unsafeBrandId,
  protobufDecoder,
  fromTenantKindV2,
  toTenantV2,
  TenantDeclaredAttributeAssignedV2,
  Attribute,
  tenantAttributeType,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  tenantNotFound,
  attributeNotFound,
} from "../src/model/domain/errors.js";
import { toApiTenant } from "../src/model/domain/apiConverter.js";
import {
  addOneTenant,
  attributes,
  postgresDB,
  tenantService,
} from "./utils.js";
import { mockTenantAttributeRouterRequest } from "./supertestSetup.js";

describe("addDeclaredAttribute", async () => {
  const declaredAttribute: Attribute = {
    ...getMockAttribute(),
    kind: attributeKind.declared,
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const tenant = getMockTenant();

  it("Should add the declared attribute if the tenant doesn't have that", async () => {
    const tenantWithoutDeclaredAttribute: Tenant = {
      ...getMockTenant(),
      attributes: [],
    };

    await writeInReadmodel(toReadModelAttribute(declaredAttribute), attributes);
    await addOneTenant(tenantWithoutDeclaredAttribute);

    const returnedTenant = await mockTenantAttributeRouterRequest.post({
      path: "/tenants/attributes/declared",
      body: { id: declaredAttribute.id },
      authData: getMockAuthData(tenantWithoutDeclaredAttribute.id),
    });

    const writtenEvent = await readLastEventByStreamId(
      tenantWithoutDeclaredAttribute.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenantWithoutDeclaredAttribute.id,
      version: "1",
      type: "TenantDeclaredAttributeAssigned",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantDeclaredAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenantWithoutDeclaredAttribute,
      attributes: [
        {
          id: declaredAttribute.id,
          type: "PersistentDeclaredAttribute",
          assignmentTimestamp: new Date(),
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(toApiTenant(updatedTenant));
  });
  it("Should re-assign the declared attribute if it was revoked", async () => {
    const tenantWithAttributeRevoked: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          id: declaredAttribute.id,
          type: tenantAttributeType.DECLARED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
    };
    await writeInReadmodel(toReadModelAttribute(declaredAttribute), attributes);
    await addOneTenant(tenantWithAttributeRevoked);

    const returnedTenant = await mockTenantAttributeRouterRequest.post({
      path: "/tenants/attributes/declared",
      body: { id: declaredAttribute.id },
      authData: getMockAuthData(tenantWithAttributeRevoked.id),
    });

    const writtenEvent = await readLastEventByStreamId(
      tenantWithAttributeRevoked.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenantWithAttributeRevoked.id,
      version: "1",
      type: "TenantDeclaredAttributeAssigned",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantDeclaredAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenantWithAttributeRevoked,
      attributes: [
        {
          id: declaredAttribute.id,
          type: "PersistentDeclaredAttribute",
          assignmentTimestamp: new Date(),
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(toApiTenant(updatedTenant));
  });
  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    await writeInReadmodel(toReadModelAttribute(declaredAttribute), attributes);
    expect(
      tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: { id: declaredAttribute.id },
          organizationId: tenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    await addOneTenant(tenant);

    expect(
      tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: { id: declaredAttribute.id },
          organizationId: tenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      attributeNotFound(unsafeBrandId(declaredAttribute.id))
    );
  });
});
