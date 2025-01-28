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
import { delegationServiceBuilder } from "../services/delegationService.js";
import { emptyErrorMapper, makeApiProblem } from "../model/errors.js";
import {
  getDelegationByIdErrorMapper,
  getDelegationsErrorMapper,
} from "../utilities/errorMappers.js";

const delegationRouter = (
  ctx: ZodiosContext,
  {
    delegationProcessClient,
    tenantProcessClient,
    catalogProcessClient,
  }: PagoPAInteropBeClients,
  fileManager: FileManager
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const delegationRouter = ctx.router(bffApi.delegationsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const delegationService = delegationServiceBuilder(
    delegationProcessClient,
    tenantProcessClient,
    catalogProcessClient,
    fileManager
  );

  delegationRouter
    .get("/delegations", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const {
          limit,
          offset,
          states,
          kind,
          delegateIds,
          delegatorIds,
          eserviceIds,
        } = req.query;

        const delegations = await delegationService.getDelegations(
          {
            limit,
            offset,
            states,
            delegatorIds,
            delegateIds,
            eserviceIds,
            kind,
          },
          ctx
        );

        return res
          .status(200)
          .send(bffApi.CompactDelegations.parse(delegations));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getDelegationsErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error retrieving delegations`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/delegations/:delegationId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const delegation = await delegationService.getDelegation(
          unsafeBrandId(req.params.delegationId),
          ctx
        );

        return res.status(200).send(bffApi.Delegation.parse(delegation));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getDelegationByIdErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error retrieving delegation by id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/delegations/:delegationId/contracts/:contractId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { delegationId, contractId } = req.params;

        try {
          const result = await delegationService.getDelegationContract(
            unsafeBrandId(delegationId),
            unsafeBrandId(contractId),
            ctx
          );

          return res.status(200).send(result);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            ctx.correlationId,
            `Error retrieving contract ${req.params.contractId} of delegation ${req.params.delegationId}`
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    );
  return delegationRouter;
};

export default delegationRouter;
