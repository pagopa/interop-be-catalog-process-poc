import {
  Client,
  ClientId,
  ListResult,
  TenantId,
  UserId,
  WithMetadata,
  authorizationEventToBinaryData,
  clientKind,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { AuthData, DB, Logger, eventRepository } from "pagopa-interop-commons";
import {
  clientNotFound,
  organizationNotAllowedOnClient,
} from "../model/domain/errors.js";
import { ApiClientSeed } from "../model/domain/models.js";
import {
  toCreateEventClientAdded,
  toCreateEventClientDeleted,
} from "../model/domain/toEvent.js";
import { GetClientsFilters, ReadModelService } from "./readModelService.js";

const retrieveClient = async (
  clientId: ClientId,
  readModelService: ReadModelService
): Promise<WithMetadata<Client>> => {
  const client = await readModelService.getClientById(clientId);
  if (client === undefined) {
    throw clientNotFound(clientId);
  }
  return client;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function authorizationServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService
) {
  const repository = eventRepository(
    dbInstance,
    authorizationEventToBinaryData
  );

  return {
    async getClientById(
      clientId: ClientId,
      organizationId: TenantId,
      logger: Logger
    ): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(`Retrieving Client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      return {
        client: client.data,
        showUsers: client.data.consumerId === organizationId,
      };
    },

    async createConsumerClient(
      clientSeed: ApiClientSeed,
      organizationId: TenantId,
      correlationId: string,
      logger: Logger
    ): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(
        `Creating CONSUMER client ${clientSeed.name} for consumer ${organizationId}"`
      );
      const client: Client = {
        id: generateId(),
        consumerId: organizationId,
        name: clientSeed.name,
        purposes: [],
        description: clientSeed.description,
        relationships: [],
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
        showUsers: client.consumerId === organizationId,
      };
    },
    async createApiClient(
      clientSeed: ApiClientSeed,
      organizationId: TenantId,
      correlationId: string,
      logger: Logger
    ): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(
        `Creating API client ${clientSeed.name} for consumer ${organizationId}"`
      );
      const client: Client = {
        id: generateId(),
        consumerId: organizationId,
        name: clientSeed.name,
        purposes: [],
        description: clientSeed.description,
        relationships: [],
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
        showUsers: client.consumerId === organizationId,
      };
    },
    async deleteClient({
      clientId,
      organizationId,
      correlationId,
      logger,
    }: {
      clientId: ClientId;
      organizationId: TenantId;
      correlationId: string;
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
    async getClients(
      filters: GetClientsFilters,
      { offset, limit }: { offset: number; limit: number },
      authData: AuthData,
      logger: Logger
    ): Promise<ListResult<Client>> {
      logger.info(
        `Retrieving clients by name ${filters.name} , userIds ${filters.userIds}`
      );
      const userIds = authData.userRoles.includes("security")
        ? [authData.userId]
        : filters.userIds.map(unsafeBrandId<UserId>);

      return await readModelService.getClients(
        { ...filters, userIds },
        {
          offset,
          limit,
        }
      );
    },
  };
}

export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;

const assertOrganizationIsClientConsumer = (
  organizationId: TenantId,
  client: Client
): void => {
  if (client.consumerId !== organizationId) {
    throw organizationNotAllowedOnClient(organizationId, client.id);
  }
};
