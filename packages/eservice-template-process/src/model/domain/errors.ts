import {
  ApiError,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  EServiceTemplateVersionState,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  eServiceTemplateNotFound: "0001",
  eServiceTemplateVersionNotFound: "0002",
  notValidEServiceTemplateVersionState: "0003",
  eServiceTemplateDuplicate: "0004",
  eserviceTemplateWithoutPublishedVersion: "0005",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function eServiceTemplateNotFound(
  eserviceTemplateId: EServiceTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService Template ${eserviceTemplateId} not found`,
    code: "eServiceTemplateNotFound",
    title: "EService Template not found",
  });
}

export function eServiceTemplateVersionNotFound(
  eserviceTemplateId: EServiceTemplateId,
  eserviceTemplateVersionId: EServiceTemplateVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService Template ${eserviceTemplateId} version ${eserviceTemplateVersionId} not found`,
    code: "eServiceTemplateVersionNotFound",
    title: "EService Template version not found",
  });
}

export function notValidEServiceTemplateVersionState(
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplateVersionState: EServiceTemplateVersionState
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService template version ${eserviceTemplateVersionId} has a not valid status for this operation ${eserviceTemplateVersionState}`,
    code: "notValidEServiceTemplateVersionState",
    title: "Not valid eservice template version state",
  });
}

export function eServiceTemplateDuplicate(
  eserviceTemplateName: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `An EService Template with name ${eserviceTemplateName} already exists`,
    code: "eServiceTemplateDuplicate",
    title: "Duplicated service name",
  });
}

export function eserviceTemplateWithoutPublishedVersion(
  eserviceTemplateId: EServiceTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService Template ${eserviceTemplateId} does not have a published version`,
    code: "eserviceTemplateWithoutPublishedVersion",
    title: "EService template without published version",
  });
}
