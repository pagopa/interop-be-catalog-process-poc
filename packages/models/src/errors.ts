/* eslint-disable max-classes-per-file */
import { P, match } from "ts-pattern";

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
  public correlationId?: string;

  constructor({
    code,
    title,
    detail,
    correlationId,
    errors,
  }: {
    code: T;
    title: string;
    detail: string;
    correlationId?: string;
    errors?: Error[];
  }) {
    super(detail);
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.correlationId = correlationId;
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

export type ProblemError = {
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

const makeProblemLogString = (
  problem: Problem,
  originalError: unknown
): string => {
  const errorsString = problem.errors.map((e) => e.detail).join(" - ");
  return `- title: ${problem.title} - detail: ${problem.detail} - errors: ${errorsString} - orignal error: ${originalError}`;
};

export function makeApiProblemBuilder<T extends string>(
  logger: { error: (message: string) => void; warn: (message: string) => void },
  errors: {
    [K in T]: string;
  }
): (
  error: unknown,
  httpMapper: (apiError: ApiError<T | CommonErrorCodes>) => number
) => Problem {
  const allErrors = { ...errorCodes, ...errors };
  return (error, httpMapper) => {
    const makeProblem = (
      httpStatus: number,
      { title, detail, correlationId, errors }: ApiError<T | CommonErrorCodes>
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

    return match<unknown, Problem>(error)
      .with(P.instanceOf(ApiError<T | CommonErrorCodes>), (error) => {
        const problem = makeProblem(httpMapper(error), error);
        logger.warn(makeProblemLogString(problem, error));
        return problem;
      })
      .otherwise((error: unknown) => {
        const problem = makeProblem(500, genericError("Unexpected error"));
        logger.error(makeProblemLogString(problem, error));
        return problem;
      });
  };
}

const errorCodes = {
  authenticationSaslFailed: "9000",
  jwtParsingError: "9001",
  operationForbidden: "9989",
  missingClaim: "9990",
  genericError: "9991",
  thirdPartyCallError: "9992",
  unauthorizedError: "9993",
  missingHeader: "9994",
  tokenGenerationError: "9995",
  missingRSAKey: "9996",
  missingKafkaMessageData: "9997",
  kafkaMessageProcessError: "9998",
  badRequestError: "9999",
} as const;

export type CommonErrorCodes = keyof typeof errorCodes;

export function parseErrorMessage(error: unknown): string {
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
  errors: Error[]
): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail,
    code: "badRequestError",
    title: "Bad request",
    errors,
  });
}

export function missingClaim(error: unknown): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Claim has not been passed ${parseErrorMessage(error)}`,
    code: "missingClaim",
    title: "Claim has not been passed",
  });
}

export function jwtParsingError(error: unknown): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Unexpected error JWT token parsing: ${parseErrorMessage(error)}`,
    code: "jwtParsingError",
    title: "JWT parsing error",
  });
}

export function missingHeader(headerName?: string): ApiError<CommonErrorCodes> {
  const title = "Header has not been passed";
  return new ApiError({
    detail: headerName
      ? `Header ${headerName} not existing in this request`
      : title,
    code: "missingHeader",
    title,
  });
}

export const missingBearer: ApiError<CommonErrorCodes> = new ApiError({
  detail: `Authorization Illegal header key.`,
  code: "missingHeader",
  title: "Bearer token has not been passed",
});

export const operationForbidden: ApiError<CommonErrorCodes> = new ApiError({
  detail: `Insufficient privileges`,
  code: "operationForbidden",
  title: "Insufficient privileges",
});
