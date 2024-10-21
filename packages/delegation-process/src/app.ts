import {
  authenticationMiddleware,
  contextMiddleware,
  initFileManager,
  initPDFGenerator,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";

import healthRouter from "./routers/HealthRouter.js";
import delegationProducerRouter from "./routers/DelegationProducerRouter.js";
import delegationRouter from "./routers/DelegationRouter.js";
import { config } from "./config/config.js";

const serviceName = "delgation-process";

const app = zodiosCtx.app();

const pdfGenerator = await initPDFGenerator();
const fileManager = initFileManager(config);

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");
app.use(contextMiddleware(serviceName));
app.use(healthRouter);
app.use(authenticationMiddleware(config));
app.use(loggerMiddleware(serviceName));
app.use(delegationRouter(zodiosCtx));
app.use(delegationProducerRouter(zodiosCtx, pdfGenerator, fileManager));

export default app;
