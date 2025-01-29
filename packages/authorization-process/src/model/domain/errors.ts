import {
  ApiError,
  ClientId,
  DelegationId,
  DescriptorId,
  EService,
  EServiceId,
  ProducerKeychainId,
  PurposeId,
  TenantId,
  UserId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  clientNotFound: "0001",
  organizationNotAllowedOnClient: "0002",
  clientUserIdNotFound: "0003",
  clientKeyNotFound: "0004",
  userNotAllowedOnClient: "0005",
  purposeNotFound: "0006",
  userWithoutSecurityPrivileges: "0007",
  clientUserAlreadyAssigned: "0008",
  eserviceNotFound: "0009",
  noPurposeVersionsFoundInRequiredState: "0010",
  descriptorNotFound: "0011",
  noAgreementFoundInRequiredState: "0012",
  purposeAlreadyLinkedToClient: "0013",
  organizationNotAllowedOnPurpose: "0014",
  tooManyKeysPerClient: "0015",
  userNotFound: "0016",
  keyAlreadyExists: "0017",
  producerKeychainNotFound: "0018",
  organizationNotAllowedOnProducerKeychain: "0019",
  producerKeychainUserAlreadyAssigned: "0020",
  producerKeychainUserIdNotFound: "0021",
  tooManyKeysPerProducerKeychain: "0022",
  userNotAllowedOnProducerKeychain: "0023",
  producerKeyNotFound: "0024",
  organizationNotAllowedOnEService: "0025",
  eserviceAlreadyLinkedToProducerKeychain: "0026",
  userNotAllowedToDeleteClientKey: "0027",
  userNotAllowedToDeleteProducerKeychainKey: "0028",
  purposeDelegationNotFound: "0029",
  eserviceNotDelegableForClientAccess: "0030",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function clientNotFound(clientId: ClientId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client ${clientId} not found`,
    code: "clientNotFound",
    title: "Client not found",
  });
}

export function organizationNotAllowedOnClient(
  organizationId: TenantId,
  clientId: ClientId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed on client ${clientId}`,
    code: "organizationNotAllowedOnClient",
    title: "Organization not allowed on client",
  });
}

export function clientUserIdNotFound(
  userId: UserId,
  clientId: ClientId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} not found in client ${clientId}`,
    code: "clientUserIdNotFound",
    title: "User id not found in client",
  });
}

export function clientKeyNotFound(
  keyId: string,
  clientId: ClientId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Key ${keyId} not found in client ${clientId}`,
    code: "clientKeyNotFound",
    title: "Key not found",
  });
}

export function userNotAllowedOnClient(
  userId: UserId,
  clientId: ClientId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} is not allowed on client ${clientId}`,
    code: "userNotAllowedOnClient",
    title: "User not allowed on client",
  });
}

export function purposeNotFound(purposeId: PurposeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
    title: "Purpose not found",
  });
}

export function userWithoutSecurityPrivileges(
  consumerId: TenantId,
  requesterUserId: UserId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${requesterUserId} does not have security privileges for consumer ${consumerId}`,
    code: "userWithoutSecurityPrivileges",
    title: "User without security privileges",
  });
}

export function clientUserAlreadyAssigned(
  clientId: ClientId,
  userId: UserId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} is already assigned to the client ${clientId}`,
    code: "clientUserAlreadyAssigned",
    title: "User already assigned to the client",
  });
}

export function eserviceNotFound(eserviceId: EServiceId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eserviceNotFound",
    title: "EService not found",
  });
}

export function noPurposeVersionsFoundInRequiredState(
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No versions in required state found in purpose ${purposeId}`,
    code: "noPurposeVersionsFoundInRequiredState",
    title: "No purpose versions found in required state",
  });
}

export function descriptorNotFound(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found in EService ${eserviceId}`,
    code: "descriptorNotFound",
    title: "Descriptor not found",
  });
}

export function noAgreementFoundInRequiredState(
  eserviceId: EServiceId,
  consumerId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No agreement in required state found for eservice ${eserviceId} and consumer ${consumerId}`,
    code: "noAgreementFoundInRequiredState",
    title: "No Agreement found in required state",
  });
}

export function purposeAlreadyLinkedToClient(
  purposeId: PurposeId,
  clientId: ClientId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} is already linked to client ${clientId}`,
    code: "purposeAlreadyLinkedToClient",
    title: "Purpose already linked to client",
  });
}

export function organizationNotAllowedOnPurpose(
  organizationId: TenantId,
  purposeId: PurposeId,
  delegationId?: DelegationId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed on purpose ${purposeId} ${
      delegationId
        ? `as delegate for delegation ${delegationId}`
        : `as consumer`
    }`,
    code: "organizationNotAllowedOnPurpose",
    title: "Organization not allowed on purpose",
  });
}

export function tooManyKeysPerClient(
  clientId: ClientId,
  size: number
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Keys count (${size}) for the client ${clientId} exceed maximum allowed value`,
    code: "tooManyKeysPerClient",
    title: "Too many Keys per client",
  });
}

export function tooManyKeysPerProducerKeychain(
  producerKeychainId: ProducerKeychainId,
  size: number
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Keys count (${size}) for the producer keychain ${producerKeychainId} exceeds maximum allowed value`,
    code: "tooManyKeysPerProducerKeychain",
    title: "Too many Keys per producer keychain",
  });
}

export function userNotFound(
  userId: UserId,
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} not found for selfcare institution ${selfcareId}`,
    code: "userNotFound",
    title: "User not found",
  });
}

export function keyAlreadyExists(kid: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Key with kid ${kid} already exists `,
    code: "keyAlreadyExists",
    title: "Key already exists",
  });
}

export function producerKeychainNotFound(
  producerKeychainId: ProducerKeychainId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Producer Keychain ${producerKeychainId} not found`,
    code: "producerKeychainNotFound",
    title: "Producer Keychain not found",
  });
}

export function organizationNotAllowedOnProducerKeychain(
  organizationId: TenantId,
  producerKeychainId: ProducerKeychainId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed on producer keychain ${producerKeychainId}`,
    code: "organizationNotAllowedOnProducerKeychain",
    title: "Organization not allowed on producer keychain",
  });
}

export function userNotAllowedOnProducerKeychain(
  userId: UserId,
  producerKeychain: ProducerKeychainId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} is not allowed on producer keychain ${producerKeychain}`,
    code: "userNotAllowedOnProducerKeychain",
    title: "User not allowed on producer keychain",
  });
}

export function userNotAllowedToDeleteClientKey(
  userId: UserId,
  client: ClientId,
  kid: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} is not allowed to delete client (${client}) key ${kid}`,
    code: "userNotAllowedToDeleteClientKey",
    title: "User not allowed to delete client key",
  });
}

export function userNotAllowedToDeleteProducerKeychainKey(
  userId: UserId,
  producerKeychain: ProducerKeychainId,
  kid: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} is not allowed to delete producer keychain (${producerKeychain}) key ${kid}`,
    code: "userNotAllowedToDeleteProducerKeychainKey",
    title: "User not allowed to delete producer keychain key",
  });
}

export function producerKeyNotFound(
  keyId: string,
  producerKeychainId: ProducerKeychainId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Key ${keyId} not found in producer keychain ${producerKeychainId}`,
    code: "producerKeyNotFound",
    title: "Key not found",
  });
}

export function producerKeychainUserAlreadyAssigned(
  producerKeychainId: ProducerKeychainId,
  userId: UserId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} is already assigned to the producer keychain ${producerKeychainId}`,
    code: "producerKeychainUserAlreadyAssigned",
    title: "User already assigned to the producer keychain",
  });
}

export function producerKeychainUserIdNotFound(
  userId: UserId,
  producerKeychainId: ProducerKeychainId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} not found in producer keychain ${producerKeychainId}`,
    code: "producerKeychainUserIdNotFound",
    title: "User id not found in producer keychain",
  });
}

export function organizationNotAllowedOnEService(
  organizationId: TenantId,
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed on e-service ${eserviceId}`,
    code: "organizationNotAllowedOnEService",
    title: "Organization not allowed on e-service",
  });
}

export function eserviceAlreadyLinkedToProducerKeychain(
  eserviceId: EServiceId,
  producerKeychainId: ProducerKeychainId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} is already linked to producer keychain ${producerKeychainId}`,
    code: "eserviceAlreadyLinkedToProducerKeychain",
    title: "EService already linked to producer keychain",
  });
}

export function purposeDelegationNotFound(
  delegationId: DelegationId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${delegationId} not found`,
    code: "purposeDelegationNotFound",
    title: "Deleagtion not found",
  });
}

export function eserviceNotDelegableForClientAccess(
  eservice: EService
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eservice.id} is not delegable for client access`,
    code: "eserviceNotDelegableForClientAccess",
    title: "EService not delegable for client access",
  });
}
