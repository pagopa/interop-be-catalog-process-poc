/* eslint-disable @typescript-eslint/no-floating-promises */
import crypto from "crypto";
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  operationForbidden,
  TenantMailAddedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/dist/eventStoreTestUtils.js";
import { tenantApi } from "pagopa-interop-api-clients";
import { getMockAuthData, getMockTenant } from "pagopa-interop-commons-test";
import {
  mailAlreadyExists,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import { addOneTenant, postgresDB, tenantService } from "./utils.js";
import { mockTenantRouterRequest } from "./supertestSetup.js";

describe("addTenantMail", async () => {
  const mockTenant = getMockTenant();
  const mailSeed: tenantApi.MailSeed = {
    kind: "CONTACT_EMAIL",
    address: "testMail@test.it",
    description: "mail description",
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should correctly add the mail", async () => {
    await addOneTenant(mockTenant);

    await mockTenantRouterRequest.post({
      path: "/tenants/:tenantId/mails",
      body: { ...mailSeed },
      pathParams: { tenantId: mockTenant.id },
      authData: getMockAuthData(mockTenant.id),
    });

    const writtenEvent = await readLastEventByStreamId(
      mockTenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockTenant.id,
      version: "1",
      type: "TenantMailAdded",
      event_version: 2,
    });

    const writtenPayload: TenantMailAddedV2 | undefined = protobufDecoder(
      TenantMailAddedV2
    ).parse(writtenEvent.data);

    const updatedTenant: Tenant = {
      ...mockTenant,
      mails: [
        {
          ...mailSeed,
          id: writtenPayload.mailId,
          createdAt: new Date(),
        },
      ],
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });
  it("Should throw tenantNotFound if the tenant doesn't exists", async () => {
    expect(
      tenantService.addTenantMail(
        {
          tenantId: mockTenant.id,
          mailSeed,
          organizationId: mockTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(mockTenant.id));
  });
  it("Should throw operationForbidden when when the requester is trying to assign an email to another tenant", async () => {
    await addOneTenant(mockTenant);
    expect(
      tenantService.addTenantMail(
        {
          tenantId: mockTenant.id,
          mailSeed,
          organizationId: generateId(),
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("Should throw mailAlreadyExists if address already exists in the tenant mail", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      mails: [
        {
          ...mailSeed,
          id: crypto
            .createHash("sha256")
            .update(mailSeed.address)
            .digest("base64"),
          createdAt: new Date(),
        },
      ],
    };

    await addOneTenant(tenant);
    expect(
      tenantService.addTenantMail(
        {
          tenantId: tenant.id,
          mailSeed,
          organizationId: tenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(mailAlreadyExists());
  });
});
