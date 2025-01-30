import { AuthData } from "pagopa-interop-commons";
import {
  EServiceTemplate,
  eserviceTemplateVersionState,
  operationForbidden,
  TenantId,
} from "pagopa-interop-models";
import { draftEServiceTemplateVersionAlreadyExists } from "../model/domain/errors.js";

export function assertRequesterEServiceTemplateCreator(
  creatorId: TenantId,
  authData: AuthData
): void {
  if (authData.organizationId !== creatorId) {
    throw operationForbidden;
  }
}

export function assertNoDraftEServiceTemplateVersions(
  eserviceTemplate: EServiceTemplate
): void {
  if (
    eserviceTemplate.versions.some(
      (v) => v.state === eserviceTemplateVersionState.draft
    )
  ) {
    throw draftEServiceTemplateVersionAlreadyExists(eserviceTemplate.id);
  }
}
