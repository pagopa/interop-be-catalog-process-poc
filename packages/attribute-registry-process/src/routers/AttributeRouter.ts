import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
  ReadModelRepository,
  initDB,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { readModelServiceBuilder } from "../services/readModelService.js";
import {
  toAttributeKind,
  toApiAttribute,
} from "../model/domain/apiConverter.js";
import { config } from "../config/config.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { attributeRegistryServiceBuilder } from "../services/attributeRegistryService.js";
import {
  createCertifiedAttributesErrorMapper,
  createDeclaredAttributesErrorMapper,
  createInternalCertifiedAttributesErrorMapper,
  createVerifiedAttributesErrorMapper,
  getAttributeByIdErrorMapper,
  getAttributeByOriginAndCodeErrorMapper,
  getAttributesByNameErrorMapper,
} from "../utilities/errorMappers.js";

const readModelRepository = ReadModelRepository.init(config);
const readModelService = readModelServiceBuilder(readModelRepository);
const attributeRegistryService = attributeRegistryServiceBuilder(
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

const attributeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const attributeRouter = ctx.router(attributeRegistryApi.attributeApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  const {
    ADMIN_ROLE,
    SECURITY_ROLE,
    API_ROLE,
    M2M_ROLE,
    INTERNAL_ROLE,
    SUPPORT_ROLE,
  } = userRoles;
  attributeRouter
    .get(
      "/attributes",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const { logger } = fromAppContext(req.ctx);

        try {
          const { limit, offset, kinds, name, origin } = req.query;
          const attributes =
            await attributeRegistryService.getAttributesByKindsNameOrigin(
              {
                kinds: kinds.map(toAttributeKind),
                name,
                origin,
                offset,
                limit,
              },
              logger
            );

          return res.status(200).send(
            attributeRegistryApi.Attributes.parse({
              results: attributes.results.map(toApiAttribute),
              totalCount: attributes.totalCount,
            })
          );
        } catch (error) {
          return res.status(500).send();
        }
      }
    )
    .get(
      "/attributes/name/:name",
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
          const attribute = await attributeRegistryService.getAttributeByName(
            req.params.name,
            ctx.logger
          );

          return res
            .status(200)
            .send(
              attributeRegistryApi.Attribute.parse(
                toApiAttribute(attribute.data)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAttributesByNameErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )

    .get(
      "/attributes/origin/:origin/code/:code",
      authorizationMiddleware([
        ADMIN_ROLE,
        INTERNAL_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const { origin, code } = req.params;
          const attribute =
            await attributeRegistryService.getAttributeByOriginAndCode(
              {
                origin,
                code,
              },
              ctx.logger
            );

          return res
            .status(200)
            .send(
              attributeRegistryApi.Attribute.parse(
                toApiAttribute(attribute.data)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAttributeByOriginAndCodeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )

    .get(
      "/attributes/:attributeId",
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
          const attribute = await attributeRegistryService.getAttributeById(
            unsafeBrandId(req.params.attributeId),
            ctx.logger
          );

          return res
            .status(200)
            .send(
              attributeRegistryApi.Attribute.parse(
                toApiAttribute(attribute.data)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAttributeByIdErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/bulk/attributes",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const { logger } = fromAppContext(req.ctx);
        const { limit, offset } = req.query;

        try {
          const attributes = await attributeRegistryService.getAttributesByIds(
            {
              ids: req.body.map((a) => unsafeBrandId(a)),
              offset,
              limit,
            },
            logger
          );
          return res.status(200).send(
            attributeRegistryApi.Attributes.parse({
              results: attributes.results.map(toApiAttribute),
              totalCount: attributes.totalCount,
            })
          );
        } catch (error) {
          return res.status(500).send();
        }
      }
    )
    .post(
      "/certifiedAttributes",
      authorizationMiddleware([ADMIN_ROLE, M2M_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const attribute =
            await attributeRegistryService.createCertifiedAttribute(
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              attributeRegistryApi.Attribute.parse(toApiAttribute(attribute))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createCertifiedAttributesErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/declaredAttributes",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE, M2M_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const attribute =
            await attributeRegistryService.createDeclaredAttribute(
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              attributeRegistryApi.Attribute.parse(toApiAttribute(attribute))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createDeclaredAttributesErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/verifiedAttributes",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE, M2M_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const attribute =
            await attributeRegistryService.createVerifiedAttribute(
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              attributeRegistryApi.Attribute.parse(toApiAttribute(attribute))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createVerifiedAttributesErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/certifiedAttributes",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const attribute =
            await attributeRegistryService.createInternalCertifiedAttribute(
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              attributeRegistryApi.Attribute.parse(toApiAttribute(attribute))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createInternalCertifiedAttributesErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return attributeRouter;
};
export default attributeRouter;
