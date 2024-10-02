import {
  agreementApi,
  attributeRegistryApi,
  catalogApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import { Logger } from "pagopa-interop-commons";
import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  agreementNotFound: "0001",
  producerAndConsumerParamMissing: "0002",
  missingActivePurposeVersion: "0003",
  activeAgreementByEserviceAndConsumerNotFound: "0004",
  multipleAgreementForEserviceAndConsumer: "0005",
  missingAvailableDescriptor: "0006",
  unexpectedDescriptorState: "0007",
  attributeNotFoundInRegistry: "0008",
  eserviceDescriptorNotFound: "0009",
  keyNotFound: "0010",
  attributeAlreadyExists: "0011",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(
  errorCodes,
  false // API Gateway shall not let Problem errors from other services to pass through
);

export function producerAndConsumerParamMissing(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Either producerId or consumerId required",
    code: "producerAndConsumerParamMissing",
    title: "Producer and Consumer param missing",
  });
}

export function missingActivePurposeVersion(
  purposeId: purposeApi.Purpose["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `There is no active version for purpose ${purposeId}`,
    code: "missingActivePurposeVersion",
    title: "Missing active purpose version",
  });
}

export function activeAgreementByEserviceAndConsumerNotFound(
  eserviceId: agreementApi.Agreement["eserviceId"],
  consumerId: agreementApi.Agreement["consumerId"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Active Agreement not found for EService ${eserviceId} and Consumer ${consumerId}`,
    code: "activeAgreementByEserviceAndConsumerNotFound",
    title: "Active Agreement not found",
  });
}

export function multipleAgreementForEserviceAndConsumer(
  eserviceId: agreementApi.Agreement["eserviceId"],
  consumerId: agreementApi.Agreement["consumerId"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected multiple Active Agreements for EService ${eserviceId} and Consumer ${consumerId}`,
    code: "multipleAgreementForEserviceAndConsumer",
    title: "Multiple active Agreements found",
  });
}

export function missingAvailableDescriptor(
  eserviceId: catalogApi.EService["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No available descriptors for EService ${eserviceId}`,
    code: "missingAvailableDescriptor",
    title: "Missing available descriptor",
  });
}

export function unexpectedDescriptorState(
  state: catalogApi.EServiceDescriptorState,
  descriptorId: catalogApi.EServiceDescriptor["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected Descriptor state: ${state} - id: ${descriptorId}`,
    code: "unexpectedDescriptorState",
    title: "Unexpected descriptor state",
  });
}

export function attributeNotFoundInRegistry(
  attributeId: attributeRegistryApi.Attribute["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeId} not found in Attribute Registry`,
    code: "attributeNotFoundInRegistry",
    title: "Attribute not found in Attribute Registry",
  });
}

export function eserviceDescriptorNotFound(
  eserviceId: catalogApi.EService["id"],
  descriptorId: catalogApi.EServiceDescriptor["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found for EService ${eserviceId}`,
    code: "eserviceDescriptorNotFound",
    title: "Descriptor not found",
  });
}

export function keyNotFound(kId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Key with kId ${kId} not found`,
    code: "keyNotFound",
    title: "Key not found",
  });
}

export function agreementNotFound(
  agreementId: agreementApi.Agreement["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement ${agreementId} not found`,
    code: "agreementNotFound",
    title: "Agreement not found",
  });
}

export function invalidAgreementState(
  agreementId: agreementApi.Agreement["id"],
  logger: Logger
): ApiError<ErrorCodes> {
  const error = agreementNotFound(agreementId);
  logger.warn(
    `Root cause for Error "${error.title}": cannot retrieve agreement in DRAFT state`
  );
  return error;
}

export function attributeAlreadyExists(
  name: attributeRegistryApi.CertifiedAttributeSeed["name"],
  code: attributeRegistryApi.CertifiedAttributeSeed["code"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${name} with code ${code} already exists`,
    code: "attributeAlreadyExists",
    title: "Attribute already exists",
  });
}
