/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { RequestListener } from "http";
import jwt from "jsonwebtoken";
import request from "supertest";
import type {
  Method,
  ZodiosEndpointDefinition,
  ZodiosPathsByMethod,
  ZodiosBodyByPath,
  ZodiosQueryParamsByPath,
  ZodiosPathParamsByPath,
  ZodiosResponseByPath,
} from "@zodios/core";
import { AuthData } from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import { getMockAuthData } from "./testUtils.js";

type MockedApiRequestOptions<
  TApi extends Array<ZodiosEndpointDefinition<unknown>>,
  TMethod extends Method,
  TPath extends ZodiosPathsByMethod<TApi, TMethod>
> = {
  path: TPath;
  authData?: AuthData;
} & (ZodiosPathParamsByPath<TApi, TMethod, TPath> extends never
  ? object
  : { pathParams: ZodiosPathParamsByPath<TApi, TMethod, TPath> }) &
  (ZodiosQueryParamsByPath<TApi, TMethod, TPath> extends never
    ? object
    : { queryParams: ZodiosQueryParamsByPath<TApi, TMethod, TPath> }) &
  (ZodiosBodyByPath<TApi, TMethod, TPath> extends never
    ? object
    : { body: ZodiosBodyByPath<TApi, TMethod, TPath> });

type MockedApiRequester<TApi extends Array<ZodiosEndpointDefinition<unknown>>> =
  {
    [TMethod in "get" | "post" | "delete" | "put"]: <
      TPath extends ZodiosPathsByMethod<TApi, TMethod>
    >(
      opts: MockedApiRequestOptions<TApi, TMethod, TPath>
    ) => Promise<ZodiosResponseByPath<TApi, TMethod, TPath>>;
  };

export function createMockedApiRequester<
  TApi extends Array<ZodiosEndpointDefinition<unknown>>
>(app: RequestListener): MockedApiRequester<TApi> {
  function resolvePathParams(
    path: string,
    pathParams?: Record<string, string>
  ) {
    if (!pathParams) {
      return path;
    }
    return Object.entries(pathParams).reduce(
      (acc, [key, value]) => acc.replace(`:${key}`, value),
      path
    );
  }

  const requester = request(app);

  function sendMockedApiRequest<TMethod extends Method>(method: TMethod) {
    return async <TPath extends ZodiosPathsByMethod<TApi, TMethod>>(
      opts: MockedApiRequestOptions<TApi, TMethod, TPath>
    ): Promise<ZodiosResponseByPath<TApi, TMethod, TPath>> => {
      const authData = opts.authData ?? getMockAuthData();
      const { path, pathParams, body, queryParams } = opts as {
        path: string;
        pathParams?: Record<string, string>;
        body?: unknown;
        queryParams?: unknown;
      };

      const payload = {
        iss: "dev.interop.pagopa.it",
        aud: "dev.interop.pagopa.it/ui",
        uid: authData.userId,
        nbf: Math.floor(Date.now() / 1000),
        name: "Mario",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        family_name: "Rossi",
        jti: "1bca86f5-e913-4fce-bc47-2803bde44d2b",
        email: "Mario.rossi@psp.it",
        ...authData,
        organization: {
          id: authData.selfcareId,
          name: "PagoPA S.p.A.",
          roles: [
            {
              partyRole: "MANAGER",
              role: "admin",
            },
          ],
          fiscal_code: "15376371009",
          ipaCode: "5N2TR557",
        },
        "user-roles": authData.userRoles.join(","),
      };

      const sessionToken = jwt.sign(payload, "test-secret");

      const request = requester[method](resolvePathParams(path, pathParams));

      request.set({
        "X-Correlation-Id": generateId(),
        Authorization: `Bearer ${sessionToken}`,
      });

      if (queryParams) {
        request.query(queryParams);
      }
      if (body) {
        request.send(body);
      }

      return new Promise<Response>((resolve, reject) => {
        request.end((err, res) => {
          if (err) {
            reject(err);
          }
          resolve(res.body);
        });
      });
    };
  }

  return {
    get: sendMockedApiRequest("get"),
    post: sendMockedApiRequest("post"),
    delete: sendMockedApiRequest("delete"),
    put: sendMockedApiRequest("put"),
  };
}

export type MockApiRequester<
  TApi extends Array<ZodiosEndpointDefinition<unknown>>
> = ReturnType<typeof createMockedApiRequester<TApi>>;
