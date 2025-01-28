import { AuthData } from "pagopa-interop-commons";
import { operationForbidden, TenantId } from "pagopa-interop-models";

export function assertRequesterEServiceTemplateCreator(
  creatorId: TenantId,
  authData: AuthData
): void {
  if (authData.organizationId !== creatorId) {
    throw operationForbidden;
  }
}
