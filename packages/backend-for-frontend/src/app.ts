import {
  authenticationMiddleware,
  contextMiddleware,
  initFileManager,
  loggerMiddleware,
  zodiosCtx,
  initRedisRateLimiter,
  rateLimiterMiddleware,
} from "pagopa-interop-commons";
import express from "express";
import { config } from "./config/config.js";
import privacyNoticeRouter from "./routers/privacyNoticeRouter.js";
import { getInteropBeClients } from "./clients/clientsProvider.js";
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
import {
  fromFilesToBodyMiddleware,
  multerMiddleware,
} from "./utilities/middlewares.js";
import clientRouter from "./routers/clientRouter.js";
import producerKeychainRouter from "./routers/producerKeychainRouter.js";
import delegationRouter from "./routers/delegationRouter.js";
import producerDelegationRouter from "./routers/producerDelegationRouter.js";
import consumerDelegationRouter from "./routers/consumerDelegationRouter.js";

const serviceName = "backend-for-frontend";
const fileManager = initFileManager(config);
const allowList = await getAllowList(serviceName, fileManager, config);

const clients = getInteropBeClients();

const app = zodiosCtx.app();

const redisRateLimiter = await initRedisRateLimiter({
  limiterGroup: "BFF",
  maxRequests: config.rateLimiterMaxRequests,
  rateInterval: config.rateLimiterRateInterval,
  burstPercentage: config.rateLimiterBurstPercentage,
  redisHost: config.rateLimiterRedisHost,
  redisPort: config.rateLimiterRedisPort,
  timeout: config.rateLimiterTimeout,
});

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.disable("etag");

// parse files from multipart/form-data and put them in req.body
app.use(multerMiddleware);
app.use(fromFilesToBodyMiddleware);

// parse application/x-www-form-urlencoded and put it in req.body
app.use(express.urlencoded({ extended: true }));

app.use(loggerMiddleware(serviceName));

app.use(
  `/backend-for-frontend/${config.backendForFrontendInterfaceVersion}`,
  healthRouter,
  contextMiddleware(serviceName, false),
  authorizationRouter(zodiosCtx, clients, allowList, redisRateLimiter),
  authenticationMiddleware(config),
  // Authenticated routes - rate limiter relies on auth data to work
  rateLimiterMiddleware(redisRateLimiter),
  catalogRouter(zodiosCtx, clients, fileManager),
  attributeRouter(zodiosCtx, clients),
  purposeRouter(zodiosCtx, clients),
  agreementRouter(zodiosCtx, clients, fileManager),
  selfcareRouter(clients, zodiosCtx),
  supportRouter(zodiosCtx, clients, redisRateLimiter),
  toolRouter(zodiosCtx, clients),
  tenantRouter(zodiosCtx, clients),
  clientRouter(zodiosCtx, clients),
  privacyNoticeRouter(zodiosCtx),
  producerKeychainRouter(zodiosCtx, clients),
  delegationRouter(zodiosCtx, clients, fileManager),
  producerDelegationRouter(zodiosCtx, clients, fileManager),
  consumerDelegationRouter(zodiosCtx, clients, fileManager)
);

export default app;
