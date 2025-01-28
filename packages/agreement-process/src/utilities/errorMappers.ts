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

export const createAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "notLatestEServiceDescriptor",
      "descriptorNotInExpectedState",
      "missingCertifiedAttributesError",
      "eServiceNotFound",
      "delegationNotFound",
      "tenantNotFound",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("organizationIsNotTheDelegateConsumer", () => HTTP_STATUS_FORBIDDEN)
    .with("agreementAlreadyExists", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("agreementNotInExpectedState", () => HTTP_STATUS_BAD_REQUEST)
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegateConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("agreementNotInExpectedState", () => HTTP_STATUS_BAD_REQUEST)
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegateConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const submitAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "notLatestEServiceDescriptor",
      "agreementNotInExpectedState",
      "consumerWithNotValidEmail",
      "agreementSubmissionFailed",
      "missingCertifiedAttributesError",
      "descriptorNotInExpectedState",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("agreementNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegateConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with(
      "agreementAlreadyExists",
      "contractAlreadyExists",
      () => HTTP_STATUS_CONFLICT
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addConsumerDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegateConsumer",
      "organizationNotAllowed",
      "documentsChangeNotAllowed",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("agreementDocumentAlreadyExists", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const upgradeAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "agreementNotInExpectedState",
      "publishedDescriptorNotFound",
      "noNewerDescriptor",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegateConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const cloneAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "agreementNotInExpectedState",
      "missingCertifiedAttributesError",
      "eServiceNotFound",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("agreementAlreadyExists", () => HTTP_STATUS_CONFLICT)
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegateConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getConsumerDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("organizationNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with("documentNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const suspendAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with("agreementNotInExpectedState", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const removeConsumerDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("documentNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegateConsumer",
      "documentsChangeNotAllowed",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const rejectAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("agreementNotInExpectedState", () => HTTP_STATUS_BAD_REQUEST)
    .with(
      "organizationIsNotTheProducer",
      "organizationIsNotTheDelegateProducer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const activateAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "notLatestEServiceDescriptor",
      "agreementNotInExpectedState",
      "agreementActivationFailed",
      "descriptorNotInExpectedState",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("agreementNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "organizationIsNotTheDelegateProducer",
      "organizationIsNotTheProducer",
      "organizationNotAllowed",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("agreementAlreadyExists", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const archiveAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("agreementNotInExpectedState", () => HTTP_STATUS_BAD_REQUEST)
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegateConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getAgreementErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("agreementNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const computeAgreementsStateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("badRequestError", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const verifyTenantCertifiedAttributesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "eServiceNotFound",
      "descriptorNotFound",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with(
      "organizationIsNotTheConsumer",
      "organizationIsNotTheDelegateConsumer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
