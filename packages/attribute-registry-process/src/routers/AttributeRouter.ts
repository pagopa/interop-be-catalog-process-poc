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
import { readModelService } from "../services/readModelService.js";
import {
  toAttributeKind,
  toApiAttribute,
} from "../model/domain/apiConverter.js";
import { attributeNotFound } from "../model/domain/errors.js";

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

          const attributes = await readModelService.getAttributes(
            {
              kinds: kinds.map(toAttributeKind),
              name,
              origin,
            },
            offset,
            limit
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
        try {
          const attribute = await readModelService.getAttributeByName(
            req.params.name
          );

          if (attribute) {
            return res.status(200).json(toApiAttribute(attribute.data)).end();
          } else {
            return res
              .status(404)
              .json(makeApiProblem(attributeNotFound(req.params.name)))
              .end();
          }
        } catch (error) {
          const errorRes = makeApiProblem(error);
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
        try {
          const { origin, code } = req.params;

          const attribute = await readModelService.getAttributeByOriginAndCode({
            origin,
            code,
          });
          if (attribute) {
            return res.status(200).json(toApiAttribute(attribute.data)).end();
          } else {
            return res
              .status(404)
              .json(makeApiProblem(attributeNotFound(`${origin}/${code}`)))
              .end();
          }
        } catch (error) {
          const errorRes = makeApiProblem(error);
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
        try {
          const attribute = await readModelService.getAttributeById(
            req.params.attributeId
          );

          if (attribute) {
            return res.status(200).json(toApiAttribute(attribute.data)).end();
          } else {
            return res
              .status(404)
              .json(makeApiProblem(attributeNotFound(req.params.attributeId)))
              .end();
          }
        } catch (error) {
          const errorRes = makeApiProblem(error);
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
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/certifiedAttributes",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE, M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/declaredAttributes",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE, M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/verifiedAttributes",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE, M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/internal/certifiedAttributes",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (_req, res) => res.status(501).send()
    );

  return attributeRouter;
};
export default attributeRouter;
