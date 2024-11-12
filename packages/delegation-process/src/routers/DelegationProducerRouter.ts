import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { delegationApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  fromAppContext,
  ReadModelRepository,
  userRoles,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
  authorizationMiddleware,
  initDB,
  initPDFGenerator,
  initFileManager,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../config/config.js";
import { delegationToApiDelegation } from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { delegationProducerServiceBuilder } from "../services/delegationProducerService.js";
import {
  createProducerDelegationErrorMapper,
  revokeDelegationErrorMapper,
  approveDelegationErrorMapper,
  rejectDelegationErrorMapper,
} from "../utilites/errorMappers.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

const pdfGenerator = await initPDFGenerator();
const fileManager = initFileManager(config);

const delegationProducerService = delegationProducerServiceBuilder(
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
  pdfGenerator,
  fileManager
);

const { ADMIN_ROLE } = userRoles;

const delegationProducerRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const delegationProducerRouter = ctx.router(delegationApi.producerApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  delegationProducerRouter
    .post(
      "/producer/delegations",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const delegation =
            await delegationProducerService.createProducerDelegation(
              req.body,
              ctx
            );
          return res
            .status(200)
            .json(
              delegationApi.Delegation.parse(
                delegationToApiDelegation(delegation)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createProducerDelegationErrorMapper,
            ctx.logger,
            ctx.correlationId
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/producer/delegations/:delegationId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const { delegationId } = req.params;
          await delegationProducerService.revokeProducerDelegation(
            unsafeBrandId(delegationId),
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            revokeDelegationErrorMapper,
            ctx.logger,
            ctx.correlationId
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/producer/delegations/:delegationId/approve",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        const { delegationId } = req.params;

        try {
          await delegationProducerService.approveProducerDelegation(
            ctx.authData.organizationId,
            unsafeBrandId(delegationId),
            ctx.correlationId,
            ctx.logger
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            approveDelegationErrorMapper,
            ctx.logger,
            ctx.correlationId
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/producer/delegations/:delegationId/reject",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        const { delegationId } = req.params;
        const { rejectionReason } = req.body;

        try {
          await delegationProducerService.rejectProducerDelegation(
            ctx.authData.organizationId,
            unsafeBrandId(delegationId),
            ctx.correlationId,
            rejectionReason
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            rejectDelegationErrorMapper,
            ctx.logger,
            ctx.correlationId
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return delegationProducerRouter;
};

export default delegationProducerRouter;
