import { AuthData, userRoles } from "pagopa-interop-commons";
import {
  Client,
  ClientId,
  CorrelationId,
  Delegation,
  delegationKind,
  delegationState,
  EService,
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
  organizationNotAllowedOnEService,
  keyAlreadyExists,
} from "../model/domain/errors.js";
import { config } from "../config/config.js";
import { ReadModelService } from "./readModelService.js";

export const assertUserSelfcareSecurityPrivileges = async ({
  selfcareId,
  requesterUserId,
  consumerId,
  selfcareV2InstitutionClient,
  userIdToCheck,
  correlationId,
}: {
  selfcareId: string;
  requesterUserId: UserId;
  consumerId: TenantId;
  selfcareV2InstitutionClient: SelfcareV2InstitutionClient;
  userIdToCheck: UserId;
  correlationId: CorrelationId;
}): Promise<void> => {
  const users =
    await selfcareV2InstitutionClient.getInstitutionUsersByProductUsingGET({
      params: { institutionId: selfcareId },
      queries: {
        userId: userIdToCheck,
        productRoles: [userRoles.ADMIN_ROLE, userRoles.SECURITY_ROLE].join(","),
      },
      headers: {
        "X-Correlation-Id": correlationId,
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

export const assertRequesterIsDelegateConsumer = (
  authData: AuthData,
  purpose: Purpose,
  delegation: Delegation
): void => {
  if (
    delegation.delegateId !== authData.organizationId ||
    delegation.delegatorId !== purpose.consumerId ||
    delegation.eserviceId !== purpose.eserviceId ||
    delegation.kind !== delegationKind.delegatedConsumer ||
    delegation.state !== delegationState.active
  ) {
    throw organizationNotAllowedOnPurpose(
      authData.organizationId,
      purpose.id,
      delegation.id
    );
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

export const assertOrganizationIsEServiceProducer = (
  organizationId: TenantId,
  eservice: EService
): void => {
  if (organizationId !== eservice.producerId) {
    throw organizationNotAllowedOnEService(organizationId, eservice.id);
  }
};

export const assertKeyDoesNotAlreadyExist = async (
  kid: string,
  readModelService: ReadModelService
): Promise<void> => {
  const [clientKey, producerKey] = await Promise.all([
    readModelService.getClientKeyByKid(kid),
    readModelService.getProducerKeychainKeyByKid(kid),
  ]);

  if (clientKey || producerKey) {
    throw keyAlreadyExists(kid);
  }
};
