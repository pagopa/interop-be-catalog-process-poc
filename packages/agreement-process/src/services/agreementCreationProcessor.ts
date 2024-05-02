import { AuthData, CreateEvent, Logger } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEvent,
  agreementState,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { toCreateEventAgreementAdded } from "../model/domain/toEvent.js";
import {
  assertEServiceExist,
  assertTenantExist,
  validateCertifiedAttributes,
  validateCreationOnDescriptor,
  verifyCreationConflictingAgreements,
} from "../model/domain/validators.js";
import { ApiAgreementPayload } from "../model/types.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";

// eslint-disable-next-line max-params
export async function createAgreementLogic(
  agreement: ApiAgreementPayload,
  authData: AuthData,
  agreementQuery: AgreementQuery,
  eserviceQuery: EserviceQuery,
  tenantQuery: TenantQuery,
  correlationId: string,
  logger: Logger
): Promise<CreateEvent<AgreementEvent>> {
  const eservice = await eserviceQuery.getEServiceById(
    agreement.eserviceId,
    logger
  );
  assertEServiceExist(unsafeBrandId(agreement.eserviceId), eservice);

  const descriptor = validateCreationOnDescriptor(
    eservice,
    unsafeBrandId(agreement.descriptorId)
  );

  await verifyCreationConflictingAgreements(
    authData.organizationId,
    agreement,
    agreementQuery,
    logger
  );
  const consumer = await tenantQuery.getTenantById(
    authData.organizationId,
    logger
  );
  assertTenantExist(authData.organizationId, consumer);

  if (eservice.producerId !== consumer.id) {
    validateCertifiedAttributes(descriptor, consumer);
  }

  const agreementSeed: Agreement = {
    id: generateId(),
    eserviceId: unsafeBrandId(agreement.eserviceId),
    descriptorId: unsafeBrandId(agreement.descriptorId),
    producerId: eservice.producerId,
    consumerId: authData.organizationId,
    state: agreementState.draft,
    verifiedAttributes: [],
    certifiedAttributes: [],
    declaredAttributes: [],
    consumerDocuments: [],
    createdAt: new Date(),
    stamps: {},
  };

  return toCreateEventAgreementAdded(agreementSeed, correlationId);
}
