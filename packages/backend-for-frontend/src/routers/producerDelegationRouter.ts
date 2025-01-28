import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import {
  ExpressContext,
  FileManager,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import { emptyErrorMapper, makeApiProblem } from "../model/errors.js";
import { delegationServiceBuilder } from "../services/delegationService.js";

const producerDelegationRouter = (
  ctx: ZodiosContext,
  {
    delegationProcessClient,
    tenantProcessClient,
    catalogProcessClient,
  }: PagoPAInteropBeClients,
  fileManager: FileManager
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const producerDelegationRouter = ctx.router(
    bffApi.producerDelegationsApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );
  const delegationService = delegationServiceBuilder(
    delegationProcessClient,
    tenantProcessClient,
    catalogProcessClient,
    fileManager
  );

  producerDelegationRouter
    .post("/producer/delegations", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const delegationResource =
          await delegationService.createProducerDelegation(req.body, ctx);

        return res
          .status(200)
          .send(bffApi.CreatedResource.parse(delegationResource));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error creating delegation`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/producer/delegations/:delegationId/approve", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await delegationService.approveProducerDelegation(
          unsafeBrandId(req.params.delegationId),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error approving delegation with id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/producer/delegations/:delegationId/reject", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await delegationService.rejectProducerDelegation(
          unsafeBrandId(req.params.delegationId),
          req.body,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error rejecting delegation with id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/producer/delegations/:delegationId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await delegationService.revokeProducerDelegation(
          unsafeBrandId(req.params.delegationId),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error revoking delegation with id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    });

  return producerDelegationRouter;
};

export default producerDelegationRouter;
