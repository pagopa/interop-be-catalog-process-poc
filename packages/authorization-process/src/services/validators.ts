import { JsonWebKey } from "crypto";
import { userRoles } from "pagopa-interop-commons";
import {
  Client,
  ClientId,
  CorrelationId,
  EService,
  invalidKeyLength,
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
    await selfcareV2InstitutionClient.getInstitutionProductUsersUsingGET({
      params: { institutionId: selfcareId },
      queries: {
        userIdForAuth: requesterUserId,
        userId: userIdToCheck,
        productRoles: [userRoles.SECURITY_ROLE, userRoles.ADMIN_ROLE],
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

export function assertValidateRsaKeyLength(
  jwk: JsonWebKey,
  minLength: number = 2048
): void {
  const keyLength = jwk.n && Buffer.from(jwk.n, "base64url").length * 8;
  if (!keyLength || (keyLength && keyLength < minLength)) {
    throw invalidKeyLength(JSON.stringify(jwk));
  }
}
