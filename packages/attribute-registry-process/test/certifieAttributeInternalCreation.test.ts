/* eslint-disable @typescript-eslint/no-floating-promises */
import { randomUUID } from "crypto";
import { AuthData, genericLogger, userRoles } from "pagopa-interop-commons";
import {
  getMockAuthData,
  decodeProtobufPayload,
  getMockAttribute,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Tenant,
  generateId,
  AttributeAddedV1,
  Attribute,
  attributeKind,
  toAttributeV1,
  unsafeBrandId,
  TenantFeatureCertifier,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  toApiAttribute,
  toAttribute,
} from "../src/model/domain/apiConverter.js";
import { attributeDuplicateByNameAndCode } from "../src/model/domain/errors.js";
import {
  addOneTenant,
  attributeRegistryService,
  readLastAttributeEvent,
  addOneAttribute,
} from "./utils.js";
import { mockAttributeRegistryRouterRequest } from "./supertestSetup.js";

describe("certified attribute internal creation", () => {
  const mockAttribute = getMockAttribute();
  const mockTenant = getMockTenant();
  it("should write on event-store for the internal creation of a certified attribute", async () => {
    const tenant: Tenant = {
      ...mockTenant,
      features: [
        {
          type: "PersistentCertifier",
          certifierId: randomUUID(),
        },
      ],
    };

    const authData: AuthData = {
      ...getMockAuthData(tenant.id),
      userRoles: [userRoles.INTERNAL_ROLE],
    };

    await addOneTenant(tenant);

    const attribute = await mockAttributeRegistryRouterRequest.post({
      path: "/internal/certifiedAttributes",
      body: {
        name: mockAttribute.name,
        code: "code",
        origin: (tenant.features[0] as TenantFeatureCertifier).certifierId,
        description: mockAttribute.description,
      },
      authData,
    });

    expect(attribute).toBeDefined();

    const writtenEvent = await readLastAttributeEvent(
      unsafeBrandId(attribute.id)
    );
    expect(writtenEvent).toMatchObject({
      stream_id: attribute.id,
      version: "0",
      type: "AttributeAdded",
      event_version: 1,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: AttributeAddedV1,
      payload: writtenEvent.data,
    });

    const expectedAttribute: Attribute = {
      ...mockAttribute,
      id: unsafeBrandId(attribute.id),
      code: "code",
      kind: attributeKind.certified,
      creationTime: new Date(writtenPayload.attribute!.creationTime),
      origin: (tenant.features[0] as TenantFeatureCertifier).certifierId,
    };

    expect(writtenPayload.attribute).toEqual(
      toAttributeV1(toAttribute(attribute))
    );

    expect(attribute).toEqual(toApiAttribute(expectedAttribute));
  });
  it("should throw attributeDuplicate if an attribute with the same name and code already exists", async () => {
    const attribute = {
      ...mockAttribute,
      code: "123456",
    };

    const tenant: Tenant = {
      ...mockTenant,
      features: [
        {
          type: "PersistentCertifier",
          certifierId: randomUUID(),
        },
      ],
    };

    await addOneTenant(tenant);
    await addOneAttribute(attribute);
    expect(
      attributeRegistryService.createInternalCertifiedAttribute(
        {
          name: attribute.name,
          code: attribute.code,
          origin: (tenant.features[0] as TenantFeatureCertifier).certifierId,
          description: attribute.description,
        },
        {
          authData: getMockAuthData(),
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      attributeDuplicateByNameAndCode(attribute.name, attribute.code)
    );
  });
});
