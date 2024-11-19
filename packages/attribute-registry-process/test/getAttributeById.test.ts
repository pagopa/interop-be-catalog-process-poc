/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  generateId,
  AttributeId,
  Attribute,
  attributeKind,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { getMockAttribute, getMockAuthData } from "pagopa-interop-commons-test";
import { attributeNotFound } from "../src/model/domain/errors.js";
import { toApiAttribute } from "../src/model/domain/apiConverter.js";
import { addOneAttribute, attributeRegistryService } from "./utils.js";
import { mockAttributeRegistryRouterRequest } from "./supertestSetup.js";

describe("getAttributeById", async () => {
  const mockAttribute = getMockAttribute();

  const attribute1: Attribute = {
    ...mockAttribute,
    id: generateId(),
    name: "attribute 001 test",
    kind: attributeKind.certified,
    origin: "IPA",
    code: "12345A",
  };
  await addOneAttribute(attribute1);
  it("should get the attribute if it exists", async () => {
    const attribute = await mockAttributeRegistryRouterRequest.get({
      path: "/attributes/:attributeId",
      pathParams: { attributeId: attribute1.id },
      authData: getMockAuthData(),
    });

    expect(attribute).toEqual(toApiAttribute(attribute1));
  });
  it("should throw attributeNotFound if the attribute doesn't exist", async () => {
    const id = generateId<AttributeId>();
    expect(
      attributeRegistryService.getAttributeById(id, genericLogger)
    ).rejects.toThrowError(attributeNotFound(id));
  });
});
