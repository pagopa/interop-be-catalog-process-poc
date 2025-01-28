import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
  initDB,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  apiTenantFeatureTypeToTenantFeatureType,
  toApiTenant,
} from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  getTenantByExternalIdErrorMapper,
  getTenantByIdErrorMapper,
  getTenantBySelfcareIdErrorMapper,
  updateVerifiedAttributeExtensionDateErrorMapper,
  updateTenantVerifiedAttributeErrorMapper,
  selfcareUpsertTenantErrorMapper,
  addCertifiedAttributeErrorMapper,
  getCertifiedAttributesErrorMapper,
  revokeCertifiedAttributeErrorMapper,
  maintenanceTenantDeletedErrorMapper,
  maintenanceTenantPromotedToCertifierErrorMapper,
  deleteTenantMailErrorMapper,
  addTenantMailErrorMapper,
  addDeclaredAttributeErrorMapper,
  verifyVerifiedAttributeErrorMapper,
  revokeVerifiedAttributeErrorMapper,
  internalAddCertifiedAttributeErrorMapper,
  internalRevokeCertifiedAttributeErrorMapper,
  revokeDeclaredAttributeErrorMapper,
  internalUpsertTenantErrorMapper,
  m2mRevokeCertifiedAttributeErrorMapper,
  m2mUpsertTenantErrorMapper,
  maintenanceTenantUpdatedErrorMapper,
  assignTenantDelegatedProducerFeatureErrorMapper,
  removeTenantDelegatedProducerFeatureErrorMapper,
  removeTenantDelegatedConsumerFeatureErrorMapper,
  assignTenantDelegatedConsumerFeatureErrorMapper,
} from "../utilities/errorMappers.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../config/config.js";
import { tenantServiceBuilder } from "../services/tenantService.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const tenantService = tenantServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  readModelService
);

const tenantsRouter = (
  ctx: ZodiosContext
): Array<ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext>> => {
  const {
    ADMIN_ROLE,
    SECURITY_ROLE,
    API_ROLE,
    M2M_ROLE,
    INTERNAL_ROLE,
    SUPPORT_ROLE,
    MAINTENANCE_ROLE,
  } = userRoles;
  const tenantsRouter = ctx.router(tenantApi.tenantApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  tenantsRouter
    .get(
      "/consumers",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const { name, offset, limit } = req.query;
          const consumers = await tenantService.getConsumers(
            {
              consumerName: name,
              producerId: req.ctx.authData.organizationId,
              offset,
              limit,
            },
            ctx.logger
          );

          return res.status(200).send(
            tenantApi.Tenants.parse({
              results: consumers.results.map(toApiTenant),
              totalCount: consumers.totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            () => 500,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/producers",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const { name, offset, limit } = req.query;
          const producers = await tenantService.getProducers(
            {
              producerName: name,
              offset,
              limit,
            },
            ctx.logger
          );

          return res.status(200).send(
            tenantApi.Tenants.parse({
              results: producers.results.map(toApiTenant),
              totalCount: producers.totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            () => 500,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/tenants",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const { name, features, offset, limit } = req.query;
          const tenants = await tenantService.getTenants(
            {
              name,
              features: features.map(apiTenantFeatureTypeToTenantFeatureType),
              offset,
              limit,
            },
            ctx.logger
          );

          return res.status(200).send(
            tenantApi.Tenants.parse({
              results: tenants.results.map(toApiTenant),
              totalCount: tenants.totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            () => 500,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )

    .get(
      "/tenants/:id",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        M2M_ROLE,
        SECURITY_ROLE,
        INTERNAL_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const tenant = await tenantService.getTenantById(
            unsafeBrandId(req.params.id),
            ctx.logger
          );
          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getTenantByIdErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
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
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const { origin, code } = req.params;

          const tenant = await tenantService.getTenantByExternalId(
            {
              value: code,
              origin,
            },
            ctx.logger
          );
          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getTenantByExternalIdErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )

    .get(
      "/tenants/attributes/certified",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const { offset, limit } = req.query;
          const { results, totalCount } =
            await tenantService.getCertifiedAttributes({
              organizationId: req.ctx.authData.organizationId,
              offset,
              limit,
            });

          return res.status(200).send(
            tenantApi.CertifiedAttributes.parse({
              results: results satisfies tenantApi.CertifiedAttribute[],
              totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getCertifiedAttributesErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const { tenantId, attributeId } = req.params;
          const tenant = await tenantService.updateTenantVerifiedAttribute(
            {
              verifierId: req.ctx.authData.organizationId,
              tenantId: unsafeBrandId(tenantId),
              attributeId: unsafeBrandId(attributeId),
              updateVerifiedTenantAttributeSeed: req.body,
            },
            ctx
          );
          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateTenantVerifiedAttributeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId/verifier/:verifierId",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const { tenantId, attributeId, verifierId } = req.params;
          const tenant =
            await tenantService.updateVerifiedAttributeExtensionDate(
              unsafeBrandId(tenantId),
              unsafeBrandId(attributeId),
              verifierId,
              ctx
            );
          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateVerifiedAttributeExtensionDateErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/maintenance/tenants/:tenantId/certifier",
      authorizationMiddleware([MAINTENANCE_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const tenant = await tenantService.addCertifierId(
            {
              tenantId: unsafeBrandId(req.params.tenantId),
              certifierId: req.body.certifierId,
              correlationId: req.ctx.correlationId,
            },
            ctx.logger
          );
          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            maintenanceTenantPromotedToCertifierErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/tenants/:tenantId/mails",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await tenantService.addTenantMail(
            {
              tenantId: unsafeBrandId(req.params.tenantId),
              mailSeed: req.body,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
            },
            ctx.logger
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addTenantMailErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/maintenance/tenants/:tenantId",
      authorizationMiddleware([MAINTENANCE_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await tenantService.maintenanceTenantDelete(
            {
              tenantId: unsafeBrandId(req.params.tenantId),
              version: req.body.currentVersion,
              correlationId: ctx.correlationId,
            },
            ctx.logger
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            maintenanceTenantDeletedErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/maintenance/tenants/:tenantId",
      authorizationMiddleware([MAINTENANCE_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await tenantService.maintenanceTenantUpdate(
            {
              tenantId: unsafeBrandId(req.params.tenantId),
              version: req.body.currentVersion,
              tenantUpdate: req.body.tenant,
              correlationId: ctx.correlationId,
            },
            ctx.logger
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            maintenanceTenantUpdatedErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/tenants/:tenantId/mails/:mailId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { tenantId, mailId } = req.params;
          await tenantService.deleteTenantMailById(
            {
              tenantId: unsafeBrandId(tenantId),
              mailId,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
            },
            ctx.logger
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteTenantMailErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/tenants/delegatedProducer",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await tenantService.assignTenantDelegatedProducerFeature({
            organizationId: req.ctx.authData.organizationId,
            correlationId: req.ctx.correlationId,
            authData: ctx.authData,
            logger: ctx.logger,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            assignTenantDelegatedProducerFeatureErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/tenants/delegatedConsumer",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await tenantService.assignTenantDelegatedConsumerFeature(ctx);
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            assignTenantDelegatedConsumerFeatureErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/tenants/delegatedProducer",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await tenantService.removeTenantDelegatedProducerFeature({
            organizationId: req.ctx.authData.organizationId,
            correlationId: req.ctx.correlationId,
            authData: ctx.authData,
            logger: ctx.logger,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            removeTenantDelegatedProducerFeatureErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/tenants/delegatedConsumer",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await tenantService.removeTenantDelegatedConsumerFeature({
            organizationId: ctx.authData.organizationId,
            correlationId: ctx.correlationId,
            authData: ctx.authData,
            logger: ctx.logger,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            removeTenantDelegatedConsumerFeatureErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  const m2mRouter = ctx.router(tenantApi.m2mApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  m2mRouter
    .post(
      "/m2m/tenants",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const tenant = await tenantService.m2mUpsertTenant(req.body, ctx);
          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            m2mUpsertTenantErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/m2m/origin/:origin/externalId/:externalId/attributes/:code",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { origin, externalId, code } = req.params;
          await tenantService.m2mRevokeCertifiedAttribute({
            tenantOrigin: origin,
            tenantExternalId: externalId,
            organizationId: req.ctx.authData.organizationId,
            attributeExternalId: code,
            correlationId: req.ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            m2mRevokeCertifiedAttributeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  const selfcareRouter = ctx.router(tenantApi.selfcareApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  selfcareRouter
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
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const tenant = await tenantService.getTenantBySelfcareId(
            req.params.selfcareId,
            ctx.logger
          );

          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getTenantBySelfcareIdErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/selfcare/tenants",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        INTERNAL_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const id = await tenantService.selfcareUpsertTenant(req.body, ctx);
          return res.status(200).send(tenantApi.ResourceId.parse({ id }));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            selfcareUpsertTenantErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  const internalRouter = ctx.router(tenantApi.internalApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  internalRouter
    .post(
      "/internal/tenants",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const tenant = await tenantService.internalUpsertTenant(
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            internalUpsertTenantErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/origin/:tOrigin/externalId/:tExternalId/attributes/origin/:aOrigin/externalId/:aExternalId",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { tOrigin, tExternalId, aOrigin, aExternalId } = req.params;
          await tenantService.internalAssignCertifiedAttribute(
            {
              tenantOrigin: tOrigin,
              tenantExternalId: tExternalId,
              attributeOrigin: aOrigin,
              attributeExternalId: aExternalId,
              correlationId: req.ctx.correlationId,
            },
            ctx.logger
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            internalAddCertifiedAttributeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/internal/origin/:tOrigin/externalId/:tExternalId/attributes/origin/:aOrigin/externalId/:aExternalId",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { tOrigin, tExternalId, aOrigin, aExternalId } = req.params;
          await tenantService.internalRevokeCertifiedAttribute(
            {
              tenantOrigin: tOrigin,
              tenantExternalId: tExternalId,
              attributeOrigin: aOrigin,
              attributeExternalId: aExternalId,
              correlationId: req.ctx.correlationId,
            },
            ctx.logger
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            internalRevokeCertifiedAttributeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  const tenantsAttributeRouter = ctx.router(tenantApi.tenantAttributeApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  tenantsAttributeRouter
    .post(
      "/tenants/:tenantId/attributes/certified",
      authorizationMiddleware([ADMIN_ROLE, M2M_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { tenantId } = req.params;
          const tenant = await tenantService.addCertifiedAttribute(
            {
              tenantId: unsafeBrandId(tenantId),
              tenantAttributeSeed: req.body,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
            },
            ctx.logger
          );
          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addCertifiedAttributeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/tenants/attributes/declared",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const tenant = await tenantService.addDeclaredAttribute(
            {
              tenantAttributeSeed: req.body,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
            },
            ctx.logger
          );
          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addDeclaredAttributeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/tenants/:tenantId/attributes/verified",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const tenant = await tenantService.verifyVerifiedAttribute(
            {
              tenantId: unsafeBrandId(req.params.tenantId),
              attributeId: unsafeBrandId(req.body.id),
              agreementId: unsafeBrandId(req.body.agreementId),
              expirationDate: req.body.expirationDate,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
            },
            ctx.logger
          );
          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            verifyVerifiedAttributeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const tenant = await tenantService.revokeVerifiedAttribute(
            {
              tenantId: unsafeBrandId(req.params.tenantId),
              attributeId: unsafeBrandId(req.params.attributeId),
              agreementId: unsafeBrandId(req.body.agreementId),
            },
            ctx
          );
          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            revokeVerifiedAttributeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/tenants/:tenantId/attributes/certified/:attributeId",
      authorizationMiddleware([ADMIN_ROLE, M2M_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { tenantId, attributeId } = req.params;
          await tenantService.revokeCertifiedAttributeById(
            {
              tenantId: unsafeBrandId(tenantId),
              attributeId: unsafeBrandId(attributeId),
            },
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            revokeCertifiedAttributeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/tenants/attributes/declared/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const tenant = await tenantService.revokeDeclaredAttribute(
            {
              attributeId: unsafeBrandId(req.params.attributeId),
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
            },
            ctx.logger
          );
          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            revokeDeclaredAttributeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );
  return [
    tenantsRouter,
    tenantsAttributeRouter,
    m2mRouter,
    selfcareRouter,
    internalRouter,
  ];
};
export default tenantsRouter;
