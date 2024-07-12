import { userRoles } from "pagopa-interop-commons";
import { Client, Purpose, TenantId, UserId } from "pagopa-interop-models";
import { SelfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import {
  userWithoutSecurityPrivileges,
  organizationNotAllowedOnPurpose,
  organizationNotAllowedOnClient,
} from "../model/domain/errors.js";

export const assertUserSelfcareSecurityPrivileges = async ({
  selfcareId,
  requesterUserId,
  consumerId,
  selfcareV2Client,
  userIdToCheck,
}: {
  selfcareId: string;
  requesterUserId: UserId;
  consumerId: TenantId;
  selfcareV2Client: SelfcareV2Client;
  userIdToCheck: UserId;
}): Promise<void> => {
  const users = await selfcareV2Client.getInstitutionProductUsersUsingGET({
    params: { institutionId: selfcareId },
    queries: {
      userIdForAuth: requesterUserId,
      userId: userIdToCheck,
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

export const assertOrganizationIsPurposeConsumer = (
  organizationId: TenantId,
  purpose: Purpose
): void => {
  if (organizationId !== purpose.consumerId) {
    throw organizationNotAllowedOnPurpose(organizationId, purpose.id);
  }
};
