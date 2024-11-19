/* eslint-disable @typescript-eslint/no-floating-promises */
import { AuthData, userRoles, genericLogger } from "pagopa-interop-commons";
import {
  Descriptor,
  descriptorState,
  EService,
  generateId,
  EServiceId,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import { getMockAuthData } from "pagopa-interop-commons-test";
import { eServiceNotFound } from "../src/model/domain/errors.js";
import { eServiceToApiEService } from "../src/model/domain/apiConverter.js";
import {
  addOneEService,
  catalogService,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "./utils.js";
import { mockEserviceRouterRequest } from "./supertestSetup.js";

describe("get eservice by id", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it("should get the eservice if it exists (requester is the producer, admin)", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice1: EService = {
      ...mockEService,
      id: generateId(),
      name: "eservice 001",
      descriptors: [descriptor1],
    };
    await addOneEService(eservice1);

    const descriptor2: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice2: EService = {
      ...mockEService,
      id: generateId(),
      name: "eservice 002",
      descriptors: [descriptor2],
    };
    await addOneEService(eservice2);

    const descriptor3: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice3: EService = {
      ...mockEService,
      id: generateId(),
      name: "eservice 003",
      descriptors: [descriptor3],
    };
    await addOneEService(eservice3);

    const result = await mockEserviceRouterRequest.get({
      path: "/eservices/:eServiceId",
      pathParams: { eServiceId: eservice1.id },
      authData: getMockAuthData(eservice1.producerId),
    });

    expect(result).toEqual(eServiceToApiEService(eservice1));
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    await addOneEService(mockEService);
    const notExistingId: EServiceId = generateId();
    expect(
      catalogService.getEServiceById(notExistingId, {
        authData: getMockAuthData(),
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "",
      })
    ).rejects.toThrowError(eServiceNotFound(notExistingId));
  });

  it("should throw eServiceNotFound if there is only a draft descriptor (requester is not the producer)", async () => {
    const descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(mockEService);
    expect(
      catalogService.getEServiceById(eservice.id, {
        authData: getMockAuthData(),
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "",
      })
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
  it("should throw eServiceNotFound if there is only a draft descriptor (requester is the producer but not admin nor api, nor support)", async () => {
    const descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const authData: AuthData = {
      ...getMockAuthData(),
      userRoles: [userRoles.SECURITY_ROLE],
    };
    await addOneEService(mockEService);
    expect(
      catalogService.getEServiceById(eservice.id, {
        authData,
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "",
      })
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
  it("should throw eServiceNotFound if there are no descriptors (requester is not the producer)", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(mockEService);
    expect(
      catalogService.getEServiceById(eservice.id, {
        authData: getMockAuthData(),
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "",
      })
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
  it("should throw eServiceNotFound if there are no descriptors (requester is the producer but not admin, nor api, nor support)", async () => {
    const descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const authData: AuthData = {
      ...getMockAuthData(eservice.producerId),
      userRoles: [userRoles.SECURITY_ROLE],
    };
    await addOneEService(mockEService);
    expect(
      catalogService.getEServiceById(eservice.id, {
        authData,
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "",
      })
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
  it("should filter out the draft descriptors if the eservice has both draft and non-draft ones (requester is not the producer)", async () => {
    const descriptorA: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const descriptorB: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptorA, descriptorB],
    };
    const authData: AuthData = {
      ...getMockAuthData(),
      userRoles: [userRoles.ADMIN_ROLE],
    };
    await addOneEService(eservice);
    const result = await catalogService.getEServiceById(eservice.id, {
      authData,
      logger: genericLogger,
      correlationId: generateId(),
      serviceName: "",
    });
    expect(result.descriptors).toEqual([descriptorB]);
  });
  it("should filter out the draft descriptors if the eservice has both draft and non-draft ones (requester is the producer but not admin nor api, nor support)", async () => {
    const descriptorA: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const descriptorB: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptorA, descriptorB],
    };
    const authData: AuthData = {
      ...getMockAuthData(eservice.producerId),
      userRoles: [userRoles.SECURITY_ROLE],
    };
    await addOneEService(eservice);
    const result = await catalogService.getEServiceById(eservice.id, {
      authData,
      logger: genericLogger,
      correlationId: generateId(),
      serviceName: "",
    });
    expect(result.descriptors).toEqual([descriptorB]);
  });
});
