import {
  Client,
  ClientId,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
import { DB, Logger } from "pagopa-interop-commons";
import { clientNotFound } from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

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
  _dbInstance: DB,
  readModelService: ReadModelService
) {
  // const repository = eventRepository(
  //   dbInstance,
  //   authorizationEventToBinaryData
  // );

  return {
    async getClientById(
      clientId: ClientId,
      organizationId: TenantId,
      logger: Logger
    ): Promise<Client> {
      logger.info(`Retrieving Client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      if (client.data.consumerId === organizationId) {
        return client.data;
      } else {
        return { ...client.data, users: [] };
      }
    },
  };
}

export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;
