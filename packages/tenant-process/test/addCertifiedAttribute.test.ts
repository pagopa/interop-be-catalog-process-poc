/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAuthData,
  getMockTenant,
  getTenantOneCertifierFeature,
} from "pagopa-interop-commons-test";
import {
  Tenant,
  Attribute,
  generateId,
  unsafeBrandId,
  attributeKind,
  protobufDecoder,
  TenantCertifiedAttributeAssignedV2,
  fromTenantKindV2,
  toTenantV2,
  toReadModelAttribute,
  tenantAttributeType,
} from "pagopa-interop-models";
import { describe, beforeAll, vi, afterAll, it, expect } from "vitest";
import {
  writeInReadmodel,
  getMockAttribute,
  readLastEventByStreamId,
  getMockCertifiedTenantAttribute,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  certifiedAttributeAlreadyAssigned,
  tenantNotFound,
  attributeNotFound,
  tenantIsNotACertifier,
  attributeDoesNotBelongToCertifier,
} from "../src/model/domain/errors.js";
import { toApiTenant } from "../src/model/domain/apiConverter.js";
import {
  attributes,
  addOneTenant,
  tenantService,
  postgresDB,
} from "./utils.js";
import { mockTenantAttributeRouterRequest } from "./supertestSetup.js";

describe("addCertifiedAttribute", async () => {
  const tenantAttributeSeed: tenantApi.CertifiedTenantAttributeSeed = {
    id: generateId(),
  };
  const targetTenant: Tenant = { ...getMockTenant(), kind: "PA" };

  const requesterTenant: Tenant = {
    ...getMockTenant(),
    features: [
      {
        type: "PersistentCertifier",
        certifierId: generateId(),
      },
    ],
    updatedAt: new Date(),
  };

  const attribute: Attribute = {
    ...getMockAttribute(),
    id: unsafeBrandId(tenantAttributeSeed.id),
    kind: attributeKind.certified,
    origin: getTenantOneCertifierFeature(requesterTenant).certifierId,
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should add the certified attribute if the tenant doesn't have that", async () => {
    await addOneTenant(targetTenant);
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await addOneTenant(requesterTenant);

    const returnedTenant = await mockTenantAttributeRouterRequest.post({
      path: "/tenants/:tenantId/attributes/certified",
      body: { ...tenantAttributeSeed },
      pathParams: { tenantId: targetTenant.id },
      authData: getMockAuthData(requesterTenant.id),
    });

    const writtenEvent = await readLastEventByStreamId(
      targetTenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: targetTenant.id,
      version: "1",
      type: "TenantCertifiedAttributeAssigned",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantCertifiedAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...targetTenant,
      attributes: [
        {
          id: unsafeBrandId(tenantAttributeSeed.id),
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(toApiTenant(updatedTenant));
  });
  it("Should store TenantCertifiedAttributeAssigned and tenantUpdatedKind events", async () => {
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await addOneTenant(requesterTenant);
    const tenantWithRevaluatedKind: Tenant = {
      ...targetTenant,
      kind: "PRIVATE",
    };
    await addOneTenant(tenantWithRevaluatedKind);

    await mockTenantAttributeRouterRequest.post({
      path: "/tenants/:tenantId/attributes/certified",
      body: { ...tenantAttributeSeed },
      pathParams: { tenantId: tenantWithRevaluatedKind.id },
      authData: getMockAuthData(requesterTenant.id),
    });

    const writtenEventTenantCertifiedAttributeAssigned =
      await readEventByStreamIdAndVersion(
        tenantWithRevaluatedKind.id,
        1,
        "tenant",
        postgresDB
      );

    const writtenEventTenantKindUpdated = await readEventByStreamIdAndVersion(
      tenantWithRevaluatedKind.id,
      2,
      "tenant",
      postgresDB
    );

    expect(writtenEventTenantCertifiedAttributeAssigned).toMatchObject({
      stream_id: tenantWithRevaluatedKind.id,
      version: "1",
      type: "TenantCertifiedAttributeAssigned",
      event_version: 2,
    });

    expect(writtenEventTenantKindUpdated).toMatchObject({
      stream_id: tenantWithRevaluatedKind.id,
      version: "2",
      type: "TenantKindUpdated",
      event_version: 2,
    });
  });
  it("Should re-assign the certified attribute if it was revoked", async () => {
    const tenantWithCertifiedAttribute: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...getMockCertifiedTenantAttribute(),
          id: unsafeBrandId(tenantAttributeSeed.id),
          revocationTimestamp: new Date(),
        },
      ],
    };

    await writeInReadmodel(toReadModelAttribute(attribute), attributes);

    await addOneTenant(tenantWithCertifiedAttribute);
    await addOneTenant(requesterTenant);

    const returnedTenant = await mockTenantAttributeRouterRequest.post({
      path: "/tenants/:tenantId/attributes/certified",
      body: { ...tenantAttributeSeed },
      pathParams: { tenantId: tenantWithCertifiedAttribute.id },
      authData: getMockAuthData(requesterTenant.id),
    });

    const writtenEvent = await readLastEventByStreamId(
      tenantWithCertifiedAttribute.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenantWithCertifiedAttribute.id,
      version: "1",
      type: "TenantCertifiedAttributeAssigned",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantCertifiedAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenantWithCertifiedAttribute,
      attributes: [
        {
          id: unsafeBrandId(tenantAttributeSeed.id),
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(toApiTenant(updatedTenant));
  });
  it("Should throw certifiedAttributeAlreadyAssigned if the attribute was already assigned", async () => {
    const tenantAlreadyAssigned: Tenant = {
      ...targetTenant,
      attributes: [
        {
          id: attribute.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
        },
      ],
    };
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);

    await addOneTenant(tenantAlreadyAssigned);
    await addOneTenant(requesterTenant);
    expect(
      tenantService.addCertifiedAttribute(
        {
          tenantId: tenantAlreadyAssigned.id,
          tenantAttributeSeed,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      certifiedAttributeAlreadyAssigned(attribute.id, tenantAlreadyAssigned.id)
    );
  });
  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);

    expect(
      tenantService.addCertifiedAttribute(
        {
          tenantId: targetTenant.id,
          tenantAttributeSeed,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(requesterTenant.id));
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);

    expect(
      tenantService.addCertifiedAttribute(
        {
          tenantId: targetTenant.id,
          tenantAttributeSeed,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(attributeNotFound(attribute.id));
  });

  it("Should throw tenantIsNotACertifier if the requester is not a certifier", async () => {
    const tenant: Tenant = getMockTenant();
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);

    await addOneTenant(targetTenant);
    await addOneTenant(tenant);

    expect(
      tenantService.addCertifiedAttribute(
        {
          tenantId: targetTenant.id,
          tenantAttributeSeed,
          organizationId: tenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(tenantIsNotACertifier(tenant.id));
  });
  it("Should throw attributeDoesNotBelongToCertifier if attribute origin doesn't match the certifierId of the requester", async () => {
    const notCompliantOriginAttribute: Attribute = {
      ...attribute,
      origin: generateId(),
    };
    await writeInReadmodel(
      toReadModelAttribute(notCompliantOriginAttribute),
      attributes
    );
    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);

    expect(
      tenantService.addCertifiedAttribute(
        {
          tenantId: targetTenant.id,
          tenantAttributeSeed,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      attributeDoesNotBelongToCertifier(
        notCompliantOriginAttribute.id,
        requesterTenant.id,
        targetTenant.id
      )
    );
  });
});
