import { zodiosRouter } from "@zodios/express";
import { api } from "../model/generated/api.js";
import { ApiError, mapCatalogServiceErrorToApiError } from "../model/types.js";
import { CatalogService } from "../services/CatalogService.js";

const eservicesRouter = zodiosRouter(api.api);

eservicesRouter.post("/eservices", async (req, res) => {
  try {
    await CatalogService.createEService(req.body);
    return res.status(201).end();
  } catch (error) {
    const errorRes: ApiError = mapCatalogServiceErrorToApiError(error);
    return res.status(errorRes.status).json(errorRes).end();
  }
});

export default eservicesRouter;
