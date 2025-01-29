/* eslint-disable sonarjs/no-identical-functions */
import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_CONFLICT,
} = constants;

export const getEServiceErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("eServiceNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createEServiceErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("originNotCompliant", () => HTTP_STATUS_FORBIDDEN)
    .with("eServiceDuplicate", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateEServiceErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("eServiceDuplicate", () => HTTP_STATUS_CONFLICT)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("eserviceNotInDraftState", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteEServiceErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("eserviceNotInDraftState", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const documentCreateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceDescriptorNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "notValidDescriptor",
      "interfaceAlreadyExists",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("prettyNameDuplicate", () => HTTP_STATUS_CONFLICT)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const documentGetErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceDescriptorNotFound",
      "eServiceDocumentNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const documentDeleteErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceDescriptorNotFound",
      "eServiceDocumentNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("notValidDescriptor", () => HTTP_STATUS_BAD_REQUEST)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const documentUpdateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceDescriptorNotFound",
      "eServiceDocumentNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("notValidDescriptor", () => HTTP_STATUS_BAD_REQUEST)
    .with("prettyNameDuplicate", () => HTTP_STATUS_CONFLICT)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "draftDescriptorAlreadyExists",
      "attributeNotFound",
      "inconsistentDailyCalls",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteDraftDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceDescriptorNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("notValidDescriptor", () => HTTP_STATUS_BAD_REQUEST)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateDraftDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceDescriptorNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with(
      "notValidDescriptor",
      "inconsistentDailyCalls",
      "attributeNotFound",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceDescriptorNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with(
      "notValidDescriptor",
      "inconsistentDailyCalls",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const publishDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceDescriptorNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "eServiceDescriptorWithoutInterface",
      "eServiceRiskAnalysisIsRequired",
      "riskAnalysisNotValid",
      "notValidDescriptor",
      "audienceCannotBeEmpty",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const suspendDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceDescriptorNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("notValidDescriptor", () => HTTP_STATUS_BAD_REQUEST)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const activateDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceDescriptorNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("notValidDescriptor", () => HTTP_STATUS_BAD_REQUEST)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const cloneEServiceByDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceDescriptorNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("eServiceDuplicate", () => HTTP_STATUS_CONFLICT)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const archiveDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceDescriptorNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createRiskAnalysisErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "eserviceNotInDraftState",
      "eserviceNotInReceiveMode",
      "riskAnalysisValidationFailed",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("riskAnalysisDuplicated", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateRiskAnalysisErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceRiskAnalysisNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "eserviceNotInDraftState",
      "eserviceNotInReceiveMode",
      "riskAnalysisValidationFailed",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("riskAnalysisDuplicated", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteRiskAnalysisErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceRiskAnalysisNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "eserviceNotInDraftState",
      "eserviceNotInReceiveMode",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateEServiceDescriptionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("eserviceWithoutValidDescriptors", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateEServiceFlagsErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("eserviceWithoutValidDescriptors", () => HTTP_STATUS_CONFLICT)
    .with("invalidEServiceFlags", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateEServiceNameErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with(
      "eserviceWithoutValidDescriptors",
      "eServiceDuplicate",
      () => HTTP_STATUS_CONFLICT
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateDescriptorAttributesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eServiceNotFound",
      "eServiceDescriptorNotFound",
      "attributeNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "inconsistentAttributesSeedGroupsCount",
      "descriptorAttributeGroupSupersetMissingInAttributesSeed",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("unchangedAttributes", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const approveDelegatedEServiceDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("eServiceDescriptorNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const rejectDelegatedEServiceDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("eServiceDescriptorNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
