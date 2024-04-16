import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
  ReadModelRepository,
  initDB,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { api } from "../model/generated/api.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import {
  toAttributeKind,
  toApiAttribute,
} from "../model/domain/apiConverter.js";
import { config } from "../utilities/config.js";
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
  const attributeRouter = ctx.router(api.api);
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
        try {
          const { limit, offset, kinds, name, origin } = req.query;

          const loggerCtx = {
            userId: req.ctx.authData.userId,
            organizationId: req.ctx.authData.organizationId,
            correlationId: req.ctx.correlationId,
          };

          const attributes =
            await attributeRegistryService.getAttributesByKindsNameOrigin(
              {
                kinds: kinds.map(toAttributeKind),
                name,
                origin,
                offset,
                limit,
              },
              loggerCtx
            );

          return res
            .status(200)
            .json({
              results: attributes.results.map(toApiAttribute),
              totalCount: attributes.totalCount,
            })
            .end();
        } catch (error) {
          return res.status(500).end();
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
        const loggerCtx = {
          userId: req.ctx.authData.userId,
          organizationId: req.ctx.authData.organizationId,
          correlationId: req.ctx.correlationId,
        };

        try {
          const attribute = await attributeRegistryService.getAttributeByName(
            req.params.name,
            loggerCtx
          );

          return res.status(200).json(toApiAttribute(attribute.data)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAttributesByNameErrorMapper,
            loggerCtx
          );
          return res.status(errorRes.status).json(errorRes).end();
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
        const { origin, code } = req.params;
        const loggerCtx = {
          userId: req.ctx.authData.userId,
          organizationId: req.ctx.authData.organizationId,
          correlationId: req.ctx.correlationId,
        };

        try {
          const attribute =
            await attributeRegistryService.getAttributeByOriginAndCode(
              {
                origin,
                code,
              },
              loggerCtx
            );

          return res.status(200).json(toApiAttribute(attribute.data)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAttributeByOriginAndCodeErrorMapper,
            loggerCtx
          );
          return res.status(errorRes.status).json(errorRes).end();
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
        const loggerCtx = {
          userId: req.ctx.authData.userId,
          organizationId: req.ctx.authData.organizationId,
          correlationId: req.ctx.correlationId,
        };

        try {
          const attribute = await attributeRegistryService.getAttributeById(
            unsafeBrandId(req.params.attributeId),
            loggerCtx
          );

          return res.status(200).json(toApiAttribute(attribute.data)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAttributeByIdErrorMapper,
            loggerCtx
          );
          return res.status(errorRes.status).json(errorRes).end();
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
        const { limit, offset } = req.query;
        const loggerCtx = {
          userId: req.ctx.authData.userId,
          organizationId: req.ctx.authData.organizationId,
          correlationId: req.ctx.correlationId,
        };

        try {
          const attributes = await attributeRegistryService.getAttributesByIds(
            {
              ids: req.body.map((a) => unsafeBrandId(a)),
              offset,
              limit,
            },
            loggerCtx
          );
          return res
            .status(200)
            .json({
              results: attributes.results.map(toApiAttribute),
              totalCount: attributes.totalCount,
            })
            .end();
        } catch (error) {
          return res.status(500).end();
        }
      }
    )
    .post(
      "/certifiedAttributes",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE, M2M_ROLE]),
      async (req, res) => {
        try {
          const attribute =
            await attributeRegistryService.createCertifiedAttribute(
              req.body,
              req.ctx.authData,
              req.ctx.correlationId
            );
          return res.status(200).json(toApiAttribute(attribute)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createCertifiedAttributesErrorMapper,
            {
              userId: req.ctx.authData.userId,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
            }
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/declaredAttributes",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE, M2M_ROLE]),
      async (req, res) => {
        try {
          const attribute =
            await attributeRegistryService.createDeclaredAttribute(
              req.body,
              req.ctx.authData,
              req.ctx.correlationId
            );
          return res.status(200).json(toApiAttribute(attribute)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createDeclaredAttributesErrorMapper,
            {
              userId: req.ctx.authData.userId,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
            }
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/verifiedAttributes",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE, M2M_ROLE]),
      async (req, res) => {
        try {
          const attribute =
            await attributeRegistryService.createVerifiedAttribute(
              req.body,
              req.ctx.authData,
              req.ctx.correlationId
            );
          return res.status(200).json(toApiAttribute(attribute)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createVerifiedAttributesErrorMapper,
            {
              userId: req.ctx.authData.userId,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
            }
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/internal/certifiedAttributes",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        try {
          const attribute =
            await attributeRegistryService.createInternalCertifiedAttribute(
              req.body,
              req.ctx.authData,
              req.ctx.correlationId
            );
          return res.status(200).json(toApiAttribute(attribute)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createInternalCertifiedAttributesErrorMapper,
            {
              userId: req.ctx.authData.userId,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
            }
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    );

  return attributeRouter;
};
export default attributeRouter;
