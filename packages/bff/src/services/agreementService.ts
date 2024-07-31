/* eslint-disable max-params */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {
  getAllFromPaginated,
  removeDuplicates,
  WithLogger,
} from "pagopa-interop-commons";
import {
  bffApi,
  catalogApi,
  agreementApi,
  tenantApi,
  attributeRegistryApi,
} from "pagopa-interop-api-clients";
import {
  AgreementProcessClient,
  PagoPAInteropBeClients,
} from "../providers/clientProvider.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import { agreementDescriptorNotFound } from "../model/domain/errors.js";
import { isAgreementUpgradable } from "../model/validators.js";
import {
  toCompactDescriptor,
  toCompactEservice,
  toCompactEserviceLight,
  toCompactOrganization,
} from "../model/api/converters/catalogClientApiConverter.js";
import { getBulkAttributes } from "./attributeService.js";
import { enhanceTenantAttributes } from "./tenantService.js";

export function agreementServiceBuilder(clients: PagoPAInteropBeClients) {
  const { agreementProcessClient } = clients;
  return {
    async createAgreement(
      payload: bffApi.AgreementPayload,
      { headers, logger, authData }: WithLogger<BffAppContext>
    ) {
      logger.info(
        `Creating agreement with consumerId ${authData.organizationId} eserviceId ${payload.eserviceId} descriptorId ${payload.descriptorId}`
      );
      return await agreementProcessClient.createAgreement(payload, {
        headers,
      });
    },

    async getAgreements(
      {
        offset,
        limit,
        producersIds,
        eservicesIds,
        consumersIds,
        states,
        showOnlyUpgradeable,
      }: {
        offset: number;
        limit: number;
        producersIds: string[];
        eservicesIds: string[];
        consumersIds: string[];
        states: bffApi.AgreementState[];
        showOnlyUpgradeable?: boolean;
      },
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreements> {
      ctx.logger.info("Retrieving agreements");

      const { results, totalCount } =
        await agreementProcessClient.getAgreements({
          queries: {
            offset,
            limit,
            showOnlyUpgradeable,
            eservicesIds,
            consumersIds,
            producersIds,
            states,
          },
          headers: ctx.headers,
        });

      const agreements = results.map((a) =>
        enrichAgreementListEntry(a, clients, ctx)
      );
      return {
        pagination: {
          limit,
          offset,
          totalCount,
        },
        results: await Promise.all(agreements),
      };
    },

    async getAgreementById(
      agreementId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      ctx.logger.info(`Retrieving agreement with id ${agreementId}`);
      const agreement = await agreementProcessClient.getAgreementById({
        params: { agreementId },
        headers: ctx.headers,
      });

      return enrichAgreement(agreement, clients, ctx);
    },

    async submitAgreement(
      agreementId: string,
      payload: bffApi.AgreementSubmissionPayload,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      ctx.logger.info(`Submitting agreement ${agreementId}`);
      const agreement = await agreementProcessClient.submitAgreement(payload, {
        params: { agreementId },
        headers: ctx.headers,
      });

      return enrichAgreement(agreement, clients, ctx);
    },

    async suspendAgreement(
      agreementId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      ctx.logger.info(`Suspending agreement ${agreementId}`);
      const agreement = await agreementProcessClient.suspendAgreement(
        undefined,
        {
          params: { agreementId },
          headers: ctx.headers,
        }
      );

      return enrichAgreement(agreement, clients, ctx);
    },

    async rejectAgreement(
      agreementId: string,
      payload: bffApi.AgreementRejectionPayload,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      ctx.logger.info(`Rejecting agreement ${agreementId}`);
      const agreement = await agreementProcessClient.rejectAgreement(payload, {
        params: { agreementId },
        headers: ctx.headers,
      });

      return enrichAgreement(agreement, clients, ctx);
    },

    async archiveAgreement(
      agreementId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<void> {
      ctx.logger.info(`Archiving agreement ${agreementId}`);
      await agreementProcessClient.archiveAgreement(undefined, {
        params: { agreementId },
        headers: ctx.headers,
      });
    },

    async updateAgreement(
      agreementId: string,
      payload: bffApi.AgreementUpdatePayload,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      ctx.logger.info(`Updating agreement ${agreementId}`);
      const agreement = await agreementProcessClient.updateAgreementById(
        payload,
        {
          params: { agreementId },
          headers: ctx.headers,
        }
      );

      return enrichAgreement(agreement, clients, ctx);
    },

    async upgradeAgreement(
      agreementId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      ctx.logger.info(`Upgrading agreement ${agreementId}`);
      const agreement = await agreementProcessClient.upgradeAgreementById(
        undefined,
        {
          params: { agreementId },
          headers: ctx.headers,
        }
      );
      return enrichAgreement(agreement, clients, ctx);
    },

    async deleteAgreement(
      agreementId: string,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      return await agreementProcessClient.deleteAgreement(undefined, {
        params: { agreementId },
        headers,
      });
    },

    async activateAgreement(
      agreementId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      const agreement = await agreementProcessClient.activateAgreement(
        undefined,
        {
          params: { agreementId },
          headers: ctx.headers,
        }
      );
      return enrichAgreement(agreement, clients, ctx);
    },

    async cloneAgreement(
      agreementId: string,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      const agreement = await agreementProcessClient.cloneAgreement(undefined, {
        params: { agreementId },
        headers,
      });
      return { id: agreement.id };
    },

    async getAgreementsEserviceProducers(
      {
        offset,
        limit,
        requesterId,
        states,
        eServiceName,
      }: {
        offset: number;
        limit: number;
        requesterId: string;
        states: agreementApi.AgreementState[];
        eServiceName?: string;
      },
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactEServicesLight> {
      logger.info(
        `Retrieving producer eservices from agreement filtered by eservice name ${eServiceName}, offset ${offset}, limit ${limit}`
      );

      if (eServiceName && eServiceName.length < 3) {
        return emptyPagination(offset, limit);
      }

      const eservices = await agreementProcessClient.getAgreementEServices({
        queries: {
          offset,
          limit,
          eServiceName,
          producersIds: [requesterId],
          states,
        },
        headers,
      });

      return {
        pagination: {
          limit,
          offset,
          totalCount: eservices.totalCount,
        },
        results: eservices.results.map((e) => toCompactEserviceLight(e)),
      };
    },

    async getAgreementsEserviceConsumers(
      offset: number,
      limit: number,
      requesterId: string,
      eServiceName: string | undefined,
      { headers, logger }: WithLogger<BffAppContext>
    ) {
      logger.info(
        `Retrieving consumer eservices from agreement filtered by eservice name ${eServiceName}, offset ${offset}, limit ${limit}`
      );

      if (eServiceName && eServiceName.length < 3) {
        return emptyPagination(offset, limit);
      }

      const eservices = await agreementProcessClient.getAgreementEServices({
        queries: {
          offset,
          limit,
          eServiceName,
          consumersIds: [requesterId],
        },
        headers,
      });

      return {
        pagination: {
          limit,
          offset,
          totalCount: eservices.totalCount,
        },
        results: eservices.results.map((e) => toCompactEserviceLight(e)),
      };
    },

    async getAgreementProducers(
      offset: number,
      limit: number,
      producerName: string | undefined,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactOrganizations> {
      logger.info(`Retrieving agreement producers`);

      if (producerName && producerName.length < 3) {
        return emptyPagination(offset, limit);
      }

      const producers = await agreementProcessClient.getAgreementProducers({
        queries: {
          offset,
          limit,
          producerName,
        },
        headers,
      });

      return {
        pagination: {
          limit,
          offset,
          totalCount: producers.totalCount,
        },
        results: producers.results.map((p) => toCompactOrganization(p)),
      };
    },

    async getAgreementConsumers(
      offset: number,
      limit: number,
      consumerName: string | undefined,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactOrganizations> {
      logger.info(`Retrieving agreement consumers`);

      if (consumerName && consumerName.length < 3) {
        return emptyPagination(offset, limit);
      }

      const consumers = await agreementProcessClient.getAgreementConsumers({
        queries: {
          offset,
          limit,
          consumerName,
        },
        headers,
      });

      return {
        pagination: {
          limit,
          offset,
          totalCount: consumers.totalCount,
        },
        results: consumers.results.map((c) => toCompactOrganization(c)),
      };
    },
  };
}

// Fetched all agreements in a recursive way
export const getAllAgreements = async (
  agreementProcessClient: AgreementProcessClient,
  headers: Headers,
  consumerIds: string[] = [],
  eserviceIds: string[] = [],
  producerIds: string[] = [],
  states: agreementApi.AgreementState[] = [],
  start: number = 0
): Promise<agreementApi.Agreement[]> => {
  const agreements = (
    await getAgreementsFrom(
      agreementProcessClient,
      headers,
      start,
      consumerIds,
      eserviceIds,
      producerIds
    )
  ).results;

  if (agreements.length >= 50) {
    return agreements.concat(
      await getAllAgreements(
        agreementProcessClient,
        headers,
        consumerIds,
        eserviceIds,
        producerIds,
        states,
        start + 50
      )
    );
  }
  return agreements;
};

export const getAgreementsFrom = async (
  agreementProcessClient: AgreementProcessClient,
  headers: Headers,
  start: number,
  consumerIds?: string[],
  eserviceIds?: string[],
  producerIds?: string[],
  states: agreementApi.AgreementState[] = [],
  limit: number = 50
): Promise<agreementApi.Agreements> =>
  await agreementProcessClient.getAgreements({
    headers,
    queries: {
      consumersIds: consumerIds,
      producersIds: producerIds,
      eservicesIds: eserviceIds,
      states,
      offset: start,
      limit,
    },
  });

export const getLatestAgreement = async (
  agreementProcessClient: AgreementProcessClient,
  consumerId: string,
  eservice: catalogApi.EService,
  headers: Headers
): Promise<agreementApi.Agreement | undefined> => {
  const allAgreements = await getAllFromPaginated(
    async (offset: number, limit: number) =>
      agreementProcessClient.getAgreements({
        headers,
        queries: {
          consumersIds: [consumerId],
          eservicesIds: [eservice.id],
          limit,
          offset,
        },
      })
  );

  type AgreementAndDescriptor = {
    agreement: agreementApi.Agreement;
    descriptor: catalogApi.EServiceDescriptor;
  };

  const agreementAndDescriptor = allAgreements.reduce<AgreementAndDescriptor[]>(
    (acc, agreement) => {
      const descriptor = eservice.descriptors.find(
        (d) => d.id === agreement.descriptorId
      );
      if (descriptor) {
        acc.push({ agreement, descriptor });
      }
      return acc;
    },
    []
  );

  return agreementAndDescriptor
    .sort((first, second) => {
      const descriptorFirstAgreement = first.descriptor;
      const descriptorSecondAgreement = second.descriptor;
      if (
        descriptorFirstAgreement.version !== descriptorSecondAgreement.version
      ) {
        return (
          Number(descriptorSecondAgreement.version) -
          Number(descriptorFirstAgreement.version)
        );
      } else {
        return (
          new Date(second.agreement.createdAt).getTime() -
          new Date(first.agreement.createdAt).getTime()
        );
      }
    })
    .at(0)?.agreement;
};

async function enrichAgreementListEntry(
  agreement: agreementApi.Agreement,
  clients: PagoPAInteropBeClients,
  ctx: WithLogger<BffAppContext>
): Promise<bffApi.AgreementListEntry> {
  const { consumer, producer, eservice } = await getConsumerProducerEservice(
    agreement,
    clients,
    ctx
  );

  const currentDescriptor = getCurrentDescriptor(eservice, agreement);

  return {
    id: agreement.id,
    state: agreement.state,
    consumer: {
      id: consumer.id,
      name: consumer.name,
      kind: consumer.kind,
    },
    eservice: toCompactEservice(eservice, producer),
    descriptor: toCompactDescriptor(currentDescriptor),
    canBeUpgraded: isAgreementUpgradable(eservice, agreement),
    suspendedByConsumer: agreement.suspendedByConsumer,
    suspendedByProducer: agreement.suspendedByProducer,
    suspendedByPlatform: agreement.suspendedByPlatform,
  };
}

export async function enrichAgreement(
  agreement: agreementApi.Agreement,
  clients: PagoPAInteropBeClients,
  ctx: WithLogger<BffAppContext>
): Promise<bffApi.Agreement> {
  const { consumer, producer, eservice } = await getConsumerProducerEservice(
    agreement,
    clients,
    ctx
  );

  const currentDescriptior = getCurrentDescriptor(eservice, agreement);

  const activeDescriptor = eservice.descriptors
    .toSorted((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
  const activeDescriptorAttributes = activeDescriptor
    ? descriptorAttributesIds(activeDescriptor)
    : [];
  const allAttributesIds = removeDuplicates([
    ...activeDescriptorAttributes,
    ...tenantAttributesIds(consumer),
  ]);

  const attributes = await getBulkAttributes(
    allAttributesIds,
    clients.attributeProcessClient,
    ctx
  );

  const agreementVerifiedAttrs = filterAttributes(
    attributes,
    agreement.verifiedAttributes.map((attr) => attr.id)
  );
  const agreementCertifiedAttrs = filterAttributes(
    attributes,
    agreement.certifiedAttributes.map((attr) => attr.id)
  );
  const agreementDeclaredAttrs = filterAttributes(
    attributes,
    agreement.declaredAttributes.map((attr) => attr.id)
  );
  const tenantAttributes = enhanceTenantAttributes(
    consumer.attributes,
    attributes
  );
  return {
    id: agreement.id,
    descriptorId: agreement.descriptorId,
    producer: {
      id: agreement.producerId,
      name: producer.name,
      kind: producer.kind,
      contactMail: producer.mails.find(
        (m) => m.kind === tenantApi.MailKind.Values.CONTACT_EMAIL
      ),
    },
    consumer: {
      id: agreement.consumerId,
      selfcareId: consumer.selfcareId,
      externalId: consumer.externalId,
      createdAt: consumer.createdAt,
      updatedAt: consumer.updatedAt,
      name: consumer.name,
      attributes: tenantAttributes,
      contactMail: consumer.mails.find(
        (m) => m.kind === tenantApi.MailKind.Values.CONTACT_EMAIL
      ),
      features: consumer.features,
    },
    eservice: {
      id: agreement.eserviceId,
      name: eservice.name,
      version: currentDescriptior.version,
      activeDescriptor,
    },
    state: agreement.state,
    verifiedAttributes: agreementVerifiedAttrs,
    certifiedAttributes: agreementCertifiedAttrs,
    declaredAttributes: agreementDeclaredAttrs,
    suspendedByConsumer: agreement.suspendedByConsumer,
    suspendedByProducer: agreement.suspendedByProducer,
    suspendedByPlatform: agreement.suspendedByPlatform,
    isContractPresent: agreement.contract !== undefined,
    consumerDocuments: agreement.consumerDocuments,
    createdAt: agreement.createdAt,
    updatedAt: agreement.updatedAt,
    suspendedAt: agreement.suspendedAt,
    consumerNotes: agreement.consumerNotes,
    rejectionReason: agreement.rejectionReason,
  };
}

function descriptorAttributesIds(
  descriptor: catalogApi.EServiceDescriptor
): string[] {
  const { verified, declared, certified } = descriptor.attributes;
  const allAttributes = [
    ...verified.flat(),
    ...declared.flat(),
    ...certified.flat(),
  ];
  return allAttributes.map((attr) => attr.id);
}

function tenantAttributesIds(tenant: tenantApi.Tenant): string[] {
  const verifiedIds = tenant.attributes.map((attr) => attr.verified?.id);
  const certifiedIds = tenant.attributes.map((attr) => attr.certified?.id);
  const declaredIds = tenant.attributes.map((attr) => attr.declared?.id);

  return [...verifiedIds, ...certifiedIds, ...declaredIds].filter(
    (x): x is string => x !== undefined
  );
}

async function getConsumerProducerEservice(
  agreement: agreementApi.Agreement,
  { tenantProcessClient, catalogProcessClient }: PagoPAInteropBeClients,
  { headers }: WithLogger<BffAppContext>
): Promise<{
  consumer: tenantApi.Tenant;
  producer: tenantApi.Tenant;
  eservice: catalogApi.EService;
}> {
  const consumerTask = tenantProcessClient.tenant.getTenant({
    params: { id: agreement.consumerId },
    headers,
  });

  const producerTask = tenantProcessClient.tenant.getTenant({
    params: { id: agreement.producerId },
    headers,
  });
  const eserviceTask = catalogProcessClient.getEServiceById({
    params: { eServiceId: agreement.eserviceId },
    headers,
  });
  const [consumer, producer, eservice] = await Promise.all([
    consumerTask,
    producerTask,
    eserviceTask,
  ]);

  return {
    consumer,
    producer,
    eservice,
  };
}

function filterAttributes(
  attributes: attributeRegistryApi.Attribute[],
  filterIds: string[]
): attributeRegistryApi.Attribute[] {
  return attributes.filter((attr) => filterIds.includes(attr.id));
}

export function getCurrentDescriptor(
  eservice: catalogApi.EService,
  agreement: agreementApi.Agreement
): catalogApi.EServiceDescriptor {
  const descriptor = eservice.descriptors.find(
    (descriptor) => descriptor.id === agreement.descriptorId
  );

  if (!descriptor) {
    throw agreementDescriptorNotFound(agreement.id);
  }
  return descriptor;
}

const emptyPagination = (offset: number, limit: number) => ({
  pagination: {
    limit,
    offset,
    totalCount: 0,
  },
  results: [],
});
