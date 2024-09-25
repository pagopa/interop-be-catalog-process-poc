import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { AttributeId, TenantId, unsafeBrandId } from "pagopa-interop-models";
import { tenantServiceBuilder } from "../services/tenantService.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import { emptyErrorMapper } from "../utilities/errorMappers.js";
import { makeApiProblem } from "../model/errors.js";

const tenantRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const tenantRouter = ctx.router(bffApi.tenantsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const tenantService = tenantServiceBuilder(
    clients.tenantProcessClient,
    clients.attributeProcessClient,
    clients.selfcareV2Client
  );

  tenantRouter
    .get("/consumers", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await tenantService.getConsumers(
          req.query.q,
          req.query.offset,
          req.query.limit,
          ctx
        );

        return res
          .status(200)
          .json(bffApi.CompactOrganizations.parse(result))
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving consumers for name ${req.query.q}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/producers", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await tenantService.getProducers(
          req.query.q,
          req.query.offset,
          req.query.limit,
          ctx
        );

        return res
          .status(200)
          .json(bffApi.CompactOrganizations.parse(result))
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving producers for name ${req.query.q}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/tenants/attributes/certified", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await tenantService.getRequesterCertifiedAttributes(
          req.query.offset,
          req.query.limit,
          ctx
        );

        return res
          .status(200)
          .json(bffApi.RequesterCertifiedAttributes.parse(result))
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving tenant certified attributes offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/tenants/:tenantId/attributes/certified", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        const result = await tenantService.getCertifiedAttributes(
          tenantId,
          ctx
        );

        return res
          .status(200)
          .json(bffApi.CertifiedAttributesResponse.parse(result))
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving certified attributes for tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post("/tenants/:tenantId/attributes/certified", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        await tenantService.addCertifiedAttribute(tenantId, req.body, ctx);

        return res.status(204).json().end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error adding certified attribute ${req.body.id} to tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post("/tenants/attributes/declared", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await tenantService.addDeclaredAttribute(req.body, ctx);

        return res.status(204).json().end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error adding declared attribute ${req.body.id} to requester tenant`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .delete("/tenants/attributes/declared/:attributeId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const attributeId = unsafeBrandId<AttributeId>(req.params.attributeId);
        await tenantService.revokeDeclaredAttribute(attributeId, ctx);

        return res.status(204).json().end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error revoking declared attribute ${req.params.attributeId} to requester tenant`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/tenants/:tenantId/attributes/declared", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        const result = await tenantService.getDeclaredAttributes(tenantId, ctx);

        return res
          .status(200)
          .json(bffApi.DeclaredAttributesResponse.parse(result))
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving declared attributes for tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/tenants/:tenantId/attributes/verified", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        const result = await tenantService.getVerifiedAttributes(tenantId, ctx);

        return res
          .status(200)
          .json(bffApi.VerifiedAttributesResponse.parse(result))
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving verified attributes for tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post("/tenants/:tenantId/attributes/verified", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        await tenantService.verifyVerifiedAttribute(tenantId, req.body, ctx);

        return res.status(204).json().end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error verifying verified attribute ${req.body.id} to tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .delete(
      "/tenants/:tenantId/attributes/certified/:attributeId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
          const attributeId = unsafeBrandId<AttributeId>(
            req.params.attributeId
          );
          await tenantService.revokeCertifiedAttribute(
            tenantId,
            attributeId,
            ctx
          );

          return res.status(204).json().end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            `Error revoking certified attribute ${req.params.attributeId} to tenant ${req.params.tenantId}`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
          const attributeId = unsafeBrandId<AttributeId>(
            req.params.attributeId
          );
          await tenantService.updateVerifiedAttribute(
            tenantId,
            attributeId,
            req.body,
            ctx
          );

          return res.status(204).json().end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            `Error updating expirationDate for verified attribute ${req.params.attributeId} to tenant ${req.params.tenantId}`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
          const attributeId = unsafeBrandId<AttributeId>(
            req.params.attributeId
          );
          await tenantService.revokeVerifiedAttribute(
            tenantId,
            attributeId,
            ctx
          );

          return res.status(204).json().end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            `Error revoking verified attribute ${req.params.attributeId} to tenant ${req.params.tenantId}`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get("/tenants/:tenantId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        const result = await tenantService.getTenant(tenantId, ctx);
        return res.status(200).json(bffApi.Tenant.parse(result)).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving tenant with tenantId ${req.params.tenantId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post("/tenants/:tenantId/mails", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        await tenantService.addTenantMail(tenantId, req.body, ctx);
        return res.status(204).json().end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error adding mail to tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .delete("/tenants/:tenantId/mails/:mailId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        await tenantService.deleteTenantMail(tenantId, req.params.mailId, ctx);
        return res.status(204).json().end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error deleting mail ${req.params.mailId} from tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get(
      "/tenants",

      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const result = await tenantService.getTenants(
            req.query.name,
            req.query.limit,
            ctx
          );
          return res.status(200).json(bffApi.Tenants.parse(result)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            `Error retrieving tenants`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    );

  return tenantRouter;
};

export default tenantRouter;
