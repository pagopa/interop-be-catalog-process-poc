/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  randomArrayItem,
  getMockTenant,
  getMockValidRiskAnalysis,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  eserviceMode,
  EServiceDescriptorPublishedV2,
  toEServiceV2,
  TenantKind,
  tenantKind,
  Tenant,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import { beforeAll, vi, afterAll, expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptor,
  eServiceDescriptorWithoutInterface,
  tenantNotFound,
  tenantKindNotFound,
  eServiceRiskAnalysisIsRequired,
  riskAnalysisNotValid,
  audienceCannotBeEmpty,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  addOneTenant,
  addOneAgreement,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
  getMockAgreement,
} from "./utils.js";
import { mockEserviceRouterRequest } from "./supertestSetup.js";

describe("publish descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it("should write on event-store for the publication of a descriptor with mode Deliver", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.deliver,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await mockEserviceRouterRequest.post({
      path: "/eservices/:eServiceId/descriptors/:descriptorId/publish",
      pathParams: { eServiceId: eservice.id, descriptorId: descriptor.id },
      authData: getMockAuthData(eservice.producerId),
    });

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorPublished",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorPublishedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          publishedAt: new Date(),
          state: descriptorState.published,
        },
      ],
    });

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);
  });

  it("should write on event-store for the publication of a descriptor with mode Receive", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
    };

    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const riskAnalysis = getMockValidRiskAnalysis(producerTenantKind);

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [descriptor],
      riskAnalysis: [riskAnalysis],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    await mockEserviceRouterRequest.post({
      path: "/eservices/:eServiceId/descriptors/:descriptorId/publish",
      pathParams: { eServiceId: eservice.id, descriptorId: descriptor.id },
      authData: getMockAuthData(eservice.producerId),
    });

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorPublished",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorPublishedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          publishedAt: new Date(),
          state: descriptorState.published,
        },
      ],
    });

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);
  });

  it("should also archive the previously published descriptor", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: mockDocument,
    };
    const descriptor2: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      state: descriptorState.draft,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor1, descriptor2],
    };
    await addOneEService(eservice);

    await mockEserviceRouterRequest.post({
      path: "/eservices/:eServiceId/descriptors/:descriptorId/publish",
      pathParams: { eServiceId: eservice.id, descriptorId: descriptor2.id },
      authData: getMockAuthData(eservice.producerId),
    });

    const writtenEvent = await readLastEserviceEvent(eservice.id);

    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorPublished",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorPublishedV2,
      payload: writtenEvent.data,
    });

    const updatedDescriptor1: Descriptor = {
      ...descriptor1,
      archivedAt: new Date(),
      state: descriptorState.archived,
    };
    const updatedDescriptor2: Descriptor = {
      ...descriptor2,
      publishedAt: new Date(),
      state: descriptorState.published,
    };

    const expectedEservice: EService = {
      ...eservice,
      descriptors: [updatedDescriptor1, updatedDescriptor2],
    };
    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEservice),
      descriptorId: descriptor2.id,
    });
  });

  it("should also write deprecate the previously published descriptor if there was a valid agreement", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: mockDocument,
    };
    const descriptor2: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      state: descriptorState.draft,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor1, descriptor2],
    };
    await addOneEService(eservice);
    const tenant: Tenant = {
      ...getMockTenant(),
    };
    await addOneTenant(tenant);
    const agreement = getMockAgreement({
      eserviceId: eservice.id,
      descriptorId: descriptor1.id,
      producerId: eservice.producerId,
      consumerId: tenant.id,
    });
    await addOneAgreement(agreement);

    await mockEserviceRouterRequest.post({
      path: "/eservices/:eServiceId/descriptors/:descriptorId/publish",
      pathParams: { eServiceId: eservice.id, descriptorId: descriptor2.id },
      authData: getMockAuthData(eservice.producerId),
    });

    const writtenEvent = await readLastEserviceEvent(eservice.id);

    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorPublished",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorPublishedV2,
      payload: writtenEvent.data,
    });

    const updatedDescriptor1: Descriptor = {
      ...descriptor1,
      deprecatedAt: new Date(),
      state: descriptorState.deprecated,
    };
    const updatedDescriptor2: Descriptor = {
      ...descriptor2,
      publishedAt: new Date(),
      state: descriptorState.published,
    };

    const expectedEservice: EService = {
      ...eservice,
      descriptors: [updatedDescriptor1, updatedDescriptor2],
    };
    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEservice),
      descriptorId: descriptor2.id,
    });
  });

  it("should throw eServiceNotFound if the eService doesn't exist", async () => {
    await expect(
      catalogService.publishDescriptor(mockEService.id, mockDescriptor.id, {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);
    expect(
      catalogService.publishDescriptor(eservice.id, mockDescriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.publishDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw notValidDescriptor if the descriptor is in published state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.publishDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      notValidDescriptor(descriptor.id, descriptorState.published)
    );
  });

  it("should throw notValidDescriptor if the descriptor is in deprecated state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.deprecated,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.publishDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      notValidDescriptor(descriptor.id, descriptorState.deprecated)
    );
  });

  it("should throw notValidDescriptor if the descriptor is in suspended state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.suspended,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.publishDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      notValidDescriptor(descriptor.id, descriptorState.suspended)
    );
  });

  it("should throw notValidDescriptor if the descriptor is in archived state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.archived,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.publishDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      notValidDescriptor(descriptor.id, descriptorState.archived)
    );
  });

  it("should throw eServiceDescriptorWithoutInterface if the descriptor doesn't have an interface", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    expect(
      catalogService.publishDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceDescriptorWithoutInterface(descriptor.id));
  });

  it("should throw tenantNotFound if the eService has mode Receive and the producer tenant doesn't exist", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: generateId(),
      mode: eserviceMode.receive,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    expect(
      catalogService.publishDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(eservice.producerId));
  });

  it("should throw tenantKindNotFound if the eService has mode Receive and the producer tenant kind doesn't exist", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
    };

    const producer: Tenant = {
      ...getMockTenant(),
      kind: undefined,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [descriptor],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    expect(
      catalogService.publishDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantKindNotFound(producer.id));
  });

  it("should throw eServiceRiskAnalysisIsRequired if the eService has mode Receive and no risk analysis", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
    };

    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [descriptor],
      riskAnalysis: [],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    expect(
      catalogService.publishDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceRiskAnalysisIsRequired(eservice.id));
  });

  it("should throw riskAnalysisNotValid if the eService has mode Receive and one of the risk analyses is not valid", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
    };

    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const validRiskAnalysis = getMockValidRiskAnalysis(producerTenantKind);
    const riskAnalysis1 = validRiskAnalysis;
    const riskAnalysis2 = {
      ...validRiskAnalysis,
      riskAnalysisForm: {
        ...validRiskAnalysis.riskAnalysisForm,
        singleAnswers: [],
        // ^ validation here is schema only: it checks for missing expected fields, so this is invalid
      },
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [descriptor],
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    expect(
      catalogService.publishDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(riskAnalysisNotValid());
  });

  it("should throw audienceCannotBeEmpty if the descriptor audience is an empty array", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
      audience: [],
    };

    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };

    await addOneEService(eservice);

    expect(
      catalogService.publishDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(audienceCannotBeEmpty(descriptor.id));
  });
});
