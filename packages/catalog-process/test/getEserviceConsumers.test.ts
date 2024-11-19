import { Descriptor, descriptorState, EService } from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import { getMockAuthData, getMockTenant } from "pagopa-interop-commons-test";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  getMockAgreement,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "./utils.js";
import { mockEserviceRouterRequest } from "./supertestSetup.js";

describe("get eservice consumers", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it("should get the consumers of the given eservice", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice1: EService = {
      ...mockEService,
      descriptors: [descriptor1],
    };
    await addOneEService(eservice1);
    const tenant = getMockTenant();
    await addOneTenant(tenant);
    const agreement = getMockAgreement({
      eserviceId: eservice1.id,
      descriptorId: descriptor1.id,
      producerId: eservice1.producerId,
      consumerId: tenant.id,
    });
    await addOneAgreement(agreement);

    const result = await mockEserviceRouterRequest.get({
      path: "/eservices/:eServiceId/consumers",
      pathParams: { eServiceId: eservice1.id },
      queryParams: { offset: 0, limit: 50 },
      authData: getMockAuthData(),
    });

    expect(result.totalCount).toBe(1);
    expect(result.results[0].consumerName).toBe(tenant.name);
  });

  it("should not get any consumers, if no one is using the given eservice", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice1: EService = {
      ...mockEService,
      descriptors: [descriptor1],
    };
    await addOneEService(eservice1);

    const consumers = await mockEserviceRouterRequest.get({
      path: "/eservices/:eServiceId/consumers",
      pathParams: { eServiceId: eservice1.id },
      queryParams: { offset: 0, limit: 50 },
      authData: getMockAuthData(),
    });

    expect(consumers.results).toStrictEqual([]);
    expect(consumers.totalCount).toBe(0);
  });
});
