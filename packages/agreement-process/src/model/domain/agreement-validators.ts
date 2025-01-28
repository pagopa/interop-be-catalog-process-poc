import {
  Agreement,
  AgreementState,
  AttributeId,
  Descriptor,
  DescriptorState,
  EService,
  EServiceAttribute,
  Tenant,
  agreementState,
  descriptorState,
  AgreementId,
  DescriptorId,
  EServiceId,
  unsafeBrandId,
  TenantId,
  AgreementStamp,
  AgreementStamps,
  delegationKind,
  Delegation,
  delegationState,
} from "pagopa-interop-models";
import { AuthData } from "pagopa-interop-commons";
import {
  certifiedAttributesSatisfied,
  filterCertifiedAttributes,
  filterDeclaredAttributes,
  filterVerifiedAttributes,
} from "pagopa-interop-agreement-lifecycle";
import { ReadModelService } from "../../services/readModelService.js";
import {
  agreementActivationFailed,
  agreementAlreadyExists,
  agreementNotInExpectedState,
  agreementStampNotFound,
  agreementSubmissionFailed,
  descriptorNotFound,
  descriptorNotInExpectedState,
  documentChangeNotAllowed,
  missingCertifiedAttributesError,
  notLatestEServiceDescriptor,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegateConsumer,
  organizationIsNotTheDelegateProducer,
  organizationIsNotTheProducer,
  organizationNotAllowed,
} from "./errors.js";
import {
  ActiveDelegations,
  CertifiedAgreementAttribute,
  DeclaredAgreementAttribute,
  VerifiedAgreementAttribute,
} from "./models.js";

/* ========= STATES ========= */
export const agreementActivableStates: AgreementState[] = [
  agreementState.pending,
  agreementState.suspended,
];

export const agreementActivationAllowedDescriptorStates: DescriptorState[] = [
  descriptorState.published,
  descriptorState.suspended,
  descriptorState.deprecated,
];

export const agreementSuspendableStates: AgreementState[] = [
  agreementState.active,
  agreementState.suspended,
];
export const agreementArchivableStates: AgreementState[] = [
  agreementState.active,
  agreementState.suspended,
];
export const agreementSubmittableStates: AgreementState[] = [
  agreementState.draft,
];

export const agreementUpdatableStates: AgreementState[] = [
  agreementState.draft,
];

export const agreementUpgradableStates: AgreementState[] = [
  agreementState.active,
  agreementState.suspended,
];
export const agreementRejectableStates: AgreementState[] = [
  agreementState.pending,
];

export const agreementDeletableStates: AgreementState[] = [
  agreementState.draft,
  agreementState.missingCertifiedAttributes,
  agreementState.pending,
];

export const agreementClonableStates: AgreementState[] = [
  agreementState.rejected,
];

export const agreementActivationFailureStates: AgreementState[] = [
  agreementState.draft,
  agreementState.pending,
  agreementState.missingCertifiedAttributes,
];

export const agreementCloningConflictingStates: AgreementState[] = [
  agreementState.draft,
  agreementState.pending,
  agreementState.missingCertifiedAttributes,
  agreementState.active,
  agreementState.suspended,
];

export const agreementCreationConflictingStates: AgreementState[] = [
  agreementState.draft,
  agreementState.pending,
  agreementState.missingCertifiedAttributes,
  agreementState.active,
  agreementState.suspended,
];

export const agreementSubmissionConflictingStates: AgreementState[] = [
  agreementState.pending,
  agreementState.missingCertifiedAttributes,
];

export const agreementConsumerDocumentChangeValidStates: AgreementState[] = [
  agreementState.draft,
  agreementState.pending,
];

/* ========= ASSERTIONS ========= */

const assertRequesterIsConsumer = (
  agreement: Pick<Agreement, "consumerId">,
  authData: AuthData
): void => {
  if (
    !authData.userRoles.includes("internal") &&
    authData.organizationId !== agreement.consumerId
  ) {
    throw organizationIsNotTheConsumer(authData.organizationId);
  }
};

const assertRequesterIsProducer = (
  agreement: Agreement,
  authData: AuthData
): void => {
  if (
    !authData.userRoles.includes("internal") &&
    authData.organizationId !== agreement.producerId
  ) {
    throw organizationIsNotTheProducer(authData.organizationId);
  }
};

export const assertRequesterCanActAsConsumerOrProducer = (
  agreement: Agreement,
  authData: AuthData,
  activeDelegations: ActiveDelegations
): void => {
  try {
    assertRequesterCanActAsConsumer(
      agreement,
      authData,
      activeDelegations.consumerDelegation
    );
  } catch {
    try {
      assertRequesterCanActAsProducer(
        agreement,
        authData,
        activeDelegations.producerDelegation
      );
    } catch {
      throw organizationNotAllowed(authData.organizationId);
    }
  }
};

export const assertRequesterCanRetrieveConsumerDocuments = async (
  agreement: Agreement,
  authData: AuthData,
  readModelService: ReadModelService
): Promise<void> => {
  // This operation has a dedicated assertion because it's the only operation that
  // can be performed also by the producer/consumer even when active producer/consumer delegations exist
  try {
    assertRequesterIsConsumer(agreement, authData);
  } catch {
    try {
      assertRequesterIsProducer(agreement, authData);
    } catch {
      try {
        assertRequesterIsDelegateProducer(
          agreement,
          authData,
          await readModelService.getActiveProducerDelegationByEserviceId(
            agreement.eserviceId
          )
        );
      } catch {
        try {
          assertRequesterIsDelegateConsumer(
            agreement,
            authData,
            await readModelService.getActiveConsumerDelegationByAgreement(
              agreement
            )
          );
        } catch {
          throw organizationNotAllowed(authData.organizationId);
        }
      }
    }
  }
};

export const assertRequesterCanActAsProducer = (
  agreement: Agreement,
  authData: AuthData,
  activeProducerDelegation: Delegation | undefined
): void => {
  if (!activeProducerDelegation) {
    // No active producer delegation, the requester is authorized only if they are the producer
    assertRequesterIsProducer(agreement, authData);
  } else {
    // Active producer delegation, the requester is authorized only if they are the delegate
    assertRequesterIsDelegateProducer(
      agreement,
      authData,
      activeProducerDelegation
    );
  }
};

const assertRequesterIsDelegateProducer = (
  agreement: Agreement,
  authData: AuthData,
  activeProducerDelegation: Delegation | undefined
): void => {
  if (
    activeProducerDelegation?.delegateId !== authData.organizationId ||
    activeProducerDelegation?.delegatorId !== agreement.producerId ||
    activeProducerDelegation?.kind !== delegationKind.delegatedProducer ||
    activeProducerDelegation?.state !== delegationState.active ||
    activeProducerDelegation?.eserviceId !== agreement.eserviceId
  ) {
    throw organizationIsNotTheDelegateProducer(
      authData.organizationId,
      activeProducerDelegation?.id
    );
  }
};

export const assertSubmittableState = (
  state: AgreementState,
  agreementId: AgreementId
): void => {
  if (state !== agreementState.draft) {
    throw agreementNotInExpectedState(agreementId, state);
  }
};

export const assertExpectedState = (
  agreementId: AgreementId,
  agreementState: AgreementState,
  expectedStates: AgreementState[]
): void => {
  if (!expectedStates.includes(agreementState)) {
    throw agreementNotInExpectedState(agreementId, agreementState);
  }
};

export const assertCanWorkOnConsumerDocuments = (
  state: AgreementState
): void => {
  if (!agreementConsumerDocumentChangeValidStates.includes(state)) {
    throw documentChangeNotAllowed(state);
  }
};

export const assertActivableState = (agreement: Agreement): void => {
  if (!agreementActivableStates.includes(agreement.state)) {
    throw agreementNotInExpectedState(agreement.id, agreement.state);
  }
};

export const assertRequesterIsDelegateConsumer = (
  agreement: Pick<Agreement, "consumerId" | "eserviceId">,
  authData: AuthData,
  activeConsumerDelegation: Delegation | undefined
): void => {
  if (
    activeConsumerDelegation?.delegateId !== authData.organizationId ||
    activeConsumerDelegation?.delegatorId !== agreement.consumerId ||
    activeConsumerDelegation?.eserviceId !== agreement.eserviceId ||
    activeConsumerDelegation?.kind !== delegationKind.delegatedConsumer ||
    activeConsumerDelegation?.state !== delegationState.active
  ) {
    throw organizationIsNotTheDelegateConsumer(
      authData.organizationId,
      activeConsumerDelegation?.id
    );
  }
};

export const assertRequesterCanActAsConsumer = (
  agreement: Pick<Agreement, "consumerId" | "eserviceId">,
  authData: AuthData,
  activeConsumerDelegation: Delegation | undefined
): void => {
  if (!activeConsumerDelegation) {
    // No active consumer delegation, the requester is authorized only if they are the consumer
    assertRequesterIsConsumer(agreement, authData);
  } else {
    // Active consumer delegation, the requester is authorized only if they are the delegate
    assertRequesterIsDelegateConsumer(
      agreement,
      authData,
      activeConsumerDelegation
    );
  }
};

/* =========  VALIDATIONS ========= */

const validateDescriptorState = (
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  descriptorState: DescriptorState,
  allowedStates: DescriptorState[]
): void => {
  if (!allowedStates.includes(descriptorState)) {
    throw descriptorNotInExpectedState(eserviceId, descriptorId, allowedStates);
  }
};

const validateLatestDescriptor = (
  eservice: EService,
  descriptorId: DescriptorId,
  allowedStates: DescriptorState[]
): Descriptor => {
  const activeDescriptorStates: DescriptorState[] = [
    descriptorState.archived,
    descriptorState.deprecated,
    descriptorState.published,
    descriptorState.suspended,
  ];

  const recentActiveDescriptors = eservice.descriptors
    .filter((d) => activeDescriptorStates.includes(d.state))
    .sort((a, b) => Number(b.version) - Number(a.version));

  if (
    recentActiveDescriptors.length < 1 ||
    recentActiveDescriptors[0].id !== descriptorId
  ) {
    throw notLatestEServiceDescriptor(descriptorId);
  }

  const recentActiveDescriptor = recentActiveDescriptors[0];
  validateDescriptorState(
    eservice.id,
    descriptorId,
    recentActiveDescriptor.state,
    allowedStates
  );

  return recentActiveDescriptor;
};

export const validateCreationOnDescriptor = (
  eservice: EService,
  descriptorId: DescriptorId
): Descriptor => {
  const allowedStatus = [descriptorState.published];
  return validateLatestDescriptor(eservice, descriptorId, allowedStatus);
};

export const verifyCreationConflictingAgreements = async (
  organizationId: TenantId,
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<void> => {
  await verifyConflictingAgreements(
    organizationId,
    eserviceId,
    agreementCreationConflictingStates,
    readModelService
  );
};

export const verifySubmissionConflictingAgreements = async (
  agreement: Agreement,
  readModelService: ReadModelService
): Promise<void> => {
  await verifyConflictingAgreements(
    agreement.consumerId,
    unsafeBrandId(agreement.eserviceId),
    agreementSubmissionConflictingStates,
    readModelService
  );
};

export const validateCertifiedAttributes = ({
  descriptor,
  consumer,
}: {
  descriptor: Descriptor;
  consumer: Tenant;
}): void => {
  if (
    !certifiedAttributesSatisfied(descriptor.attributes, consumer.attributes)
  ) {
    throw missingCertifiedAttributesError(descriptor.id, consumer.id);
  }
};

export const validateSubmitOnDescriptor = async (
  eservice: EService,
  descriptorId: DescriptorId
): Promise<Descriptor> => {
  const allowedStatus: DescriptorState[] = [
    descriptorState.published,
    descriptorState.suspended,
  ];
  return validateLatestDescriptor(eservice, descriptorId, allowedStatus);
};

export const validateActiveOrPendingAgreement = (
  agreementId: AgreementId,
  state: AgreementState
): void => {
  if (agreementState.active !== state && agreementState.pending !== state) {
    throw agreementSubmissionFailed(agreementId);
  }
};

export const verifyConflictingAgreements = async (
  consumerId: TenantId,
  eserviceId: EServiceId,
  conflictingStates: AgreementState[],
  readModelService: ReadModelService
): Promise<void> => {
  const agreements = await readModelService.getAllAgreements({
    consumerId,
    eserviceId,
    agreementStates: conflictingStates,
  });

  if (agreements.length > 0) {
    throw agreementAlreadyExists(consumerId, eserviceId);
  }
};

export const validateActivationOnDescriptor = (
  eservice: EService,
  descriptorId: Descriptor["id"]
): Descriptor => {
  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
  if (!descriptor) {
    throw descriptorNotFound(eservice.id, descriptorId);
  }

  validateDescriptorState(
    eservice.id,
    descriptor.id,
    descriptor.state,
    agreementActivationAllowedDescriptorStates
  );

  return descriptor;
};

export const failOnActivationFailure = (
  newState: AgreementState,
  agreement: Agreement
): void => {
  if (agreementActivationFailureStates.includes(newState)) {
    throw agreementActivationFailed(agreement.id);
  }
};

/* ========= MATCHERS ========= */

const matchingAttributes = (
  eserviceAttributes: EServiceAttribute[][],
  consumerAttributes: AttributeId[]
): AttributeId[] =>
  eserviceAttributes
    .flatMap((atts) => atts.map((att) => att.id))
    .filter((att) => consumerAttributes.includes(att));

export const matchingCertifiedAttributes = (
  descriptor: Descriptor,
  consumer: Tenant
): CertifiedAgreementAttribute[] => {
  const certifiedAttributes = filterCertifiedAttributes(
    consumer.attributes
  ).map((a) => a.id);

  return matchingAttributes(
    descriptor.attributes.certified,
    certifiedAttributes
  ).map((id) => ({ id } as CertifiedAgreementAttribute));
};

export const matchingDeclaredAttributes = (
  descriptor: Descriptor,
  consumer: Tenant
): DeclaredAgreementAttribute[] => {
  const declaredAttributes = filterDeclaredAttributes(consumer.attributes).map(
    (a) => a.id
  );

  return matchingAttributes(
    descriptor.attributes.declared,
    declaredAttributes
  ).map((id) => ({ id } as DeclaredAgreementAttribute));
};

export const matchingVerifiedAttributes = (
  eservice: EService,
  descriptor: Descriptor,
  consumer: Tenant
): VerifiedAgreementAttribute[] => {
  const verifiedAttributes = filterVerifiedAttributes(
    eservice.producerId,
    consumer.attributes
  ).map((a) => a.id);

  return matchingAttributes(
    descriptor.attributes.verified,
    verifiedAttributes
  ).map((id) => ({ id } as VerifiedAgreementAttribute));
};

export function assertStampExists<S extends keyof AgreementStamps>(
  stamps: AgreementStamps,
  stamp: S
): asserts stamps is AgreementStamps & {
  [key in S]: AgreementStamp;
} {
  if (!stamps[stamp]) {
    throw agreementStampNotFound(stamp);
  }
}
