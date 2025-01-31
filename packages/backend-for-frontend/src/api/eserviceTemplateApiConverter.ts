import { bffApi, eserviceTemplateApi } from "pagopa-interop-api-clients";
import { genericError } from "pagopa-interop-models";

export const toBffCreatedEServiceTemplateVersion = (
  eserviceTemplate: eserviceTemplateApi.EServiceTemplate
): bffApi.CreatedEServiceTemplateVersion => {
  const version = eserviceTemplate.versions.at(0);
  if (version === undefined) {
    throw genericError("No version found for the created EServiceTemplate");
  }
  return {
    id: eserviceTemplate.id,
    versionId: version.id,
  };
};
