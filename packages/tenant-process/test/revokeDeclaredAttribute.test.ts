/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockAuthData,
  getMockTenant,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  AttributeId,
  TenantDeclaredAttributeRevokedV2,
  tenantAttributeType,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  tenantNotFound,
  attributeNotFound,
} from "../src/model/domain/errors.js";
import { toApiTenant } from "../src/model/domain/apiConverter.js";
import { addOneTenant, postgresDB, tenantService } from "./utils.js";
import { mockTenantAttributeRouterRequest } from "./supertestSetup.js";

describe("revokeDeclaredAttribute", async () => {
  const attributeId: AttributeId = generateId();
  const tenant: Tenant = {
    ...getMockTenant(),
    attributes: [
      {
        id: attributeId,
        type: "PersistentDeclaredAttribute",
        assignmentTimestamp: new Date(
          new Date().setDate(new Date().getDate() - 3)
        ),
      },
    ],
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should revoke the declared attribute if it exist in tenant", async () => {
    await addOneTenant(tenant);

    const returnedTenant = await mockTenantAttributeRouterRequest.delete({
      path: "/tenants/attributes/declared/:attributeId",
      pathParams: {
        attributeId,
      },
      authData: getMockAuthData(tenant.id),
    });

    const writtenEvent = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "1",
      type: "TenantDeclaredAttributeRevoked",
      event_version: 2,
    });

    const writtenPayload = protobufDecoder(
      TenantDeclaredAttributeRevokedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenant,
      attributes: [
        {
          ...tenant.attributes[0],
          type: "PersistentDeclaredAttribute",
          revocationTimestamp: new Date(),
        },
      ],
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(toApiTenant(updatedTenant));
  });
  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    expect(
      tenantService.revokeDeclaredAttribute(
        {
          attributeId,
          organizationId: tenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    const notDeclaredAttributeTenant: Tenant = {
      ...tenant,
      attributes: [
        {
          id: attributeId,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
        },
      ],
    };
    await addOneTenant(notDeclaredAttributeTenant);
    expect(
      tenantService.revokeDeclaredAttribute(
        {
          attributeId,
          organizationId: notDeclaredAttributeTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(attributeNotFound(attributeId));
  });
});
