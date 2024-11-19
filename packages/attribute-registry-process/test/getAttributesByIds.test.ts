import { Attribute, attributeKind, generateId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { getMockAttribute, getMockAuthData } from "pagopa-interop-commons-test";
import { toApiAttribute } from "../src/model/domain/apiConverter.js";
import { addOneAttribute } from "./utils.js";
import { mockAttributeRegistryRouterRequest } from "./supertestSetup.js";

describe("getAttributesByIds", async () => {
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

  const attribute2: Attribute = {
    ...mockAttribute,
    id: generateId(),
    name: "attribute 002 test",
    kind: attributeKind.certified,
    origin: "IPA",
    code: "12345B",
  };
  await addOneAttribute(attribute2);

  const attribute3: Attribute = {
    ...mockAttribute,
    id: generateId(),
    name: "attribute 003 test",
    kind: attributeKind.certified,
    origin: "IPA",
    code: "12345C",
  };
  await addOneAttribute(attribute3);

  it("should get the attributes if they exist", async () => {
    const result = await mockAttributeRegistryRouterRequest.post({
      path: "/bulk/attributes",
      body: [attribute1.id, attribute2.id, attribute3.id],
      queryParams: {
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(),
    });

    expect(result.totalCount).toBe(3);
    expect(result.results).toEqual([
      toApiAttribute(attribute1),
      toApiAttribute(attribute2),
      toApiAttribute(attribute3),
    ]);
  });
  it("should not get the attributes if they don't exist", async () => {
    const result = await mockAttributeRegistryRouterRequest.post({
      path: "/bulk/attributes",
      body: [generateId(), generateId()],
      queryParams: {
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(),
    });
    expect(result.totalCount).toBe(0);
    expect(result.results).toEqual([]);
  });
  it("should not get any attributes if the requested ids list is empty", async () => {
    const result = await mockAttributeRegistryRouterRequest.post({
      path: "/bulk/attributes",
      body: [],
      queryParams: {
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(),
    });
    expect(result.totalCount).toBe(0);
    expect(result.results).toEqual([]);
  });
});
