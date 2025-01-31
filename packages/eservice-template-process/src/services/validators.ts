import { AuthData } from "pagopa-interop-commons";
import {
  EServiceTemplate,
  TenantId,
  eserviceTemplateVersionState,
  operationForbidden,
} from "pagopa-interop-models";
import { eserviceTemplateNotInDraftState } from "../model/domain/errors.js";

export function assertRequesterEServiceTemplateCreator(
  creatorId: TenantId,
  authData: AuthData
): void {
  if (authData.organizationId !== creatorId) {
    throw operationForbidden;
  }
}

export function assertIsDraftEserviceTemplate(
  eserviceTemplate: EServiceTemplate
): void {
  if (
    eserviceTemplate.versions.some(
      (v) => v.state !== eserviceTemplateVersionState.draft
    )
  ) {
    throw eserviceTemplateNotInDraftState(eserviceTemplate.id);
  }
}
