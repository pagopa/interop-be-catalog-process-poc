/* eslint-disable sonarjs/no-identical-functions */
import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_CONFLICT,
} = constants;

export const getEServiceTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const suspendEServiceTemplateVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceTemplateNotFound",
      "eServiceTemplateVersionNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("notValidEServiceTemplateVersionState", () => HTTP_STATUS_BAD_REQUEST)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const activateEServiceTemplateVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceTemplateNotFound",
      "eServiceTemplateVersionNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("notValidEServiceTemplateVersionState", () => HTTP_STATUS_BAD_REQUEST)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateEServiceTemplateNameErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with(
      "eserviceTemplateWithoutPublishedVersion",
      "eServiceTemplateDuplicate",
      () => HTTP_STATUS_CONFLICT
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateEServiceTemplateAudienceDescriptionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("eserviceTemplateWithoutPublishedVersion", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateEServiceTemplateEServiceDescriptionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("eserviceTemplateWithoutPublishedVersion", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
