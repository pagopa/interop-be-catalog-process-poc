import { constants } from "http2";
import {
  ApiError,
  parseErrorMessage,
  makeApiProblemBuilder,
  AttributeId,
} from "pagopa-interop-models";

export const errorCodes = {
  purposeNotFound: "0001",
  userNotFound: "0002",
  selfcareEntityNotFilled: "0003",
  descriptorNotFound: "0004",
  attributeNotExists: "0005",
  invalidEserviceRequester: "0006",
  missingClaim: "0007",
  tenantLoginNotAllowed: "0008",
  tokenVerificationFailed: "0009",
  eServiceNotFound: "0010",
  tenantNotFound: "0011",
  agreementNotFound: "0012",
  eserviceDescriptorNotFound: "0013",
  purposeDraftVersionNotFound: "0014",
  dynamoReadingError: "0015",
  missingInterface: "0016",
  eserviceRiskNotFound: "0017",
  noDescriptorInEservice: "0018",
  missingDescriptorInClonedEservice: "0019",
  invalidInterfaceContentTypeDetected: "0020",
  invalidInterfaceFileDetected: "0021",
  openapiVersionNotRecognized: "0022",
  interfaceExtractingInfoError: "0023",
  agreementDescriptorNotFound: "0024",
  unknownTenantOrigin: "0025",
  invalidJwtClaim: "0026",
  samlNotValid: "0027",
  missingSelfcareId: "0028",
  invalidZipStructure: "0029",
  contractNotFound: "0030",
  contractException: "0031",
  notValidDescriptor: "0032",
  privacyNoticeNotFoundInConfiguration: "0033",
  privacyNoticeNotFound: "0034",
  privacyNoticeVersionIsNotTheLatest: "0035",
  missingActivePurposeVersion: "0036",
  activeAgreementByEserviceAndConsumerNotFound: "0037",
  purposeIdNotFoundInClientAssertion: "0038",
  delegationNotFound: "0039",
  organizationNotAllowed: "0040",
  cannotGetKeyWithClient: "0041",
  clientAssertionPublicKeyNotFound: "0042",
  eserviceDelegated: "0043",
  delegatedEserviceNotExportable: "0044",
  noVersionInEServiceTemplate: "0045",
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

export function samlNotValid(message: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Error while validating saml -> ${message}`,
    code: "samlNotValid",
    title: "SAML not valid",
  });
}

export function missingSelfcareId(tenantId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `SelfcareId in Tenant ${tenantId} not found`,
    code: "missingSelfcareId",
    title: "SelfcareId not found",
  });
}

export function eserviceRiskNotFound(
  eserviceId: string,
  riskAnalysisId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `RiskAnalysis ${riskAnalysisId} not found in Eservice ${eserviceId}`,
    code: "eserviceRiskNotFound",
    title: "Risk analysis not found",
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

export function notValidDescriptor(
  descriptorId: string,
  state: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} has a not valid status for this operation ${state}`,
    code: "notValidDescriptor",
    title: "Not valid descriptor",
  });
}

export function contractNotFound(agreementId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Contract not found for agreement ${agreementId}`,
    code: "contractNotFound",
    title: "Contract not found",
  });
}

export function contractException(agreementId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Contract exception for agreement ${agreementId}`,
    code: "contractException",
    title: "Contract exception",
  });
}

export function invalidZipStructure(description: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid zip structure: ${description}`,
    code: "invalidZipStructure",
    title: "Invalid zip structure",
  });
}

export function missingActivePurposeVersion(
  purposeId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `There is no active version for purpose ${purposeId}`,
    code: "missingActivePurposeVersion",
    title: "Missing active purpose version",
  });
}

export function activeAgreementByEserviceAndConsumerNotFound(
  eserviceId: string,
  consumerId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Active agreement for Eservice ${eserviceId} and consumer ${consumerId} not found`,
    code: "activeAgreementByEserviceAndConsumerNotFound",
    title: "Active agreement not found",
  });
}

export function purposeIdNotFoundInClientAssertion(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `PurposeId not found in client assertion`,
    code: "purposeIdNotFoundInClientAssertion",
    title: "PurposeId not found in client assertion",
  });
}

export function clientAssertionPublicKeyNotFound(
  kid: string,
  clientId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Public key with kid ${kid} not found for client ${clientId}`,
    code: "clientAssertionPublicKeyNotFound",
    title: "Client assertion public key not found",
  });
}

export function organizationNotAllowed(clientId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization not allowed for client ${clientId}`,
    code: "organizationNotAllowed",
    title: "Organization not allowed",
  });
}

export function cannotGetKeyWithClient(
  clientId: string,
  keyId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Cannot get key with client ${clientId} and key ${keyId}`,
    code: "cannotGetKeyWithClient",
    title: "Cannot get key with client",
  });
}

export function delegationNotFound(delegationId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${delegationId} not found`,
    code: "delegationNotFound",
    title: "Delegation not found",
  });
}

export function delegatedEserviceNotExportable(
  delegatorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Impossibile to export Eservice with a valid delegation for producer ${delegatorId}`,
    code: "delegatedEserviceNotExportable",
    title: "Delegated Eservice is not exportable",
  });
}

export function noVersionInEServiceTemplate(
  eserviceTemplateId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No version found in Eservice Template ${eserviceTemplateId}`,
    code: "noVersionInEServiceTemplate",
    title: "No version found in Eservice Template",
  });
}
