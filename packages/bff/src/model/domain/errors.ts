import { constants } from "node:http2";
import {
  ApiError,
  AttributeId,
  parseErrorMessage,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  purposeNotFound: "0001",
  userNotFound: "0002",
  selfcareEntityNotFilled: "0003",
  privacyNoticeNotFoundInConfiguration: "0004",
  privacyNoticeNotFound: "0005",
  privacyNoticeVersionIsNotTheLatest: "0006",
  dynamoReadingError: "0007",
  descriptorNotFound: "0008",
  attributeNotExists: "0009",
  invalidEserviceRequester: "0010",
  missingClaim: "0011",
  tenantLoginNotAllowed: "0012",
  tokenVerificationFailed: "0013",
  eServiceNotFound: "0014",
  tenantNotFound: "0015",
  agreementNotFound: "0016",
  eserviceDescriptorNotFound: "0017",
  purposeDraftVersionNotFound: "0018",
  invalidRiskAnalysisContentType: "0019",
  missingInterface: "0020",
  eserviceRiskNotFound: "0021",
  invalidInterfaceContentTypeDetected: "0022",
  invalidInterfaceFileDetected: "0023",
  openapiVersionNotRecognized: "0024",
  interfaceExtractingInfoError: "0025",
  agreementDescriptorNotFound: "0026",
  noDescriptorInEservice: "0027",
  missingDescriptorInClonedEservice: "0028",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export const emptyErrorMapper = (): number =>
  constants.HTTP_STATUS_INTERNAL_SERVER_ERROR;

export function selfcareEntityNotFilled(
  className: string,
  field: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Selfcare entity ${className} with field ${field} not filled`,
    code: "selfcareEntityNotFilled",
    title: "Selfcare Entity not filled",
  });
}

export function userNotFound(
  userId: string,
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} not found for institution ${selfcareId}`,
    code: "userNotFound",
    title: "User not found",
  });
}

export function purposeNotFound(purposeId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
    title: "Purpose not found",
  });
}

export function dynamoReadingError(error: unknown): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Error while reading data from Dynamo -> ${parseErrorMessage(
      error
    )}`,
    code: "dynamoReadingError",
    title: "Dynamo reading error",
  });
}

export function privacyNoticeNotFoundInConfiguration(
  privacyNoticeKind: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Privacy Notice ${privacyNoticeKind} not found in configuration`,
    code: "privacyNoticeNotFoundInConfiguration",
    title: "Privacy Notice not found in configuration",
  });
}

export function privacyNoticeNotFound(
  privacyNoticeKind: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Privacy Notice ${privacyNoticeKind} not found`,
    code: "privacyNoticeNotFound",
    title: "Privacy Notice not found",
  });
}

export function privacyNoticeVersionIsNotTheLatest(
  versionId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `PrivacyNotice version ${versionId} not found`,
    code: "privacyNoticeVersionIsNotTheLatest",
    title: "Privacy Notice version is not the latest",
  });
}

export function agreementDescriptorNotFound(
  agreementId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor of agreement ${agreementId} not found`,
    code: "agreementDescriptorNotFound",
    title: "Agreement descriptor not found",
  });
}

export function eServiceNotFound(eserviceId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
    title: "EService not found",
  });
}

export function tenantNotFound(tenantId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
    title: "Tenant not found",
  });
}

export function agreementNotFound(consumerId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement of consumer ${consumerId} not found`,
    code: "agreementNotFound",
    title: "Agreement not found",
  });
}

export function eserviceDescriptorNotFound(
  eserviceId: string,
  descriptorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found in Eservice ${eserviceId}`,
    code: "eserviceDescriptorNotFound",
    title: "EService descriptor not found",
  });
}

export function purposeDraftVersionNotFound(
  purposeId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Version in DRAFT state for Purpose ${purposeId} not found`,
    code: "purposeDraftVersionNotFound",
    title: "Purpose draft version not found",
  });
}

export function invalidEServiceRequester(
  eserviceId: string,
  requesterId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} does not belong to producer ${requesterId}`,
    code: "invalidEserviceRequester",
    title: `Invalid eservice requester`,
  });
}

export function attributeNotExists(id: AttributeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${id} does not exist in the attribute registry`,
    code: "attributeNotExists",
    title: "Attribute not exists",
  });
}

export function missingClaim(claimName: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Claim ${claimName} has not been passed`,
    code: "missingClaim",
    title: "Claim not found",
  });
}

export function tenantLoginNotAllowed(
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant origin is not allowed and SelfcareID ${selfcareId} does not belong to allow list`,
    code: "tenantLoginNotAllowed",
    title: "Tenant login not allowed",
  });
}

export function tokenVerificationFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Token verification failed",
    code: "tokenVerificationFailed",
    title: "Token verification failed",
  });
}

export function invalidRiskAnalysisContentType(
  contentType: string,
  purposeId: string,
  versionId: string,
  documentId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid contentType ${contentType} for document ${documentId} from purpose ${purposeId} and version ${versionId}`,
    code: "invalidRiskAnalysisContentType",
    title: "Invalid Risk Analysis content type",
  });
}

export function missingInterface(
  eserviceId: string,
  descriptorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Missing interface for Eservice ${eserviceId} and descriptor ${descriptorId}`,
    code: "missingInterface",
    title: "Missing interface",
  });
}

export function eserviceRiskNotFound(
  eserviceId: string,
  riskAnalysisId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `"RiskAnalysis ${riskAnalysisId} not found in Eservice ${eserviceId}"`,
    code: "eserviceRiskNotFound",
    title: "Risk analysis not found",
  });
}

export function noDescriptorInEservice(
  eserviceId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No descriptor found in Eservice ${eserviceId}`,
    code: "noDescriptorInEservice",
    title: "No descriptor found in Eservice",
  });
}

export function missingDescriptorInClonedEservice(
  eserviceId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Missing descriptor in cloned eService ${eserviceId}`,
    code: "missingDescriptorInClonedEservice",
    title: "Missing descriptor in cloned eService",
  });
}

export function invalidInterfaceContentTypeDetected(
  eServiceId: string,
  contentType: string,
  technology: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `The interface file for EService ${eServiceId} has a contentType ${contentType} not admitted for ${technology} technology`,
    code: "invalidInterfaceContentTypeDetected",
    title: "Invalid content type detected",
  });
}

export function invalidInterfaceFileDetected(
  eServiceId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `The interface file for EService ${eServiceId} is invalid`,
    code: "invalidInterfaceFileDetected",
    title: "Invalid interface file detected",
  });
}

export function openapiVersionNotRecognized(
  version: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `OpenAPI version not recognized - ${version}`,
    code: "openapiVersionNotRecognized",
    title: "OpenAPI version not recognized",
  });
}

export function interfaceExtractingInfoError(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Error extracting info from interface file`,
    code: "interfaceExtractingInfoError",
    title: "Error extracting info from interface file",
  });
}
