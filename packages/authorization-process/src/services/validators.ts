import { userRoles } from "pagopa-interop-commons";
import { TenantId, UserId, Client } from "pagopa-interop-models";
import { SelfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import { userWithoutSecurityPrivileges } from "../model/domain/errors.js";
import { organizationNotAllowedOnClient } from "../model/domain/errors.js";

export const assertUserSelfcareSecurityPrivileges = async (
  selfcareId: string,
  requesterUserId: UserId,
  consumerId: TenantId,
  selfcareV2Client: SelfcareV2Client,
  userId: UserId
): Promise<void> => {
  const users = await selfcareV2Client.getInstitutionProductUsersUsingGET({
    params: { institutionId: selfcareId },
    queries: {
      userIdForAuth: requesterUserId,
      userId,
      productRoles: [userRoles.SECURITY_ROLE, userRoles.ADMIN_ROLE],
    },
  });
  if (users.length === 0) {
    throw userWithoutSecurityPrivileges(consumerId, requesterUserId);
  }
};

export const assertOrganizationIsClientConsumer = (
  organizationId: TenantId,
  client: Client
): void => {
  if (client.consumerId !== organizationId) {
    throw organizationNotAllowedOnClient(organizationId, client.id);
  }
};
