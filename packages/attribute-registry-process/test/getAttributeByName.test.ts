/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { getMockAttribute, getMockAuthData } from "pagopa-interop-commons-test";
import { Attribute, generateId, attributeKind } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { attributeNotFound } from "../src/model/domain/errors.js";
import { toApiAttribute } from "../src/model/domain/apiConverter.js";
import { addOneAttribute, attributeRegistryService } from "./utils.js";
import { mockAttributeRegistryRouterRequest } from "./supertestSetup.js";

describe("getAttributeByName", async () => {
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
      path: "/attributes/name/:name",
      pathParams: { name: attribute1.name },
      authData: getMockAuthData(),
    });
    expect(attribute).toEqual(toApiAttribute(attribute1));
  });
  it("should throw attributeNotFound if the attribute doesn't exist", async () => {
    const name = "not-existing";
    expect(
      attributeRegistryService.getAttributeByName(name, genericLogger)
    ).rejects.toThrowError(attributeNotFound(name));
  });
});
