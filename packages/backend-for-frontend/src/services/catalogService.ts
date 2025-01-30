/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import { randomUUID } from "crypto";
import AdmZip from "adm-zip";
import { bffApi, catalogApi, tenantApi } from "pagopa-interop-api-clients";
import {
  FileManager,
  WithLogger,
  createPollingByCondition,
  formatDateyyyyMMddThhmmss,
  getAllFromPaginated,
} from "pagopa-interop-commons";
import {
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  RiskAnalysisId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { BffProcessConfig, config } from "../config/config.js";
import {
  eserviceDescriptorNotFound,
  eserviceRiskNotFound,
  invalidZipStructure,
  missingDescriptorInClonedEservice,
  noDescriptorInEservice,
  tenantNotFound,
} from "../model/errors.js";
import { getLatestActiveDescriptor } from "../model/modelMappingUtils.js";
import {
  AgreementProcessClient,
  AttributeProcessClient,
  CatalogProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import {
  verifyAndCreateEServiceDocument,
  verifyAndCreateImportedDoc,
} from "../utilities/eserviceDocumentUtils.js";
import {
  cloneEServiceDocument,
  createDescriptorDocumentZipFile,
} from "../utilities/fileUtils.js";
import {
  toBffCatalogApiEService,
  toBffCatalogApiDescriptorAttributes,
  toBffCatalogApiDescriptorDoc,
  toBffCatalogApiProducerDescriptorEService,
  toBffCatalogApiEserviceRiskAnalysis,
  toCatalogCreateEServiceSeed,
  toBffCatalogDescriptorEService,
  toBffCatalogApiEserviceRiskAnalysisSeed,
  toCompactProducerDescriptor,
} from "../api/catalogApiConverter.js";
import { ConfigurationEservice } from "../model/types.js";
import { getAllAgreements, getLatestAgreement } from "./agreementService.js";
import { getAllBulkAttributes } from "./attributeService.js";
import {
  assertNotDelegatedEservice,
  assertRequesterIsProducer,
  assertRequesterCanActAsProducer,
  isInvalidDescriptor,
} from "./validators.js";

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;

export const enhanceCatalogEservices = async (
  eservices: catalogApi.EService[],
  tenantProcessClient: TenantProcessClient,
  agreementProcessClient: AgreementProcessClient,
  headers: Headers,
  requesterId: TenantId
): Promise<bffApi.CatalogEService[]> => {
  const tenantsIds = new Set([
    ...eservices.map((e) => e.producerId),
    requesterId,
  ] as TenantId[]);

  const cachedTenants = new Map(
    await Promise.all(
      Array.from(tenantsIds).map(
        async (tenantId): Promise<[TenantId, tenantApi.Tenant]> => [
          tenantId,
          await tenantProcessClient.tenant.getTenant({
            headers,
            params: { id: tenantId },
          }),
        ]
      )
    )
  );

  const getCachedTenant = (tenantId: TenantId): tenantApi.Tenant => {
    const tenant = cachedTenants.get(tenantId);
    if (!tenant) {
      throw tenantNotFound(tenantId);
    }
    return tenant;
  };
  const enhanceEService =
    (
      agreementProcessClient: AgreementProcessClient,
      headers: Headers,
      requesterId: TenantId
    ): ((eservice: catalogApi.EService) => Promise<bffApi.CatalogEService>) =>
    async (eservice: catalogApi.EService): Promise<bffApi.CatalogEService> => {
      const producerTenant = getCachedTenant(eservice.producerId as TenantId);
      const requesterTenant = getCachedTenant(requesterId);

      const latestActiveDescriptor = getLatestActiveDescriptor(eservice);

      const latestAgreement = await getLatestAgreement(
        agreementProcessClient,
        requesterId,
        eservice,
        headers
      );

      const isRequesterEqProducer = requesterId === eservice.producerId;

      return toBffCatalogApiEService(
        eservice,
        producerTenant,
        requesterTenant,
        isRequesterEqProducer,
        latestActiveDescriptor,
        latestAgreement
      );
    };

  return await Promise.all(
    eservices.map(enhanceEService(agreementProcessClient, headers, requesterId))
  );
};

const enhanceProducerEService = (
  eservice: catalogApi.EService,
  requesterId: TenantId
): bffApi.ProducerEService => {
  const activeDescriptor = getLatestActiveDescriptor(eservice);
  const draftDescriptor = eservice.descriptors.find(isInvalidDescriptor);

  const isRequesterDelegateProducer = requesterId !== eservice.producerId;

  return {
    id: eservice.id,
    name: eservice.name,
    mode: eservice.mode,
    activeDescriptor: activeDescriptor
      ? toCompactProducerDescriptor(
          activeDescriptor,
          isRequesterDelegateProducer
        )
      : undefined,
    draftDescriptor: draftDescriptor
      ? toCompactProducerDescriptor(
          draftDescriptor,
          isRequesterDelegateProducer
        )
      : undefined,
  };
};

export const retrieveEserviceDescriptor = (
  eservice: catalogApi.EService,
  descriptorId: DescriptorId
): catalogApi.EServiceDescriptor => {
  const descriptor = eservice.descriptors.find((e) => e.id === descriptorId);

  if (!descriptor) {
    throw eserviceDescriptorNotFound(eservice.id, descriptorId);
  }

  return descriptor;
};

const retrieveRiskAnalysis = (
  eservice: catalogApi.EService,
  riskAnalysisId: RiskAnalysisId
): catalogApi.EServiceRiskAnalysis => {
  const riskAnalysis = eservice.riskAnalysis.find(
    (ra) => ra.id === riskAnalysisId
  );

  if (!riskAnalysis) {
    throw eserviceRiskNotFound(eservice.id, riskAnalysisId);
  }
  return riskAnalysis;
};

const getAttributeIds = (
  descriptor: catalogApi.EServiceDescriptor
): string[] => [
  ...descriptor.attributes.certified.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
  ...descriptor.attributes.declared.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
  ...descriptor.attributes.verified.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
];

export const getAllEserviceConsumers = async (
  catalogProcessClient: CatalogProcessClient,
  headers: Headers,
  eServiceId: EServiceId
): Promise<catalogApi.EServiceConsumer[]> =>
  await getAllFromPaginated(async (offset, limit) =>
    catalogProcessClient.getEServiceConsumers({
      headers,
      params: {
        eServiceId,
      },
      queries: { offset, limit },
    })
  );

export function catalogServiceBuilder(
  catalogProcessClient: CatalogProcessClient,
  tenantProcessClient: TenantProcessClient,
  agreementProcessClient: AgreementProcessClient,
  attributeProcessClient: AttributeProcessClient,
  delegationProcessClient: DelegationProcessClient,
  fileManager: FileManager,
  bffConfig: BffProcessConfig
) {
  return {
    getCatalog: async (
      { headers, authData, logger }: WithLogger<BffAppContext>,
      queries: catalogApi.GetEServicesQueryParams
    ): Promise<bffApi.CatalogEServices> => {
      const { offset, limit, producersIds, states, attributesIds, name } =
        queries;
      logger.info(
        `Retrieving EServices for name = ${name}, producersIds = ${producersIds}, attributesIds = ${attributesIds}, states = ${states}, offset = ${offset}, limit = ${limit}`
      );
      const requesterId = authData.organizationId;
      const eservicesResponse: catalogApi.EServices =
        await catalogProcessClient.getEServices({
          headers,
          queries,
        });

      const results = await enhanceCatalogEservices(
        eservicesResponse.results,
        tenantProcessClient,
        agreementProcessClient,
        headers,
        requesterId
      );
      const response: bffApi.CatalogEServices = {
        results,
        pagination: {
          offset,
          limit,
          totalCount: eservicesResponse.totalCount,
        },
      };
      return response;
    },
    getProducerEServiceDescriptor: async (
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceDescriptor> => {
      logger.info(
        `Retrieving producer EService Descriptor for eserviceId = ${eserviceId}, descriptorId = ${descriptorId}`
      );
      const requesterId = authData.organizationId;

      const eservice: catalogApi.EService =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId: eserviceId,
          },
          headers,
        });

      await assertRequesterCanActAsProducer(
        delegationProcessClient,
        headers,
        requesterId,
        eservice
      );

      const descriptor = retrieveEserviceDescriptor(eservice, descriptorId);

      const descriptorAttributeIds = getAttributeIds(descriptor);

      const attributes = await getAllBulkAttributes(
        attributeProcessClient,
        headers,
        descriptorAttributeIds
      );

      const descriptorAttributes = toBffCatalogApiDescriptorAttributes(
        attributes,
        descriptor
      );

      const producerTenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: eservice.producerId,
        },
      });

      return {
        id: descriptor.id,
        version: descriptor.version,
        description: descriptor.description,
        interface:
          descriptor.interface &&
          toBffCatalogApiDescriptorDoc(descriptor.interface),
        docs: descriptor.docs.map(toBffCatalogApiDescriptorDoc),
        state: descriptor.state,
        audience: descriptor.audience,
        voucherLifespan: descriptor.voucherLifespan,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
        dailyCallsTotal: descriptor.dailyCallsTotal,
        agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
        attributes: descriptorAttributes,
        eservice: toBffCatalogApiProducerDescriptorEService(
          eservice,
          producerTenant
        ),
        rejectionReasons: descriptor.rejectionReasons,
      };
    },
    getProducerEServiceDetails: async (
      eServiceId: EServiceId,
      { headers, authData, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceDetails> => {
      logger.info(
        `Retrieving producer EService Details for eserviceId = ${eServiceId}`
      );
      const requesterId = authData.organizationId;

      const eservice: catalogApi.EService =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId,
          },
          headers,
        });

      await assertRequesterCanActAsProducer(
        delegationProcessClient,
        headers,
        requesterId,
        eservice
      );

      return {
        id: eservice.id,
        name: eservice.name,
        description: eservice.description,
        technology: eservice.technology,
        mode: eservice.mode,
        riskAnalysis: eservice.riskAnalysis.map(
          toBffCatalogApiEserviceRiskAnalysis
        ),
        isSignalHubEnabled: eservice.isSignalHubEnabled,
      };
    },
    updateEServiceDescription: async (
      { headers, logger }: WithLogger<BffAppContext>,
      eServiceId: EServiceId,
      updateSeed: bffApi.EServiceDescriptionUpdateSeed
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Updating EService Description for eserviceId = ${eServiceId}`
      );
      const updatedEservice =
        await catalogProcessClient.updateEServiceDescription(updateSeed, {
          headers,
          params: {
            eServiceId,
          },
        });

      return {
        id: updatedEservice.id,
      };
    },
    updateEServiceName: async (
      { headers, logger }: WithLogger<BffAppContext>,
      eServiceId: EServiceId,
      nameUpdateSeed: bffApi.EServiceNameUpdateSeed
    ): Promise<void> => {
      logger.info(`Updating EService name of eservice with id = ${eServiceId}`);
      await catalogProcessClient.updateEServiceName(nameUpdateSeed, {
        headers,
        params: {
          eServiceId,
        },
      });
    },
    createEService: async (
      eServiceSeed: bffApi.EServiceSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedEServiceDescriptor> => {
      logger.info(
        `Creating EService with seed ${JSON.stringify(eServiceSeed)}`
      );
      const { id, descriptors } = await catalogProcessClient.createEService(
        toCatalogCreateEServiceSeed(eServiceSeed),
        {
          headers,
        }
      );
      return { id, descriptorId: descriptors[0].id };
    },
    updateEServiceById: async (
      eServiceId: EServiceId,
      updateEServiceSeed: bffApi.UpdateEServiceSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Updating EService ${eServiceId} with seed ${JSON.stringify(
          updateEServiceSeed
        )}`
      );
      const { id } = await catalogProcessClient.updateEServiceById(
        updateEServiceSeed,
        {
          headers,
          params: {
            eServiceId,
          },
        }
      );
      return { id };
    },
    deleteEService: async (
      eServiceId: EServiceId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Deleting EService ${eServiceId}`);
      await catalogProcessClient.deleteEService(undefined, {
        headers,
        params: {
          eServiceId,
        },
      });
    },
    createEServiceDocument: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      doc: bffApi.createEServiceDocument_Body,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      ctx.logger.info(
        `Creating EService Document for EService ${eServiceId} and Descriptor ${descriptorId}`
      );
      const eService = await catalogProcessClient.getEServiceById({
        params: { eServiceId },
        headers: ctx.headers,
      });

      retrieveEserviceDescriptor(eService, unsafeBrandId(descriptorId));

      const documentId = randomUUID();

      await verifyAndCreateEServiceDocument(
        catalogProcessClient,
        fileManager,
        eService,
        doc,
        descriptorId,
        documentId,
        ctx
      );

      return { id: documentId };
    },
    getProducerEServices: async (
      eserviceName: string | undefined,
      consumersIds: string[],
      delegated: boolean | undefined,
      offset: number,
      limit: number,
      { headers, authData, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServices> => {
      logger.info(
        `Retrieving producer EServices with name ${eserviceName}, offset ${offset}, limit ${limit}, consumersIds ${JSON.stringify(
          consumersIds
        )}`
      );
      const requesterId = authData.organizationId;
      const res: {
        results: catalogApi.EService[];
        totalCount: number;
      } = {
        results: [],
        totalCount: 0,
      };

      if (consumersIds.length === 0) {
        const { results, totalCount } = await catalogProcessClient.getEServices(
          {
            headers,
            queries: {
              name: eserviceName,
              producersIds: requesterId,
              delegated,
              offset,
              limit,
            },
          }
        );

        res.results = results;
        res.totalCount = totalCount;
      } else {
        const eserviceIds = (
          await getAllAgreements(agreementProcessClient, headers, {
            consumersIds,
            producersIds: [requesterId],
            eservicesIds: [],
            states: [],
          })
        ).map((agreement) => agreement.eserviceId);

        const { results, totalCount } = await catalogProcessClient.getEServices(
          {
            headers,
            queries: {
              name: eserviceName,
              eservicesIds: eserviceIds,
              producersIds: requesterId,
              delegated,
              offset,
              limit,
            },
          }
        );

        res.results = results;
        res.totalCount = totalCount;
      }

      return {
        results: res.results.map((result) =>
          enhanceProducerEService(result, requesterId)
        ),
        pagination: {
          offset,
          limit,
          totalCount: res.totalCount,
        },
      };
    },
    getCatalogEServiceDescriptor: async (
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CatalogEServiceDescriptor> => {
      logger.info(
        `Retrieving Descriptor ${descriptorId} of EService ${eserviceId}`
      );
      const requesterId = authData.organizationId;

      const eservice = await catalogProcessClient.getEServiceById({
        params: {
          eServiceId: eserviceId,
        },
        headers,
      });

      const descriptor = retrieveEserviceDescriptor(eservice, descriptorId);
      const attributeIds = getAttributeIds(descriptor);
      const attributes = await getAllBulkAttributes(
        attributeProcessClient,
        headers,
        attributeIds
      );

      const descriptorAttributes = toBffCatalogApiDescriptorAttributes(
        attributes,
        descriptor
      );

      const requesterTenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: requesterId,
        },
      });
      const producerTenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: eservice.producerId,
        },
      });
      const agreement = await getLatestAgreement(
        agreementProcessClient,
        requesterId,
        eservice,
        headers
      );

      return {
        id: descriptor.id,
        version: descriptor.version,
        description: descriptor.description,
        state: descriptor.state,
        audience: descriptor.audience,
        voucherLifespan: descriptor.voucherLifespan,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
        dailyCallsTotal: descriptor.dailyCallsTotal,
        agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
        attributes: descriptorAttributes,
        publishedAt: descriptor.publishedAt,
        suspendedAt: descriptor.suspendedAt,
        deprecatedAt: descriptor.deprecatedAt,
        archivedAt: descriptor.archivedAt,
        interface:
          descriptor.interface &&
          toBffCatalogApiDescriptorDoc(descriptor.interface),
        docs: descriptor.docs.map(toBffCatalogApiDescriptorDoc),
        eservice: toBffCatalogDescriptorEService(
          eservice,
          descriptor,
          producerTenant,
          agreement,
          requesterTenant
        ),
      };
    },
    getEServiceConsumers: async (
      eserviceId: EServiceId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<{
      filename: string;
      file: Buffer;
    }> => {
      logger.info(`Retrieving Consumers of EService ${eserviceId}`);
      const eservice = await catalogProcessClient.getEServiceById({
        params: {
          eServiceId: eserviceId,
        },
        headers,
      });

      const consumers = await getAllEserviceConsumers(
        catalogProcessClient,
        headers,
        eserviceId
      );

      const currentDate = formatDateyyyyMMddThhmmss(new Date());
      const filename = `${currentDate}-lista-fruitori-${eservice.name}.csv`;

      const buildCsv = (consumers: catalogApi.EServiceConsumer[]): string =>
        [
          "versione,stato_versione,stato_richiesta_fruizione,fruitore,codice_ipa_fruitore",
          ...consumers.map((c) =>
            [
              c.descriptorVersion,
              c.descriptorState,
              c.agreementState,
              c.consumerName,
              c.consumerExternalId,
            ].join(",")
          ),
        ].join("\n");

      return {
        filename,
        file: Buffer.from(buildCsv(consumers)),
      };
    },
    updateEServiceRiskAnalysis: async (
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysisId,
      riskAnalysisSeed: bffApi.EServiceRiskAnalysisSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating risk analysis ${riskAnalysisId} of EService ${eserviceId}`
      );
      await catalogProcessClient.updateRiskAnalysis(riskAnalysisSeed, {
        headers,
        params: {
          eServiceId: eserviceId,
          riskAnalysisId,
        },
      });
    },
    deleteEServiceRiskAnalysis: async (
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysisId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Deleting risk analysis ${riskAnalysisId} of EService ${eserviceId}`
      );
      await catalogProcessClient.deleteRiskAnalysis(undefined, {
        headers,
        params: {
          eServiceId: eserviceId,
          riskAnalysisId,
        },
      });
    },
    addRiskAnalysisToEService: async (
      eserviceId: EServiceId,
      riskAnalysisSeed: bffApi.EServiceRiskAnalysisSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Adding risk analysis to EService ${eserviceId}`);
      await catalogProcessClient.createRiskAnalysis(
        {
          name: riskAnalysisSeed.name,
          riskAnalysisForm: riskAnalysisSeed.riskAnalysisForm,
        },
        {
          headers,
          params: {
            eServiceId: eserviceId,
          },
        }
      );
    },
    getEServiceRiskAnalysis: async (
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysisId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.EServiceRiskAnalysis> => {
      logger.info(
        `Retrieving risk analysis ${riskAnalysisId} of EService ${eserviceId}`
      );
      const eservice: catalogApi.EService =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId: eserviceId,
          },
          headers,
        });

      const riskAnalysis = retrieveRiskAnalysis(eservice, riskAnalysisId);

      return toBffCatalogApiEserviceRiskAnalysis(riskAnalysis);
    },
    getEServiceDocumentById: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<{ contentType: string; document: Buffer }> => {
      logger.info(
        `Retrieving document ${documentId} of descriptor ${descriptorId} of EService ${eServiceId}`
      );
      const { path, contentType } =
        await catalogProcessClient.getEServiceDocumentById({
          params: {
            eServiceId,
            descriptorId,
            documentId,
          },
          headers,
        });

      const stream = await fileManager.get(
        config.eserviceDocumentsContainer,
        path,
        logger
      );

      return { contentType, document: Buffer.from(stream) };
    },
    createDescriptor: async (
      eServiceId: EServiceId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(`Creating descriptor for EService ${eServiceId}`);
      const eService = await catalogProcessClient.getEServiceById({
        params: { eServiceId },
        headers,
      });

      if (eService.descriptors.length === 0) {
        throw noDescriptorInEservice(eServiceId);
      }

      const retrieveLatestDescriptor = (
        descriptors: catalogApi.EServiceDescriptor[]
      ): catalogApi.EServiceDescriptor =>
        descriptors.reduce(
          (latestDescriptor, curr) =>
            parseInt(curr.version, 10) > parseInt(latestDescriptor.version, 10)
              ? curr
              : latestDescriptor,
          descriptors[0]
        );

      const previousDescriptor = retrieveLatestDescriptor(eService.descriptors);

      const clonedDocumentsCalls = previousDescriptor.docs.map((doc) =>
        cloneEServiceDocument({
          doc,
          documentsContainer: config.eserviceDocumentsContainer,
          documentsPath: config.eserviceDocumentsPath,
          fileManager,
          logger,
        })
      );

      const clonedDocuments = await Promise.all(clonedDocumentsCalls);

      const { id } = await catalogProcessClient.createDescriptor(
        {
          description: previousDescriptor.description,
          audience: [],
          voucherLifespan: previousDescriptor.voucherLifespan,
          dailyCallsPerConsumer: previousDescriptor.dailyCallsPerConsumer,
          dailyCallsTotal: previousDescriptor.dailyCallsTotal,
          agreementApprovalPolicy: previousDescriptor.agreementApprovalPolicy,
          attributes: previousDescriptor.attributes,
          docs: clonedDocuments,
        },
        {
          headers,
          params: {
            eServiceId,
          },
        }
      );
      return { id };
    },
    deleteDraft: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Deleting draft descriptor ${descriptorId} of EService ${eServiceId}`
      );
      await catalogProcessClient.deleteDraft(undefined, {
        headers,
        params: {
          descriptorId,
          eServiceId,
        },
      });
    },
    updateDraftDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      updateEServiceDescriptorSeed: bffApi.UpdateEServiceDescriptorSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Updating draft descriptor ${descriptorId} of EService ${eServiceId}`
      );
      const { id } = await catalogProcessClient.updateDraftDescriptor(
        updateEServiceDescriptorSeed,
        {
          headers,
          params: {
            descriptorId,
            eServiceId,
          },
        }
      );
      return { id };
    },
    deleteEServiceDocumentById: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Deleting document ${documentId} of descriptor ${descriptorId} of EService ${eServiceId}`
      );
      await catalogProcessClient.deleteEServiceDocumentById(undefined, {
        params: {
          eServiceId,
          descriptorId,
          documentId,
        },
        headers,
      });
    },
    cloneEServiceByDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedEServiceDescriptor> => {
      logger.info(
        `Cloning EService ${eServiceId} by descriptor ${descriptorId}`
      );
      const eService = await catalogProcessClient.cloneEServiceByDescriptor(
        undefined,
        {
          params: {
            eServiceId,
            descriptorId,
          },
          headers,
        }
      );
      const eServiceDescriptorId = eService.descriptors.at(0)?.id;
      if (!eServiceDescriptorId) {
        throw missingDescriptorInClonedEservice(eService.id);
      }
      return { id: eService.id, descriptorId: eServiceDescriptorId };
    },
    activateDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Activating descriptor ${descriptorId} of EService ${eServiceId}`
      );
      await catalogProcessClient.activateDescriptor(undefined, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    updateDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.UpdateEServiceDescriptorQuotasSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Updating descriptor ${descriptorId} of EService ${eServiceId}`
      );
      return await catalogProcessClient.updateDescriptor(seed, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    publishDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Publishing descriptor ${descriptorId} of EService ${eServiceId}`
      );
      await catalogProcessClient.publishDescriptor(undefined, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    suspendDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Suspending descriptor ${descriptorId} of EService ${eServiceId}`
      );
      await catalogProcessClient.suspendDescriptor(undefined, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    updateEServiceDocumentById: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      updateEServiceDescriptorDocumentSeed: bffApi.UpdateEServiceDescriptorDocumentSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.EServiceDoc> => {
      logger.info(
        `Updating document ${documentId} of descriptor ${descriptorId} of EService ${eServiceId}`
      );
      const { id, name, contentType, prettyName } =
        await catalogProcessClient.updateEServiceDocumentById(
          updateEServiceDescriptorDocumentSeed,
          {
            params: {
              eServiceId,
              descriptorId,
              documentId,
            },
            headers,
          }
        );

      return { id, name, contentType, prettyName };
    },
    exportEServiceDescriptor: async (
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.FileResource> => {
      logger.info(
        `Exporting descriptor ${descriptorId} of EService ${eserviceId}`
      );
      const requesterId = authData.organizationId;

      const eservice = await catalogProcessClient.getEServiceById({
        params: {
          eServiceId: eserviceId,
        },
        headers,
      });

      assertRequesterIsProducer(requesterId, eservice);
      await assertNotDelegatedEservice(
        delegationProcessClient,
        headers,
        requesterId,
        eserviceId
      );

      const zipFolderName = `${eservice.id}_${descriptorId}`;
      const zipFile = await createDescriptorDocumentZipFile(
        bffConfig.eserviceDocumentsContainer,
        fileManager,
        logger,
        zipFolderName,
        eservice,
        descriptorId
      );

      const zipFilePath = `${bffConfig.exportEservicePath}/${requesterId}`;
      const zipFileName = `${zipFolderName}.zip`;
      await fileManager.storeBytes(
        {
          bucket: bffConfig.exportEserviceContainer,
          path: zipFilePath,
          name: zipFileName,
          content: Buffer.from(zipFile),
        },
        logger
      );

      const url = await fileManager.generateGetPresignedUrl(
        bffConfig.exportEserviceContainer,
        zipFilePath,
        zipFileName,
        bffConfig.presignedUrlGetDurationMinutes
      );

      return {
        filename: zipFileName,
        url,
      };
    },
    generatePutPresignedUrl: async (
      filename: string,
      { authData, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PresignedUrl> => {
      logger.info(
        `Generating presigned url for file ${filename} for organization ${authData.organizationId}`
      );
      const path = `${bffConfig.importEservicePath}/${authData.organizationId}`;
      const url = await fileManager.generatePutPresignedUrl(
        bffConfig.importEserviceContainer,
        path,
        filename,
        bffConfig.presignedUrlPutDurationMinutes
      );

      return {
        url,
      };
    },
    importEService: async (
      fileResource: bffApi.FileResource,
      context: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedEServiceDescriptor> => {
      const { logger, authData, headers } = context;
      logger.info(
        `Importing EService for organization ${authData.organizationId}`
      );
      const tenantId = authData.organizationId;
      const zipFile = await fileManager.get(
        config.importEserviceContainer,
        `${config.importEservicePath}/${tenantId}/${fileResource.filename}`,
        logger
      );

      const zip = new AdmZip(Buffer.from(zipFile));

      const rootFolderName = fileResource.filename.replace(".zip", "");

      const entriesMap = zip.getEntries().reduce((map, entry) => {
        map.set(entry.entryName.replace(rootFolderName + "/", ""), entry);
        return map;
      }, new Map<string, AdmZip.IZipEntry>());

      const configurationEntry = entriesMap.get("configuration.json");
      if (!configurationEntry) {
        throw invalidZipStructure("Error reading configuration.json");
      }

      const jsonContent = configurationEntry.getData().toString("utf8");
      const { data: importedEservice, error } = ConfigurationEservice.safeParse(
        JSON.parse(jsonContent)
      );

      if (error) {
        throw invalidZipStructure("Error decoding configuration.json");
      }
      const docsPath = importedEservice.descriptor.docs.map((doc) =>
        entriesMap.get(doc.path)?.getData()
      );
      if (docsPath.some((doc) => doc === undefined)) {
        throw invalidZipStructure("Error reading docs");
      }

      const descriptorInterface = importedEservice.descriptor.interface;

      if (
        descriptorInterface &&
        entriesMap.get(descriptorInterface.path) === undefined
      ) {
        throw invalidZipStructure("Error reading interface");
      }

      const allowedFiles = [
        "configuration.json",
        "documents/",
        importedEservice.descriptor.interface?.path,
        ...importedEservice.descriptor.docs.map((doc) => doc.path),
      ].filter(
        (path: string | undefined): path is string => path !== undefined
      );

      const filePaths = Array.from(entriesMap.keys());

      const difference = filePaths.filter(
        (item) => !allowedFiles.includes(item)
      );
      if (difference.length > 0) {
        throw invalidZipStructure(
          `Not allowed files found: ${difference.join(", ")}`
        );
      }

      const eserviceSeed: catalogApi.EServiceSeed = {
        name: importedEservice.name,
        description: importedEservice.description,
        technology: importedEservice.technology,
        mode: importedEservice.mode,
        descriptor: {
          description: importedEservice.descriptor.description,
          audience: importedEservice.descriptor.audience,
          voucherLifespan: importedEservice.descriptor.voucherLifespan,
          dailyCallsPerConsumer:
            importedEservice.descriptor.dailyCallsPerConsumer,
          dailyCallsTotal: importedEservice.descriptor.dailyCallsTotal,
          agreementApprovalPolicy:
            importedEservice.descriptor.agreementApprovalPolicy,
        },
        isSignalHubEnabled: importedEservice.isSignalHubEnabled,
      };

      const pollEServiceById = createPollingByCondition(() =>
        catalogProcessClient.getEServiceById({
          params: {
            eServiceId: eservice.id,
          },
          headers,
        })
      );

      const eservice = await catalogProcessClient.createEService(eserviceSeed, {
        headers,
      });
      await pollEServiceById((result) => result.descriptors.length > 0);

      for (const riskAnalysis of importedEservice.riskAnalysis) {
        try {
          await catalogProcessClient.createRiskAnalysis(
            toBffCatalogApiEserviceRiskAnalysisSeed(riskAnalysis),
            {
              headers,
              params: {
                eServiceId: eservice.id,
              },
            }
          );
        } catch (error) {
          await catalogProcessClient.deleteEService(undefined, {
            headers: context.headers,
            params: {
              eServiceId: eservice.id,
            },
          });
        }
        await pollEServiceById((result) => result.riskAnalysis.length > 0);
      }

      const descriptor = eservice.descriptors[0];
      if (descriptorInterface) {
        await verifyAndCreateImportedDoc(
          catalogProcessClient,
          fileManager,
          eservice,
          descriptor,
          entriesMap,
          descriptorInterface,
          "INTERFACE",
          context
        );
      }
      await pollEServiceById((result) =>
        result.descriptors.some(
          (d) => d.id === descriptor.id && d.interface !== undefined
        )
      );

      for (const doc of importedEservice.descriptor.docs) {
        await verifyAndCreateImportedDoc(
          catalogProcessClient,
          fileManager,
          eservice,
          descriptor,
          entriesMap,
          doc,
          "DOCUMENT",
          context
        );
        await pollEServiceById((result) =>
          result.descriptors.some(
            (d) =>
              d.id === descriptor.id &&
              d.docs.some((d) => d.prettyName === doc.prettyName)
          )
        );
      }

      return {
        id: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      };
    },
    approveDelegatedEServiceDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: EServiceId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Approving e-service ${eServiceId} version ${descriptorId}`);
      await catalogProcessClient.approveDelegatedEServiceDescriptor(undefined, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    rejectDelegatedEServiceDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: EServiceId,
      body: catalogApi.RejectDelegatedEServiceDescriptorSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Rejecting e-service ${eServiceId} version ${descriptorId}`);
      await catalogProcessClient.rejectDelegatedEServiceDescriptor(body, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    updateDescriptorAttributes: async (
      eServiceId: EServiceId,
      descriptorId: EServiceId,
      body: bffApi.DescriptorAttributesSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating attributes of Descriptor ${descriptorId} for EService ${eServiceId}`
      );
      await catalogProcessClient.updateDescriptorAttributes(body, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
  };
}
