/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { bffApi, attributeRegistryApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { toApiAttributeProcessSeed } from "../model/domain/apiConverter.js";

export function attributeServiceBuilder(
  attributeClient: PagoPAInteropBeClients["attributeProcessClient"]
) {
  return {
    async createCertifiedAttribute(
      seed: bffApi.AttributeSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.Attribute> {
      logger.info(`Creating certified attribute with name ${seed.name}`);

      return attributeClient.createCertifiedAttribute(
        toApiAttributeProcessSeed(seed),
        {
          headers,
        }
      );
    },

    async createVerifiedAttribute(
      seed: bffApi.AttributeSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.Attribute> {
      logger.info(`Creating verified attribute with name ${seed.name}`);

      return attributeClient.createVerifiedAttribute(
        toApiAttributeProcessSeed(seed),
        {
          headers,
        }
      );
    },

    async createDeclaredAttribute(
      seed: bffApi.AttributeSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.Attribute> {
      logger.info(`Creating declared attribute with name ${seed.name}`);

      return attributeClient.createDeclaredAttribute(
        toApiAttributeProcessSeed(seed),
        {
          headers,
        }
      );
    },

    async getAttributeById(
      attributeId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<attributeRegistryApi.Attribute> {
      logger.info(`Retrieving attribute with id ${attributeId}`);
      return attributeClient.getAttributeById({
        params: { attributeId },
        headers,
      });
    },

    async getAttributeByOriginAndCode(
      origin: string,
      code: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<attributeRegistryApi.Attribute> {
      logger.info(
        `Retrieving attribute with origin ${origin} and code ${code}`
      );
      return attributeClient.getAttributeByOriginAndCode({
        params: { origin, code },
        headers,
      });
    },

    async getAttributes({
      offset,
      limit,
      kinds,
      ctx,
      name,
      origin,
    }: {
      offset: number;
      limit: number;
      kinds: attributeRegistryApi.AttributeKind[];
      ctx: WithLogger<BffAppContext>;
      name?: string;
      origin?: string;
    }): Promise<attributeRegistryApi.Attributes> {
      ctx.logger.info("Retrieving attributes");
      return attributeClient.getAttributes({
        queries: { offset, limit, kinds: kinds.join(","), name, origin },
        headers: ctx.headers,
      });
    },
  };
}

export type AttributeService = ReturnType<typeof attributeServiceBuilder>;
