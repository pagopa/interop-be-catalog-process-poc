/* eslint-disable max-classes-per-file */
import { P, match } from "ts-pattern";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { CorrelationId } from "./brandedIds.js";

export class ApiError<T> extends Error {
  /* TODO consider refactoring how the code property is used:
    From the API point of view, it is an info present only in the single error
    in the errors array - not in the main Problem response.
    However, at the moment we need it because it is used around the codebase to
    map ApiError to a specific HTTP status code.
    */
  public code: T;
  public title: string;
  public detail: string;
  public errors: Array<{ code: T; detail: string }>;

  constructor({
    code,
    title,
    detail,
    errors,
  }: {
    code: T;
    title: string;
    detail: string;
    errors?: Error[];
  }) {
    super(detail);
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.errors =
      errors && errors.length > 0
        ? errors.map((e) => ({ code, detail: e.message }))
        : [{ code, detail }];
  }
}

export class InternalError<T> extends Error {
  public code: T;
  public detail: string;

  constructor({ code, detail }: { code: T; detail: string }) {
    super(detail);
    this.code = code;
    this.detail = detail;
  }
}

type ProblemError = {
  code: string;
  detail: string;
};

export type Problem = {
  type: string;
  status: number;
  title: string;
  correlationId?: string;
  detail: string;
  errors: ProblemError[];
  toString: () => string;
};

type MakeApiProblemFn<T extends string> = (
  error: unknown,
  httpMapper: (apiError: ApiError<T | CommonErrorCodes>) => number,
  logger: { error: (message: string) => void; warn: (message: string) => void },
  correlationId: CorrelationId,
  operationalLogMessage?: string
) => Problem;

const makeProblemLogString = (
  problem: Problem,
  originalError: unknown
): string => {
  const errorsString = problem.errors.map((e) => e.detail).join(" - ");
  return `- title: ${problem.title} - detail: ${problem.detail} - errors: ${errorsString} - original error: ${originalError}`;
};

export function makeApiProblemBuilder<T extends string>(
  errors: {
    [K in T]: string;
  },
  problemErrorsPassthrough: boolean = true
): MakeApiProblemFn<T> {
  const allErrors = { ...errorCodes, ...errors };
  return (error, httpMapper, logger, correlationId, operationalLogMessage) => {
    const makeProblem = (
      httpStatus: number,
      { title, detail, errors }: ApiError<T | CommonErrorCodes>
    ): Problem => ({
      type: "about:blank",
      title,
      status: httpStatus,
      detail,
      correlationId,
      errors: errors.map(({ code, detail }) => ({
        code: allErrors[code],
        detail,
      })),
    });

    const genericProblem = makeProblem(500, genericError("Unexpected error"));

    if (operationalLogMessage) {
      logger.warn(operationalLogMessage);
    }
    return match<unknown, Problem>(error)
      .with(P.instanceOf(ApiError<T | CommonErrorCodes>), (error) => {
        const problem = makeProblem(httpMapper(error), error);
        logger.warn(makeProblemLogString(problem, error));
        return problem;
      })
      .with(
        /* this case is to allow a passthrough of Problem errors, so that
           services that call other interop services can forward Problem errors
           as they are, without the need to explicitly handle them */
        {
          response: {
            status: P.number,
            data: {
              type: "about:blank",
              title: P.string,
              status: P.number,
              detail: P.string,
              errors: P.array({
                code: P.string,
                detail: P.string,
              }),
              correlationId: P.string.optional(),
            },
          },
        },
        (e) => {
          const receivedProblem: Problem = e.response.data;
          if (problemErrorsPassthrough) {
            logger.warn(makeProblemLogString(receivedProblem, error));
            return receivedProblem;
          } else {
            logger.warn(
              makeProblemLogString(
                genericProblem,
                `${receivedProblem.title}, code ${
                  receivedProblem.errors.at(0)?.code
                }, ${receivedProblem.errors.at(0)?.detail}`
              )
            );
            return genericProblem;
          }
        }
      )
      .with(P.instanceOf(ZodError), (error) => {
        // Zod errors shall always be catched and handled throwing
        // an ApiError. If a ZodError arrives here we log it and
        // return a generic problem
        const zodError = fromZodError(error);
        logger.error(makeProblemLogString(genericProblem, zodError));
        return genericProblem;
      })
      .otherwise((error: unknown): Problem => {
        logger.error(makeProblemLogString(genericProblem, error));
        return genericProblem;
      });
  };
}

const errorCodes = {
  authenticationSaslFailed: "9000",
  jwtDecodingError: "9001",
  htmlTemplateInterpolationError: "9002",
  pdfGenerationError: "9003",
  operationForbidden: "9989",
  invalidClaim: "9990",
  genericError: "9991",
  thirdPartyCallError: "9992",
  unauthorizedError: "9993",
  missingHeader: "9994",
  tokenGenerationError: "9995",
  missingRSAKey: "9996",
  missingKafkaMessageData: "9997",
  kafkaMessageProcessError: "9998",
  badRequestError: "9999",
  jwkDecodingError: "10000",
  notAllowedPrivateKeyException: "10001",
  missingRequiredJWKClaim: "10002",
  invalidKey: "10003",
  tooManyRequestsError: "10004",
  notAllowedCertificateException: "10005",
  jwksSigningKeyError: "10006",
  badBearerToken: "10007",
  invalidKeyLength: "10003",
} as const;

export type CommonErrorCodes = keyof typeof errorCodes;

export function parseErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return fromZodError(error).message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return `${JSON.stringify(error)}`;
}

/* ===== Internal Error ===== */

export function missingKafkaMessageDataError(
  dataName: string,
  eventType: string
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "missingKafkaMessageData",
    detail: `"Invalid message: missing data '${dataName}' in ${eventType} event"`,
  });
}

export function genericInternalError(
  message: string
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "genericError",
    detail: message,
  });
}

export function thirdPartyCallError(
  serviceName: string,
  errorMessage: string
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "thirdPartyCallError",
    detail: `Error while invoking ${serviceName} external service -> ${errorMessage}`,
  });
}

export function tokenGenerationError(
  error: unknown
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "tokenGenerationError",
    detail: `Error during token generation: ${parseErrorMessage(error)}`,
  });
}

export function kafkaMessageProcessError(
  topic: string,
  partition: number,
  offset: string,
  error?: unknown
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "kafkaMessageProcessError",
    detail: `Error while handling kafka message from topic : ${topic} - partition ${partition} - offset ${offset}. ${
      error ? parseErrorMessage(error) : ""
    }`,
  });
}

export function htmlTemplateInterpolationError(
  error: unknown
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "htmlTemplateInterpolationError",
    detail: `Error compiling HTML template: ${parseErrorMessage(error)}`,
  });
}

export function pdfGenerationError(
  error: unknown
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "pdfGenerationError",
    detail: `Error during pdf generation : ${parseErrorMessage(error)}`,
  });
}

/* ===== API Error ===== */

export function authenticationSaslFailed(
  message: string
): ApiError<CommonErrorCodes> {
  return new ApiError({
    code: "authenticationSaslFailed",
    title: "SASL authentication fails",
    detail: `SALS Authentication fails with this error : ${message}`,
  });
}

export function genericError(details: string): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: details,
    code: "genericError",
    title: "Unexpected error",
  });
}

export function unauthorizedError(details: string): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: details,
    code: "unauthorizedError",
    title: "Unauthorized",
  });
}

export function badRequestError(
  detail: string,
  errors?: Error[]
): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail,
    code: "badRequestError",
    title: "Bad request",
    errors,
  });
}

export function tooManyRequestsError(
  organizationId: string
): ApiError<CommonErrorCodes> {
  return new ApiError({
    code: "tooManyRequestsError",
    title: "Too Many Requests",
    detail: `Requests limit exceeded for organization ${organizationId}`,
  });
}

export function invalidClaim(error: unknown): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Claim not valid or missing: ${parseErrorMessage(error)}`,
    code: "invalidClaim",
    title: "Claim not valid or missing",
  });
}

export function jwtDecodingError(error: unknown): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Unexpected error on JWT decoding: ${parseErrorMessage(error)}`,
    code: "jwtDecodingError",
    title: "JWT decoding error",
  });
}

export function missingHeader(headerName?: string): ApiError<CommonErrorCodes> {
  const title = "Header has not been passed";
  return new ApiError({
    detail: headerName ? `Missing ${headerName} request header` : title,
    code: "missingHeader",
    title,
  });
}

export const badBearerToken: ApiError<CommonErrorCodes> = new ApiError({
  detail: `Bad Bearer Token format in Authorization header`,
  code: "badBearerToken",
  title: "Bad Bearer Token format",
});

export const operationForbidden: ApiError<CommonErrorCodes> = new ApiError({
  detail: `Insufficient privileges`,
  code: "operationForbidden",
  title: "Insufficient privileges",
});

export function jwkDecodingError(error: unknown): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Unexpected error on JWK base64 decoding: ${parseErrorMessage(
      error
    )}`,
    code: "jwkDecodingError",
    title: "JWK decoding error",
  });
}

export function jwksSigningKeyError(): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Error getting signing key`,
    code: "jwksSigningKeyError",
    title: "JWK signing key error",
  });
}

export function notAllowedPrivateKeyException(): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `The received key is a private key`,
    code: "notAllowedPrivateKeyException",
    title: "Not allowed private key exception",
  });
}

export function notAllowedCertificateException(): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `The received key is a certificate`,
    code: "notAllowedCertificateException",
    title: "Not allowed certificate exception",
  });
}

export function missingRequiredJWKClaim(): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `One or more required JWK claims are missing`,
    code: "missingRequiredJWKClaim",
    title: "Missing required JWK claims",
  });
}

export function invalidKey(
  kid: string,
  error: unknown
): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Key ${kid} is invalid. Reason: ${parseErrorMessage(error)}`,
    code: "invalidKey",
    title: "Invalid Key",
  });
}

export function invalidKeyLength(key: string): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Invalid length for the key ${key}, must be 2048 bites`,
    code: "invalidKeyLength",
    title: "Invalid Key length",
  });
}
