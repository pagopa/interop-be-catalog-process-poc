import { userRoles } from "pagopa-interop-commons";
import {
  Client,
  ClientId,
  ProducerKeychain,
  ProducerKeychainId,
  Purpose,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { SelfcareV2InstitutionClient } from "pagopa-interop-api-clients";
import {
  userWithoutSecurityPrivileges,
  organizationNotAllowedOnPurpose,
  organizationNotAllowedOnClient,
  organizationNotAllowedOnProducerKeychain,
  tooManyKeysPerClient,
  tooManyKeysPerProducerKeychain,
} from "../model/domain/errors.js";
import { config } from "../config/config.js";

export const assertUserSelfcareSecurityPrivileges = async ({
  selfcareId,
  requesterUserId,
  consumerId,
  selfcareV2InstitutionClient,
  userIdToCheck,
}: {
  selfcareId: string;
  requesterUserId: UserId;
  consumerId: TenantId;
  selfcareV2InstitutionClient: SelfcareV2InstitutionClient;
  userIdToCheck: UserId;
}): Promise<void> => {
  const users =
    await selfcareV2InstitutionClient.getInstitutionProductUsersUsingGET({
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

export const assertOrganizationIsProducerKeychainProducer = (
  organizationId: TenantId,
  producerKeychain: ProducerKeychain
): void => {
  if (producerKeychain.producerId !== organizationId) {
    throw organizationNotAllowedOnProducerKeychain(
      organizationId,
      producerKeychain.id
    );
  }
};

export const assertClientKeysCountIsBelowThreshold = (
  clientId: ClientId,
  size: number
): void => {
  if (size > config.maxKeysPerClient) {
    throw tooManyKeysPerClient(clientId, size);
  }
};

export const assertProducerKeychainKeysCountIsBelowThreshold = (
  producerKeychainId: ProducerKeychainId,
  size: number
): void => {
  if (size > config.maxKeysPerProducerKeychain) {
    throw tooManyKeysPerProducerKeychain(producerKeychainId, size);
  }
};
