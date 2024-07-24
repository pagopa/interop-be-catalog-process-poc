import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as BFFErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = BFFErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_FORBIDDEN,
} = constants;

export const bffGetCatalogErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with(
      "descriptorNotFound",
      "eserviceRiskNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("invalidEserviceRequester", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const reversePurposeUpdateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const emptyErrorMapper = (): number => HTTP_STATUS_INTERNAL_SERVER_ERROR;
