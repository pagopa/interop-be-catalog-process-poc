import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
} from "pagopa-interop-commons";
import { makeApiProblem } from "pagopa-interop-models";
import { api } from "../model/generated/api.js";
import { tenantService } from "../services/tenantService.js";

const tenantsRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const tenantsRouter = ctx.router(api.api);
  const {
    ADMIN_ROLE,
    SECURITY_ROLE,
    API_ROLE,
    M2M_ROLE,
    INTERNAL_ROLE,
    SUPPORT_ROLE,
  } = userRoles;
  tenantsRouter
    .get(
      "/consumers",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/producers",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/tenants",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/tenants/:id",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        M2M_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/tenants/origin/:origin/code/:code",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        M2M_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/tenants/selfcare/:selfcareId",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        M2M_ROLE,
        SECURITY_ROLE,
        INTERNAL_ROLE,
        SUPPORT_ROLE,
      ]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/internal/tenants",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/internal/origin/:tOrigin/externalId/:tExternalId/attributes/origin/:aOrigin/externalId/:aExternalId",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/m2m/tenants",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/selfcare/tenants",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        INTERNAL_ROLE,
      ]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/:tenantId/attributes/verified",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        try {
          const { tenantId, attributeId } = req.params;
          await tenantService.updateTenantVerifiedAttribute({
            verifierId: req.ctx.authData.organizationId, // [QUESTION]: userId or organizationId?
            tenantId,
            attributeId,
            updateVerifiedTenantAttributeSeed: req.body,
          });
          return res.status(200).end();
        } catch (error) {
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId/verifier/:verifierId",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/attributes/declared",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/internal/origin/:tOrigin/externalId/:tExternalId/attributes/origin/:aOrigin/externalId/:aExternalId",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/m2m/origin/:origin/externalId/:externalId/attributes/:code",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/tenants/attributes/declared/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    );

  return tenantsRouter;
};
export default tenantsRouter;
