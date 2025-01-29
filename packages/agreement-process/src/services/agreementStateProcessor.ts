import { CreateEvent, Logger } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEvent,
  AgreementState,
  AttributeId,
  Descriptor,
  EService,
  Tenant,
  WithMetadata,
  agreementApprovalPolicy,
  agreementState,
  CompactTenant,
  CorrelationId,
  TenantId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import {
  certifiedAttributesSatisfied,
  declaredAttributesSatisfied,
  verifiedAttributesSatisfied,
} from "pagopa-interop-agreement-lifecycle";
import {
  toCreateEventAgreementSetDraftByPlatform,
  toCreateEventAgreementSetMissingCertifiedAttributesByPlatform,
  toCreateEventAgreementSuspendedByPlatform,
  toCreateEventAgreementUnsuspendedByPlatform,
} from "../model/domain/toEvent.js";
import { ReadModelService } from "./readModelService.js";
import { retrieveEService } from "./agreementService.js";

const {
  draft,
  suspended,
  archived,
  missingCertifiedAttributes,
  pending,
  active,
  rejected,
} = agreementState;

const nextStateFromDraft = (
  agreement: Agreement,
  descriptor: Descriptor,
  tenant: Tenant | CompactTenant
): AgreementState => {
  if (agreement.consumerId === agreement.producerId) {
    return active;
  }
  if (!certifiedAttributesSatisfied(descriptor.attributes, tenant.attributes)) {
    return missingCertifiedAttributes;
  }

  if (
    descriptor.agreementApprovalPolicy === agreementApprovalPolicy.automatic &&
    declaredAttributesSatisfied(descriptor.attributes, tenant.attributes) &&
    verifiedAttributesSatisfied(
      agreement.producerId,
      descriptor.attributes,
      tenant.attributes
    )
  ) {
    return active;
  }
  if (declaredAttributesSatisfied(descriptor.attributes, tenant.attributes)) {
    return pending;
  }
  return draft;
};

const nextStateFromPending = (
  agreement: Agreement,
  descriptor: Descriptor,
  tenant: Tenant | CompactTenant
): AgreementState => {
  if (!certifiedAttributesSatisfied(descriptor.attributes, tenant.attributes)) {
    return missingCertifiedAttributes;
  }
  if (!declaredAttributesSatisfied(descriptor.attributes, tenant.attributes)) {
    return draft;
  }
  if (
    !verifiedAttributesSatisfied(
      agreement.producerId,
      descriptor.attributes,
      tenant.attributes
    )
  ) {
    return pending;
  }
  return active;
};

const nextStateFromActiveOrSuspended = (
  agreement: Agreement,
  descriptor: Descriptor,
  tenant: Tenant | CompactTenant
): AgreementState => {
  if (agreement.consumerId === agreement.producerId) {
    return active;
  }
  if (
    certifiedAttributesSatisfied(descriptor.attributes, tenant.attributes) &&
    declaredAttributesSatisfied(descriptor.attributes, tenant.attributes) &&
    verifiedAttributesSatisfied(
      agreement.producerId,
      descriptor.attributes,
      tenant.attributes
    )
  ) {
    return active;
  }
  return suspended;
};

const nextStateFromMissingCertifiedAttributes = (
  descriptor: Descriptor,
  tenant: Tenant | CompactTenant
): AgreementState => {
  if (certifiedAttributesSatisfied(descriptor.attributes, tenant.attributes)) {
    return draft;
  }
  return missingCertifiedAttributes;
};

export const nextStateByAttributesFSM = (
  agreement: Agreement,
  descriptor: Descriptor,
  tenant: Tenant | CompactTenant
): AgreementState =>
  match(agreement.state)
    .with(agreementState.draft, () =>
      nextStateFromDraft(agreement, descriptor, tenant)
    )
    .with(agreementState.pending, () =>
      nextStateFromPending(agreement, descriptor, tenant)
    )
    .with(agreementState.active, agreementState.suspended, () =>
      nextStateFromActiveOrSuspended(agreement, descriptor, tenant)
    )
    .with(agreementState.archived, () => archived)
    .with(agreementState.missingCertifiedAttributes, () =>
      nextStateFromMissingCertifiedAttributes(descriptor, tenant)
    )
    .with(agreementState.rejected, () => rejected)
    .exhaustive();

export const agreementStateByFlags = (
  nextStateByAttributes: AgreementState,
  suspendedByProducer: boolean | undefined,
  suspendedByConsumer: boolean | undefined,
  suspendedByPlatform: boolean | undefined
): AgreementState =>
  match([
    nextStateByAttributes,
    suspendedByProducer,
    suspendedByConsumer,
    suspendedByPlatform,
  ])
    .with(
      [agreementState.active, true, P.any, P.any],
      [agreementState.active, P.any, true, P.any],
      [agreementState.active, P.any, P.any, true],
      () => agreementState.suspended
    )
    .otherwise(() => nextStateByAttributes);

export const suspendedByPlatformFlag = (
  nextStateByAttributes: AgreementState
): boolean =>
  nextStateByAttributes === agreementState.suspended ||
  nextStateByAttributes === agreementState.missingCertifiedAttributes;

export const suspendedByConsumerFlag = (
  agreement: Agreement,
  requesterOrgId: Tenant["id"],
  targetDestinationState: AgreementState,
  delegateConsumerId: TenantId | undefined
): boolean | undefined =>
  requesterOrgId === agreement.consumerId ||
  requesterOrgId === delegateConsumerId
    ? targetDestinationState === agreementState.suspended
    : agreement.suspendedByConsumer;

export const suspendedByProducerFlag = (
  agreement: Agreement,
  requesterOrgId: Tenant["id"],
  targetDestinationState: AgreementState,
  delegateProducerId: TenantId | undefined
): boolean | undefined =>
  requesterOrgId === agreement.producerId ||
  requesterOrgId === delegateProducerId
    ? targetDestinationState === agreementState.suspended
    : agreement.suspendedByProducer;

const allowedStateTransitions = (state: AgreementState): AgreementState[] =>
  match(state)
    .with(agreementState.draft, agreementState.pending, () => [
      agreementState.missingCertifiedAttributes,
    ])
    .with(agreementState.missingCertifiedAttributes, () => [
      agreementState.draft,
    ])
    .with(agreementState.active, () => [agreementState.suspended])
    .with(agreementState.suspended, () => [
      agreementState.active,
      agreementState.suspended,
    ])
    .with(agreementState.archived, agreementState.rejected, () => [])
    .exhaustive();

const updatableStates = Object.values(agreementState).filter(
  (state) => allowedStateTransitions(state).length > 0
);

function updateAgreementState(
  agreement: WithMetadata<Agreement>,
  consumer: CompactTenant,
  eservices: EService[],
  correlationId: CorrelationId,
  logger: Logger
): CreateEvent<AgreementEvent> | void {
  const descriptor = eservices
    .find((eservice) => eservice.id === agreement.data.eserviceId)
    ?.descriptors.find(
      (descriptor) => descriptor.id === agreement.data.descriptorId
    );

  if (!descriptor) {
    logger.error(
      `Descriptor ${agreement.data.descriptorId} not found for Agreement ${agreement.data.id} - EService ${agreement.data.eserviceId}`
    );
    return;
  }

  const nextStateByAttributes = nextStateByAttributesFSM(
    agreement.data,
    descriptor,
    consumer
  );

  const newSuspendedByPlatform = suspendedByPlatformFlag(nextStateByAttributes);

  const finalState = agreementStateByFlags(
    nextStateByAttributes,
    agreement.data.suspendedByProducer,
    agreement.data.suspendedByConsumer,
    newSuspendedByPlatform
  );

  const updatedAgreement: Agreement = {
    ...agreement.data,
    state: finalState,
    suspendedByPlatform: newSuspendedByPlatform,
  };

  if (
    allowedStateTransitions(agreement.data.state).includes(finalState) &&
    newSuspendedByPlatform !== agreement.data.suspendedByPlatform
  ) {
    return match([finalState, newSuspendedByPlatform])
      .with([agreementState.suspended, true], () =>
        toCreateEventAgreementSuspendedByPlatform(
          updatedAgreement,
          agreement.metadata.version,
          correlationId
        )
      )
      .with(
        [agreementState.suspended, false],
        [agreementState.active, P._],
        () =>
          toCreateEventAgreementUnsuspendedByPlatform(
            updatedAgreement,
            agreement.metadata.version,
            correlationId
          )
      )
      .with([agreementState.missingCertifiedAttributes, P._], () =>
        toCreateEventAgreementSetMissingCertifiedAttributesByPlatform(
          updatedAgreement,
          agreement.metadata.version,
          correlationId
        )
      )
      .with([agreementState.draft, P._], () =>
        toCreateEventAgreementSetDraftByPlatform(
          updatedAgreement,
          agreement.metadata.version,
          correlationId
        )
      )
      .otherwise(
        () =>
          void logger.error(
            `Agreement state transition not allowed from ${agreement.data.state} to ${finalState} - Agreement ${agreement.data.id} - EService ${agreement.data.eserviceId} - Consumer ${consumer.id}`
          )
      );
  }
}

function eserviceContainsAttribute(
  attributeId: AttributeId,
  eservice: EService
): boolean {
  const allIds = eservice.descriptors
    .flatMap((descriptor) => [
      ...descriptor.attributes.certified,
      ...descriptor.attributes.declared,
      ...descriptor.attributes.verified,
    ])
    .flatMap((attr) => attr.map((a) => a.id));

  return allIds.includes(attributeId);
}

export async function computeAgreementsStateByAttribute(
  attributeId: AttributeId,
  consumer: CompactTenant,
  readModelService: ReadModelService,
  correlationId: CorrelationId,
  logger: Logger
): Promise<Array<CreateEvent<AgreementEvent>>> {
  const agreements = await readModelService.getAllAgreements({
    consumerId: consumer.id,
    agreementStates: updatableStates,
  });

  const uniqueEServiceIds = Array.from(
    new Set(agreements.map((a) => a.data.eserviceId))
  );

  const eservices: EService[] = await Promise.all(
    uniqueEServiceIds.map((id) => retrieveEService(id, readModelService))
  );

  const eservicesWithAttribute = eservices.filter((eservice) =>
    eserviceContainsAttribute(attributeId, eservice)
  );

  const agreementsToUpdate = agreements.filter((agreement) =>
    eservicesWithAttribute.some(
      (eservice) => eservice.id === agreement.data.eserviceId
    )
  );

  return agreementsToUpdate
    .map((agreement) =>
      updateAgreementState(
        agreement,
        consumer,
        eservicesWithAttribute,
        correlationId,
        logger
      )
    )
    .filter(
      (event): event is NonNullable<CreateEvent<AgreementEvent>> =>
        event !== undefined
    );
}
