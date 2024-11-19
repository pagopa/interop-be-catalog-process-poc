/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  attributeKind,
  tenantAttributeType,
  toReadModelAttribute,
} from "pagopa-interop-models";

import {
  writeInReadmodel,
  getMockAttribute,
  getMockTenant,
  readEventByStreamIdAndVersion,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  generateId,
  Tenant,
  Attribute,
  unsafeBrandId,
  protobufDecoder,
  TenantCertifiedAttributeAssignedV2,
  fromTenantKindV2,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { AuthData, genericLogger, userRoles } from "pagopa-interop-commons";
import {
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantNotFoundByExternalId,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  attributes,
  postgresDB,
  tenantService,
} from "./utils.js";
import { mockInternalTenantRouterRequest } from "./supertestSetup.js";

describe("internalAssignCertifiedAttributes", async () => {
  const authData: AuthData = {
    ...getMockAuthData(),
    userRoles: [userRoles.INTERNAL_ROLE],
  };

  const attribute: Attribute = {
    ...getMockAttribute(),
    kind: attributeKind.certified,
    origin: "IPA",
    code: generateId(),
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should add the certified attribute if the Tenant doesn't have it", async () => {
    const targetTenant: Tenant = {
      ...getMockTenant(),
      attributes: [],
    };
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await addOneTenant(targetTenant);

    await mockInternalTenantRouterRequest.post({
      path: "/internal/origin/:tOrigin/externalId/:tExternalId/attributes/origin/:aOrigin/externalId/:aExternalId",
      pathParams: {
        tOrigin: targetTenant.externalId.origin,
        tExternalId: targetTenant.externalId.value,
        aOrigin: attribute.origin!,
        aExternalId: attribute.code!,
      },
      authData,
    });

    const writtenEvent = await readEventByStreamIdAndVersion(
      targetTenant.id,
      1,
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
          id: unsafeBrandId(attribute.id),
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });
  it("Should re-assign the attribute if it was revoked", async () => {
    const tenantWithCertifiedAttribute: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          id: unsafeBrandId(attribute.id),
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
    };

    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await addOneTenant(tenantWithCertifiedAttribute);

    await mockInternalTenantRouterRequest.post({
      path: "/internal/origin/:tOrigin/externalId/:tExternalId/attributes/origin/:aOrigin/externalId/:aExternalId",
      pathParams: {
        tOrigin: tenantWithCertifiedAttribute.externalId.origin,
        tExternalId: tenantWithCertifiedAttribute.externalId.value,
        aOrigin: attribute.origin!,
        aExternalId: attribute.code!,
      },
      authData,
    });

    const writtenEvent = await readEventByStreamIdAndVersion(
      tenantWithCertifiedAttribute.id,
      1,
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
          id: unsafeBrandId(attribute.id),
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });
  it("Should throw certifiedAttributeAlreadyAssigned if the attribute was already assigned", async () => {
    const tenantAlreadyAssigned: Tenant = {
      ...getMockTenant(),
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
    expect(
      tenantService.internalAssignCertifiedAttribute(
        {
          tenantOrigin: tenantAlreadyAssigned.externalId.origin,
          tenantExternalId: tenantAlreadyAssigned.externalId.value,
          attributeOrigin: attribute.origin!,
          attributeExternalId: attribute.code!,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      certifiedAttributeAlreadyAssigned(
        unsafeBrandId(attribute.id),
        unsafeBrandId(tenantAlreadyAssigned.id)
      )
    );
  });
  it("Should throw tenantNotFoundByExternalId if the target tenant doesn't exist", async () => {
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    const targetTenant = getMockTenant();
    expect(
      tenantService.internalAssignCertifiedAttribute(
        {
          tenantOrigin: targetTenant.externalId.origin,
          tenantExternalId: targetTenant.externalId.value,
          attributeOrigin: attribute.origin!,
          attributeExternalId: attribute.code!,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      tenantNotFoundByExternalId(
        targetTenant.externalId.origin,
        targetTenant.externalId.value
      )
    );
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    const targetTenant: Tenant = getMockTenant();
    await addOneTenant(targetTenant);

    expect(
      tenantService.internalAssignCertifiedAttribute(
        {
          tenantOrigin: targetTenant.externalId.origin,
          tenantExternalId: targetTenant.externalId.value,
          attributeOrigin: attribute.origin!,
          attributeExternalId: attribute.code!,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      attributeNotFound(unsafeBrandId(`${attribute.origin}/${attribute.code}`))
    );
  });
});
