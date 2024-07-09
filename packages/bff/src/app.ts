import {
  authenticationMiddleware,
  contextMiddleware,
  initFileManager,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { getInteropBeClients } from "./providers/clientProvider.js";
import healthRouter from "./routers/HealthRouter.js";
import agreementRouter from "./routers/agreementRouter.js";
import attributeRouter from "./routers/attributeRouter.js";
import authorizationRouter from "./routers/authorizationRouter.js";
import catalogRouter from "./routers/catalogRouter.js";
import purposeRouter from "./routers/purposeRouter.js";
import selfcareRouter from "./routers/selfcareRouter.js";
import supportRouter from "./routers/supportRouter.js";
import tenantRouter from "./routers/tenantRouter.js";
import toolRouter from "./routers/toolRouter.js";
import getAllowList from "./utilities/getAllowList.js";

const serviceName = "bff-process";
const fileManager = initFileManager(config);
const allowList = await getAllowList(serviceName, fileManager, config);

const clients = getInteropBeClients();

const app = zodiosCtx.app();

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(contextMiddleware(serviceName, true));
app.use(healthRouter);
app.use(authorizationRouter(zodiosCtx, clients, allowList));
app.use(authenticationMiddleware);
app.use(loggerMiddleware(serviceName));
app.use(catalogRouter(zodiosCtx, clients));
app.use(attributeRouter(zodiosCtx));
app.use(purposeRouter(zodiosCtx, clients));
app.use(agreementRouter(zodiosCtx));
app.use(selfcareRouter(zodiosCtx));
app.use(tenantRouter(zodiosCtx));
app.use(supportRouter(zodiosCtx, clients));
app.use(toolRouter(zodiosCtx));

export default app;
