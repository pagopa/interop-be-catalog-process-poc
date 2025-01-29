import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
  zodiosValidationErrorToApiProblem,
  ReadModelRepository,
  initDB,
  initFileManager,
  fromAppContext,
  initPDFGenerator,
} from "pagopa-interop-commons";
import { EServiceId, TenantId, unsafeBrandId } from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
import {
  apiPurposeVersionStateToPurposeVersionState,
  purposeToApiPurpose,
  purposeVersionDocumentToApiPurposeVersionDocument,
  purposeVersionToApiPurposeVersion,
  riskAnalysisFormConfigToApiRiskAnalysisFormConfig,
} from "../model/domain/apiConverter.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../config/config.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  activatePurposeVersionErrorMapper,
  archivePurposeVersionErrorMapper,
  createPurposeVersionErrorMapper,
  clonePurposeErrorMapper,
  createPurposeErrorMapper,
  createReversePurposeErrorMapper,
  deletePurposeErrorMapper,
  deletePurposeVersionErrorMapper,
  getPurposeErrorMapper,
  getRiskAnalysisDocumentErrorMapper,
  rejectPurposeVersionErrorMapper,
  retrieveRiskAnalysisConfigurationByVersionErrorMapper,
  suspendPurposeVersionErrorMapper,
  updatePurposeErrorMapper,
  updateReversePurposeErrorMapper,
  getPurposesErrorMapper,
} from "../utilities/errorMappers.js";
import { purposeServiceBuilder } from "../services/purposeService.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const fileManager = initFileManager(config);
const pdfGenerator = await initPDFGenerator();

const purposeService = purposeServiceBuilder(
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
  fileManager,
  pdfGenerator
);

const purposeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeRouter = ctx.router(purposeApi.purposeApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  const {
    ADMIN_ROLE,
    API_ROLE,
    SECURITY_ROLE,
    M2M_ROLE,
    INTERNAL_ROLE,
    SUPPORT_ROLE,
  } = userRoles;
  purposeRouter
    .get(
      "/purposes",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        INTERNAL_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const {
            name,
            eservicesIds,
            consumersIds,
            producersIds,
            states,
            excludeDraft,
            offset,
            limit,
          } = req.query;
          const purposes = await purposeService.getPurposes(
            req.ctx.authData.organizationId,
            {
              title: name,
              eservicesIds: eservicesIds?.map(unsafeBrandId<EServiceId>),
              consumersIds: consumersIds?.map(unsafeBrandId<TenantId>),
              producersIds: producersIds?.map(unsafeBrandId<TenantId>),
              states: states?.map(apiPurposeVersionStateToPurposeVersionState),
              excludeDraft,
            },
            { offset, limit },
            ctx.logger
          );
          return res.status(200).send(
            purposeApi.Purposes.parse({
              results: purposes.results.map((purpose) =>
                purposeToApiPurpose(purpose, false)
              ),
              totalCount: purposes.totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getPurposesErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.createPurpose(req.body, ctx);
          return res
            .status(200)
            .send(
              purposeApi.Purpose.parse(
                purposeToApiPurpose(purpose, isRiskAnalysisValid)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createPurposeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/reverse/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.createReversePurpose(req.body, ctx);
          return res
            .status(200)
            .send(
              purposeApi.Purpose.parse(
                purposeToApiPurpose(purpose, isRiskAnalysisValid)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createReversePurposeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/reverse/purposes/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.updateReversePurpose(
              unsafeBrandId(req.params.id),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              purposeApi.Purpose.parse(
                purposeToApiPurpose(purpose, isRiskAnalysisValid)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateReversePurposeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/purposes/:id",
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
          const { purpose, isRiskAnalysisValid } =
            await purposeService.getPurposeById(
              unsafeBrandId(req.params.id),
              ctx.authData.organizationId,
              ctx.logger
            );
          return res
            .status(200)
            .send(
              purposeApi.Purpose.parse(
                purposeToApiPurpose(purpose, isRiskAnalysisValid)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getPurposeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposes/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.updatePurpose(
              unsafeBrandId(req.params.id),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              purposeApi.Purpose.parse(
                purposeToApiPurpose(purpose, isRiskAnalysisValid)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updatePurposeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/purposes/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await purposeService.deletePurpose(unsafeBrandId(req.params.id), ctx);
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deletePurposeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/internal/delegationRevoked/purposes/:id",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await purposeService.internalDeletePurposeAfterDelegationRevocation(
            unsafeBrandId(req.params.id),
            unsafeBrandId(req.query.delegationId),
            ctx.correlationId,
            ctx.logger
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deletePurposeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const purposeVersion = await purposeService.createPurposeVersion(
            unsafeBrandId(req.params.purposeId),
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(
              purposeApi.PurposeVersion.parse(
                purposeVersionToApiPurposeVersion(purposeVersion)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createPurposeVersionErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/purposes/:purposeId/versions/:versionId",
      authorizationMiddleware([ADMIN_ROLE, INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await purposeService.deletePurposeVersion(
            {
              purposeId: unsafeBrandId(req.params.purposeId),
              versionId: unsafeBrandId(req.params.versionId),
            },
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deletePurposeVersionErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/purposes/:purposeId/versions/:versionId/documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE, SUPPORT_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const document = await purposeService.getRiskAnalysisDocument({
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
            documentId: unsafeBrandId(req.params.documentId),
            organizationId: req.ctx.authData.organizationId,
            logger: ctx.logger,
          });
          return res
            .status(200)
            .send(
              purposeApi.PurposeVersionDocument.parse(
                purposeVersionDocumentToApiPurposeVersionDocument(document)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getRiskAnalysisDocumentErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/reject",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await purposeService.rejectPurposeVersion(
            {
              purposeId: unsafeBrandId(req.params.purposeId),
              versionId: unsafeBrandId(req.params.versionId),
              rejectionReason: req.body.rejectionReason,
            },
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            rejectPurposeVersionErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/activate",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { purposeId, versionId } = req.params;
          const purposeVersion = await purposeService.activatePurposeVersion(
            {
              purposeId: unsafeBrandId(purposeId),
              versionId: unsafeBrandId(versionId),
            },
            ctx
          );
          return res
            .status(200)
            .send(
              purposeApi.PurposeVersion.parse(
                purposeVersionToApiPurposeVersion(purposeVersion)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            activatePurposeVersionErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposes/:purposeId/clone",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.clonePurpose({
              purposeId: unsafeBrandId(req.params.purposeId),
              seed: req.body,
              ctx,
            });
          return res
            .status(200)
            .send(
              purposeApi.Purpose.parse(
                purposeToApiPurpose(purpose, isRiskAnalysisValid)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            clonePurposeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/suspend",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const suspendedVersion = await purposeService.suspendPurposeVersion(
            {
              purposeId: unsafeBrandId(req.params.purposeId),
              versionId: unsafeBrandId(req.params.versionId),
            },
            ctx
          );
          return res
            .status(200)
            .send(
              purposeApi.PurposeVersion.parse(
                purposeVersionToApiPurposeVersion(suspendedVersion)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            suspendPurposeVersionErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/archive",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const archivedVersion = await purposeService.archivePurposeVersion(
            {
              purposeId: unsafeBrandId(req.params.purposeId),
              versionId: unsafeBrandId(req.params.versionId),
            },
            ctx
          );
          return res
            .status(200)
            .send(
              purposeApi.PurposeVersion.parse(
                purposeVersionToApiPurposeVersion(archivedVersion)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            archivePurposeVersionErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/delegationRevoked/purposes/:purposeId/versions/:versionId/archive",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await purposeService.internalArchivePurposeVersionAfterDelegationRevocation(
            {
              purposeId: unsafeBrandId(req.params.purposeId),
              versionId: unsafeBrandId(req.params.versionId),
              delegationId: unsafeBrandId(req.query.delegationId),
            },
            ctx.correlationId,
            ctx.logger
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            archivePurposeVersionErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/purposes/riskAnalysis/latest",
      authorizationMiddleware([
        ADMIN_ROLE,
        SUPPORT_ROLE,
        API_ROLE,
        SECURITY_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const riskAnalysisConfiguration =
            await purposeService.retrieveLatestRiskAnalysisConfiguration({
              tenantKind: req.query.tenantKind,
              organizationId: req.ctx.authData.organizationId,
              logger: ctx.logger,
            });
          return res
            .status(200)
            .send(
              purposeApi.RiskAnalysisFormConfigResponse.parse(
                riskAnalysisFormConfigToApiRiskAnalysisFormConfig(
                  riskAnalysisConfiguration
                )
              )
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
      "/purposes/riskAnalysis/version/:riskAnalysisVersion",
      authorizationMiddleware([
        ADMIN_ROLE,
        SUPPORT_ROLE,
        API_ROLE,
        SECURITY_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const riskAnalysisConfiguration =
            await purposeService.retrieveRiskAnalysisConfigurationByVersion({
              eserviceId: unsafeBrandId(req.query.eserviceId),
              riskAnalysisVersion: req.params.riskAnalysisVersion,
              organizationId: req.ctx.authData.organizationId,
              logger: ctx.logger,
            });
          return res
            .status(200)
            .send(
              purposeApi.RiskAnalysisFormConfigResponse.parse(
                riskAnalysisFormConfigToApiRiskAnalysisFormConfig(
                  riskAnalysisConfiguration
                )
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            retrieveRiskAnalysisConfigurationByVersionErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return purposeRouter;
};
export default purposeRouter;
