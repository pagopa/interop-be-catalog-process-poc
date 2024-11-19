/* eslint-disable @typescript-eslint/no-floating-promises */

import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockProducerKeychain,
  getRandomAuthData,
} from "pagopa-interop-commons-test";
import {
  ProducerKeychain,
  ProducerKeychainUserAddedV2,
  TenantId,
  UserId,
  generateId,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { AuthData, genericLogger } from "pagopa-interop-commons";
import { selfcareV2ClientApi } from "pagopa-interop-api-clients";
import {
  userWithoutSecurityPrivileges,
  producerKeychainNotFound,
  producerKeychainUserAlreadyAssigned,
  organizationNotAllowedOnProducerKeychain,
} from "../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";
import {
  mockProducerKeyChainRouterRequest,
  mockSelfcareV2ClientCall,
} from "./supertestSetup.js";

const mockSelfCareUsers: selfcareV2ClientApi.UserResource = {
  id: generateId(),
  name: "test",
  roles: [],
  email: "test@test.it",
  surname: "surname_test",
};

describe("addProducerKeychainUsers", () => {
  it("should write on event-store when adding multiple users to a producer keychain", async () => {
    const producerId: TenantId = generateId();
    const users: UserId[] = [generateId()];
    const userIdsToAdd: UserId[] = [generateId(), generateId()];

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      users,
    };

    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Router",
    });

    await addOneProducerKeychain(mockProducerKeychain);

    await mockProducerKeyChainRouterRequest.post({
      path: "/producerKeychains/:producerKeychainId/users",
      body: { userIds: userIdsToAdd },
      pathParams: { producerKeychainId: mockProducerKeychain.id },
      authData: getMockAuthData(producerId),
    });

    const writtenEvent = await readLastAuthorizationEvent(
      mockProducerKeychain.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockProducerKeychain.id,
      version: "2",
      type: "ProducerKeychainUserAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainUserAddedV2,
      payload: writtenEvent.data,
    });

    const expectedProducerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      users: [...users, ...userIdsToAdd],
    };

    expect(writtenPayload).toEqual({
      userId: userIdsToAdd.at(-1),
      producerKeychain: toProducerKeychainV2(expectedProducerKeychain),
    });
  });
  it("should throw producerKeychainNotFound if the producer keychain doesn't exist", async () => {
    const userIdsToAdd: UserId[] = [generateId()];
    const producerId: TenantId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      users: [],
    };

    await addOneProducerKeychain(getMockProducerKeychain());

    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Service",
    });

    expect(
      authorizationService.addProducerKeychainUsers(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIds: userIdsToAdd,
          authData: getRandomAuthData(producerId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(producerKeychainNotFound(mockProducerKeychain.id));
  });
  it("should throw producerKeychainUserAlreadyAssigned if one of the users passed already exists in the producer keychain", async () => {
    const producerId: TenantId = generateId();
    const userIdAlreadyAssigned: UserId = generateId();

    const users: UserId[] = [generateId(), userIdAlreadyAssigned];

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      users,
    };

    await addOneProducerKeychain(mockProducerKeychain);

    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Service",
    });

    expect(
      authorizationService.addProducerKeychainUsers(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIds: [userIdAlreadyAssigned],
          authData: getRandomAuthData(producerId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      producerKeychainUserAlreadyAssigned(
        mockProducerKeychain.id,
        userIdAlreadyAssigned
      )
    );
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    const userIdToAdd: UserId = generateId();
    const organizationId: TenantId = generateId();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: generateId(),
      users: [],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    mockSelfcareV2ClientCall({
      value: [mockSelfCareUsers],
      mockedFor: "Service",
    });

    expect(
      authorizationService.addProducerKeychainUsers(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIds: [userIdToAdd],
          authData: getRandomAuthData(organizationId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      organizationNotAllowedOnProducerKeychain(
        organizationId,
        mockProducerKeychain.id
      )
    );
  });
  it("should throw userWithoutSecurityPrivileges if one of the Security users is not found", async () => {
    const producerId: TenantId = generateId();

    const authData: AuthData = {
      userId: generateId(),
      selfcareId: generateId(),
      organizationId: producerId,
      userRoles: [],
      externalId: {
        value: "",
        origin: "",
      },
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId,
      users: [],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    mockSelfcareV2ClientCall({
      value: [],
      mockedFor: "Service",
    });

    expect(
      authorizationService.addProducerKeychainUsers(
        {
          producerKeychainId: mockProducerKeychain.id,
          userIds: [generateId()],
          authData,
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      userWithoutSecurityPrivileges(producerId, authData.userId)
    );
  });
});
