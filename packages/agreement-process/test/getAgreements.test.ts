/* eslint-disable functional/no-let */
import {
  getMockTenant,
  getMockDescriptorPublished,
  getMockEService,
  getMockAgreement,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  Tenant,
  Descriptor,
  EService,
  AgreementAttribute,
  Agreement,
  descriptorState,
  generateId,
  EServiceId,
  agreementState,
  TenantId,
} from "pagopa-interop-models";
import { describe, beforeEach, it, expect } from "vitest";
import { agreementToApiAgreement } from "../src/model/domain/apiConverter.js";
import { addOneTenant, addOneEService, addOneAgreement } from "./utils.js";
import { mockAgreementRouterRequest } from "./supertestSetup.js";

describe("get agreements", () => {
  let tenant1: Tenant;
  let tenant2: Tenant;
  let tenant3: Tenant;
  let descriptor1: Descriptor;
  let descriptor2: Descriptor;
  let descriptor3: Descriptor;
  let descriptor4: Descriptor;
  let descriptor5: Descriptor;
  let eservice1: EService;
  let eservice2: EService;
  let eservice3: EService;
  let attribute1: AgreementAttribute;
  let attribute2: AgreementAttribute;
  let attribute3: AgreementAttribute;
  let attribute4: AgreementAttribute;
  let agreement1: Agreement;
  let agreement2: Agreement;
  let agreement3: Agreement;
  let agreement4: Agreement;
  let agreement5: Agreement;
  let agreement6: Agreement;

  beforeEach(async () => {
    tenant1 = getMockTenant();
    tenant2 = getMockTenant();
    tenant3 = getMockTenant();

    descriptor1 = {
      ...getMockDescriptorPublished(),
      state: descriptorState.suspended,
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    };
    descriptor2 = {
      ...getMockDescriptorPublished(),
      publishedAt: new Date(),
    };
    descriptor3 = {
      ...getMockDescriptorPublished(),
      publishedAt: new Date(Date.now()),
    };
    descriptor4 = {
      ...getMockDescriptorPublished(),
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    };
    descriptor5 = getMockDescriptorPublished();
    eservice1 = {
      ...getMockEService(generateId<EServiceId>(), tenant1.id, [
        descriptor1,
        descriptor2,
        // descriptor2 is the latest - agreements for descriptor1 are upgradeable
      ]),
      name: "EService1", // Adding name because results are sorted by esevice name
    };
    eservice2 = {
      ...getMockEService(generateId<EServiceId>(), tenant2.id, [
        descriptor3,
        descriptor4,
        // descriptor4 is not the latest - agreements for descriptor3 are not upgradeable
      ]),
      name: "EService2", // Adding name because results are sorted by esevice name
    };
    eservice3 = {
      ...getMockEService(generateId<EServiceId>(), tenant3.id, [descriptor5]),
      name: "EService3", // Adding name because results are sorted by esevice name
    };

    await addOneTenant(tenant1);
    await addOneTenant(tenant2);
    await addOneTenant(tenant3);
    await addOneEService(eservice1);
    await addOneEService(eservice2);
    await addOneEService(eservice3);

    attribute1 = { id: generateId() };
    attribute2 = { id: generateId() };
    attribute3 = { id: generateId() };
    attribute4 = { id: generateId() };
    agreement1 = {
      ...getMockAgreement(eservice1.id, tenant1.id, agreementState.draft),
      descriptorId: eservice1.descriptors[0].id,
      producerId: eservice1.producerId,
      certifiedAttributes: [attribute1, attribute2],
      declaredAttributes: [attribute3],
    };

    agreement2 = {
      ...getMockAgreement(eservice1.id, tenant2.id, agreementState.active),
      descriptorId: eservice1.descriptors[1].id,
      producerId: eservice1.producerId,
      declaredAttributes: [attribute3],
      verifiedAttributes: [attribute4],
    };

    agreement3 = {
      ...getMockAgreement(eservice2.id, tenant1.id, agreementState.pending),
      descriptorId: eservice2.descriptors[0].id,
      producerId: eservice2.producerId,
    };

    agreement4 = {
      ...getMockAgreement(
        eservice2.id,
        tenant2.id,
        agreementState.missingCertifiedAttributes
      ),
      // upgradeable agreement based on descriptors, but not in an upgradeable state
      descriptorId: eservice2.descriptors[1].id,
      producerId: eservice2.producerId,
    };

    agreement5 = {
      ...getMockAgreement(eservice3.id, tenant1.id, agreementState.archived),
      descriptorId: eservice3.descriptors[0].id,
      producerId: eservice3.producerId,
    };

    agreement6 = {
      ...getMockAgreement(eservice3.id, tenant3.id, agreementState.rejected),
      descriptorId: eservice3.descriptors[0].id,
      producerId: eservice3.producerId,
    };

    await addOneAgreement(agreement1);
    await addOneAgreement(agreement2);
    await addOneAgreement(agreement3);
    await addOneAgreement(agreement4);
    await addOneAgreement(agreement5);
    await addOneAgreement(agreement6);
  });

  it("should get all agreements if no filters are provided", async () => {
    const allAgreements = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: { limit: 10, offset: 0 },
      authData: getMockAuthData(),
    });

    expect(allAgreements).toEqual({
      totalCount: 6,
      results: expect.arrayContaining([
        agreementToApiAgreement(agreement1),
        agreementToApiAgreement(agreement2),
        agreementToApiAgreement(agreement3),
        agreementToApiAgreement(agreement4),
        agreementToApiAgreement(agreement5),
        agreementToApiAgreement(agreement6),
      ]),
    });
  });

  it("should get agreements with filters: producerId", async () => {
    const agreements1 = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: { producersIds: eservice1.producerId, limit: 10, offset: 0 },
      authData: getMockAuthData(),
    });
    expect(agreements1).toEqual({
      totalCount: 2,
      results: expect.arrayContaining([
        agreementToApiAgreement(agreement1),
        agreementToApiAgreement(agreement2),
      ]),
    });

    const agreements2 = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        producersIds: [eservice1.producerId, eservice2.producerId],
        limit: 10,
        offset: 0,
      },
      authData: getMockAuthData(),
    });

    expect(agreements2).toEqual({
      totalCount: 4,
      results: expect.arrayContaining([
        agreementToApiAgreement(agreement1),
        agreementToApiAgreement(agreement2),
        agreementToApiAgreement(agreement3),
        agreementToApiAgreement(agreement4),
      ]),
    });
  });

  it("should get agreements with filters: consumerId", async () => {
    const agreements1 = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        consumersIds: tenant1.id,
        limit: 10,
        offset: 0,
      },
      authData: getMockAuthData(),
    });
    expect(agreements1).toEqual({
      totalCount: 3,
      results: expect.arrayContaining([
        agreementToApiAgreement(agreement1),
        agreementToApiAgreement(agreement3),
        agreementToApiAgreement(agreement5),
      ]),
    });

    const agreements2 = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        consumersIds: [tenant1.id, tenant2.id],
        limit: 10,
        offset: 0,
      },
      authData: getMockAuthData(),
    });
    expect(agreements2).toEqual({
      totalCount: 5,
      results: expect.arrayContaining([
        agreementToApiAgreement(agreement1),
        agreementToApiAgreement(agreement2),
        agreementToApiAgreement(agreement3),
        agreementToApiAgreement(agreement4),
        agreementToApiAgreement(agreement5),
      ]),
    });
  });

  it("should get agreements with filters: eserviceId", async () => {
    const agreements1 = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        eservicesIds: eservice1.id,
        limit: 10,
        offset: 0,
      },
      authData: getMockAuthData(),
    });
    expect(agreements1).toEqual({
      totalCount: 2,
      results: expect.arrayContaining([
        agreementToApiAgreement(agreement1),
        agreementToApiAgreement(agreement2),
      ]),
    });

    const agreements2 = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        eservicesIds: [eservice1.id, eservice2.id],
        limit: 10,
        offset: 0,
      },
      authData: getMockAuthData(),
    });
    expect(agreements2).toEqual({
      totalCount: 4,
      results: expect.arrayContaining([
        agreementToApiAgreement(agreement1),
        agreementToApiAgreement(agreement2),
        agreementToApiAgreement(agreement3),
        agreementToApiAgreement(agreement4),
      ]),
    });
  });

  it("should get agreements with filters: descriptorId", async () => {
    const agreements1 = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        descriptorsIds: descriptor1.id,
        limit: 10,
        offset: 0,
      },
      authData: getMockAuthData(),
    });
    expect(agreements1).toEqual({
      totalCount: 1,
      results: expect.arrayContaining([agreementToApiAgreement(agreement1)]),
    });

    const agreements2 = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        descriptorsIds: [descriptor1.id, descriptor3.id, descriptor5.id],
        limit: 10,
        offset: 0,
      },
      authData: getMockAuthData(),
    });
    expect(agreements2).toEqual({
      totalCount: 4,
      results: expect.arrayContaining([
        agreementToApiAgreement(agreement1),
        agreementToApiAgreement(agreement3),
        agreementToApiAgreement(agreement5),
        agreementToApiAgreement(agreement6),
      ]),
    });
  });

  it("should get agreements with filters: state", async () => {
    const agreements = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        states: ["ACTIVE", "PENDING"],
        limit: 10,
        offset: 0,
      },
      authData: getMockAuthData(),
    });
    expect(agreements).toEqual({
      totalCount: 2,
      results: expect.arrayContaining([
        agreementToApiAgreement(agreement2),
        agreementToApiAgreement(agreement3),
      ]),
    });
  });
  it("should get agreements with filters: showOnlyUpgradeable", async () => {
    const agreements = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        showOnlyUpgradeable: true,
        limit: 10,
        offset: 0,
      },
      authData: getMockAuthData(),
    });
    expect(agreements).toEqual({
      totalCount: 1,
      results: expect.arrayContaining([
        agreementToApiAgreement(agreement1),
        // also agreement4 has a latest descriptor to upgrade to,
        // but it is not in an upgradeable state
      ]),
    });
  });

  it("should get agreements with filters: producerId, consumerId, eserviceId", async () => {
    const agreements = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        producersIds: [eservice1.producerId, eservice2.producerId],
        consumersIds: tenant1.id,
        eservicesIds: [eservice1.id, eservice2.id],
        limit: 10,
        offset: 0,
      },
      authData: getMockAuthData(),
    });
    expect(agreements).toEqual({
      totalCount: 2,
      results: expect.arrayContaining([
        agreementToApiAgreement(agreement1),
        agreementToApiAgreement(agreement3),
      ]),
    });
  });

  it("should get agreements with filters: producerId, consumerId, eserviceId, descriptorId", async () => {
    const agreements = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        producersIds: [eservice1.producerId, eservice2.producerId],
        consumersIds: tenant1.id,
        eservicesIds: [eservice1.id, eservice2.id],
        descriptorsIds: [descriptor1.id],
        limit: 10,
        offset: 0,
      },
      authData: getMockAuthData(),
    });
    expect(agreements).toEqual({
      totalCount: 1,
      results: expect.arrayContaining([agreementToApiAgreement(agreement1)]),
    });
  });

  it("should get agreements with filters: showOnlyUpgradeable, state, descriptorId", async () => {
    const agreements1 = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        showOnlyUpgradeable: true,
        states: ["DRAFT"],
        descriptorsIds: descriptor1.id,
        limit: 10,
        offset: 0,
      },
      authData: getMockAuthData(),
    });
    expect(agreements1).toEqual({
      totalCount: 1,
      results: expect.arrayContaining([agreementToApiAgreement(agreement1)]),
    });

    const agreements2 = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        showOnlyUpgradeable: true,
        states: ["SUSPENDED"],
        descriptorsIds: descriptor1.id,
        limit: 10,
        offset: 0,
      },
      authData: getMockAuthData(),
    });
    expect(agreements2).toEqual({
      totalCount: 0,
      results: [],
    });
  });

  it("should get agreements with limit", async () => {
    const agreements = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        eservicesIds: eservice1.id,
        limit: 1,
        offset: 0,
      },
      authData: getMockAuthData(),
    });
    expect(agreements).toEqual({
      totalCount: 2,
      results: expect.arrayContaining([agreementToApiAgreement(agreement1)]),
    });
  });

  it("should get agreements with offset and limit", async () => {
    const agreements = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        eservicesIds: [eservice1.id, eservice2.id],
        limit: 2,
        offset: 1,
      },
      authData: getMockAuthData(),
    });
    expect(agreements).toEqual({
      totalCount: 4,
      results: expect.arrayContaining([
        agreementToApiAgreement(agreement2),
        agreementToApiAgreement(agreement3),
      ]),
    });
  });
  it("should get no agreements in case no filters match", async () => {
    const agreements = await mockAgreementRouterRequest.get({
      path: "/agreements",
      queryParams: {
        producersIds: generateId<TenantId>(),
        limit: 10,
        offset: 0,
      },
      authData: getMockAuthData(),
    });

    expect(agreements).toEqual({
      totalCount: 0,
      results: [],
    });
  });
});
