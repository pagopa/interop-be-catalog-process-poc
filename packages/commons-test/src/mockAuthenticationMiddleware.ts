/* eslint-disable functional/immutable-data */
import {
  ExpressContext,
  genericLogger,
  jwtFromAuthHeader,
  readAuthDataFromJwtToken,
} from "pagopa-interop-commons";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";

export const mockAuthenticationMiddleware: (
  config: unknown
) => ZodiosRouterContextRequestHandler<ExpressContext> =
  () =>
  async (req, _res, next): Promise<unknown> => {
    try {
      const jwtToken = jwtFromAuthHeader(req, genericLogger);
      req.ctx.authData = readAuthDataFromJwtToken(jwtToken, genericLogger);

      return next();
    } catch (error) {
      next(error);
    }
    return next();
  };
