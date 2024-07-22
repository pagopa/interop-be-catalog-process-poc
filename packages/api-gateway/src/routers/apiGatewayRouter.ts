import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { apiGatewayApi } from "pagopa-interop-api-clients";
import {
  authorizationMiddleware,
  ExpressContext,
  userRoles,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { fromApiGatewayAppContext } from "../utilities/context.js";
import { agreementServiceBuilder } from "../services/agreementService.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { makeApiProblem } from "../models/errors.js";
import {
  emptyErrorMapper,
  getAgreementErrorMapper,
  getAgreementsErrorMapper,
} from "../utilities/errorMappers.js";

const apiGatewayRouter = (
  ctx: ZodiosContext,
  { agreementProcessClient, tenantProcessClient }: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ROLE } = userRoles;
  const apiGatewayRouter = ctx.router(apiGatewayApi.gatewayApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const agreementService = agreementServiceBuilder(
    agreementProcessClient,
    tenantProcessClient
  );

  apiGatewayRouter
    .get(
      "/agreements",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const agreements = await agreementService.getAgreements(
            ctx,
            req.query
          );

          return res.status(200).json(agreements).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAgreementsErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/agreements/:agreementId",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const agreement = await agreementService.getAgreementById(
            ctx,
            req.params.agreementId
          );

          return res.status(200).json(agreement).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAgreementErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/agreements/:agreementId/attributes",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const attributes = await agreementService.getAgreementAttributes(
            ctx,
            req.params.agreementId
          );

          return res.status(200).json(attributes).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper, // TODO map errors
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/agreements/:agreementId/purposes",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/attributes",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/attributes/:attributeId",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/clients/:clientId",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get("/eservices", authorizationMiddleware([M2M_ROLE]), async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/eservices/:eserviceId",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/eservices/:eserviceId/descriptors",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/eservices/:eserviceId/descriptors/:descriptorId",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get("/events", authorizationMiddleware([M2M_ROLE]), async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/events/agreements",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/events/eservices",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/events/keys",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get("/keys/:kid", authorizationMiddleware([M2M_ROLE]), async (_req, res) =>
      res.status(501).send()
    )
    .get("/purposes", authorizationMiddleware([M2M_ROLE]), async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/purposes/:purposeId",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/purposes/:purposeId/agreement",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/organizations/:organizationId",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/organizations/origin/:origin/externalId/:externalId/attributes/:code",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/organizations/origin/:origin/externalId/:externalId/attributes/:code",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/organizations/origin/:origin/externalId/:externalId/eservices",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    );

  return apiGatewayRouter;
};

export default apiGatewayRouter;
