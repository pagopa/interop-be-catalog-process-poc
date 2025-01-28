/* eslint-disable functional/no-let */
import {
  getMockTenant,
  getMockDescriptorPublished,
  getMockEService,
  getMockAgreement,
  getMockDelegation,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
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
  delegationKind,
} from "pagopa-interop-models";
import { describe, beforeEach, it, expect } from "vitest";
import {
  addOneTenant,
  addOneEService,
  addOneAgreement,
  agreementService,
  addOneDelegation,
} from "./utils.js";

describe("get agreements", () => {
  let tenant1: Tenant;
  let tenant2: Tenant;
  let tenant3: Tenant;
  let tenant4: Tenant;
  let tenant5: Tenant;
  let tenant6: Tenant;
  let descriptor1: Descriptor;
  let descriptor2: Descriptor;
  let descriptor3: Descriptor;
  let descriptor4: Descriptor;
  let descriptor5: Descriptor;
  let eservice1: EService;
  let eservice2: EService;
  let eservice3: EService;
  let eservice4: EService;
  let eservice5: EService;
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
  let agreement7: Agreement;
  let agreement8: Agreement;
  let agreement9: Agreement;
  let agreement10: Agreement;
  let agreement11: Agreement;

  beforeEach(async () => {
    tenant1 = getMockTenant();
    tenant2 = getMockTenant();
    tenant3 = getMockTenant();
    tenant4 = getMockTenant();
    tenant5 = getMockTenant();
    tenant6 = getMockTenant();

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
    eservice4 = {
      ...getMockEService(generateId<EServiceId>(), tenant3.id, [descriptor5]),
      name: "EService4", // Adding name because results are sorted by esevice name
    };
    eservice5 = {
      ...getMockEService(generateId<EServiceId>(), tenant4.id, [descriptor5]),
      name: "EService5", // Adding name because results are sorted by esevice name
    };

    await addOneTenant(tenant1);
    await addOneTenant(tenant2);
    await addOneTenant(tenant3);
    await addOneTenant(tenant4);
    await addOneEService(eservice1);
    await addOneEService(eservice2);
    await addOneEService(eservice3);
    await addOneEService(eservice4);
    await addOneEService(eservice5);

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

    agreement7 = {
      ...getMockAgreement(eservice4.id, tenant1.id, agreementState.draft),
      descriptorId: eservice4.descriptors[0].id,
      producerId: eservice4.producerId,
    };

    agreement8 = {
      ...getMockAgreement(eservice5.id, tenant1.id, agreementState.draft),
      descriptorId: eservice5.descriptors[0].id,
      producerId: eservice5.producerId,
    };

    agreement9 = {
      ...getMockAgreement(eservice5.id, tenant5.id, agreementState.draft),
      descriptorId: eservice5.descriptors[0].id,
      producerId: eservice5.producerId,
    };

    agreement10 = {
      ...getMockAgreement(eservice5.id, tenant6.id, agreementState.draft),
      descriptorId: eservice5.descriptors[0].id,
      producerId: eservice5.producerId,
    };

    agreement11 = {
      ...getMockAgreement(eservice5.id, tenant4.id, agreementState.draft),
      descriptorId: eservice5.descriptors[0].id,
      producerId: eservice5.producerId,
    };

    await addOneAgreement(agreement1);
    await addOneAgreement(agreement2);
    await addOneAgreement(agreement3);
    await addOneAgreement(agreement4);
    await addOneAgreement(agreement5);
    await addOneAgreement(agreement6);
    await addOneAgreement(agreement7);
    await addOneAgreement(agreement8);
    await addOneAgreement(agreement9);
    await addOneAgreement(agreement10);
    await addOneAgreement(agreement11);

    const delegation1 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      delegateId: eservice4.producerId,
      delegatorId: tenant3.id,
      eserviceId: eservice4.id,
      state: agreementState.active,
    });
    const delegation2 = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      delegateId: tenant4.id,
      delegatorId: tenant1.id,
      eserviceId: eservice5.id,
      state: agreementState.active,
    });
    const delegation3 = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      delegateId: tenant6.id,
      delegatorId: tenant5.id,
      eserviceId: eservice5.id,
      state: agreementState.active,
    });
    const delegation4 = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      delegateId: tenant5.id,
      delegatorId: tenant6.id,
      eserviceId: eservice5.id,
      state: agreementState.active,
    });

    await addOneDelegation(delegation1);
    await addOneDelegation(delegation2);
    await addOneDelegation(delegation3);
    await addOneDelegation(delegation4);
  });

  it("should get all agreements if no filters are provided", async () => {
    const allAgreements = await agreementService.getAgreements(
      {},
      20,
      0,
      genericLogger
    );
    expect(allAgreements).toEqual({
      totalCount: 11,
      results: expect.arrayContaining([
        agreement1,
        agreement2,
        agreement3,
        agreement4,
        agreement5,
        agreement6,
        agreement7,
        agreement8,
        agreement9,
        agreement10,
        agreement11,
      ]),
    });
  });

  it("should get agreements with filters: producerId", async () => {
    const agreements1 = await agreementService.getAgreements(
      {
        producerId: eservice1.producerId,
      },
      10,
      0,
      genericLogger
    );
    expect(agreements1).toEqual({
      totalCount: 2,
      results: expect.arrayContaining([agreement1, agreement2]),
    });

    const agreements2 = await agreementService.getAgreements(
      {
        producerId: [eservice1.producerId, eservice2.producerId],
      },
      10,
      0,
      genericLogger
    );

    expect(agreements2).toEqual({
      totalCount: 4,
      results: expect.arrayContaining([
        agreement1,
        agreement2,
        agreement3,
        agreement4,
      ]),
    });
  });

  it("should get agreements with filters: consumerId", async () => {
    const agreements1 = await agreementService.getAgreements(
      {
        consumerId: tenant1.id,
      },
      10,
      0,
      genericLogger
    );
    expect(agreements1).toEqual({
      totalCount: 5,
      results: expect.arrayContaining([
        agreement1,
        agreement3,
        agreement5,
        agreement7,
        agreement8,
      ]),
    });

    const agreements2 = await agreementService.getAgreements(
      {
        consumerId: [tenant1.id, tenant2.id],
      },
      10,
      0,
      genericLogger
    );
    expect(agreements2).toEqual({
      totalCount: 7,
      results: expect.arrayContaining([
        agreement1,
        agreement2,
        agreement3,
        agreement4,
        agreement5,
        agreement7,
        agreement8,
      ]),
    });
  });

  it("should get agreements with filters: eserviceId", async () => {
    const agreements1 = await agreementService.getAgreements(
      {
        eserviceId: eservice1.id,
      },
      10,
      0,
      genericLogger
    );
    expect(agreements1).toEqual({
      totalCount: 2,
      results: expect.arrayContaining([agreement1, agreement2]),
    });

    const agreements2 = await agreementService.getAgreements(
      {
        eserviceId: [eservice1.id, eservice2.id],
      },
      10,
      0,
      genericLogger
    );
    expect(agreements2).toEqual({
      totalCount: 4,
      results: expect.arrayContaining([
        agreement1,
        agreement2,
        agreement3,
        agreement4,
      ]),
    });
  });

  it("should get agreements with filters: descriptorId", async () => {
    const agreements1 = await agreementService.getAgreements(
      {
        descriptorId: descriptor1.id,
      },
      10,
      0,
      genericLogger
    );
    expect(agreements1).toEqual({
      totalCount: 1,
      results: expect.arrayContaining([agreement1]),
    });

    const agreements2 = await agreementService.getAgreements(
      {
        descriptorId: [descriptor1.id, descriptor3.id, descriptor5.id],
      },
      10,
      0,
      genericLogger
    );
    expect(agreements2).toEqual({
      totalCount: 9,
      results: expect.arrayContaining([
        agreement1,
        agreement3,
        agreement5,
        agreement6,
        agreement7,
        agreement8,
        agreement9,
        agreement10,
        agreement11,
      ]),
    });
  });

  it("should get agreements with filters: attributeId", async () => {
    const agreements1 = await agreementService.getAgreements(
      {
        attributeId: attribute2.id,
      },
      10,
      0,
      genericLogger
    );
    expect(agreements1).toEqual({
      totalCount: 1,
      results: expect.arrayContaining([agreement1]),
    });

    const agreements2 = await agreementService.getAgreements(
      {
        attributeId: attribute3.id,
      },
      10,
      0,
      genericLogger
    );
    expect(agreements2).toEqual({
      totalCount: 2,
      results: expect.arrayContaining([agreement1, agreement2]),
    });

    const agreements3 = await agreementService.getAgreements(
      {
        attributeId: [attribute1.id, attribute3.id, attribute4.id],
      },
      10,
      0,
      genericLogger
    );
    expect(agreements3).toEqual({
      totalCount: 2,
      results: expect.arrayContaining([agreement1, agreement2]),
    });
  });
  it("should get agreements with filters: state", async () => {
    const agreements = await agreementService.getAgreements(
      {
        agreementStates: [agreementState.active, agreementState.pending],
      },
      10,
      0,
      genericLogger
    );
    expect(agreements).toEqual({
      totalCount: 2,
      results: expect.arrayContaining([agreement2, agreement3]),
    });
  });
  it("should get agreements with filters: showOnlyUpgradeable", async () => {
    const agreements = await agreementService.getAgreements(
      {
        showOnlyUpgradeable: true,
      },
      10,
      0,
      genericLogger
    );
    expect(agreements).toEqual({
      totalCount: 1,
      results: expect.arrayContaining([
        agreement1,
        // also agreement4 has a latest descriptor to upgrade to,
        // but it is not in an upgradeable state
      ]),
    });
  });

  it("should get agreements with filters: producerId, consumerId, eserviceId", async () => {
    const agreements = await agreementService.getAgreements(
      {
        producerId: [eservice1.producerId, eservice2.producerId],
        consumerId: tenant1.id,
        eserviceId: [eservice1.id, eservice2.id],
      },
      10,
      0,
      genericLogger
    );
    expect(agreements).toEqual({
      totalCount: 2,
      results: expect.arrayContaining([agreement1, agreement3]),
    });
  });

  it("should get agreements with filters: producerId, consumerId, eserviceId, descriptorId", async () => {
    const agreements = await agreementService.getAgreements(
      {
        producerId: [eservice1.producerId, eservice2.producerId],
        consumerId: tenant1.id,
        eserviceId: [eservice1.id, eservice2.id],
        descriptorId: [descriptor1.id],
      },
      10,
      0,
      genericLogger
    );
    expect(agreements).toEqual({
      totalCount: 1,
      results: expect.arrayContaining([agreement1]),
    });
  });

  it("should get agreements with filters: attributeId, state", async () => {
    const agreements = await agreementService.getAgreements(
      {
        attributeId: attribute3.id,
        agreementStates: [agreementState.active],
      },
      10,
      0,
      genericLogger
    );
    expect(agreements).toEqual({
      totalCount: 1,
      results: expect.arrayContaining([agreement2]),
    });
  });

  it("should get agreements with filters: showOnlyUpgradeable, state, descriptorId", async () => {
    const agreements1 = await agreementService.getAgreements(
      {
        showOnlyUpgradeable: true,
        agreementStates: [agreementState.draft],
        descriptorId: descriptor1.id,
      },
      10,
      0,
      genericLogger
    );
    expect(agreements1).toEqual({
      totalCount: 1,
      results: expect.arrayContaining([agreement1]),
    });

    const agreements2 = await agreementService.getAgreements(
      {
        showOnlyUpgradeable: true,
        agreementStates: [agreementState.suspended],
        descriptorId: descriptor1.id,
      },
      10,
      0,
      genericLogger
    );
    expect(agreements2).toEqual({
      totalCount: 0,
      results: [],
    });
  });

  it("should get agreements with limit", async () => {
    const agreements = await agreementService.getAgreements(
      {
        eserviceId: eservice1.id,
      },

      1,
      0,
      genericLogger
    );
    expect(agreements).toEqual({
      totalCount: 2,
      results: expect.arrayContaining([agreement1]),
    });
  });

  it("should get agreements with offset and limit", async () => {
    const agreements = await agreementService.getAgreements(
      {
        eserviceId: [eservice1.id, eservice2.id],
      },

      2,
      1,
      genericLogger
    );
    expect(agreements).toEqual({
      totalCount: 4,
      results: expect.arrayContaining([agreement2, agreement3]),
    });
  });

  it("should get no agreements in case no filters match", async () => {
    const agreements = await agreementService.getAgreements(
      {
        producerId: generateId<TenantId>(),
      },
      10,
      0,
      genericLogger
    );

    expect(agreements).toEqual({
      totalCount: 0,
      results: [],
    });
  });

  it("should get agreements for a delegated eservice with filters: producerId and requester is producer", async () => {
    const agreements = await agreementService.getAgreements(
      {
        producerId: eservice4.producerId,
      },
      10,
      0,
      genericLogger
    );
    expect(agreements).toEqual({
      totalCount: 3,
      results: expect.arrayContaining([agreement5, agreement6, agreement7]),
    });
  });

  it("should get agreements for a delegated eservice with filters: consumerId and requester is consumer", async () => {
    const agreements = await agreementService.getAgreements(
      {
        consumerId: tenant4.id,
      },
      10,
      0,
      genericLogger
    );
    expect(agreements).toEqual({
      totalCount: 2,
      results: expect.arrayContaining([agreement8, agreement11]),
    });
  });
});
