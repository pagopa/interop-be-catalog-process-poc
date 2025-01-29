import { JsonWebKey } from "crypto";
import {
  Client,
  ClientId,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  Key,
  ListResult,
  Purpose,
  PurposeId,
  PurposeVersionState,
  TenantId,
  UserId,
  WithMetadata,
  authorizationEventToBinaryData,
  clientKind,
  generateId,
  genericInternalError,
  invalidKey,
  purposeVersionState,
  unsafeBrandId,
  ProducerKeychain,
  ProducerKeychainId,
  CorrelationId,
  Delegation,
} from "pagopa-interop-models";
import {
  AuthData,
  DB,
  Logger,
  eventRepository,
  userRoles,
  calculateKid,
  createJWK,
  WithLogger,
  AppContext,
} from "pagopa-interop-commons";
import {
  authorizationApi,
  SelfcareV2InstitutionClient,
} from "pagopa-interop-api-clients";

import {
  clientNotFound,
  descriptorNotFound,
  eserviceNotFound,
  clientKeyNotFound,
  noAgreementFoundInRequiredState,
  noPurposeVersionsFoundInRequiredState,
  purposeAlreadyLinkedToClient,
  purposeNotFound,
  clientUserAlreadyAssigned,
  clientUserIdNotFound,
  userNotFound,
  userNotAllowedOnClient,
  producerKeychainNotFound,
  producerKeyNotFound,
  userNotAllowedOnProducerKeychain,
  producerKeychainUserAlreadyAssigned,
  producerKeychainUserIdNotFound,
  eserviceAlreadyLinkedToProducerKeychain,
  userNotAllowedToDeleteProducerKeychainKey,
  userNotAllowedToDeleteClientKey,
  eserviceNotDelegableForClientAccess,
  purposeDelegationNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventClientAdded,
  toCreateEventClientDeleted,
  toCreateEventClientKeyDeleted,
  toCreateEventClientPurposeAdded,
  toCreateEventClientPurposeRemoved,
  toCreateEventClientUserAdded,
  toCreateEventClientUserDeleted,
  toCreateEventKeyAdded,
  toCreateEventProducerKeychainAdded,
  toCreateEventProducerKeychainDeleted,
  toCreateEventProducerKeychainEServiceRemoved,
  toCreateEventProducerKeychainEServiceAdded,
  toCreateEventProducerKeychainKeyAdded,
  toCreateEventProducerKeychainKeyDeleted,
  toCreateEventProducerKeychainUserAdded,
  toCreateEventProducerKeychainUserDeleted,
} from "../model/domain/toEvent.js";
import {
  ApiKeyUseToKeyUse,
  clientToApiClient,
} from "../model/domain/apiConverter.js";
import {
  GetClientsFilters,
  GetProducerKeychainsFilters,
  ReadModelService,
} from "./readModelService.js";
import {
  assertOrganizationIsPurposeConsumer,
  assertUserSelfcareSecurityPrivileges,
  assertOrganizationIsClientConsumer,
  assertOrganizationIsProducerKeychainProducer,
  assertClientKeysCountIsBelowThreshold,
  assertProducerKeychainKeysCountIsBelowThreshold,
  assertOrganizationIsEServiceProducer,
  assertKeyDoesNotAlreadyExist,
  assertRequesterIsDelegateConsumer,
} from "./validators.js";

const retrieveClient = async (
  clientId: ClientId,
  readModelService: ReadModelService
): Promise<WithMetadata<Client>> => {
  const client = await readModelService.getClientById(clientId);
  if (!client) {
    throw clientNotFound(clientId);
  }
  return client;
};

const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (eservice === undefined) {
    throw eserviceNotFound(eserviceId);
  }
  return eservice;
};

const retrievePurpose = async (
  purposeId: PurposeId,
  readModelService: ReadModelService
): Promise<Purpose> => {
  const purpose = await readModelService.getPurposeById(purposeId);
  if (purpose === undefined) {
    throw purposeNotFound(purposeId);
  }
  return purpose;
};

const retrievePurposeDelegation = async (
  purpose: Purpose,
  readModelService: ReadModelService
): Promise<Delegation | undefined> => {
  if (!purpose.delegationId) {
    return undefined;
  }

  const delegation = await readModelService.getActiveConsumerDelegationById(
    purpose.delegationId
  );
  if (!delegation) {
    throw purposeDelegationNotFound(purpose.delegationId);
  }

  return delegation;
};

const retrieveDescriptor = (
  descriptorId: DescriptorId,
  eservice: EService
): Descriptor => {
  const descriptor = eservice.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );

  if (descriptor === undefined) {
    throw descriptorNotFound(eservice.id, descriptorId);
  }

  return descriptor;
};

const retrieveProducerKeychain = async (
  producerKeychainId: ProducerKeychainId,
  readModelService: ReadModelService
): Promise<WithMetadata<ProducerKeychain>> => {
  const producerKeychain = await readModelService.getProducerKeychainById(
    producerKeychainId
  );
  if (!producerKeychain) {
    throw producerKeychainNotFound(producerKeychainId);
  }
  return producerKeychain;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function authorizationServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  selfcareV2InstitutionClient: SelfcareV2InstitutionClient
) {
  const repository = eventRepository(
    dbInstance,
    authorizationEventToBinaryData
  );

  return {
    async getClientById({
      clientId,
      organizationId,
      logger,
    }: {
      clientId: ClientId;
      organizationId: TenantId;
      logger: Logger;
    }): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(`Retrieving Client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      return {
        client: client.data,
        showUsers: organizationId === client.data.consumerId,
      };
    },

    async createConsumerClient({
      clientSeed,
      organizationId,
      correlationId,
      logger,
    }: {
      clientSeed: authorizationApi.ClientSeed;
      organizationId: TenantId;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(
        `Creating CONSUMER client ${clientSeed.name} for consumer ${organizationId}"`
      );
      const client: Client = {
        id: generateId(),
        consumerId: organizationId,
        name: clientSeed.name,
        purposes: [],
        description: clientSeed.description,
        kind: clientKind.consumer,
        users: clientSeed.members.map(unsafeBrandId<UserId>),
        createdAt: new Date(),
        keys: [],
      };

      await repository.createEvent(
        toCreateEventClientAdded(client, correlationId)
      );

      return {
        client,
        showUsers: true,
      };
    },
    async createApiClient({
      clientSeed,
      organizationId,
      correlationId,
      logger,
    }: {
      clientSeed: authorizationApi.ClientSeed;
      organizationId: TenantId;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(
        `Creating API client ${clientSeed.name} for consumer ${organizationId}"`
      );
      const client: Client = {
        id: generateId(),
        consumerId: organizationId,
        name: clientSeed.name,
        purposes: [],
        description: clientSeed.description,
        kind: clientKind.api,
        users: clientSeed.members.map(unsafeBrandId<UserId>),
        createdAt: new Date(),
        keys: [],
      };

      await repository.createEvent(
        toCreateEventClientAdded(client, correlationId)
      );

      return {
        client,
        showUsers: true,
      };
    },
    async getClients({
      filters,
      authData,
      offset,
      limit,
      logger,
    }: {
      filters: GetClientsFilters;
      authData: AuthData;
      offset: number;
      limit: number;
      logger: Logger;
    }): Promise<ListResult<Client>> {
      logger.info(
        `Retrieving clients by name ${filters.name} , userIds ${filters.userIds}`
      );
      const userIds = authData.userRoles.includes(userRoles.SECURITY_ROLE)
        ? [authData.userId]
        : filters.userIds;

      return await readModelService.getClients(
        { ...filters, userIds },
        {
          offset,
          limit,
        }
      );
    },
    async deleteClient({
      clientId,
      organizationId,
      correlationId,
      logger,
    }: {
      clientId: ClientId;
      organizationId: TenantId;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<void> {
      logger.info(`Deleting client ${clientId}`);

      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(organizationId, client.data);

      await repository.createEvent(
        toCreateEventClientDeleted(
          client.data,
          client.metadata.version,
          correlationId
        )
      );
    },
    async removeClientUser({
      clientId,
      userIdToRemove,
      organizationId,
      correlationId,
      logger,
    }: {
      clientId: ClientId;
      userIdToRemove: UserId;
      organizationId: TenantId;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<void> {
      logger.info(`Removing user ${userIdToRemove} from client ${clientId}`);

      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(organizationId, client.data);

      if (!client.data.users.includes(userIdToRemove)) {
        throw clientUserIdNotFound(userIdToRemove, clientId);
      }

      const updatedClient: Client = {
        ...client.data,
        users: client.data.users.filter((userId) => userId !== userIdToRemove),
      };

      await repository.createEvent(
        toCreateEventClientUserDeleted(
          updatedClient,
          userIdToRemove,
          client.metadata.version,
          correlationId
        )
      );
    },
    async deleteClientKeyById({
      clientId,
      keyIdToRemove,
      authData,
      correlationId,
      logger,
    }: {
      clientId: ClientId;
      keyIdToRemove: string;
      authData: AuthData;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<void> {
      logger.info(`Removing key ${keyIdToRemove} from client ${clientId}`);

      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(authData.organizationId, client.data);

      const hasSecurityRole = authData.userRoles.includes(
        userRoles.SECURITY_ROLE
      );

      if (hasSecurityRole && !client.data.users.includes(authData.userId)) {
        throw userNotAllowedOnClient(authData.userId, client.data.id);
      }

      const keyToRemove = client.data.keys.find(
        (key) => key.kid === keyIdToRemove
      );

      if (!keyToRemove) {
        throw clientKeyNotFound(keyIdToRemove, client.data.id);
      }

      if (hasSecurityRole && keyToRemove.userId !== authData.userId) {
        throw userNotAllowedToDeleteClientKey(
          authData.userId,
          client.data.id,
          keyToRemove.kid
        );
      }

      const updatedClient: Client = {
        ...client.data,
        keys: client.data.keys.filter((key) => key.kid !== keyIdToRemove),
      };

      await repository.createEvent(
        toCreateEventClientKeyDeleted(
          updatedClient,
          keyIdToRemove,
          client.metadata.version,
          correlationId
        )
      );
    },
    async removeClientPurpose({
      clientId,
      purposeIdToRemove,
      organizationId,
      correlationId,
      logger,
    }: {
      clientId: ClientId;
      purposeIdToRemove: PurposeId;
      organizationId: TenantId;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<void> {
      logger.info(
        `Removing purpose ${purposeIdToRemove} from client ${clientId}`
      );

      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(organizationId, client.data);

      // if (!client.data.purposes.find((id) => id === purposeIdToRemove)) {
      //   throw purposeNotFound(purposeIdToRemove);
      // }

      const updatedClient: Client = {
        ...client.data,
        purposes: client.data.purposes.filter(
          (purposeId) => purposeId !== purposeIdToRemove
        ),
      };

      await repository.createEvent(
        toCreateEventClientPurposeRemoved(
          updatedClient,
          purposeIdToRemove,
          client.metadata.version,
          correlationId
        )
      );
    },
    async removePurposeFromClients({
      purposeIdToRemove,
      correlationId,
      logger,
    }: {
      purposeIdToRemove: PurposeId;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<void> {
      logger.info(`Removing purpose ${purposeIdToRemove} from all clients`);

      const clients = await readModelService.getClientsRelatedToPurpose(
        purposeIdToRemove
      );
      for (const client of clients) {
        const updatedClient: Client = {
          ...client.data,
          purposes: client.data.purposes.filter(
            (purposeId) => purposeId !== purposeIdToRemove
          ),
        };

        await repository.createEvent(
          toCreateEventClientPurposeRemoved(
            updatedClient,
            purposeIdToRemove,
            client.metadata.version,
            correlationId
          )
        );
      }
    },
    async getClientUsers({
      clientId,
      organizationId,
      logger,
    }: {
      clientId: ClientId;
      organizationId: TenantId;
      logger: Logger;
    }): Promise<{ users: UserId[]; showUsers: boolean }> {
      logger.info(`Retrieving users of client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(organizationId, client.data);
      return {
        users: client.data.users,
        showUsers: true,
      };
    },
    async addClientUsers(
      {
        clientId,
        userIds,
        authData,
      }: {
        clientId: ClientId;
        userIds: UserId[];
        authData: AuthData;
      },
      correlationId: CorrelationId,
      logger: Logger
    ): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(`Binding client ${clientId} with user ${userIds.join(",")}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(authData.organizationId, client.data);

      await Promise.all(
        userIds.map((userId) =>
          assertUserSelfcareSecurityPrivileges({
            selfcareId: authData.selfcareId,
            requesterUserId: authData.userId,
            consumerId: authData.organizationId,
            selfcareV2InstitutionClient,
            userIdToCheck: userId,
            correlationId,
          })
        )
      );

      userIds.forEach((userId) => {
        if (client.data.users.includes(userId)) {
          throw clientUserAlreadyAssigned(clientId, userId);
        }
      });

      const uniqueUserIds = Array.from(new Set(userIds));
      const updatedClient: Client = {
        ...client.data,
      };

      await repository.createEvents(
        uniqueUserIds.map((userId, index) => {
          // eslint-disable-next-line functional/immutable-data
          updatedClient.users.push(userId);
          return toCreateEventClientUserAdded(
            userId,
            updatedClient,
            client.metadata.version + index,
            correlationId
          );
        })
      );

      return {
        client: updatedClient,
        showUsers: true,
      };
    },
    async getClientKeys({
      clientId,
      userIds,
      organizationId,
      logger,
    }: {
      clientId: ClientId;
      userIds: UserId[];
      organizationId: TenantId;
      logger: Logger;
    }): Promise<Key[]> {
      logger.info(`Retrieving keys for client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(organizationId, client.data);
      if (userIds.length > 0) {
        return client.data.keys.filter((k) => userIds.includes(k.userId));
      } else {
        return client.data.keys;
      }
    },
    async addClientPurpose({
      clientId,
      seed,
      ctx: { authData, correlationId, logger },
    }: {
      clientId: ClientId;
      seed: authorizationApi.PurposeAdditionDetails;
      ctx: WithLogger<AppContext>;
    }): Promise<void> {
      logger.info(
        `Adding purpose with id ${seed.purposeId} to client ${clientId}`
      );
      const purposeId: PurposeId = unsafeBrandId(seed.purposeId);

      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(authData.organizationId, client.data);

      const purpose = await retrievePurpose(purposeId, readModelService);
      const delegation = await retrievePurposeDelegation(
        purpose,
        readModelService
      );

      const isDelegate =
        delegation && purpose.consumerId !== authData.organizationId;

      if (isDelegate) {
        assertRequesterIsDelegateConsumer(authData, purpose, delegation);
      } else {
        assertOrganizationIsPurposeConsumer(authData.organizationId, purpose);
      }

      if (client.data.purposes.includes(purposeId)) {
        throw purposeAlreadyLinkedToClient(purposeId, client.data.id);
      }

      const eservice = await retrieveEService(
        purpose.eserviceId,
        readModelService
      );

      if (isDelegate && !eservice.isClientAccessDelegable) {
        throw eserviceNotDelegableForClientAccess(eservice);
      }

      const agreement = await readModelService.getActiveOrSuspendedAgreement(
        eservice.id,
        purpose.consumerId
      );

      if (agreement === undefined) {
        throw noAgreementFoundInRequiredState(eservice.id, purpose.consumerId);
      }

      retrieveDescriptor(agreement.descriptorId, eservice);

      const validPurposeVersionStates: Set<PurposeVersionState> = new Set([
        purposeVersionState.active,
        purposeVersionState.suspended,
      ]);
      const purposeVersion = purpose.versions.find((v) =>
        validPurposeVersionStates.has(v.state)
      );

      if (purposeVersion === undefined) {
        throw noPurposeVersionsFoundInRequiredState(purpose.id);
      }

      const updatedClient: Client = {
        ...client.data,
        purposes: [...client.data.purposes, purposeId],
      };

      await repository.createEvent(
        toCreateEventClientPurposeAdded(
          purposeId,
          updatedClient,
          client.metadata.version,
          correlationId
        )
      );
    },

    async createKeys({
      clientId,
      authData,
      keysSeeds,
      correlationId,
      logger,
    }: {
      clientId: ClientId;
      authData: AuthData;
      keysSeeds: authorizationApi.KeysSeed;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(`Creating keys for client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      assertOrganizationIsClientConsumer(
        unsafeBrandId(authData.organizationId),
        client.data
      );
      assertClientKeysCountIsBelowThreshold(
        clientId,
        client.data.keys.length + keysSeeds.length
      );
      if (!client.data.users.includes(authData.userId)) {
        throw userNotFound(authData.userId, authData.selfcareId);
      }

      await assertUserSelfcareSecurityPrivileges({
        selfcareId: authData.selfcareId,
        requesterUserId: authData.userId,
        consumerId: authData.organizationId,
        selfcareV2InstitutionClient,
        userIdToCheck: authData.userId,
        correlationId,
      });

      if (keysSeeds.length !== 1) {
        throw genericInternalError("Wrong number of keys");
      }
      const keySeed = keysSeeds[0];
      const jwk = createJWK(keySeed.key);
      if (jwk.kty !== "RSA") {
        throw invalidKey(keySeed.key, "Not an RSA key");
      }
      const newKey: Key = {
        name: keySeed.name,
        createdAt: new Date(),
        kid: calculateKid(jwk),
        encodedPem: keySeed.key,
        algorithm: keySeed.alg,
        use: ApiKeyUseToKeyUse(keySeed.use),
        userId: authData.userId,
      };

      await assertKeyDoesNotAlreadyExist(newKey.kid, readModelService);

      const updatedClient: Client = {
        ...client.data,
        keys: [...client.data.keys, newKey],
      };
      await repository.createEvent(
        toCreateEventKeyAdded(
          newKey.kid,
          updatedClient,
          client.metadata.version,
          correlationId
        )
      );

      return {
        client: updatedClient,
        showUsers: true,
      };
    },
    async getClientKeyById({
      clientId,
      kid,
      organizationId,
      logger,
    }: {
      clientId: ClientId;
      kid: string;
      organizationId: TenantId;
      logger: Logger;
    }): Promise<Key> {
      logger.info(`Retrieving key ${kid} in client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);

      assertOrganizationIsClientConsumer(organizationId, client.data);
      const key = client.data.keys.find((key) => key.kid === kid);

      if (!key) {
        throw clientKeyNotFound(kid, clientId);
      }
      return key;
    },
    async getKeyWithClientByKeyId({
      clientId,
      kid,
      logger,
    }: {
      clientId: ClientId;
      kid: string;
      logger: Logger;
    }): Promise<authorizationApi.KeyWithClient> {
      logger.info(`Getting client ${clientId} and key ${kid}`);
      const client = await retrieveClient(clientId, readModelService);
      const key = client.data.keys.find((key) => key.kid === kid);

      if (!key) {
        throw clientKeyNotFound(kid, clientId);
      }

      const jwk: JsonWebKey = createJWK(key.encodedPem);
      const jwkKey = authorizationApi.JWKKey.parse({
        ...jwk,
        kid: key.kid,
        use: "sig",
      });

      return {
        key: jwkKey,
        client: clientToApiClient(client.data, {
          showUsers: false,
        }),
      };
    },
    async createProducerKeychain({
      producerKeychainSeed,
      organizationId,
      correlationId,
      logger,
    }: {
      producerKeychainSeed: authorizationApi.ProducerKeychainSeed;
      organizationId: TenantId;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<{ producerKeychain: ProducerKeychain; showUsers: boolean }> {
      logger.info(
        `Creating producer keychain ${producerKeychainSeed.name} for producer ${organizationId}"`
      );

      const producerKeychain: ProducerKeychain = {
        id: generateId(),
        producerId: organizationId,
        name: producerKeychainSeed.name,
        eservices: [],
        description: producerKeychainSeed.description,
        users: producerKeychainSeed.members.map(unsafeBrandId<UserId>),
        createdAt: new Date(),
        keys: [],
      };

      await repository.createEvent(
        toCreateEventProducerKeychainAdded(producerKeychain, correlationId)
      );

      return { producerKeychain, showUsers: true };
    },
    async getProducerKeychains({
      filters,
      authData,
      offset,
      limit,
      logger,
    }: {
      filters: GetProducerKeychainsFilters;
      authData: AuthData;
      offset: number;
      limit: number;
      logger: Logger;
    }): Promise<ListResult<ProducerKeychain>> {
      logger.info(
        `Retrieving producer keychains by name ${filters.name}, userIds ${filters.userIds}, producerId ${filters.producerId}, eserviceId ${filters.eserviceId}`
      );
      const userIds = authData.userRoles.includes(userRoles.SECURITY_ROLE)
        ? [authData.userId]
        : filters.userIds;

      return await readModelService.getProducerKeychains(
        { ...filters, userIds },
        {
          offset,
          limit,
        }
      );
    },
    async getProducerKeychainById({
      producerKeychainId,
      organizationId,
      logger,
    }: {
      producerKeychainId: ProducerKeychainId;
      organizationId: TenantId;
      logger: Logger;
    }): Promise<{ producerKeychain: ProducerKeychain; showUsers: boolean }> {
      logger.info(`Retrieving Producer Keychain ${producerKeychainId}`);
      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      return {
        producerKeychain: producerKeychain.data,
        showUsers: organizationId === producerKeychain.data.producerId,
      };
    },
    async deleteProducerKeychain({
      producerKeychainId,
      organizationId,
      correlationId,
      logger,
    }: {
      producerKeychainId: ProducerKeychainId;
      organizationId: TenantId;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<void> {
      logger.info(`Deleting producer keychain ${producerKeychainId}`);

      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        organizationId,
        producerKeychain.data
      );

      await repository.createEvent(
        toCreateEventProducerKeychainDeleted(
          producerKeychain.data,
          producerKeychain.metadata.version,
          correlationId
        )
      );
    },
    async getProducerKeychainUsers({
      producerKeychainId,
      organizationId,
      logger,
    }: {
      producerKeychainId: ProducerKeychainId;
      organizationId: TenantId;
      logger: Logger;
    }): Promise<UserId[]> {
      logger.info(
        `Retrieving users of producer keychain ${producerKeychainId}`
      );
      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        organizationId,
        producerKeychain.data
      );
      return producerKeychain.data.users;
    },
    async addProducerKeychainUsers(
      {
        producerKeychainId,
        userIds,
        authData,
      }: {
        producerKeychainId: ProducerKeychainId;
        userIds: UserId[];
        authData: AuthData;
      },
      correlationId: CorrelationId,
      logger: Logger
    ): Promise<{ producerKeychain: ProducerKeychain; showUsers: boolean }> {
      logger.info(
        `Binding producer keychain ${producerKeychainId} with users ${userIds.join(
          ", "
        )}`
      );
      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        authData.organizationId,
        producerKeychain.data
      );

      await Promise.all(
        userIds.map((userId) =>
          assertUserSelfcareSecurityPrivileges({
            selfcareId: authData.selfcareId,
            requesterUserId: authData.userId,
            consumerId: authData.organizationId,
            userIdToCheck: userId,
            selfcareV2InstitutionClient,
            correlationId,
          })
        )
      );

      userIds.forEach((userId) => {
        if (producerKeychain.data.users.includes(userId)) {
          throw producerKeychainUserAlreadyAssigned(producerKeychainId, userId);
        }
      });

      const uniqueUserIds = Array.from(new Set(userIds));
      const updatedProducerKeychain: ProducerKeychain = {
        ...producerKeychain.data,
      };

      await repository.createEvents(
        uniqueUserIds.map((userId, index) => {
          // eslint-disable-next-line functional/immutable-data
          updatedProducerKeychain.users.push(userId);
          return toCreateEventProducerKeychainUserAdded(
            userId,
            updatedProducerKeychain,
            producerKeychain.metadata.version + index,
            correlationId
          );
        })
      );

      return {
        producerKeychain: updatedProducerKeychain,
        showUsers: true,
      };
    },
    async removeProducerKeychainUser({
      producerKeychainId,
      userIdToRemove,
      organizationId,
      correlationId,
      logger,
    }: {
      producerKeychainId: ProducerKeychainId;
      userIdToRemove: UserId;
      organizationId: TenantId;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<void> {
      logger.info(
        `Removing user ${userIdToRemove} from producer keychain ${producerKeychainId}`
      );

      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        organizationId,
        producerKeychain.data
      );

      if (!producerKeychain.data.users.includes(userIdToRemove)) {
        throw producerKeychainUserIdNotFound(
          userIdToRemove,
          producerKeychainId
        );
      }

      const updatedProducerKeychain: ProducerKeychain = {
        ...producerKeychain.data,
        users: producerKeychain.data.users.filter(
          (userId) => userId !== userIdToRemove
        ),
      };

      await repository.createEvent(
        toCreateEventProducerKeychainUserDeleted(
          updatedProducerKeychain,
          userIdToRemove,
          producerKeychain.metadata.version,
          correlationId
        )
      );
    },
    async createProducerKeychainKey({
      producerKeychainId,
      authData,
      keySeed,
      correlationId,
      logger,
    }: {
      producerKeychainId: ProducerKeychainId;
      authData: AuthData;
      keySeed: authorizationApi.KeySeed;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<ProducerKeychain> {
      logger.info(`Creating keys for producer keychain ${producerKeychainId}`);
      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        unsafeBrandId(authData.organizationId),
        producerKeychain.data
      );
      assertProducerKeychainKeysCountIsBelowThreshold(
        producerKeychainId,
        producerKeychain.data.keys.length + 1
      );

      if (!producerKeychain.data.users.includes(authData.userId)) {
        throw userNotFound(authData.userId, authData.selfcareId);
      }

      await assertUserSelfcareSecurityPrivileges({
        selfcareId: authData.selfcareId,
        requesterUserId: authData.userId,
        consumerId: authData.organizationId,
        selfcareV2InstitutionClient,
        userIdToCheck: authData.userId,
        correlationId,
      });

      const jwk = createJWK(keySeed.key);

      if (jwk.kty !== "RSA") {
        throw invalidKey(keySeed.key, "Not an RSA key");
      }

      const newKey: Key = {
        name: keySeed.name,
        createdAt: new Date(),
        kid: calculateKid(jwk),
        encodedPem: keySeed.key,
        algorithm: keySeed.alg,
        use: ApiKeyUseToKeyUse(keySeed.use),
        userId: authData.userId,
      };

      await assertKeyDoesNotAlreadyExist(newKey.kid, readModelService);

      const updatedProducerKeychain: ProducerKeychain = {
        ...producerKeychain.data,
        keys: [...producerKeychain.data.keys, newKey],
      };

      await repository.createEvent(
        toCreateEventProducerKeychainKeyAdded(
          newKey.kid,
          updatedProducerKeychain,
          producerKeychain.metadata.version,
          correlationId
        )
      );

      return updatedProducerKeychain;
    },
    async removeProducerKeychainKeyById({
      producerKeychainId,
      keyIdToRemove,
      authData,
      correlationId,
      logger,
    }: {
      producerKeychainId: ProducerKeychainId;
      keyIdToRemove: string;
      authData: AuthData;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<void> {
      logger.info(
        `Removing key ${keyIdToRemove} from producer keychain ${producerKeychainId}`
      );

      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        authData.organizationId,
        producerKeychain.data
      );

      const hasSecurityRole = authData.userRoles.includes(
        userRoles.SECURITY_ROLE
      );

      if (
        hasSecurityRole &&
        !producerKeychain.data.users.includes(authData.userId)
      ) {
        throw userNotAllowedOnProducerKeychain(
          authData.userId,
          producerKeychain.data.id
        );
      }

      const keyToRemove = producerKeychain.data.keys.find(
        (key) => key.kid === keyIdToRemove
      );

      if (!keyToRemove) {
        throw producerKeyNotFound(keyIdToRemove, producerKeychain.data.id);
      }

      if (hasSecurityRole && keyToRemove.userId !== authData.userId) {
        throw userNotAllowedToDeleteProducerKeychainKey(
          authData.userId,
          producerKeychain.data.id,
          keyToRemove.kid
        );
      }

      const updatedProducerKeychain: ProducerKeychain = {
        ...producerKeychain.data,
        keys: producerKeychain.data.keys.filter(
          (key) => key.kid !== keyIdToRemove
        ),
      };

      await repository.createEvent(
        toCreateEventProducerKeychainKeyDeleted(
          updatedProducerKeychain,
          keyIdToRemove,
          producerKeychain.metadata.version,
          correlationId
        )
      );
    },
    async getProducerKeychainKeys({
      producerKeychainId,
      userIds,
      organizationId,
      logger,
    }: {
      producerKeychainId: ProducerKeychainId;
      userIds: UserId[];
      organizationId: TenantId;
      logger: Logger;
    }): Promise<Key[]> {
      logger.info(
        `Retrieving keys for producer keychain ${producerKeychainId}`
      );
      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        organizationId,
        producerKeychain.data
      );
      if (userIds.length > 0) {
        return producerKeychain.data.keys.filter((k) =>
          userIds.includes(k.userId)
        );
      }
      return producerKeychain.data.keys;
    },
    async getProducerKeychainKeyById({
      producerKeychainId,
      kid,
      organizationId,
      logger,
    }: {
      producerKeychainId: ProducerKeychainId;
      kid: string;
      organizationId: TenantId;
      logger: Logger;
    }): Promise<Key> {
      logger.info(
        `Retrieving key ${kid} in producerKeychain ${producerKeychainId}`
      );
      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );

      assertOrganizationIsProducerKeychainProducer(
        organizationId,
        producerKeychain.data
      );
      const key = producerKeychain.data.keys.find((key) => key.kid === kid);

      if (!key) {
        throw producerKeyNotFound(kid, producerKeychainId);
      }
      return key;
    },
    async addProducerKeychainEService({
      producerKeychainId,
      seed,
      organizationId,
      correlationId,
      logger,
    }: {
      producerKeychainId: ProducerKeychainId;
      seed: authorizationApi.EServiceAdditionDetails;
      organizationId: TenantId;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<void> {
      logger.info(
        `Adding eservice with id ${seed.eserviceId} to producer keychain ${producerKeychainId}`
      );
      const eserviceId: EServiceId = unsafeBrandId(seed.eserviceId);
      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        organizationId,
        producerKeychain.data
      );
      const eservice = await retrieveEService(eserviceId, readModelService);
      assertOrganizationIsEServiceProducer(organizationId, eservice);
      if (producerKeychain.data.eservices.includes(eserviceId)) {
        throw eserviceAlreadyLinkedToProducerKeychain(
          eserviceId,
          producerKeychain.data.id
        );
      }
      const updatedProducerKeychain: ProducerKeychain = {
        ...producerKeychain.data,
        eservices: [...producerKeychain.data.eservices, eserviceId],
      };
      await repository.createEvent(
        toCreateEventProducerKeychainEServiceAdded(
          eserviceId,
          updatedProducerKeychain,
          producerKeychain.metadata.version,
          correlationId
        )
      );
    },
    async removeProducerKeychainEService({
      producerKeychainId,
      eserviceIdToRemove,
      organizationId,
      correlationId,
      logger,
    }: {
      producerKeychainId: ProducerKeychainId;
      eserviceIdToRemove: EServiceId;
      organizationId: TenantId;
      correlationId: CorrelationId;
      logger: Logger;
    }): Promise<void> {
      logger.info(
        `Removing e-service ${eserviceIdToRemove} from producer keychain ${producerKeychainId}`
      );

      const producerKeychain = await retrieveProducerKeychain(
        producerKeychainId,
        readModelService
      );
      assertOrganizationIsProducerKeychainProducer(
        organizationId,
        producerKeychain.data
      );

      if (
        !producerKeychain.data.eservices.find((id) => id === eserviceIdToRemove)
      ) {
        throw eserviceNotFound(eserviceIdToRemove);
      }

      const updatedProducerKeychain: ProducerKeychain = {
        ...producerKeychain.data,
        eservices: producerKeychain.data.eservices.filter(
          (eserviceId) => eserviceId !== eserviceIdToRemove
        ),
      };

      await repository.createEvent(
        toCreateEventProducerKeychainEServiceRemoved(
          updatedProducerKeychain,
          eserviceIdToRemove,
          producerKeychain.metadata.version,
          correlationId
        )
      );
    },
  };
}

export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;
