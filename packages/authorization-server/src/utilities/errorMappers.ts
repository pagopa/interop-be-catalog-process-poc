import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_TOO_MANY_REQUESTS,
} = constants;

export const authorizationServerErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tokenGenerationStatesEntryNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("tooManyRequestsError", () => HTTP_STATUS_TOO_MANY_REQUESTS)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
