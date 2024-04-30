import {
  ZodiosPathsByMethod,
  ZodiosEndpointDefinition,
  Method,
} from "@zodios/core";
import { Request } from "express";
import {
  Problem,
  makeApiProblemBuilder,
  genericError,
  ApiError,
  unauthorizedError,
  CommonErrorCodes,
  missingBearer,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { z } from "zod";
import { Middleware } from "../types/middleware.js";
import { UserRole, readHeaders } from "../index.js";
import { logger } from "../logging/index.js";
import { readAuthDataFromJwtToken } from "./jwt.js";

type RoleValidation =
  | {
      isValid: false;
      error: ApiError<CommonErrorCodes>;
    }
  | { isValid: true };

const hasValidRoles = (
  req: Request,
  admittedRoles: UserRole[]
): RoleValidation => {
  const jwtToken = req.headers.authorization?.split(" ")[1];
  if (!jwtToken) {
    throw missingBearer;
  }
  const authData = readAuthDataFromJwtToken(jwtToken);
  if (!authData.userRoles || authData.userRoles.length === 0) {
    return {
      isValid: false,
      error: unauthorizedError("No user roles found to execute this request"),
    };
  }

  const admittedRolesStr = admittedRoles.map((role) =>
    role.toString().toLowerCase()
  );

  const intersection = authData.userRoles.filter((value) =>
    admittedRolesStr.includes(value)
  );

  return intersection.length > 0
    ? { isValid: true }
    : {
        isValid: false,
        error: unauthorizedError(
          `Invalid user roles (${authData.userRoles.join(
            ","
          )}) to execute this request`
        ),
      };
};

const makeApiProblem = makeApiProblemBuilder({});

export const authorizationMiddleware =
  <
    Api extends ZodiosEndpointDefinition[],
    M extends Method,
    Path extends ZodiosPathsByMethod<Api, M>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Context extends z.ZodObject<any>
  >(
    admittedRoles: UserRole[]
  ): Middleware<Api, M, Path, Context> =>
  (req, res, next) => {
    try {
      const validationResult = hasValidRoles(req as Request, admittedRoles);
      if (!validationResult.isValid) {
        throw validationResult.error;
      }

      return next();
    } catch (err) {
      const headers = readHeaders(req as Request);

      const logger_instance = logger({
        userId: headers?.userId,
        organizationId: headers?.organizationId,
        correlationId: headers?.correlationId,
      });

      const problem = match<unknown, Problem>(err)
        .with(P.instanceOf(ApiError), (error) =>
          makeApiProblem(
            new ApiError({
              code: error.code,
              detail: error.detail,
              title: error.title,
              correlationId: headers?.correlationId,
            }),
            (error) => (error.code === "unauthorizedError" ? 403 : 500),
            logger_instance
          )
        )
        .otherwise(() =>
          makeApiProblem(
            genericError(
              "An unexpected error occurred during authorization checks"
            ),
            () => 500,
            logger_instance
          )
        );

      return (
        res
          .status(problem.status)
          // NOTE(gabro): this is fine, we don't need the type safety provided by Zod since this is a generic middleware.
          // Preserving the type-level machinery to check the correctness of the json body wrt the status code is not worth the effort.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion
          .json(problem as any)
          .end()
      );
    }
  };
