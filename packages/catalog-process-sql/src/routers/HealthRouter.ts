import { zodiosRouter } from "@zodios/express";
import { catalogApi } from "pagopa-interop-api-clients";

const healthRouter = zodiosRouter(catalogApi.healthApi.api);

healthRouter.get("/status", async (_, res) => res.status(200).send());

export default healthRouter;
