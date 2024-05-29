/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockClient,
  getRandomAuthData,
} from "pagopa-interop-commons-test";
import {
  Client,
  ClientUserAddedV2,
  TenantId,
  UserId,
  generateId,
  toClientV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { AuthData, genericLogger } from "pagopa-interop-commons";
import { selfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import {
  clientNotFound,
  organizationNotAllowedOnClient,
  securityUserNotFound,
  userAlreadyAssigned,
} from "../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";

function mockSelfcareV2ClientCall(
  value: Awaited<
    ReturnType<typeof selfcareV2Client.getInstitutionProductUsersUsingGET>
  >
): void {
  vi.spyOn(
    selfcareV2Client,
    "getInstitutionProductUsersUsingGET"
  ).mockImplementationOnce(() => Promise.resolve(value));
}

const mockSelfCareUsers = {
  id: generateId(),
  name: "test",
  roles: [],
  email: "test@test.it",
  surname: "surname_test",
};

describe("addUser", () => {
  it("should write on event-store for adding a user from a client", async () => {
    const consumerId: TenantId = generateId();
    const userIdToAdd: UserId = generateId();
    const userId: UserId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      users: [userId],
    };

    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    await addOneClient(mockClient);

    vi.mock("pagopa-interop-selfcare-v2-client", () => ({
      selfcareV2Client: {
        getInstitutionProductUsersUsingGET: (): Promise<boolean> =>
          Promise.resolve(true),
      },
    }));

    await authorizationService.addUser(
      {
        clientId: mockClient.id,
        userId: userIdToAdd,
        authData: getRandomAuthData(consumerId),
      },
      generateId(),
      genericLogger
    );

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientUserAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientUserAddedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      userId: userIdToAdd,
      client: toClientV2({ ...mockClient, users: [userId, userIdToAdd] }),
    });
  });
  it("should throw clientNotFound if the client doesn't exist", async () => {
    const userIdToAdd: UserId = generateId();
    const consumerId: TenantId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      users: [],
    };

    await addOneClient(getMockClient());
    mockSelfcareV2ClientCall([mockSelfCareUsers]);
    expect(
      authorizationService.addUser(
        {
          clientId: mockClient.id,
          userId: userIdToAdd,
          authData: getRandomAuthData(consumerId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw userAlreadyAssigned if the user already exist in the client", async () => {
    const consumerId: TenantId = generateId();
    const userId: UserId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      users: [userId],
    };

    await addOneClient(mockClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    expect(
      authorizationService.addUser(
        {
          clientId: mockClient.id,
          userId,
          authData: getRandomAuthData(consumerId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(userAlreadyAssigned(mockClient.id, userId));
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    const userIdToAdd: UserId = generateId();
    const organizationId: TenantId = generateId();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: generateId(),
      users: [],
    };

    await addOneClient(mockClient);
    mockSelfcareV2ClientCall([mockSelfCareUsers]);

    expect(
      authorizationService.addUser(
        {
          clientId: mockClient.id,
          userId: userIdToAdd,
          authData: getRandomAuthData(organizationId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(organizationId, mockClient.id)
    );
  });
  it("should throw securityUserNotFound if the Security user is not found", async () => {
    const userIdToAdd: UserId = generateId();
    const consumerId: TenantId = generateId();

    const authData: AuthData = {
      userId: generateId(),
      selfcareId: generateId(),
      organizationId: consumerId,
      userRoles: [],
      externalId: {
        value: "",
        origin: "",
      },
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      users: [],
    };

    await addOneClient(mockClient);

    mockSelfcareV2ClientCall([]);

    expect(
      authorizationService.addUser(
        {
          clientId: mockClient.id,
          userId: userIdToAdd,
          authData,
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(securityUserNotFound(authData.userId, userIdToAdd));
  });
});
