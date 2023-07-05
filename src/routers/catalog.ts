import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ExpressContext, ZodiosContext } from "../app.js";
import { api } from "../model/generated/api.js";
import { ApiError, mapCatalogServiceErrorToApiError } from "../model/types.js";
import { catalogService } from "../services/CatalogService.js";

const eservicesRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eservicesRouter = ctx.router(api.api);

  eservicesRouter
    .post("/eservices", async (req, res) => {
      try {
        await catalogService.createEService(req.body, req.authData);
        return res.status(201).end();
      } catch (error) {
        const errorRes: ApiError = mapCatalogServiceErrorToApiError(error);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .put("/eservices/:eServiceId", async (req, res) => {
      try {
        await catalogService.updateEService(
          req.params.eServiceId,
          req.body,
          req.authData
        );
        return res.status(200).end();
      } catch (error) {
        const errorRes: ApiError = mapCatalogServiceErrorToApiError(error);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .delete("/eservices/:eServiceId", async (req, res) => {
      try {
        await catalogService.deleteEService(
          req.params.eServiceId,
          req.authData
        );
        return res.status(204).end();
      } catch (error) {
        const errorRes: ApiError = mapCatalogServiceErrorToApiError(error);
        return res.status(errorRes.status).json(errorRes).end();
      }
    });

  return eservicesRouter;
};
export default eservicesRouter;
