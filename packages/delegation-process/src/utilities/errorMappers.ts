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

export const getDelegationsErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getConsumerDelegatorsErrorMapper = getDelegationsErrorMapper;
export const getConsumerDelegatorsWithAgreementsErrorMapper =
  getConsumerDelegatorsErrorMapper;
export const getConsumerEservicesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("requesterIsNotConsumerDelegate", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getDelegationByIdErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("delegationNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createProducerDelegationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceNotFound",
      "tenantNotFound",
      "invalidDelegatorAndDelegateIds",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with(
      "originNotCompliant",
      "tenantNotAllowedToDelegation",
      "differentEserviceProducer",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("delegationAlreadyExists", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createConsumerDelegationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceNotFound",
      "tenantNotFound",
      "invalidDelegatorAndDelegateIds",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with(
      "originNotCompliant",
      "tenantNotAllowedToDelegation",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("delegationAlreadyExists", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const revokeDelegationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("delegationNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationRestrictedToDelegator", () => HTTP_STATUS_FORBIDDEN)
    .with("incorrectState", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const approveDelegationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("delegationNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationRestrictedToDelegate", () => HTTP_STATUS_FORBIDDEN)
    .with("incorrectState", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const rejectDelegationErrorMapper = approveDelegationErrorMapper;

export const getDelegationContractErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "delegationNotFound",
      "delegationContractNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
