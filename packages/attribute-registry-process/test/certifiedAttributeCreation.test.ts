/* eslint-disable @typescript-eslint/no-floating-promises */
import { randomUUID } from "crypto";
import { genericLogger } from "pagopa-interop-commons";
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
  attributeDuplicateByNameAndCode,
  OrganizationIsNotACertifier,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  toApiAttribute,
  toAttribute,
} from "../src/model/domain/apiConverter.js";
import {
  addOneTenant,
  attributeRegistryService,
  readLastAttributeEvent,
  addOneAttribute,
} from "./utils.js";
import { mockAttributeRegistryRouterRequest } from "./supertestSetup.js";

describe("certified attribute creation", () => {
  const mockAttribute = getMockAttribute();
  const mockTenant = getMockTenant();
  it("should write on event-store for the creation of a certified attribute", async () => {
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

    const attribute = await mockAttributeRegistryRouterRequest.post({
      path: "/certifiedAttributes",
      body: {
        name: mockAttribute.name,
        code: "code",
        description: mockAttribute.description,
      },
      authData: getMockAuthData(tenant.id),
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
      attributeRegistryService.createCertifiedAttribute(
        {
          name: attribute.name,
          code: attribute.code,
          description: attribute.description,
        },
        {
          authData: getMockAuthData(tenant.id),
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      attributeDuplicateByNameAndCode(attribute.name, attribute.code)
    );
  });
  it("should throw OrganizationIsNotACertifier if the organization is not a certifier", async () => {
    await addOneTenant(mockTenant);
    await addOneAttribute(mockAttribute);
    expect(
      attributeRegistryService.createCertifiedAttribute(
        {
          name: mockAttribute.name,
          code: "code",
          description: mockAttribute.description,
        },
        {
          authData: getMockAuthData(mockTenant.id),
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "",
        }
      )
    ).rejects.toThrowError(OrganizationIsNotACertifier(mockTenant.id));
  });
  it("should throw tenantNotFound if the certifier is not found", async () => {
    await addOneAttribute(mockAttribute);
    expect(
      attributeRegistryService.createCertifiedAttribute(
        {
          name: mockAttribute.name,
          code: "code",
          description: mockAttribute.description,
        },
        {
          authData: getMockAuthData(mockTenant.id),
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "",
        }
      )
    ).rejects.toThrowError(tenantNotFound(mockTenant.id));
  });
});
