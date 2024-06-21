/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { Logger } from "pagopa-interop-commons";
import {
  Headers,
  PagoPAInteropBeClients,
} from "../providers/clientProvider.js";
import {
  ApiClient,
  ApiClientPurpose,
  ApiKeysSeed,
  ProcessApiClient,
  ProcessApiClientPurpose,
  ProcessApiKeySeed,
} from "../model/api/clientTypes.js";

export function clientServiceBuilder(apiClients: PagoPAInteropBeClients) {
  const { authorizationProcessClient } = apiClients;

  return {
    async getClientById(
      clientId: string,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<ApiClient> {
      logger.info(`Retrieve client ${clientId}`);

      const client = await authorizationProcessClient.getClient({
        params: { clientId },
        headers: { ...requestHeaders },
      });
      return enhanceClient(apiClients, client, requestHeaders);
    },

    async deleteClient(
      clientId: string,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<void> {
      logger.info(`Deleting client ${clientId}`);

      return authorizationProcessClient.deleteClient(undefined, {
        params: { clientId },
        headers: { ...requestHeaders },
      });
    },

    async removeClientPurpose(
      clientId: string,
      purposeId: string,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<void> {
      logger.info(`Removing purpose ${purposeId} from client ${clientId}`);

      return authorizationProcessClient.removeClientPurpose(undefined, {
        params: { clientId, purposeId },
        headers: { ...requestHeaders },
      });
    },

    async deleteClientKeyById(
      clientId: string,
      keyId: string,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<void> {
      logger.info(`Deleting key ${keyId} from client ${clientId}`);

      return authorizationProcessClient.deleteClientKeyById(undefined, {
        params: { clientId, keyId },
        headers: { ...requestHeaders },
      });
    },

    async removeUser(
      clientId: string,
      userId: string,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<void> {
      logger.info(`Removing user ${userId} from client ${clientId}`);

      return authorizationProcessClient.removeClientUser(undefined, {
        params: { clientId, userId },
        headers: { ...requestHeaders },
      });
    },

    async addUserToClient(
      userId: string,
      clientId: string,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<void> {
      logger.info(`Add user ${userId} to client ${clientId}`);

      await authorizationProcessClient.addUser(
        {
          userId,
        },
        {
          params: { clientId },
          headers: { ...requestHeaders },
        }
      );
    },

    async createKeys(
      userId: string,
      clientId: string,
      keySeed: ApiKeysSeed,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<void> {
      logger.info(`Create keys for client ${clientId}`);

      const body: ProcessApiKeySeed = keySeed.map((seed) => ({
        userId,
        key: seed.key,
        use: seed.use,
        alg: seed.alg,
        name: seed.name,
        createdAt: new Date().toISOString(),
      }));

      await authorizationProcessClient.createKeys(body, {
        params: { clientId },
        headers: { ...requestHeaders },
      });
    },
  };
}

export type ClientService = ReturnType<typeof clientServiceBuilder>;

async function enhanceClient(
  apiClients: PagoPAInteropBeClients,
  client: ProcessApiClient,
  requestHeaders: Headers
): Promise<ApiClient> {
  const consumer = await apiClients.tenantProcessClient.getTenant({
    params: { id: client.consumerId },
    headers: { ...requestHeaders },
  });

  const purposes = await Promise.all(
    client.purposes.map((p) => enhancePurpose(apiClients, p, requestHeaders))
  );

  return {
    id: client.id,
    name: client.name,
    description: client.description,
    kind: client.kind,
    createdAt: client.createdAt,
    consumer: {
      id: consumer.id,
      name: consumer.name,
    },
    purposes,
  };
}

async function enhancePurpose(
  {
    catalogProcessClient,
    tenantProcessClient,
    purposeProcessClient,
  }: PagoPAInteropBeClients,
  clientPurpose: ProcessApiClientPurpose,
  requestHeaders: Headers
): Promise<ApiClientPurpose> {
  const eservice = await catalogProcessClient.getEServiceById({
    params: { eServiceId: clientPurpose.states.eservice.eserviceId },
    headers: { ...requestHeaders },
  });

  const producer = await tenantProcessClient.getTenant({
    params: { id: eservice.producerId },
    headers: { ...requestHeaders },
  });

  const purpose = await purposeProcessClient.getPurpose({
    params: { id: clientPurpose.states.purpose.purposeId },
    headers: { ...requestHeaders },
  });

  return {
    purposeId: purpose.id,
    title: purpose.title,
    eservice: {
      id: eservice.id,
      name: eservice.name,
      producer: {
        id: producer.id,
        name: producer.name,
        kind: producer.kind,
      },
    },
  };
}
