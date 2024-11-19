/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  Attribute,
  generateId,
  EServiceDraftDescriptorUpdatedV2,
  toEServiceV2,
  operationForbidden,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptor,
  inconsistentDailyCalls,
  attributeNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  addOneAttribute,
  catalogService,
  readLastEserviceEvent,
  getMockDescriptor,
  getMockEService,
  getMockDocument,
  buildUpdateDescriptorSeed,
} from "./utils.js";
import { mockEserviceRouterRequest } from "./supertestSetup.js";

describe("update draft descriptor", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it("should write on event-store for the update of a draft descriptor", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    const attribute: Attribute = {
      name: "Attribute name",
      id: generateId(),
      kind: "Declared",
      description: "Attribute Description",
      creationTime: new Date(),
    };
    await addOneAttribute(attribute);

    const updatedDescriptorSeed: catalogApi.UpdateEServiceDescriptorSeed = {
      ...buildUpdateDescriptorSeed(descriptor),
      dailyCallsTotal: 200,
      attributes: {
        certified: [],
        declared: [
          [{ id: attribute.id, explicitAttributeVerification: false }],
        ],
        verified: [],
      },
    };

    const updatedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          dailyCallsTotal: 200,
          attributes: {
            certified: [],
            declared: [
              [{ id: attribute.id, explicitAttributeVerification: false }],
            ],
            verified: [],
          },
        },
      ],
    };

    await mockEserviceRouterRequest.put({
      path: "/eservices/:eServiceId/descriptors/:descriptorId",
      pathParams: {
        eServiceId: eservice.id,
        descriptorId: descriptor.id,
      },
      body: { ...updatedDescriptorSeed },
      authData: getMockAuthData(eservice.producerId),
    });

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDraftDescriptorUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDraftDescriptorUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    expect(
      catalogService.updateDraftDescriptor(
        mockEService.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateDraftDescriptor(
        mockEService.id,
        mockDescriptor.id,
        buildUpdateDescriptorSeed(mockDescriptor),
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
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
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      notValidDescriptor(mockDescriptor.id, descriptorState.published)
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
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      notValidDescriptor(mockDescriptor.id, descriptorState.deprecated)
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
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      notValidDescriptor(mockDescriptor.id, descriptorState.suspended)
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
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      notValidDescriptor(mockDescriptor.id, descriptorState.archived)
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

    const updatedDescriptor = {
      ...descriptor,
      dailyCallsTotal: 200,
    };
    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(updatedDescriptor),
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const updatedDescriptor: Descriptor = {
      ...descriptor,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 50,
    };
    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(updatedDescriptor),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });

  it("should throw attributeNotFound if at least one of the attributes doesn't exist", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      attributes: {
        certified: [],
        declared: [],
        verified: [],
      },
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const attribute: Attribute = {
      name: "Attribute name",
      id: generateId(),
      kind: "Declared",
      description: "Attribute Description",
      creationTime: new Date(),
    };
    await addOneAttribute(attribute);
    const notExistingId1 = generateId();
    const notExistingId2 = generateId();

    const descriptorSeed = {
      ...buildUpdateDescriptorSeed(mockDescriptor),
      attributes: {
        certified: [],
        declared: [
          [
            { id: attribute.id, explicitAttributeVerification: false },
            {
              id: notExistingId1,
              explicitAttributeVerification: false,
            },
            {
              id: notExistingId2,
              explicitAttributeVerification: false,
            },
          ],
        ],
        verified: [],
      },
    };

    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        descriptorSeed,
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(attributeNotFound(notExistingId1));
  });
});
