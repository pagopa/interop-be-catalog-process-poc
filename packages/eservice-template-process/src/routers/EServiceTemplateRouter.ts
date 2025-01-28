import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  ReadModelRepository,
  initDB,
  initFileManager,
  zodiosValidationErrorToApiProblem,
  userRoles,
  authorizationMiddleware,
  fromAppContext,
} from "pagopa-interop-commons";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import { config } from "../config/config.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { eserviceTemplateServiceBuilder } from "../services/eserviceTemplateService.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  activateEServiceTemplateVersionErrorMapper,
  suspendEServiceTemplateVersionErrorMapper,
  updateEServiceTemplateNameErrorMapper,
} from "../utilities/errorMappers.js";
import { eserviceTemplateToApiEServiceTemplate } from "../model/domain/apiConverter.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

const eserviceTemplateService = eserviceTemplateServiceBuilder(
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

const eserviceTemplatesRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { ADMIN_ROLE, API_ROLE } = userRoles;

  return ctx
    .router(eserviceTemplateApi.processApi.api, {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    })
    .get(
      "/eservices/templates",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .post(
      "/eservices/templates",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .get(
      "/eservices/templates/:eServiceTemplateId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .post(
      "/eservices/templates/:eServiceTemplateId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .delete(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/publish",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/suspend",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await eserviceTemplateService.suspendEServiceTemplateVersion(
            unsafeBrandId(req.params.eServiceTemplateId),
            unsafeBrandId(req.params.eServiceTemplateVersionId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            suspendEServiceTemplateVersionErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/activate",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await eserviceTemplateService.activateEServiceTemplateVersion(
            unsafeBrandId(req.params.eServiceTemplateId),
            unsafeBrandId(req.params.eServiceTemplateVersionId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            activateEServiceTemplateVersionErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/quotas/update",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .get(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .delete(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId/update",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/riskAnalysis",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/riskAnalysis/:riskAnalysisId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .delete(
      "/eservices/templates/:eServiceTemplateId/riskAnalysis/:riskAnalysisId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/audienceDescription/update",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/eserviceDescription/update",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/name/update",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const updatedEServiceTemplate =
            await eserviceTemplateService.updateEServiceTemplateName(
              unsafeBrandId(req.params.eServiceTemplateId),
              req.body.name,
              ctx
            );
          return res
            .status(200)
            .send(
              eserviceTemplateApi.EServiceTemplate.parse(
                eserviceTemplateToApiEServiceTemplate(updatedEServiceTemplate)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateEServiceTemplateNameErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/attributes/update",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(504)
    );
};
export default eserviceTemplatesRouter;
