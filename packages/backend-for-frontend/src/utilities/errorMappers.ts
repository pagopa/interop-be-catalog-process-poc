/* eslint-disable sonarjs/no-identical-functions */
import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as BFFErrorCodes } from "../model/errors.js";

type ErrorCodes = BFFErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  HTTP_STATUS_BAD_REQUEST,
} = constants;

export const bffGetCatalogErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with(
      "descriptorNotFound",
      "eserviceRiskNotFound",
      "eserviceDescriptorNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("invalidEserviceRequester", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const emptyErrorMapper = (): number => HTTP_STATUS_INTERNAL_SERVER_ERROR;

export const reversePurposeUpdateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getPurposesErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with(
      "tenantNotFound",
      "eServiceNotFound",
      "agreementNotFound",
      "eserviceDescriptorNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getPurposeErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with(
      "tenantNotFound",
      "eServiceNotFound",
      "agreementNotFound",
      "eserviceDescriptorNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const clonePurposeErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("purposeDraftVersionNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getSelfcareErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("selfcareEntityNotFilled", () => HTTP_STATUS_INTERNAL_SERVER_ERROR)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getSelfcareUserErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("selfcareEntityNotFilled", () => HTTP_STATUS_INTERNAL_SERVER_ERROR)
    .with("userNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const sessionTokenErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("tokenVerificationFailed", () => HTTP_STATUS_UNAUTHORIZED)
    .with("tenantLoginNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with("tooManyRequestsError", () => HTTP_STATUS_TOO_MANY_REQUESTS)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getAgreementsErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with(
      "agreementDescriptorNotFound",
      () => HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getAgreementByIdErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "agreementDescriptorNotFound",
      () => HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getAgreementContractErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("contractException", () => HTTP_STATUS_INTERNAL_SERVER_ERROR)
    .with("contractNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const activateAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementDescriptorNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getClientUsersErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("userNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getPrivacyNoticeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("privacyNoticeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("privacyNoticeNotFoundInConfiguration", () => HTTP_STATUS_NOT_FOUND)
    .with("dynamoReadingError", () => HTTP_STATUS_INTERNAL_SERVER_ERROR)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const acceptPrivacyNoticeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("privacyNoticeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("privacyNoticeNotFoundInConfiguration", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "privacyNoticeVersionIsNotTheLatest",
      () => HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
    .with("dynamoReadingError", () => HTTP_STATUS_INTERNAL_SERVER_ERROR)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const attributeEmptyErrorMapper = (): number =>
  HTTP_STATUS_INTERNAL_SERVER_ERROR;

export const getProducerKeychainUsersErrorMapper = (
  error: ApiError<ErrorCodes>
  // eslint-disable-next-line sonarjs/no-identical-functions
): number =>
  match(error.code)
    .with("userNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const toolsErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("organizationNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createEServiceDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eserviceDescriptorNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "invalidInterfaceContentTypeDetected",
      "invalidInterfaceFileDetected",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const importEServiceErrorMapper = (
  error: ApiError<ErrorCodes>
): number => {
  // since verifyAndCreateEServiceDocument is shared, they throw the same errors
  const baseMapperResult = createEServiceDocumentErrorMapper(error);

  if (baseMapperResult === HTTP_STATUS_INTERNAL_SERVER_ERROR) {
    return match(error.code)
      .with(
        "notValidDescriptor",
        "invalidZipStructure",
        () => HTTP_STATUS_BAD_REQUEST
      )
      .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
  }

  return baseMapperResult;
};

export const exportEServiceDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eserviceDescriptorNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("notValidDescriptor", () => HTTP_STATUS_BAD_REQUEST)
    .with("invalidEserviceRequester", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

const delegationNotFoundErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("delegationNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getDelegationByIdErrorMapper = delegationNotFoundErrorMapper;
export const getDelegationsErrorMapper = delegationNotFoundErrorMapper;

export const createEServiceTemplateVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("noVersionInEServiceTemplate", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
