import {
  AgreementDocumentId,
  AgreementId,
  AgreementState,
  ApiError,
  DescriptorId,
  DescriptorState,
  EServiceId,
  TenantId,
  makeApiProblemBuilder,
  AttributeId,
  Agreement,
  DelegationId,
} from "pagopa-interop-models";

export const errorCodes = {
  missingCertifiedAttributesError: "0001",
  agreementSubmissionFailed: "0002",
  agreementNotInExpectedState: "0003",
  descriptorNotInExpectedState: "0004",
  eServiceNotFound: "0005",
  contractAlreadyExists: "0006",
  organizationNotAllowed: "0007",
  agreementActivationFailed: "0008",
  agreementNotFound: "0009",
  agreementAlreadyExists: "0010",
  noNewerDescriptor: "0011",
  publishedDescriptorNotFound: "0012",
  unexpectedVersionFormat: "0013",
  descriptorNotFound: "0014",
  stampNotFound: "0015",
  documentNotFound: "0017",
  documentsChangeNotAllowed: "0018",
  tenantNotFound: "0020",
  notLatestEServiceDescriptor: "0021",
  attributeNotFound: "0022",
  invalidAttributeStructure: "0023",
  consumerWithNotValidEmail: "0024",
  agreementDocumentAlreadyExists: "0025",
  delegationNotFound: "0026",
  organizationIsNotTheConsumer: "0027",
  organizationIsNotTheDelegateConsumer: "0028",
  organizationIsNotTheProducer: "0029",
  organizationIsNotTheDelegateProducer: "0030",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function eServiceNotFound(eserviceId: EServiceId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
    title: "EService not found",
  });
}

export function agreementNotFound(
  agreementId: AgreementId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement ${agreementId} not found`,
    code: "agreementNotFound",
    title: "Agreement not found",
  });
}

export function notLatestEServiceDescriptor(
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor with descriptorId: ${descriptorId} is not the latest descriptor`,
    code: "notLatestEServiceDescriptor",
    title: "Descriptor provided is not the latest descriptor",
  });
}

export function descriptorNotFound(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found in EService ${eserviceId}`,
    code: "descriptorNotFound",
    title: "Descriptor not found",
  });
}

export function descriptorNotInExpectedState(
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  allowedStates: DescriptorState[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} of EService ${eserviceId} has not status in ${allowedStates.join(
      ","
    )}`,
    code: "descriptorNotInExpectedState",
    title: "Descriptor not in expected state",
  });
}

export function missingCertifiedAttributesError(
  descriptorId: DescriptorId,
  consumerId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Required certified attribute is missing. Descriptor ${descriptorId}, Consumer: ${consumerId}`,
    code: "missingCertifiedAttributesError",
    title: `Required certified attribute is missing`,
  });
}

export function agreementAlreadyExists(
  consumerId: TenantId,
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement already exists for Consumer = ${consumerId}, EService = ${eserviceId}`,
    code: "agreementAlreadyExists",
    title: "Agreement already exists",
  });
}

export function organizationNotAllowed(
  organizationId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed to perform the operation`,
    code: "organizationNotAllowed",
    title: "Operation not allowed",
  });
}

export function documentsChangeNotAllowed(
  state: AgreementState
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `The requested operation on consumer documents is not allowed on agreement with state ${state}`,
    code: "documentsChangeNotAllowed",
    title: "Operation not allowed on consumer documents",
  });
}

export function agreementDocumentAlreadyExists(
  agreementId: AgreementId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement document for ${agreementId} already exists`,
    code: "agreementDocumentAlreadyExists",
    title: "Agreement document already exists",
  });
}

export function agreementDocumentNotFound(
  documentId: AgreementDocumentId,
  agreementId: AgreementId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Document ${documentId} in agreement ${agreementId} not found`,
    code: "documentNotFound",
    title: "Document not found",
  });
}

export function agreementNotInExpectedState(
  agreementId: AgreementId,
  state: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement ${agreementId} not in expected state (current state: ${state})`,
    code: "agreementNotInExpectedState",
    title: "Agreement not in expected state",
  });
}

export function tenantNotFound(tenantId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
    title: "Tenant not found",
  });
}

export function agreementSubmissionFailed(
  agreementId: AgreementId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unable to activate agreement ${agreementId}. Please check if attributes requirements and suspension flags are satisfied`,
    code: "agreementSubmissionFailed",
    title: "Unable to activate agreement",
  });
}

export function contractAlreadyExists(
  agreementId: AgreementId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement document for ${agreementId} already exists`,
    code: "contractAlreadyExists",
    title: "Contract already exists",
  });
}

export function agreementActivationFailed(
  agreementId: AgreementId
): ApiError<ErrorCodes> {
  return new ApiError({
    code: "agreementActivationFailed",
    title: "Unable to activate agreement",
    detail: `Unable to activate agreement ${agreementId}. Please check if attributes requirements and suspension flags are satisfied`,
  });
}

export function consumerWithNotValidEmail(
  agreementId: AgreementId,
  tenantId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement ${agreementId} has a consumer tenant ${tenantId} with no valid email`,
    code: "consumerWithNotValidEmail",
    title: "Agreement with invalid consumer email",
  });
}

export function agreementStampNotFound(
  stamp: keyof Agreement["stamps"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement ${stamp} stamp not found`,
    code: "stampNotFound",
    title: "Stamp not found",
  });
}

export function publishedDescriptorNotFound(
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Published descriptor not found in EService ${eserviceId}`,
    code: "publishedDescriptorNotFound",
    title: "Published descriptor not found",
  });
}

export function unexpectedVersionFormat(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Version in not an Int for descriptor ${descriptorId} of EService ${eserviceId}`,
    code: "unexpectedVersionFormat",
    title: "Unexpected version format",
  });
}

export function noNewerDescriptor(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No newer descriptor in EService ${eserviceId} exists for upgrade. Current descriptor ${descriptorId}`,
    code: "noNewerDescriptor",
    title: "Agreement cannot be upgraded",
  });
}

export function documentChangeNotAllowed(
  state: AgreementState
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `The requested operation on consumer documents is not allowed on agreement with state ${state}`,
    code: "documentsChangeNotAllowed",
    title: "Document change not allowed",
  });
}

export function attributeNotFound(
  attributeId: AttributeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeId} not found`,
    code: "attributeNotFound",
    title: "Attribute not found",
  });
}

export function delegationNotFound(
  delegationId: DelegationId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${delegationId} not found`,
    code: "delegationNotFound",
    title: "Delegation not found",
  });
}

export function organizationIsNotTheConsumer(
  organizationId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed to perform the operation because is not the consumer`,
    code: "organizationIsNotTheConsumer",
    title: "Organization not allowed",
  });
}

export function organizationIsNotTheDelegateConsumer(
  organizationId: TenantId,
  delegationId: DelegationId | undefined
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed to perform the operation because is not the delegate consumer${
      delegationId ? ` of delegation ${delegationId}` : ""
    }`,
    code: "organizationIsNotTheDelegateConsumer",
    title: "Organization not allowed",
  });
}

export function organizationIsNotTheProducer(
  organizationId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed to perform the operation because is not the producer`,
    code: "organizationIsNotTheProducer",
    title: "Organization not allowed",
  });
}

export function organizationIsNotTheDelegateProducer(
  organizationId: TenantId,
  delegationId: DelegationId | undefined
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed to perform the operation because is not the delegate producer${
      delegationId ? ` of delegation ${delegationId}` : ""
    }`,
    code: "organizationIsNotTheDelegateProducer",
    title: "Organization not allowed",
  });
}
