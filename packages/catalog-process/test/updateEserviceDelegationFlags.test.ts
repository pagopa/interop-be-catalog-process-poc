/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockDelegation,
} from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  operationForbidden,
  delegationState,
  generateId,
  delegationKind,
  EServiceIsDelegableEnabledV2,
  EServiceIsClientAccessDelegableEnabledV2,
  EServiceIsDelegableDisabledV2,
  EServiceIsClientAccessDelegableDisabledV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eserviceWithoutValidDescriptors,
  eServiceNotFound,
  invalidEServiceFlags,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  getMockAuthData,
  readLastEserviceEvent,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
  addOneDelegation,
} from "./utils.js";

describe("update eService flags", () => {
  it("should write on event-store for the update of the eService isDelegable flag (false -> true)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isDelegable: false,
    };
    await addOneEService(eservice);

    const returnedEService = await catalogService.updateEServiceDelegationFlags(
      eservice.id,
      {
        isDelegable: true,
        isClientAccessDelegable: false,
      },
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    const updatedEService: EService = {
      ...eservice,
      isDelegable: true,
      isClientAccessDelegable: false,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceIsDelegableEnabled",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceIsDelegableEnabledV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });
  it("should write on event-store for the update of the eService isDelegable flag (true -> false)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isDelegable: true,
    };
    await addOneEService(eservice);

    const returnedEService = await catalogService.updateEServiceDelegationFlags(
      eservice.id,
      {
        isDelegable: false,
        isClientAccessDelegable: false,
      },
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    const updatedEService: EService = {
      ...eservice,
      isDelegable: false,
      isClientAccessDelegable: false,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceIsDelegableDisabled",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceIsDelegableDisabledV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });
  it("should write on event-store for the update of the eService isClientAccessDelegable flag (false -> true)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isDelegable: true,
      isClientAccessDelegable: false,
    };
    await addOneEService(eservice);

    const returnedEService = await catalogService.updateEServiceDelegationFlags(
      eservice.id,
      {
        isDelegable: true,
        isClientAccessDelegable: true,
      },
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    const updatedEService: EService = {
      ...eservice,
      isDelegable: true,
      isClientAccessDelegable: true,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceIsClientAccessDelegableEnabled",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceIsClientAccessDelegableEnabledV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });
  it("should write on event-store for the update of the eService isClientAccessDelegable flag (true -> false)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isDelegable: true,
      isClientAccessDelegable: true,
    };
    await addOneEService(eservice);

    const returnedEService = await catalogService.updateEServiceDelegationFlags(
      eservice.id,
      {
        isDelegable: true,
        isClientAccessDelegable: false,
      },
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    const updatedEService: EService = {
      ...eservice,
      isDelegable: true,
      isClientAccessDelegable: false,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceIsClientAccessDelegableDisabled",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceIsClientAccessDelegableDisabledV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });
  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const eservice = getMockEService();

    expect(
      catalogService.updateEServiceDelegationFlags(
        eservice.id,
        {
          isDelegable: true,
          isClientAccessDelegable: false,
        },
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
  it("should throw operationForbidden if the requester is not the producer", async () => {
    const eservice = getMockEService();
    await addOneEService(eservice);

    expect(
      catalogService.updateEServiceDelegationFlags(
        eservice.id,
        {
          isDelegable: true,
          isClientAccessDelegable: false,
        },
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const eservice = getMockEService();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    expect(
      catalogService.updateEServiceDelegationFlags(
        eservice.id,
        {
          isDelegable: true,
          isClientAccessDelegable: false,
        },
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw eserviceWithoutValidDescriptors if the eservice doesn't have any descriptors", async () => {
    const eservice = getMockEService();
    await addOneEService(eservice);

    expect(
      catalogService.updateEServiceDelegationFlags(
        eservice.id,
        {
          isDelegable: true,
          isClientAccessDelegable: false,
        },
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eserviceWithoutValidDescriptors(eservice.id));
  });
  it.each([descriptorState.draft, descriptorState.archived])(
    "should throw eserviceWithoutValidDescriptors if the eservice doesn't have valid descriptors (Descriptor with state %s)",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        interface: getMockDocument(),
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      expect(
        catalogService.updateEServiceDelegationFlags(
          eservice.id,
          {
            isDelegable: true,
            isClientAccessDelegable: false,
          },
          {
            authData: getMockAuthData(eservice.producerId),
            correlationId: generateId(),
            serviceName: "",
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(eserviceWithoutValidDescriptors(eservice.id));
    }
  );
  it("should throw invalidEServiceFlags if the isDelegable is false and isClientAccessDelegable is true", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isDelegable: false,
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateEServiceDelegationFlags(
        eservice.id,
        {
          isDelegable: false,
          isClientAccessDelegable: true,
        },
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(invalidEServiceFlags(eservice.id));
  });
});
