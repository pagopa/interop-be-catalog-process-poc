/* eslint-disable max-params */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { randomUUID } from "crypto";
import {
  FileManager,
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
  delegationApi,
} from "pagopa-interop-api-clients";
import { match, P } from "ts-pattern";
import {
  AgreementProcessClient,
  PagoPAInteropBeClients,
} from "../clients/clientsProvider.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import {
  agreementDescriptorNotFound,
  contractException,
  contractNotFound,
} from "../model/errors.js";
import { config } from "../config/config.js";
import { getLatestTenantContactEmail } from "../model/modelMappingUtils.js";
import {
  toCompactEservice,
  toCompactDescriptor,
} from "../api/catalogApiConverter.js";
import {
  toBffAgreementConsumerDocument,
  toBffAttribute,
  toBffCompactOrganization,
  toCompactEserviceLight,
} from "../api/agreementApiConverter.js";
import { getAllBulkAttributes } from "./attributeService.js";
import { enhanceTenantAttributes } from "./tenantService.js";
import { isAgreementUpgradable } from "./validators.js";
import { getTenantById } from "./delegationService.js";

export async function getAllAgreements(
  agreementProcessClient: AgreementProcessClient,
  headers: BffAppContext["headers"],
  getAgreementsQueryParams: Partial<agreementApi.GetAgreementsQueryParams>
): Promise<agreementApi.Agreement[]> {
  return await getAllFromPaginated<agreementApi.Agreement>(
    async (offset, limit) =>
      await agreementProcessClient.getAgreements({
        headers,
        queries: {
          ...getAgreementsQueryParams,
          offset,
          limit,
        },
      })
  );
}

export function agreementServiceBuilder(
  clients: PagoPAInteropBeClients,
  fileManager: FileManager
) {
  const { agreementProcessClient } = clients;
  return {
    async createAgreement(
      payload: bffApi.AgreementPayload,
      { headers, logger, authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      logger.info(
        `Creating agreement with consumerId ${authData.organizationId} eserviceId ${payload.eserviceId} descriptorId ${payload.descriptorId}`
      );

      const { id } = await agreementProcessClient.createAgreement(payload, {
        headers,
      });
      return { id };
    },

    async getConsumerAgreements(
      {
        offset,
        limit,
        eservicesIds,
        producersIds,
        states,
        showOnlyUpgradeable,
      }: {
        offset: number;
        limit: number;
        eservicesIds: string[];
        producersIds: string[];
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
            consumersIds: [ctx.authData.organizationId],
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

    async getProducerAgreements(
      {
        offset,
        limit,
        eservicesIds,
        consumersIds,
        states,
        showOnlyUpgradeable,
      }: {
        offset: number;
        limit: number;
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
            producersIds: [ctx.authData.organizationId],
            offset,
            limit,
            showOnlyUpgradeable,
            eservicesIds,
            consumersIds,
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

    async addAgreementConsumerDocument(
      agreementId: string,
      doc: bffApi.addAgreementConsumerDocument_Body,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<Buffer> {
      logger.info(`Adding consumer document to agreement ${agreementId}`);

      const documentPath = `${config.consumerDocumentsPath}/${agreementId}`;
      const documentContent = Buffer.from(await doc.doc.arrayBuffer());
      const documentId = randomUUID();

      const storagePath = await fileManager.storeBytes(
        {
          bucket: config.consumerDocumentsContainer,
          path: documentPath,
          resourceId: documentId,
          name: doc.doc.name,
          content: documentContent,
        },
        logger
      );

      const seed: agreementApi.DocumentSeed = {
        id: documentId,
        prettyName: doc.prettyName,
        name: doc.doc.name,
        contentType: doc.doc.type,
        path: storagePath,
      };

      await agreementProcessClient.addAgreementConsumerDocument(seed, {
        params: { agreementId },
        headers,
      });

      return documentContent;
    },

    async getAgreementConsumerDocument(
      agreementId: string,
      documentId: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<Buffer> {
      logger.info(
        `Retrieving consumer document ${documentId} from agreement ${agreementId}`
      );

      const document =
        await agreementProcessClient.getAgreementConsumerDocument({
          params: { agreementId, documentId },
          headers,
        });

      const documentBytes = await fileManager.get(
        config.consumerDocumentsContainer,
        document.path,
        logger
      );

      return Buffer.from(documentBytes);
    },

    async getAgreementContract(
      agreementId: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<Buffer> {
      logger.info(`Retrieving contract for agreement ${agreementId}`);

      const agreement = await agreementProcessClient.getAgreementById({
        params: { agreementId },
        headers,
      });

      if (!agreement.contract) {
        if (
          agreement.state === agreementApi.AgreementState.Values.ACTIVE ||
          agreement.state === agreementApi.AgreementState.Values.SUSPENDED ||
          agreement.state === agreementApi.AgreementState.Values.ARCHIVED
        ) {
          throw contractException(agreementId);
        }
        throw contractNotFound(agreementId);
      }

      const documentBytes = await fileManager.get(
        config.consumerDocumentsContainer,
        agreement.contract.path,
        logger
      );

      return Buffer.from(documentBytes);
    },

    async removeConsumerDocument(
      agreementId: string,
      documentId: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Removing consumer document with id ${documentId} from agreement ${agreementId}`
      );

      await agreementProcessClient.removeAgreementConsumerDocument(undefined, {
        params: { agreementId, documentId },
        headers,
      });
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
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Deleting agreement ${agreementId}`);
      return await agreementProcessClient.deleteAgreement(undefined, {
        params: { agreementId },
        headers,
      });
    },

    async activateAgreement(
      agreementId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Agreement> {
      ctx.logger.info(`Activating agreement ${agreementId}`);
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
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      logger.info(`Cloning agreement ${agreementId}`);
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
      {
        offset,
        limit,
        requesterId,
        eServiceName,
      }: {
        offset: number;
        limit: number;
        requesterId: string;
        eServiceName?: string;
      },
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
      {
        offset,
        limit,
        producerName,
      }: { offset: number; limit: number; producerName?: string },
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
        results: producers.results.map((p) => toBffCompactOrganization(p)),
      };
    },

    async getAgreementConsumers(
      {
        offset,
        limit,
        consumerName,
      }: { offset: number; limit: number; consumerName?: string },
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
        results: consumers.results.map((c) => toBffCompactOrganization(c)),
      };
    },
    async verifyTenantCertifiedAttributes(
      body: bffApi.verifyTenantCertifiedAttributes_Body,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.HasCertifiedAttributes> {
      logger.info(
        `Veryfing tenant ${body.tenantId} has required certified attributes for descriptor ${body.descriptorId} of eservice ${body.eserviceId}`
      );
      return await agreementProcessClient.verifyTenantCertifiedAttributes(
        body,
        {
          headers,
        }
      );
    },
  };
}

export const getLatestAgreement = async (
  agreementProcessClient: AgreementProcessClient,
  consumerId: string,
  eservice: catalogApi.EService,
  headers: Headers
): Promise<agreementApi.Agreement | undefined> => {
  const allAgreements = await getAllAgreements(
    agreementProcessClient,
    headers,
    {
      consumersIds: [consumerId],
      eservicesIds: [eservice.id],
    }
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
  const { consumer, producer, eservice, delegation } =
    await getConsumerProducerEserviceDelegation(agreement, clients, ctx);

  const currentDescriptor = getCurrentDescriptor(eservice, agreement);

  const delegate =
    delegation !== undefined
      ? await getTenantById(
          clients.tenantProcessClient,
          ctx.headers,
          delegation.delegateId
        )
      : undefined;

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
    delegation:
      delegation !== undefined && delegate !== undefined
        ? {
            id: delegation.id,
            delegate: {
              id: delegation.delegateId,
              name: delegate.name,
              kind: delegate.kind,
              contactMail: getLatestTenantContactEmail(delegate),
            },
            delegator: {
              id: delegation.delegatorId,
              name: consumer.name,
              kind: consumer.kind,
              contactMail: getLatestTenantContactEmail(consumer),
            },
          }
        : undefined,
  };
}

export async function enrichAgreement(
  agreement: agreementApi.Agreement,
  clients: PagoPAInteropBeClients,
  ctx: WithLogger<BffAppContext>
): Promise<bffApi.Agreement> {
  const { consumer, producer, eservice } =
    await getConsumerProducerEserviceDelegation(agreement, clients, ctx);

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

  const attributes = await getAllBulkAttributes(
    clients.attributeProcessClient,
    ctx.headers,
    allAttributesIds
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

  const delegation = (
    await clients.delegationProcessClient.delegation.getDelegations({
      queries: {
        delegatorIds: [agreement.consumerId],
        eserviceIds: [agreement.eserviceId],
        offset: 0,
        limit: 1,
      },
      headers: ctx.headers,
    })
  ).results.at(0);

  const delegationInfo = await match(delegation)
    .with(P.nullish, () => undefined)
    .otherwise(async (delegation) => {
      const tenant = await clients.tenantProcessClient.tenant.getTenant({
        params: { id: delegation.delegateId },
        headers: ctx.headers,
      });

      return {
        id: delegation.id,
        delegate: {
          id: tenant.id,
          name: tenant.name,
          kind: tenant.kind,
          contactMail: getLatestTenantContactEmail(tenant),
        },
      };
    });

  return {
    id: agreement.id,
    descriptorId: agreement.descriptorId,
    delegation: delegationInfo,
    producer: {
      id: agreement.producerId,
      name: producer.name,
      kind: producer.kind,
      contactMail: getLatestTenantContactEmail(producer),
    },
    consumer: {
      id: agreement.consumerId,
      selfcareId: consumer.selfcareId,
      externalId: consumer.externalId,
      createdAt: consumer.createdAt,
      updatedAt: consumer.updatedAt,
      name: consumer.name,
      attributes: tenantAttributes,
      contactMail: getLatestTenantContactEmail(consumer),
      features: consumer.features,
    },
    eservice: {
      id: agreement.eserviceId,
      name: eservice.name,
      version: currentDescriptior.version,
      activeDescriptor: activeDescriptor
        ? toCompactDescriptor(activeDescriptor)
        : undefined,
    },
    state: agreement.state,
    verifiedAttributes: agreementVerifiedAttrs.map((a) => toBffAttribute(a)),
    certifiedAttributes: agreementCertifiedAttrs.map((a) => toBffAttribute(a)),
    declaredAttributes: agreementDeclaredAttrs.map((a) => toBffAttribute(a)),
    suspendedByConsumer: agreement.suspendedByConsumer,
    suspendedByProducer: agreement.suspendedByProducer,
    suspendedByPlatform: agreement.suspendedByPlatform,
    isContractPresent: agreement.contract !== undefined,
    consumerDocuments: agreement.consumerDocuments.map((doc) =>
      toBffAgreementConsumerDocument(doc)
    ),
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

async function getConsumerProducerEserviceDelegation(
  agreement: agreementApi.Agreement,
  {
    tenantProcessClient,
    catalogProcessClient,
    delegationProcessClient,
  }: PagoPAInteropBeClients,
  { headers }: WithLogger<BffAppContext>
): Promise<{
  consumer: tenantApi.Tenant;
  producer: tenantApi.Tenant;
  eservice: catalogApi.EService;
  delegation: delegationApi.Delegation | undefined;
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

  const delegationTask = delegationProcessClient.delegation.getDelegations({
    queries: {
      delegatorIds: [agreement.consumerId],
      eserviceIds: [agreement.eserviceId],
      kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
      offset: 0,
      limit: 1,
    },
    headers,
  });

  const [consumer, producer, eservice, delegation] = await Promise.all([
    consumerTask,
    producerTask,
    eserviceTask,
    delegationTask,
  ]);

  return {
    consumer,
    producer,
    eservice,
    delegation: delegation.results.at(0) ?? undefined,
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
