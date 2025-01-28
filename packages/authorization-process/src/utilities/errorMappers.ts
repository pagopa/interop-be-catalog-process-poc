/* eslint-disable sonarjs/no-identical-functions */
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

export const getClientErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createConsumerClientErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createApiClientErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getClientsErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getClientsWithKeysErrorMapper = getClientsErrorMapper;

export const deleteClientErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const removeClientUserErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("clientNotFound", "clientUserIdNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteClientKeyByIdErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("clientNotFound", "clientKeyNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const removeClientPurposeErrorMapper = (
  error: ApiError<ErrorCodes>
  // eslint-disable-next-line sonarjs/no-identical-functions
): number =>
  match(error.code)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    // .with("purposeNotFound", () => HTTP_STATUS_BAD_REQUEST)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getClientUsersErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addClientUserErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with(
      "organizationNotAllowedOnClient",
      "userWithoutSecurityPrivileges",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("clientUserAlreadyAssigned", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addClientPurposeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("clientNotFound", "purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "noAgreementFoundInRequiredState",
      "noPurposeVersionsFoundInRequiredState",
      "eserviceNotDelegableForClientAccess",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("purposeAlreadyLinkedToClient", () => HTTP_STATUS_CONFLICT)
    .with(
      "organizationNotAllowedOnClient",
      "organizationNotAllowedOnPurpose",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("purposeDelegationNotFound", () => HTTP_STATUS_INTERNAL_SERVER_ERROR)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getClientKeysErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createKeysErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "tooManyKeysPerClient",
      "notAllowedPrivateKeyException",
      "notAllowedCertificateException",
      "jwkDecodingError",
      "invalidKey",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("keyAlreadyExists", () => HTTP_STATUS_CONFLICT)
    .with(
      "organizationNotAllowedOnClient",
      "userWithoutSecurityPrivileges",
      "userNotFound",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createProducerKeychainKeyErrorMapper = (
  error: ApiError<ErrorCodes>
): number => {
  // since creation of keys is shared, they throw the same errors
  const baseMapperResult = createKeysErrorMapper(error);

  if (baseMapperResult === HTTP_STATUS_INTERNAL_SERVER_ERROR) {
    return match(error.code)
      .with("producerKeychainNotFound", () => HTTP_STATUS_NOT_FOUND)
      .with("tooManyKeysPerProducerKeychain", () => HTTP_STATUS_BAD_REQUEST)
      .with(
        "organizationNotAllowedOnProducerKeychain",
        () => HTTP_STATUS_FORBIDDEN
      )
      .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
  }

  return baseMapperResult;
};

export const getClientKeyErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("clientNotFound", "clientKeyNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getClientKeyWithClientErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("clientNotFound", "clientKeyNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createProducerKeychainErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getProducerKeychainsErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteProducerKeychainErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("producerKeychainNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "organizationNotAllowedOnProducerKeychain",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getProducerKeychainUsersErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("producerKeychainNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "organizationNotAllowedOnProducerKeychain",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getProducerKeychainErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("producerKeychainNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addProducerKeychainUserErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "organizationNotAllowedOnProducerKeychain",
      "userWithoutSecurityPrivileges",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("producerKeychainNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("producerKeychainUserAlreadyAssigned", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const removeProducerKeychainUserErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "producerKeychainNotFound",
      "producerKeychainUserIdNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "organizationNotAllowedOnProducerKeychain",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteProducerKeychainKeyByIdErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "producerKeychainNotFound",
      "producerKeyNotFound",
      "userNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "organizationNotAllowedOnProducerKeychain",
      "userWithoutSecurityPrivileges",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getProducerKeychainKeysErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("producerKeychainNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "organizationNotAllowedOnProducerKeychain",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getProducerKeychainKeyErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "producerKeychainNotFound",
      "producerKeyNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "organizationNotAllowedOnProducerKeychain",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addPurposeKeychainEServiceErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "producerKeychainNotFound",
      "eserviceNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("eserviceAlreadyLinkedToProducerKeychain", () => HTTP_STATUS_CONFLICT)
    .with(
      "organizationNotAllowedOnProducerKeychain",
      "organizationNotAllowedOnEService",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const removeProducerKeychainEServiceErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("producerKeychainNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("eserviceNotFound", () => HTTP_STATUS_BAD_REQUEST)
    .with(
      "organizationNotAllowedOnProducerKeychain",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
