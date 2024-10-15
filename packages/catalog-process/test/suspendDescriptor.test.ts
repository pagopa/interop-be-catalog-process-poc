/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockDelegationProducer,
} from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorSuspendedV2,
  toEServiceV2,
  operationForbidden,
  delegationState,
  Delegation,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptor,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  getMockAuthData,
  readLastEserviceEvent,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
  addOneDelegation,
} from "./utils.js";

describe("suspend descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  it("should write on event-store for the suspension of a descriptor", async () => {
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
    await catalogService.suspendDescriptor(eservice.id, descriptor.id, {
      authData: getMockAuthData(eservice.producerId),
      correlationId: "",
      serviceName: "",
      logger: genericLogger,
    });

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorSuspended");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorSuspendedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          state: descriptorState.suspended,
          suspendedAt: new Date(
            Number(writtenPayload.eservice!.descriptors[0]!.suspendedAt)
          ),
        },
      ],
    });

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);
  });
  it("should write on event-store for the suspension of a descriptor (delegate)", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };

    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };

    const delegation: Delegation = {
      ...getMockDelegationProducer(),
      eserviceId: eservice.id,
      state: delegationState.active,
    };

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    await catalogService.suspendDescriptor(eservice.id, descriptor.id, {
      authData: getMockAuthData(delegation.delegateId),
      correlationId: "",
      serviceName: "",
      logger: genericLogger,
    });

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorSuspended");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorSuspendedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          state: descriptorState.suspended,
          suspendedAt: new Date(
            Number(writtenPayload.eservice!.descriptors[0]!.suspendedAt)
          ),
        },
      ],
    });

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.suspendDescriptor(mockEService.id, mockDescriptor.id, {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
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
      catalogService.suspendDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const delegation: Delegation = {
      ...getMockDelegationProducer(),
      eserviceId: eservice.id,
      state: delegationState.active,
    };

    await addOneEService(eservice);
    await addOneDelegation(delegation);
    expect(
      catalogService.suspendDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    expect(
      catalogService.suspendDescriptor(eservice.id, mockDescriptor.id, {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it("should throw notValidDescriptor if the descriptor is in draft state", async () => {
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
      catalogService.suspendDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      notValidDescriptor(descriptor.id, descriptorState.draft)
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
      catalogService.suspendDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
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
      catalogService.suspendDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      notValidDescriptor(descriptor.id, descriptorState.archived)
    );
  });
});
