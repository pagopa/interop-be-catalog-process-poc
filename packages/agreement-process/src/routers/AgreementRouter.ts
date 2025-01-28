import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ReadModelRepository,
  ZodiosContext,
  authorizationMiddleware,
  initDB,
  initFileManager,
  initPDFGenerator,
  userRoles,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
} from "pagopa-interop-commons";
import {
  TenantId,
  DescriptorId,
  EServiceId,
  unsafeBrandId,
  DelegationId,
} from "pagopa-interop-models";
import { agreementApi } from "pagopa-interop-api-clients";
import {
  agreementDocumentToApiAgreementDocument,
  agreementToApiAgreement,
  apiAgreementStateToAgreementState,
  fromApiCompactTenant,
} from "../model/domain/apiConverter.js";
import { agreementServiceBuilder } from "../services/agreementService.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../config/config.js";
import {
  activateAgreementErrorMapper,
  addConsumerDocumentErrorMapper,
  archiveAgreementErrorMapper,
  cloneAgreementErrorMapper,
  createAgreementErrorMapper,
  deleteAgreementErrorMapper,
  getAgreementErrorMapper,
  getConsumerDocumentErrorMapper,
  rejectAgreementErrorMapper,
  removeConsumerDocumentErrorMapper,
  submitAgreementErrorMapper,
  suspendAgreementErrorMapper,
  updateAgreementErrorMapper,
  upgradeAgreementErrorMapper,
  computeAgreementsStateErrorMapper,
  verifyTenantCertifiedAttributesErrorMapper,
} from "../utilities/errorMappers.js";
import { makeApiProblem } from "../model/domain/errors.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const pdfGenerator = await initPDFGenerator();

const agreementService = agreementServiceBuilder(
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
  initFileManager(config),
  pdfGenerator
);

const {
  ADMIN_ROLE,
  SECURITY_ROLE,
  API_ROLE,
  M2M_ROLE,
  INTERNAL_ROLE,
  SUPPORT_ROLE,
} = userRoles;

const agreementRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const agreementRouter = ctx.router(agreementApi.agreementApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  agreementRouter.post(
    "/agreements/:agreementId/submit",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.submitAgreement(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );
        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          submitAgreementErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/activate",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.activateAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );

        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          activateAgreementErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/consumer-documents",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const document = await agreementService.addConsumerDocument(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );

        return res
          .status(200)
          .send(
            agreementApi.Document.parse(
              agreementDocumentToApiAgreementDocument(document)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          addConsumerDocumentErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.get(
    "/agreements/:agreementId/consumer-documents/:documentId",
    authorizationMiddleware([ADMIN_ROLE, SUPPORT_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const document = await agreementService.getAgreementConsumerDocument(
          unsafeBrandId(req.params.agreementId),
          unsafeBrandId(req.params.documentId),
          ctx
        );
        return res
          .status(200)
          .send(
            agreementApi.Document.parse(
              agreementDocumentToApiAgreementDocument(document)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getConsumerDocumentErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.delete(
    "/agreements/:agreementId/consumer-documents/:documentId",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        await agreementService.removeAgreementConsumerDocument(
          unsafeBrandId(req.params.agreementId),
          unsafeBrandId(req.params.documentId),
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          removeConsumerDocumentErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/suspend",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.suspendAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );
        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          suspendAgreementErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/reject",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.rejectAgreement(
          unsafeBrandId(req.params.agreementId),
          req.body.reason,
          ctx
        );
        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          rejectAgreementErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/archive",
    authorizationMiddleware([ADMIN_ROLE, INTERNAL_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.archiveAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );
        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          archiveAgreementErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.post(
    "/agreements",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.createAgreement(
          {
            eserviceId: unsafeBrandId<EServiceId>(req.body.eserviceId),
            descriptorId: unsafeBrandId<DescriptorId>(req.body.descriptorId),
            delegationId: req.body.delegationId
              ? unsafeBrandId<DelegationId>(req.body.delegationId)
              : undefined,
          },
          ctx
        );
        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createAgreementErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.get(
    "/agreements",
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
        const agreements = await agreementService.getAgreements(
          {
            eserviceId: req.query.eservicesIds.map(unsafeBrandId<EServiceId>),
            consumerId: req.query.consumersIds.map(unsafeBrandId<TenantId>),
            producerId: req.query.producersIds.map(unsafeBrandId<TenantId>),
            descriptorId: req.query.descriptorsIds.map(
              unsafeBrandId<DescriptorId>
            ),
            agreementStates: req.query.states.map(
              apiAgreementStateToAgreementState
            ),
            showOnlyUpgradeable: req.query.showOnlyUpgradeable || false,
          },
          req.query.limit,
          req.query.offset,
          ctx.logger
        );

        return res.status(200).send(
          agreementApi.Agreements.parse({
            results: agreements.results.map(agreementToApiAgreement),
            totalCount: agreements.totalCount,
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
  );

  agreementRouter.get(
    "/producers",
    authorizationMiddleware([
      ADMIN_ROLE,
      API_ROLE,
      SECURITY_ROLE,
      SUPPORT_ROLE,
    ]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const producers = await agreementService.getAgreementProducers(
          req.query.producerName,
          req.query.limit,
          req.query.offset,
          ctx.logger
        );

        return res.status(200).send(
          agreementApi.CompactOrganizations.parse({
            results: producers.results,
            totalCount: producers.totalCount,
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
  );

  agreementRouter.get(
    "/consumers",
    authorizationMiddleware([
      ADMIN_ROLE,
      API_ROLE,
      SECURITY_ROLE,
      SUPPORT_ROLE,
    ]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const consumers = await agreementService.getAgreementConsumers(
          req.query.consumerName,
          req.query.limit,
          req.query.offset,
          ctx.logger
        );

        return res.status(200).send(
          agreementApi.CompactOrganizations.parse({
            results: consumers.results,
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
  );

  agreementRouter.get(
    "/agreements/:agreementId",
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
        const agreement = await agreementService.getAgreementById(
          unsafeBrandId(req.params.agreementId),
          ctx.logger
        );
        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getAgreementErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.delete(
    "/agreements/:agreementId",
    authorizationMiddleware([ADMIN_ROLE, INTERNAL_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        await agreementService.deleteAgreementById(
          unsafeBrandId(req.params.agreementId),
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          deleteAgreementErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/update",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.updateAgreement(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );

        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          updateAgreementErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/upgrade",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.upgradeAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );

        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          upgradeAgreementErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/clone",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.cloneAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );

        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          cloneAgreementErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.post(
    "/compute/agreementsState",
    authorizationMiddleware([ADMIN_ROLE, INTERNAL_ROLE, M2M_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        await agreementService.computeAgreementsStateByAttribute(
          unsafeBrandId(req.body.attributeId),
          fromApiCompactTenant(req.body.consumer),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          computeAgreementsStateErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  agreementRouter.get(
    "/agreements/filter/eservices",
    authorizationMiddleware([
      ADMIN_ROLE,
      API_ROLE,
      SECURITY_ROLE,
      SUPPORT_ROLE,
    ]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const eservices = await agreementService.getAgreementEServices(
          {
            eserviceName: req.query.eServiceName,
            consumerIds: req.query.consumersIds.map(unsafeBrandId<TenantId>),
            producerIds: req.query.producersIds.map(unsafeBrandId<TenantId>),
            agreeementStates: req.query.states.map(
              apiAgreementStateToAgreementState
            ),
          },
          req.query.limit,
          req.query.offset,
          ctx.logger
        );

        return res.status(200).send(
          agreementApi.CompactEServices.parse({
            results: eservices.results,
            totalCount: eservices.totalCount,
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
  );

  agreementRouter.post(
    "/agreements/verify",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const result = await agreementService.verifyTenantCertifiedAttributes(
          {
            tenantId: unsafeBrandId<TenantId>(req.body.tenantId),
            descriptorId: unsafeBrandId<DescriptorId>(req.body.descriptorId),
            eserviceId: unsafeBrandId<EServiceId>(req.body.eserviceId),
          },
          ctx
        );
        return res
          .status(200)
          .send(agreementApi.HasCertifiedAttributes.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          verifyTenantCertifiedAttributesErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  return agreementRouter;
};
export default agreementRouter;
