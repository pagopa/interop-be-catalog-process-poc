/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAttribute,
  getMockAuthData,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test";
import {
  generateId,
  AttributeAddedV1,
  Attribute,
  attributeKind,
  toAttributeV1,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  attributeDuplicateByName,
  originNotCompliant,
} from "../src/model/domain/errors.js";
import {
  toApiAttribute,
  toAttribute,
} from "../src/model/domain/apiConverter.js";
import {
  attributeRegistryService,
  readLastAttributeEvent,
  addOneAttribute,
} from "./utils.js";
import { mockAttributeRegistryRouterRequest } from "./supertestSetup.js";

describe("declared attribute creation", () => {
  const mockAttribute = getMockAttribute();

  it("should write on event-store for the creation of a declared attribute", async () => {
    const attribute = await mockAttributeRegistryRouterRequest.post({
      path: "/declaredAttributes",
      body: {
        name: mockAttribute.name,
        description: mockAttribute.description,
      },
      authData: getMockAuthData(),
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
      kind: attributeKind.declared,
      creationTime: new Date(writtenPayload.attribute!.creationTime),
    };

    expect(writtenPayload.attribute).toEqual(
      toAttributeV1(toAttribute(attribute))
    );

    expect(attribute).toEqual(toApiAttribute(expectedAttribute));
  });
  it("should throw originNotCompliant if the requester externalId origin is not allowed", async () => {
    expect(
      attributeRegistryService.createDeclaredAttribute(
        {
          name: mockAttribute.name,
          description: mockAttribute.description,
        },
        {
          authData: {
            ...getMockAuthData(),
            externalId: {
              value: "123456",
              origin: "not-allowed-origin",
            },
          },
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "",
        }
      )
    ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
  });
  it("should throw attributeDuplicate if an attribute with the same name already exists", async () => {
    const attribute = {
      ...mockAttribute,
      kind: attributeKind.declared,
    };
    await addOneAttribute(attribute);
    expect(
      attributeRegistryService.createDeclaredAttribute(
        {
          name: attribute.name,
          description: attribute.description,
        },
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(attributeDuplicateByName(attribute.name));
  });
});
