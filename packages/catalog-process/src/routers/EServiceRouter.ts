import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
  ReadModelRepository,
  initDB,
  initFileManager,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
} from "pagopa-interop-commons";
import {
  unsafeBrandId,
  EServiceId,
  TenantId,
  AttributeId,
} from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  agreementStateToApiAgreementState,
  apiAgreementStateToAgreementState,
  apiDescriptorStateToDescriptorState,
  apiEServiceModeToEServiceMode,
  descriptorStateToApiEServiceDescriptorState,
  descriptorToApiDescriptor,
  documentToApiDocument,
  eServiceToApiEService,
} from "../model/domain/apiConverter.js";
import { config } from "../config/config.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { catalogServiceBuilder } from "../services/catalogService.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  activateDescriptorErrorMapper,
  archiveDescriptorErrorMapper,
  cloneEServiceByDescriptorErrorMapper,
  createDescriptorErrorMapper,
  createEServiceErrorMapper,
  createRiskAnalysisErrorMapper,
  deleteDraftDescriptorErrorMapper,
  deleteEServiceErrorMapper,
  deleteRiskAnalysisErrorMapper,
  documentCreateErrorMapper,
  documentDeleteErrorMapper,
  documentGetErrorMapper,
  documentUpdateErrorMapper,
  getEServiceErrorMapper,
  publishDescriptorErrorMapper,
  suspendDescriptorErrorMapper,
  updateDescriptorErrorMapper,
  updateDraftDescriptorErrorMapper,
  updateEServiceDescriptionErrorMapper,
  updateEServiceErrorMapper,
  updateRiskAnalysisErrorMapper,
} from "../utilities/errorMappers.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

const catalogService = catalogServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  readModelService,
  initFileManager(config)
);

const eservicesRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eservicesRouter = ctx.router(catalogApi.processApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  const {
    ADMIN_ROLE,
    SECURITY_ROLE,
    API_ROLE,
    M2M_ROLE,
    INTERNAL_ROLE,
    SUPPORT_ROLE,
  } = userRoles;
  eservicesRouter
    .get(
      "/eservices",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const { logger } = fromAppContext(req.ctx);

        try {
          const {
            name,
            eservicesIds,
            producersIds,
            attributesIds,
            states,
            agreementStates,
            mode,
            offset,
            limit,
          } = req.query;

          const catalogs = await catalogService.getEServices(
            req.ctx.authData,
            {
              eservicesIds: eservicesIds.map<EServiceId>(unsafeBrandId),
              producersIds: producersIds.map<TenantId>(unsafeBrandId),
              attributesIds: attributesIds.map<AttributeId>(unsafeBrandId),
              states: states.map(apiDescriptorStateToDescriptorState),
              agreementStates: agreementStates.map(
                apiAgreementStateToAgreementState
              ),
              name,
              mode: mode ? apiEServiceModeToEServiceMode(mode) : undefined,
            },
            offset,
            limit,
            logger
          );

          return res.status(200).send(
            catalogApi.EServices.parse({
              results: catalogs.results.map(eServiceToApiEService),
              totalCount: catalogs.totalCount,
            })
          );
        } catch (error) {
          return res.status(500).send();
        }
      }
    )
    .post(
      "/eservices",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const eservice = await catalogService.createEService(req.body, ctx);
          return res
            .status(200)
            .send(catalogApi.EService.parse(eServiceToApiEService(eservice)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createEServiceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/eservices/:eServiceId",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
        INTERNAL_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const eservice = await catalogService.getEServiceById(
            unsafeBrandId(req.params.eServiceId),
            ctx
          );
          return res
            .status(200)
            .send(catalogApi.EService.parse(eServiceToApiEService(eservice)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEServiceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .put(
      "/eservices/:eServiceId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEService = await catalogService.updateEService(
            unsafeBrandId(req.params.eServiceId),
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateEServiceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/:eServiceId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.deleteEService(
            unsafeBrandId(req.params.eServiceId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteEServiceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/eservices/:eServiceId/consumers",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const consumers = await catalogService.getEServiceConsumers(
            unsafeBrandId(req.params.eServiceId),
            req.query.offset,
            req.query.limit,
            ctx.logger
          );

          return res.status(200).send(
            catalogApi.EServiceConsumers.parse({
              results: consumers.results.map((c) => ({
                descriptorVersion: parseInt(c.descriptorVersion, 10),
                descriptorState: descriptorStateToApiEServiceDescriptorState(
                  c.descriptorState
                ),
                agreementState: agreementStateToApiAgreementState(
                  c.agreementState
                ),
                consumerName: c.consumerName,
                consumerExternalId: c.consumerExternalId,
              })),
              totalCount: consumers.totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            () => 500,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const { eServiceId, descriptorId, documentId } = req.params;

          const document = await catalogService.getDocumentById(
            {
              eserviceId: unsafeBrandId(eServiceId),
              descriptorId: unsafeBrandId(descriptorId),
              documentId: unsafeBrandId(documentId),
            },
            ctx
          );

          return res
            .status(200)
            .send(
              catalogApi.EServiceDoc.parse(documentToApiDocument(document))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            documentGetErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEService = await catalogService.uploadDocument(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            documentCreateErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.deleteDocument(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            unsafeBrandId(req.params.documentId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            documentDeleteErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedDocument = await catalogService.updateDocument(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            unsafeBrandId(req.params.documentId),
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(
              catalogApi.EServiceDoc.parse(
                documentToApiDocument(updatedDocument)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            documentUpdateErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const descriptor = await catalogService.createDescriptor(
            unsafeBrandId(req.params.eServiceId),
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(
              catalogApi.EServiceDescriptor.parse(
                descriptorToApiDescriptor(descriptor)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.deleteDraftDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteDraftDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .put(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEService = await catalogService.updateDraftDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateDraftDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/publish",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.publishDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            publishDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/suspend",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.suspendDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            suspendDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/activate",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.activateDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            activateDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/clone",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const clonedEserviceByDescriptor =
            await catalogService.cloneDescriptor(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              ctx
            );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(
                eServiceToApiEService(clonedEserviceByDescriptor)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            cloneEServiceByDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/archive",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.archiveDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            archiveDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEService = await catalogService.updateDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/riskAnalysis",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.createRiskAnalysis(
            unsafeBrandId(req.params.eServiceId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createRiskAnalysisErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.updateRiskAnalysis(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.riskAnalysisId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateRiskAnalysisErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEService =
            await catalogService.updateEServiceDescription(
              unsafeBrandId(req.params.eServiceId),
              req.body.description,
              ctx
            );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateEServiceDescriptionErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.deleteRiskAnalysis(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.riskAnalysisId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteRiskAnalysisErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );
  return eservicesRouter;
};
export default eservicesRouter;
