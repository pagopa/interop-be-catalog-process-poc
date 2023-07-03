import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { match, P } from "ts-pattern";
import { readClaimsFromJwtToken } from "./auth/jwt.js";
import { CatalogProcessError, ErrorCode } from "./model/domain/errors.js";
import { ApiError, mapCatalogServiceErrorToApiError } from "./model/types.js";
import { ExpressContext } from "./app.js";

export const authMiddleware: ZodiosRouterContextRequestHandler<
  ExpressContext
> = (req, res, next) => {
  try {
    const authorization = req.headers.authorization;
    return match(authorization)
      .with(P.string, (auth: string) => {
        const bearer = auth.replace("Bearer ", "");
        if (!bearer) {
          throw new CatalogProcessError(
            `Bearer token has not been passed`,
            ErrorCode.MissingBearer
          );
        }

        const authData = readClaimsFromJwtToken(bearer);
        if (!authData) {
          throw new CatalogProcessError(
            `Invalid claims: token parsing error`,
            ErrorCode.MissingClaim
          );
        }

        if (authData && !authData.organizationId) {
          throw new CatalogProcessError(
            `Claim ${bearer} has not been passed`,
            ErrorCode.MissingClaim
          );
        }

        // eslint-disable-next-line functional/immutable-data
        req.authData = authData;
        next();
      })
      .with(undefined, () => {
        throw new CatalogProcessError(
          `Bearer token has not been passed`,
          ErrorCode.MissingBearer
        );
      })
      .otherwise(() => {
        throw new CatalogProcessError(
          `Header authorization not existing in this request`,
          ErrorCode.MissingHeader
        );
      });
  } catch (error) {
    const errorRes: ApiError = mapCatalogServiceErrorToApiError(error);
    return res.status(errorRes.status).json(errorRes).end();
  }
};
