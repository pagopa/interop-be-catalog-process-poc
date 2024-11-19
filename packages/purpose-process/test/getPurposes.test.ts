import {
  EService,
  Purpose,
  TenantId,
  generateId,
  purposeVersionState,
  tenantKind,
  toReadModelEService,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getMockPurposeVersion,
  getMockPurpose,
  writeInReadmodel,
  getMockValidRiskAnalysisForm,
  getMockAuthData,
} from "pagopa-interop-commons-test/index.js";
import { purposeApi } from "pagopa-interop-api-clients";
import { purposeToApiPurpose } from "../src/model/domain/apiConverter.js";
import {
  addOnePurpose,
  eservices,
  getMockEService,
  purposes,
} from "./utils.js";
import { mockPurposeRouterRequest } from "./supertestSetup.js";

describe("getPurposes", async () => {
  const producerId1: TenantId = generateId();
  const producerId2: TenantId = generateId();
  const consumerId1: TenantId = generateId();

  const mockEService1ByTenant1: EService = {
    ...getMockEService(),
    producerId: producerId1,
  };

  const mockEService2ByTenant1: EService = {
    ...getMockEService(),
    producerId: producerId1,
  };

  const mockEService3ByTenant2: EService = {
    ...getMockEService(),
    producerId: producerId2,
  };

  const mockEService4 = getMockEService();

  const mockPurpose1: Purpose = {
    ...getMockPurpose(),
    title: "purpose 1 - test",
    consumerId: consumerId1,
    eserviceId: mockEService1ByTenant1.id,
    versions: [getMockPurposeVersion(purposeVersionState.draft)],
  };

  const mockPurpose2: Purpose = {
    ...getMockPurpose(),
    title: "purpose 2",
    eserviceId: mockEService1ByTenant1.id,
    versions: [getMockPurposeVersion(purposeVersionState.draft)],
  };

  const mockPurpose3: Purpose = {
    ...getMockPurpose(),
    title: "purpose 3",
    eserviceId: mockEService2ByTenant1.id,
    versions: [getMockPurposeVersion(purposeVersionState.active)],
  };

  const mockPurpose4: Purpose = {
    ...getMockPurpose(),
    title: "purpose 4",
    eserviceId: mockEService3ByTenant2.id,
    versions: [getMockPurposeVersion(purposeVersionState.rejected)],
  };

  const mockPurpose5: Purpose = {
    ...getMockPurpose(),
    title: "purpose 5",
    consumerId: consumerId1,
    eserviceId: mockEService4.id,
    versions: [getMockPurposeVersion(purposeVersionState.rejected)],
  };

  const mockPurpose6: Purpose = {
    ...getMockPurpose(),
    title: "purpose 6 - test",
    consumerId: consumerId1,
    eserviceId: mockEService3ByTenant2.id,
    versions: [
      getMockPurposeVersion(purposeVersionState.archived),
      getMockPurposeVersion(purposeVersionState.active),
    ],
  };

  const mockPurpose7: Purpose = {
    ...getMockPurpose(),
    title: "purpose 7 - test",
    versions: [],
    eserviceId: mockEService4.id,
  };

  beforeEach(async () => {
    await addOnePurpose(mockPurpose1);
    await addOnePurpose(mockPurpose2);
    await addOnePurpose(mockPurpose3);
    await addOnePurpose(mockPurpose4);
    await addOnePurpose(mockPurpose5);
    await addOnePurpose(mockPurpose6);
    await addOnePurpose(mockPurpose7);

    await writeInReadmodel(
      toReadModelEService(mockEService1ByTenant1),
      eservices
    );
    await writeInReadmodel(
      toReadModelEService(mockEService2ByTenant1),
      eservices
    );
    await writeInReadmodel(
      toReadModelEService(mockEService3ByTenant2),
      eservices
    );
    await writeInReadmodel(toReadModelEService(mockEService4), eservices);
  });

  it("should get the purposes if they exist (parameters: name)", async () => {
    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        name: "test",
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });

    expect(result.totalCount).toBe(3);
    expect(result.results).toEqual([
      purposeToApiPurpose(mockPurpose1, false),
      purposeToApiPurpose(mockPurpose6, false),
      purposeToApiPurpose(mockPurpose7, false),
    ]);
  });
  it("should get the purposes if they exist (parameters: eservicesIds)", async () => {
    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        eservicesIds: [mockEService1ByTenant1.id],
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });

    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([
      purposeToApiPurpose(mockPurpose1, false),
      purposeToApiPurpose(mockPurpose2, false),
    ]);
  });
  it("should get the purposes if they exist (parameters: consumersIds)", async () => {
    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        consumersIds: [consumerId1],
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });

    expect(result.totalCount).toBe(3);
    expect(result.results).toEqual([
      purposeToApiPurpose(mockPurpose1, false),
      purposeToApiPurpose(mockPurpose5, false),
      purposeToApiPurpose(mockPurpose6, false),
    ]);
  });
  it("should get the purposes if they exist (parameters: eservicesIds, producerIds)", async () => {
    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        eservicesIds: [mockEService1ByTenant1.id],
        producersIds: [producerId1, producerId2],
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });

    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([
      purposeToApiPurpose(mockPurpose1, false),
      purposeToApiPurpose(mockPurpose2, false),
    ]);
  });
  it("should get the purposes if they exist (parameters: producersIds)", async () => {
    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        producersIds: [producerId2],
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([
      purposeToApiPurpose(mockPurpose4, false),
      purposeToApiPurpose(mockPurpose6, false),
    ]);
  });
  it("should get the purposes if they exist (parameters: states)", async () => {
    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        states: [
          purposeApi.PurposeVersionState.Values.ACTIVE,
          purposeApi.PurposeVersionState.Values.REJECTED,
        ],
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });

    expect(result.totalCount).toBe(4);
    expect(result.results).toEqual([
      purposeToApiPurpose(mockPurpose3, false),
      purposeToApiPurpose(mockPurpose4, false),
      purposeToApiPurpose(mockPurpose5, false),
      purposeToApiPurpose(mockPurpose6, false),
    ]);
  });
  it("should get the purposes if they exist (parameters: states, archived and non-archived)", async () => {
    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        states: [
          purposeApi.PurposeVersionState.Values.ARCHIVED,
          purposeApi.PurposeVersionState.Values.ACTIVE,
          purposeApi.PurposeVersionState.Values.REJECTED,
        ],
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });

    expect(result.totalCount).toBe(4);
    expect(result.results).toEqual([
      purposeToApiPurpose(mockPurpose3, false),
      purposeToApiPurpose(mockPurpose4, false),
      purposeToApiPurpose(mockPurpose5, false),
      purposeToApiPurpose(mockPurpose6, false),
    ]);
  });
  it("should get the purposes with only archived versions (and exclude the ones with both archived and non-archived versions)", async () => {
    const mockArchivedPurpose: Purpose = {
      ...getMockPurpose(),
      title: "archived purpose",
      eserviceId: mockEService1ByTenant1.id,
      versions: [getMockPurposeVersion(purposeVersionState.archived)],
    };

    const mockArchivedAndActivePurpose: Purpose = {
      ...getMockPurpose(),
      title: "archived and active purpose",
      eserviceId: mockEService1ByTenant1.id,
      versions: [
        getMockPurposeVersion(purposeVersionState.archived),
        getMockPurposeVersion(purposeVersionState.active),
      ],
    };

    await addOnePurpose(mockArchivedPurpose);
    await addOnePurpose(mockArchivedAndActivePurpose);

    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        states: [purposeApi.PurposeVersionState.Values.ARCHIVED],
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });

    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([
      purposeToApiPurpose(mockArchivedPurpose, false),
    ]);
  });
  it("should not include purpose without versions or with one draft version (excludeDraft = true)", async () => {
    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        excludeDraft: true,
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });
    expect(result.totalCount).toBe(4);
    expect(result.results).toEqual([
      purposeToApiPurpose(mockPurpose3, false),
      purposeToApiPurpose(mockPurpose4, false),
      purposeToApiPurpose(mockPurpose5, false),
      purposeToApiPurpose(mockPurpose6, false),
    ]);
  });
  it("should include purpose without versions or with one draft version (excludeDraft = false)", async () => {
    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        excludeDraft: false,
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });
    expect(result.totalCount).toBe(7);
    expect(result.results).toEqual([
      purposeToApiPurpose(mockPurpose1, false),
      purposeToApiPurpose(mockPurpose2, false),
      purposeToApiPurpose(mockPurpose3, false),
      purposeToApiPurpose(mockPurpose4, false),
      purposeToApiPurpose(mockPurpose5, false),
      purposeToApiPurpose(mockPurpose6, false),
      purposeToApiPurpose(mockPurpose7, false),
    ]);
  });
  it("should get the purposes if they exist (pagination: offset)", async () => {
    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        offset: 5,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });
    expect(result.results).toEqual([
      purposeToApiPurpose(mockPurpose6, false),
      purposeToApiPurpose(mockPurpose7, false),
    ]);
  });
  it("should get the purposes if they exist (pagination: limit)", async () => {
    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        offset: 0,
        limit: 3,
      },
      authData: getMockAuthData(producerId1),
    });
    expect(result.results).toEqual([
      purposeToApiPurpose(mockPurpose1, false),
      purposeToApiPurpose(mockPurpose2, false),
      purposeToApiPurpose(mockPurpose3, false),
    ]);
  });
  it("should not get the purposes if they don't exist", async () => {
    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        name: "test",
        eservicesIds: [generateId()],
        producersIds: [generateId()],
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });
    expect(result.totalCount).toBe(0);
    expect(result.results).toEqual([]);
  });
  it("should get the purposes if they exist (parameters: name, eservicesIds, consumersIds, producersIds, states; exlcudeDraft = true)", async () => {
    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        name: "test",
        eservicesIds: [mockEService3ByTenant2.id],
        consumersIds: [consumerId1],
        producersIds: [producerId2],
        states: [purposeApi.PurposeVersionState.Values.ACTIVE],
        excludeDraft: true,
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });
    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([purposeToApiPurpose(mockPurpose6, false)]);
  });
  it("should get the purposes if they exist (parameters: name, eservicesIds, consumersIds, producersIds, states; exlcudeDraft = false)", async () => {
    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        name: "test",
        eservicesIds: [mockEService1ByTenant1.id],
        consumersIds: [consumerId1],
        producersIds: [producerId1],
        states: [purposeApi.PurposeVersionState.Values.DRAFT],
        excludeDraft: false,
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });
    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([purposeToApiPurpose(mockPurpose1, false)]);
  });
  it("should not include the riskAnalysisForm if the requester is not the producer nor the consumer", async () => {
    const mockPurpose8: Purpose = {
      ...getMockPurpose(),
      title: "purpose 8",
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      eserviceId: mockEService4.id,
    };
    await addOnePurpose(mockPurpose8);

    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        excludeDraft: false,
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(),
    });
    expect(result.totalCount).toBe(8);
    expect(result.results).toEqual(
      [
        purposeToApiPurpose(mockPurpose1, false),
        purposeToApiPurpose(mockPurpose2, false),
        purposeToApiPurpose(mockPurpose3, false),
        purposeToApiPurpose(mockPurpose4, false),
        purposeToApiPurpose(mockPurpose5, false),
        purposeToApiPurpose(mockPurpose6, false),
        purposeToApiPurpose(mockPurpose7, false),
        purposeToApiPurpose(mockPurpose8, false),
      ].map((p) => ({ ...p, riskAnalysisForm: undefined }))
    );
  });
  it("should only include the riskAnalysisForm for those purposes in which the requester is the producer or the consumer", async () => {
    await purposes.deleteMany({});

    const mockPurpose8: Purpose = {
      ...getMockPurpose(),
      title: "purpose 8",
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      eserviceId: mockEService2ByTenant1.id,
    };
    await addOnePurpose(mockPurpose8);

    const mockPurpose9: Purpose = {
      ...getMockPurpose(),
      title: "purpose 9",
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      eserviceId: mockEService4.id,
    };
    await addOnePurpose(mockPurpose9);

    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        excludeDraft: false,
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([
      purposeToApiPurpose(mockPurpose8, false),
      purposeToApiPurpose(
        { ...mockPurpose9, riskAnalysisForm: undefined },
        false
      ),
    ]);
  });
  it("should get the correct purpose if the producersIds param is passed but the caller has no e-service", async () => {
    await purposes.deleteMany({});
    await eservices.deleteMany({});

    await writeInReadmodel(toReadModelEService(mockEService4), eservices);

    const mockPurpose8: Purpose = {
      ...getMockPurpose(),
      title: "purpose 8",
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      eserviceId: mockEService4.id,
    };
    await addOnePurpose(mockPurpose8);

    const result = await mockPurposeRouterRequest.get({
      path: "/purposes",
      queryParams: {
        producersIds: [producerId1],
        excludeDraft: false,
        offset: 0,
        limit: 50,
      },
      authData: getMockAuthData(producerId1),
    });
    expect(result.totalCount).toBe(0);
    expect(result.results).toEqual([]);
  });
});
