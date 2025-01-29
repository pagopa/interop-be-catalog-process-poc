import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";

import { delegationApi } from "pagopa-interop-api-clients";
import {
  DB,
  ExpressContext,
  FileManager,
  PDFGenerator,
  ZodiosContext,
  authorizationMiddleware,
  fromAppContext,
  userRoles,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { EServiceId, TenantId, unsafeBrandId } from "pagopa-interop-models";
import { ReadModelService } from "../services/readModelService.js";
import {
  apiDelegationKindToDelegationKind,
  apiDelegationStateToDelegationState,
  delegationContractToApiDelegationContract,
  delegationToApiDelegation,
} from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  getDelegationsErrorMapper,
  getDelegationByIdErrorMapper,
  getDelegationContractErrorMapper,
  createProducerDelegationErrorMapper,
  createConsumerDelegationErrorMapper,
  approveDelegationErrorMapper,
  rejectDelegationErrorMapper,
  revokeDelegationErrorMapper,
  getConsumerDelegatorsErrorMapper,
  getConsumerEservicesErrorMapper,
  getConsumerDelegatorsWithAgreementsErrorMapper,
} from "../utilities/errorMappers.js";
import { delegationServiceBuilder } from "../services/delegationService.js";

const { ADMIN_ROLE, API_ROLE, SECURITY_ROLE, M2M_ROLE, SUPPORT_ROLE } =
  userRoles;

const delegationRouter = (
  ctx: ZodiosContext,
  readModelService: ReadModelService,
  eventStore: DB,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager
): Array<ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext>> => {
  const delegationRouter = ctx.router(delegationApi.delegationApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const delegationService = delegationServiceBuilder(
    readModelService,
    eventStore,
    pdfGenerator,
    fileManager
  );

  delegationRouter
    .get(
      "/delegations",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        const {
          offset,
          limit,
          delegateIds,
          delegatorIds,
          eserviceIds,
          delegationStates,
          kind,
        } = req.query;

        try {
          const delegations = await delegationService.getDelegations(
            {
              delegateIds: delegateIds.map(unsafeBrandId<TenantId>),
              delegatorIds: delegatorIds.map(unsafeBrandId<TenantId>),
              delegationStates: delegationStates.map(
                apiDelegationStateToDelegationState
              ),
              eserviceIds: eserviceIds.map(unsafeBrandId<EServiceId>),
              kind: kind && apiDelegationKindToDelegationKind(kind),
              offset,
              limit,
            },
            ctx.logger
          );

          return res.status(200).send(
            delegationApi.Delegations.parse({
              results: delegations.results.map(delegationToApiDelegation),
              totalCount: delegations.totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getDelegationsErrorMapper,
            ctx.logger,
            ctx.correlationId
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/delegations/:delegationId",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        const { delegationId } = req.params;

        try {
          const delegation = await delegationService.getDelegationById(
            unsafeBrandId(delegationId),
            ctx.logger
          );

          return res
            .status(200)
            .send(
              delegationApi.Delegation.parse(
                delegationToApiDelegation(delegation)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getDelegationByIdErrorMapper,
            ctx.logger,
            ctx.correlationId
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/delegations/:delegationId/contracts/:contractId",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        const { delegationId, contractId } = req.params;

        try {
          const contract = await delegationService.getDelegationContract(
            unsafeBrandId(delegationId),
            unsafeBrandId(contractId),
            ctx
          );

          return res
            .status(200)
            .send(
              delegationApi.DelegationContractDocument.parse(
                delegationContractToApiDelegationContract(contract)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getDelegationContractErrorMapper,
            ctx.logger,
            ctx.correlationId,
            `Error retrieving contract ${req.params.contractId} of delegation ${req.params.delegationId}`
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

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
          const delegation = await delegationService.createProducerDelegation(
            {
              delegateId: unsafeBrandId<TenantId>(req.body.delegateId),
              eserviceId: unsafeBrandId<EServiceId>(req.body.eserviceId),
            },
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
    .post(
      "/producer/delegations/:delegationId/approve",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        const { delegationId } = req.params;

        try {
          await delegationService.approveProducerDelegation(
            unsafeBrandId(delegationId),
            ctx
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
          await delegationService.rejectProducerDelegation(
            unsafeBrandId(delegationId),
            rejectionReason,
            ctx
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
    )
    .delete(
      "/producer/delegations/:delegationId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const { delegationId } = req.params;
          await delegationService.revokeProducerDelegation(
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
    );

  const delegationConsumerRouter = ctx.router(delegationApi.consumerApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  delegationConsumerRouter
    .post(
      "/consumer/delegations",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const delegation = await delegationService.createConsumerDelegation(
            {
              delegateId: unsafeBrandId<TenantId>(req.body.delegateId),
              eserviceId: unsafeBrandId<EServiceId>(req.body.eserviceId),
            },
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
            createConsumerDelegationErrorMapper,
            ctx.logger,
            ctx.correlationId
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/consumer/delegations/:delegationId/approve",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await delegationService.approveConsumerDelegation(
            unsafeBrandId(req.params.delegationId),
            ctx
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
      "/consumer/delegations/:delegationId/reject",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        const { rejectionReason } = req.body;

        try {
          await delegationService.rejectConsumerDelegation(
            unsafeBrandId(req.params.delegationId),
            rejectionReason,
            ctx
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
    )
    .delete(
      "/consumer/delegations/:delegationId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const { delegationId } = req.params;
          await delegationService.revokeConsumerDelegation(
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
    .get("/consumer/delegators", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      const { delegatorName, eserviceIds, limit, offset } = req.query;

      try {
        const delegators = await delegationService.getConsumerDelegators(
          {
            requesterId: ctx.authData.organizationId,
            delegatorName,
            eserviceIds: eserviceIds.map(unsafeBrandId<EServiceId>),
            limit,
            offset,
          },
          ctx.logger
        );

        return res
          .status(200)
          .send(delegationApi.CompactTenants.parse(delegators));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getConsumerDelegatorsErrorMapper,
          ctx.logger,
          ctx.correlationId
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/consumer/delegatorsWithAgreements", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      const { delegatorName, limit, offset } = req.query;

      try {
        const delegators =
          await delegationService.getConsumerDelegatorsWithAgreements(
            {
              requesterId: ctx.authData.organizationId,
              delegatorName,
              limit,
              offset,
            },
            ctx.logger
          );

        return res
          .status(200)
          .send(delegationApi.CompactTenants.parse(delegators));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getConsumerDelegatorsWithAgreementsErrorMapper,
          ctx.logger,
          ctx.correlationId
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/consumer/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      const { delegatorId, eserviceName, limit, offset } = req.query;

      try {
        const eservices = await delegationService.getConsumerEservices(
          {
            delegatorId: unsafeBrandId(delegatorId),
            requesterId: ctx.authData.organizationId,
            eserviceName,
            limit,
            offset,
          },
          ctx.logger
        );

        return res
          .status(200)
          .send(delegationApi.CompactEServices.parse(eservices));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getConsumerEservicesErrorMapper,
          ctx.logger,
          ctx.correlationId
        );

        return res.status(errorRes.status).send(errorRes);
      }
    });

  return [delegationRouter, delegationProducerRouter, delegationConsumerRouter];
};

export default delegationRouter;
