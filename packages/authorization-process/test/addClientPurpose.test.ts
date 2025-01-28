/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockAuthData,
  getMockClient,
  getMockDelegation,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import {
  Agreement,
  Client,
  ClientPurposeAddedV2,
  Descriptor,
  Purpose,
  TenantId,
  agreementState,
  delegationKind,
  delegationState,
  descriptorState,
  generateId,
  purposeVersionState,
  toClientV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  clientNotFound,
  purposeDelegationNotFound,
  eserviceNotDelegableForClientAccess,
  eserviceNotFound,
  noAgreementFoundInRequiredState,
  noPurposeVersionsFoundInRequiredState,
  organizationNotAllowedOnClient,
  organizationNotAllowedOnPurpose,
  purposeAlreadyLinkedToClient,
  purposeNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneClient,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";

describe("addClientPurpose", async () => {
  it("should write on event-store for the addition of a purpose into a client", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    await authorizationService.addClientPurpose({
      clientId: mockClient.id,
      seed: { purposeId: mockPurpose.id },
      ctx: {
        serviceName: "test",
        authData: getMockAuthData(mockConsumerId),
        correlationId: generateId(),
        logger: genericLogger,
      },
    });

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientPurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientPurposeAddedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      purposeId: mockPurpose.id,
      client: toClientV2({
        ...mockClient,
        purposes: [...mockClient.purposes, mockPurpose.id],
      }),
    });
  });

  it("should write on event-store for the addition of a purpose into a client when the eservice has an active Consumer delegation and the requester is the delegator", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
      delegationId: undefined,
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOneClient(mockClient);
    await addOneDelegation(delegation);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    await authorizationService.addClientPurpose({
      clientId: mockClient.id,
      seed: { purposeId: mockPurpose.id },
      ctx: {
        serviceName: "test",
        authData: getMockAuthData(mockClient.consumerId),
        correlationId: generateId(),
        logger: genericLogger,
      },
    });

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientPurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientPurposeAddedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      purposeId: mockPurpose.id,
      client: toClientV2({
        ...mockClient,
        purposes: [...mockClient.purposes, mockPurpose.id],
      }),
    });
  });

  it("should write on event-store for the addition of a purpose created by the delegate into a client when the eservice has an active Consumer delegation and the requester is the delegator", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockEservice.id,
      delegatorId: mockConsumerId,
      state: delegationState.active,
    });

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOneDelegation(delegation);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    await authorizationService.addClientPurpose({
      clientId: mockClient.id,
      seed: { purposeId: mockPurpose.id },
      ctx: {
        serviceName: "test",
        authData: getMockAuthData(mockClient.consumerId),
        correlationId: generateId(),
        logger: genericLogger,
      },
    });

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientPurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientPurposeAddedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      purposeId: mockPurpose.id,
      client: toClientV2({
        ...mockClient,
        purposes: [...mockClient.purposes, mockPurpose.id],
      }),
    });
  });

  it("should throw clientNotFound if the client doesn't exist", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        ctx: {
          serviceName: "test",
          authData: getMockAuthData(mockConsumerId),
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the client consumer", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: generateId(),
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        ctx: {
          serviceName: "test",
          authData: getMockAuthData(mockConsumerId),
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(mockConsumerId, mockClient.id)
    );
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        ctx: {
          serviceName: "test",
          authData: getMockAuthData(mockConsumerId),
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(purposeNotFound(mockPurpose.id));
  });
  it("should throw organizationNotAllowedOnPurpose if the requester is not the purpose consumer", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: generateId(),
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        ctx: {
          serviceName: "test",
          authData: getMockAuthData(mockConsumerId),
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnPurpose(mockConsumerId, mockPurpose.id)
    );
  });
  it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        ctx: {
          serviceName: "test",
          authData: getMockAuthData(mockConsumerId),
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(eserviceNotFound(mockEservice.id));
  });
  it("should throw noAgreementFoundInRequiredState if there is no agreement in required states (found no agreement)", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        ctx: {
          serviceName: "test",
          authData: getMockAuthData(mockConsumerId),
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(
      noAgreementFoundInRequiredState(mockEservice.id, mockConsumerId)
    );
  });
  it.each(
    Object.values(agreementState).filter(
      (state) =>
        state !== agreementState.active && state !== agreementState.suspended
    )
  )(
    "should throw noAgreementFoundInRequiredState if there is no agreement in required states (found: %s agreements)",
    async (agreementState) => {
      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        interface: getMockDocument(),
        publishedAt: new Date(),
      };

      const mockEservice = {
        ...getMockEService(),
        descriptors: [mockDescriptor],
      };
      const mockConsumerId: TenantId = generateId();

      const mockAgreement: Agreement = {
        ...getMockAgreement(),
        eserviceId: mockEservice.id,
        consumerId: mockConsumerId,
        state: agreementState,
      };

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEservice.id,
        consumerId: mockConsumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const mockClient: Client = {
        ...getMockClient(),
        consumerId: mockConsumerId,
      };

      await addOneClient(mockClient);
      await addOnePurpose(mockPurpose);
      await addOneEService(mockEservice);
      await addOneAgreement(mockAgreement);

      expect(
        authorizationService.addClientPurpose({
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
          ctx: {
            serviceName: "test",
            authData: getMockAuthData(mockConsumerId),
            correlationId: generateId(),
            logger: genericLogger,
          },
        })
      ).rejects.toThrowError(
        noAgreementFoundInRequiredState(mockEservice.id, mockConsumerId)
      );
    }
  );
  it("should throw descriptorNotFound if the descriptor doesn't exist", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [],
    };

    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        ctx: {
          serviceName: "test",
          authData: getMockAuthData(mockConsumerId),
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(mockDescriptor.id);
  });
  it("should throw noPurposeVersionsFoundInRequiredState if the purpose has no versions in required states (found no versions)", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        ctx: {
          serviceName: "test",
          authData: getMockAuthData(mockConsumerId),
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(
      noPurposeVersionsFoundInRequiredState(mockPurpose.id)
    );
  });
  it.each(
    Object.values(purposeVersionState).filter(
      (state) =>
        state !== purposeVersionState.active &&
        state !== purposeVersionState.suspended
    )
  )(
    "should throw noPurposeVersionsFoundInRequiredState if the purpose has no versions in required states (found: %s version)",
    async (versionState) => {
      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        interface: getMockDocument(),
        publishedAt: new Date(),
      };

      const mockEservice = {
        ...getMockEService(),
        descriptors: [mockDescriptor],
      };

      const mockConsumerId: TenantId = generateId();

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEservice.id,
        consumerId: mockConsumerId,
        versions: [getMockPurposeVersion(versionState)],
      };

      const mockClient: Client = {
        ...getMockClient(),
        consumerId: mockConsumerId,
      };

      const mockAgreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        eserviceId: mockEservice.id,
        descriptorId: mockDescriptor.id,
        consumerId: mockConsumerId,
      };

      await addOneClient(mockClient);
      await addOnePurpose(mockPurpose);
      await addOneEService(mockEservice);
      await addOneAgreement(mockAgreement);

      expect(
        authorizationService.addClientPurpose({
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
          ctx: {
            serviceName: "test",
            authData: getMockAuthData(mockConsumerId),
            correlationId: generateId(),
            logger: genericLogger,
          },
        })
      ).rejects.toThrowError(
        noPurposeVersionsFoundInRequiredState(mockPurpose.id)
      );
    }
  );
  it("should throw purposeAlreadyLinkedToClient if the purpose is already linked to that client", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
      purposes: [mockPurpose.id],
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        ctx: {
          serviceName: "test",
          authData: getMockAuthData(mockConsumerId),
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(
      purposeAlreadyLinkedToClient(mockPurpose.id, mockClient.id)
    );
  });
  it("should write on event-store for the addition of a purpose into a client where the requester is the delegate", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
      isClientAccessDelegable: true,
    };
    const delegateId: TenantId = generateId();
    const consumerId: TenantId = generateId();

    const delegation = getMockDelegation({
      delegateId,
      delegatorId: consumerId,
      state: delegationState.active,
      eserviceId: mockEservice.id,
      kind: delegationKind.delegatedConsumer,
    });
    await addOneDelegation(delegation);

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: delegateId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    await authorizationService.addClientPurpose({
      clientId: mockClient.id,
      seed: { purposeId: mockPurpose.id },
      ctx: {
        serviceName: "test",
        authData: getMockAuthData(delegateId),
        correlationId: generateId(),
        logger: genericLogger,
      },
    });

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientPurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientPurposeAddedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      purposeId: mockPurpose.id,
      client: toClientV2({
        ...mockClient,
        purposes: [...mockClient.purposes, mockPurpose.id],
      }),
    });
  });
  it("should write on event-store for the addition of a purpose created by a delegate into a client where the requester is the consumer", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const delegateId: TenantId = generateId();
    const consumerId: TenantId = generateId();

    const delegation = getMockDelegation({
      delegateId,
      delegatorId: consumerId,
      state: delegationState.active,
      eserviceId: mockEservice.id,
      kind: delegationKind.delegatedConsumer,
    });
    await addOneDelegation(delegation);

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    await authorizationService.addClientPurpose({
      clientId: mockClient.id,
      seed: { purposeId: mockPurpose.id },
      ctx: {
        serviceName: "test",
        authData: getMockAuthData(consumerId),
        correlationId: generateId(),
        logger: genericLogger,
      },
    });

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientPurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientPurposeAddedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      purposeId: mockPurpose.id,
      client: toClientV2({
        ...mockClient,
        purposes: [...mockClient.purposes, mockPurpose.id],
      }),
    });
  });
  it("should throw delegationNotFound if the purpose delegation is not found or is not in an active state", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
      isClientAccessDelegable: true,
    };
    const delegateId: TenantId = generateId();
    const consumerId: TenantId = generateId();

    const delegation = getMockDelegation({
      delegateId,
      delegatorId: consumerId,
      state: delegationState.revoked,
      eserviceId: mockEservice.id,
      kind: delegationKind.delegatedConsumer,
    });
    await addOneDelegation(delegation);

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: delegateId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        ctx: {
          serviceName: "test",
          authData: getMockAuthData(delegateId),
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(purposeDelegationNotFound(delegation.id));
  });
  it("should throw organizationNotAllowedOnPurpose if the requester is not the purpose delegation delegate nor delegator", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
      isClientAccessDelegable: true,
    };
    const delegateId: TenantId = generateId();
    const consumerId: TenantId = generateId();

    const delegation = getMockDelegation({
      delegateId: generateId<TenantId>(),
      delegatorId: consumerId,
      state: delegationState.active,
      eserviceId: mockEservice.id,
      kind: delegationKind.delegatedConsumer,
    });
    await addOneDelegation(delegation);

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: delegateId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        ctx: {
          serviceName: "test",
          authData: getMockAuthData(delegateId),
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnPurpose(delegateId, mockPurpose.id, delegation.id)
    );
  });
  it("should throw eserviceNotDelegableForClientAccess if for a purpose with a delegation the eservice doesn't have the isClientAccessDelegable to true", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
      isClientAccessDelegable: false,
    };
    const delegateId: TenantId = generateId();
    const consumerId: TenantId = generateId();

    const delegation = getMockDelegation({
      delegateId,
      delegatorId: consumerId,
      state: delegationState.active,
      eserviceId: mockEservice.id,
      kind: delegationKind.delegatedConsumer,
    });
    await addOneDelegation(delegation);

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: delegateId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        ctx: {
          serviceName: "test",
          authData: getMockAuthData(delegateId),
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(eserviceNotDelegableForClientAccess(mockEservice));
  });
  it("should throw noAgreementFoundInRequiredState if for a purpose with a delegation the agreement doesn't have the delegatorId as consumerId", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
      isClientAccessDelegable: true,
    };
    const delegateId: TenantId = generateId();
    const consumerId: TenantId = generateId();

    const delegation = getMockDelegation({
      delegateId,
      delegatorId: consumerId,
      state: delegationState.active,
      eserviceId: mockEservice.id,
      kind: delegationKind.delegatedConsumer,
    });
    await addOneDelegation(delegation);

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: delegateId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: generateId(),
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        ctx: {
          serviceName: "test",
          authData: getMockAuthData(delegateId),
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(
      noAgreementFoundInRequiredState(mockEservice.id, delegation.delegatorId)
    );
  });
});
