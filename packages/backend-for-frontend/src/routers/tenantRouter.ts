import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import {
  AgreementId,
  AttributeId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
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
    clients.selfcareV2InstitutionClient
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

        return res.status(200).send(bffApi.CompactOrganizations.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error retrieving consumers for name ${req.query.q}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
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

        return res.status(200).send(bffApi.CompactOrganizations.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error retrieving producers for name ${req.query.q}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
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
          .send(bffApi.RequesterCertifiedAttributes.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error retrieving tenant certified attributes offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
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
          .send(bffApi.CertifiedAttributesResponse.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error retrieving certified attributes for tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/:tenantId/attributes/certified", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        await tenantService.addCertifiedAttribute(tenantId, req.body, ctx);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error adding certified attribute ${req.body.id} to tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/attributes/declared", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await tenantService.addDeclaredAttribute(req.body, ctx);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error adding declared attribute ${req.body.id} to requester tenant`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/tenants/attributes/declared/:attributeId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const attributeId = unsafeBrandId<AttributeId>(req.params.attributeId);
        await tenantService.revokeDeclaredAttribute(attributeId, ctx);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error revoking declared attribute ${req.params.attributeId} to requester tenant`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/tenants/:tenantId/attributes/declared", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        const result = await tenantService.getDeclaredAttributes(tenantId, ctx);

        return res
          .status(200)
          .send(bffApi.DeclaredAttributesResponse.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error retrieving declared attributes for tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/tenants/:tenantId/attributes/verified", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        const result = await tenantService.getVerifiedAttributes(tenantId, ctx);

        return res
          .status(200)
          .send(bffApi.VerifiedAttributesResponse.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error retrieving verified attributes for tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/:tenantId/attributes/verified", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        await tenantService.verifyVerifiedAttribute(tenantId, req.body, ctx);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error verifying verified attribute ${req.body.id} to tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
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

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            ctx.correlationId,
            `Error revoking certified attribute ${req.params.attributeId} to tenant ${req.params.tenantId}`
          );
          return res.status(errorRes.status).send(errorRes);
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

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            ctx.correlationId,
            `Error updating expirationDate for verified attribute ${req.params.attributeId} to tenant ${req.params.tenantId}`
          );
          return res.status(errorRes.status).send(errorRes);
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
          const agreementId = unsafeBrandId<AgreementId>(req.body.agreementId);
          await tenantService.revokeVerifiedAttribute(
            tenantId,
            attributeId,
            agreementId,
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            ctx.correlationId,
            `Error revoking verified attribute ${req.params.attributeId} to tenant ${req.params.tenantId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/tenants/:tenantId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        const result = await tenantService.getTenant(tenantId, ctx);
        return res.status(200).send(bffApi.Tenant.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error retrieving tenant with tenantId ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/:tenantId/mails", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        await tenantService.addTenantMail(tenantId, req.body, ctx);
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error adding mail to tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/tenants/:tenantId/mails/:mailId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        await tenantService.deleteTenantMail(tenantId, req.params.mailId, ctx);
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error deleting mail ${req.params.mailId} from tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/tenants", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await tenantService.getTenants(
          req.query.name,
          req.query.features,
          req.query.limit,
          ctx
        );
        return res.status(200).send(bffApi.Tenants.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error retrieving tenants`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/delegatedProducer", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const tenantId = ctx.authData.organizationId;

      try {
        await tenantService.assignTenantDelegatedProducerFeature(tenantId, ctx);
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error while assigning delegated producer feature to ${tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/tenants/delegatedProducer", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const tenantId = ctx.authData.organizationId;

      try {
        await tenantService.removeTenantDelegatedProducerFeature(tenantId, ctx);
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error while removing delegated producer feature to ${tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/delegatedConsumer", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const tenantId = ctx.authData.organizationId;

      try {
        await tenantService.assignTenantDelegatedConsumerFeature(tenantId, ctx);
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error while assigning delegated consumer feature to ${tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/tenants/delegatedConsumer", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const tenantId = ctx.authData.organizationId;

      try {
        await tenantService.removeTenantDelegatedConsumerFeature(tenantId, ctx);
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error while removing delegated consumer feature to ${tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return tenantRouter;
};

export default tenantRouter;
