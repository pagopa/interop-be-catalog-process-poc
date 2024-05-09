import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_BAD_REQUEST,
} = constants;

export const getPurposeErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getRiskAnalysisDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "purposeNotFound",
      "purposeVersionNotFound",
      "purposeVersionDocumentNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("organizationNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deletePurposeVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "purposeNotFound",
      "purposeVersionNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("organizationIsNotTheConsumer", () => HTTP_STATUS_FORBIDDEN)
    .with("purposeVersionCannotBeDeleted", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const rejectPurposeVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "purposeNotFound",
      "purposeVersionNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("organizationIsNotTheProducer", () => HTTP_STATUS_FORBIDDEN)
    .with("notValidVersionState", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
