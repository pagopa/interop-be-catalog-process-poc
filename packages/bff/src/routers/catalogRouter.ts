/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";
import { PagoPaClients } from "../providers/clientProvider.js";
import { catalogServiceBuilder } from "../services/catalogService.js";

const catalogRouter = (
  ctx: ZodiosContext,
  {
    catalogProcessClient,
    tenantProcessClient,
    agreementProcessClient,
  }: PagoPaClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const catalogRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const catalogService = catalogServiceBuilder(
    catalogProcessClient,
    tenantProcessClient,
    agreementProcessClient
  );

  catalogRouter
    .get("/catalog", async (req, res) => {
      const queries = req.query;
      const correlationId = req.ctx.correlationId;
      const requesterId = req.ctx.authData?.organizationId;
      if (!requesterId) {
        // TODO : improve error handling
        throw new Error("Missing requesterId");
      }

      const response = await catalogService.getCatalog(
        correlationId,
        requesterId,
        queries
      );

      return res.status(200).json(response).send();
    })
    .get(
      "/producers/eservices/:eserviceId/descriptors/:descriptorId",
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/catalog/eservices/:eserviceId/descriptor/:descriptorId",
      async (_req, res) => res.status(501).send()
    )
    .post("/eservices", async (_req, res) => res.status(501).send())
    .get("/eservices/:eServiceId/consumers", async (_req, res) =>
      res.status(501).send()
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      async (_req, res) => res.status(501).send()
    )
    .put(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      async (_req, res) => res.status(501).send()
    )
    .post("/eservices/:eServiceId/descriptors", async (_req, res) =>
      res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/activate",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/update",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/publish",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/suspend",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents",
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/clone",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      async (_req, res) => res.status(501).send()
    )
    .delete("/eservices/:eServiceId", async (_req, res) =>
      res.status(501).send()
    )
    .put("/eservices/:eServiceId", async (_req, res) => res.status(501).send())
    .post("/eservices/:eServiceId/riskAnalysis", async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      async (_req, res) => res.status(501).send()
    );

  return catalogRouter;
};

export default catalogRouter;
