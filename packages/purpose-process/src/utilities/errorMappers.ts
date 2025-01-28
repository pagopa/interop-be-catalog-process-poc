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

export const getPurposesErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("eserviceNotFound", () => HTTP_STATUS_BAD_REQUEST)
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
    .with(
      "organizationNotAllowed",
      "organizationIsNotTheConsumer",
      "organizationIsNotTheProducer",
      "organizationIsNotTheDelegatedProducer",
      "organizationIsNotTheDelegatedConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
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
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegatedConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
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
    .with(
      "organizationIsNotTheProducer",
      "organizationIsNotTheDelegatedProducer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("notValidVersionState", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updatePurposeErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with(
      "eServiceModeNotAllowed",
      "missingFreeOfChargeReason",
      "riskAnalysisValidationFailed",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with(
      "organizationIsNotTheConsumer",
      "purposeNotInDraftState",
      "organizationIsNotTheDelegatedConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("duplicatedPurposeTitle", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateReversePurposeErrorMapper = updatePurposeErrorMapper;

export const deletePurposeErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegatedConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("purposeCannotBeDeleted", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const archivePurposeVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "purposeNotFound",
      "purposeVersionNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegatedConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("notValidVersionState", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const suspendPurposeVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "purposeNotFound",
      "purposeVersionNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("organizationNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with("notValidVersionState", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createPurposeVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("unchangedDailyCalls", () => HTTP_STATUS_BAD_REQUEST)
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegatedConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("purposeVersionStateConflict", () => HTTP_STATUS_CONFLICT)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createPurposeErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegatedConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with(
      "missingFreeOfChargeReason",
      "agreementNotFound",
      "riskAnalysisValidationFailed",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("duplicatedPurposeTitle", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createReversePurposeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegatedConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with(
      "eserviceNotFound",
      "eServiceModeNotAllowed",
      "eserviceRiskAnalysisNotFound",
      "missingFreeOfChargeReason",
      "agreementNotFound",
      "riskAnalysisValidationFailed",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("duplicatedPurposeTitle", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const clonePurposeErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "duplicatedPurposeTitle",
      "purposeCannotBeCloned",
      () => HTTP_STATUS_CONFLICT
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const retrieveRiskAnalysisConfigurationByVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceNotFound",
      "riskAnalysisConfigVersionNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const retrieveLatestRiskAnalysisConfigurationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "tenantNotFound",
      "tenantKindNotFound",
      "riskAnalysisConfigLatestVersionNotFound",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const activatePurposeVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "missingRiskAnalysis",
      "agreementNotFound",
      "riskAnalysisValidationFailed",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheProducer",
      "organizationNotAllowed",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with(
      "purposeNotFound",
      "purposeVersionNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
