/* eslint-disable max-params */
import { AuthData, CreateEvent } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEvent,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
  Delegation,
  Descriptor,
  EService,
  Tenant,
  agreementState,
  tenantMailKind,
} from "pagopa-interop-models";
import { agreementApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import {
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
} from "../model/domain/agreement-validators.js";
import {
  agreementNotInExpectedState,
  consumerWithNotValidEmail,
} from "../model/domain/errors.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import { createStamp } from "./agreementStampUtils.js";

export type AgremeentSubmissionResults = {
  events: Array<CreateEvent<AgreementEvent>>;
  initAgreement: Agreement;
  version: number;
};

export const validateConsumerEmail = async (
  consumer: Tenant,
  agreement: Agreement
): Promise<void> => {
  const hasContactEmail = consumer.mails.some(
    (mail) => mail.kind === tenantMailKind.ContactEmail
  );

  if (!hasContactEmail) {
    throw consumerWithNotValidEmail(agreement.id, agreement.consumerId);
  }
};

export const createSubmissionUpdateAgreementSeed = (
  descriptor: Descriptor,
  consumer: Tenant,
  eservice: EService,
  agreement: Agreement,
  payload: agreementApi.AgreementSubmissionPayload,
  newState: AgreementState,
  authData: AuthData,
  suspendedByPlatform: boolean | undefined,
  activeConsumerDelegation: Delegation | undefined
): UpdateAgreementSeed => {
  const stamps = calculateStamps(
    agreement,
    newState,
    createStamp(authData, {
      consumerDelegation: activeConsumerDelegation,
      producerDelegation: undefined,
    })
  );
  const isActivation = newState === agreementState.active;

  /* As we do in the upgrade, we copy suspendedByProducer, suspendedByProducer, and suspendedAt
    event if the agreement was never activated before and thus never suspended.
    In this way, if this is an agreement that was upgraded, we keep suspension flags
    from the original agreement before the upgrade, so that if it is being activated
    by the producer, it will be suspended right away if the original
    agreement was suspended by the consumer, and viceversa. */
  return isActivation
    ? {
        state: newState,
        certifiedAttributes: matchingCertifiedAttributes(descriptor, consumer),
        declaredAttributes: matchingDeclaredAttributes(descriptor, consumer),
        verifiedAttributes: matchingVerifiedAttributes(
          eservice,
          descriptor,
          consumer
        ),
        suspendedByConsumer: agreement.suspendedByConsumer,
        suspendedByProducer: agreement.suspendedByProducer,
        suspendedAt: agreement.suspendedAt,
        suspendedByPlatform,
        consumerNotes: payload.consumerNotes,
        stamps,
      }
    : {
        state: newState,
        certifiedAttributes: [],
        declaredAttributes: [],
        verifiedAttributes: [],
        suspendedByConsumer: agreement.suspendedByConsumer,
        suspendedByProducer: agreement.suspendedByProducer,
        suspendedAt: agreement.suspendedAt,
        suspendedByPlatform,
        consumerNotes: payload.consumerNotes,
        stamps,
      };
};

export const isActiveOrSuspended = (state: AgreementState): boolean =>
  state === agreementState.active || state === agreementState.suspended;

export const calculateStamps = (
  agreement: Agreement,
  state: AgreementState,
  stamp: AgreementStamp
): AgreementStamps =>
  match<AgreementState, AgreementStamps>(state)
    .with(agreementState.draft, () => agreement.stamps)
    .with(agreementState.pending, () => ({
      ...agreement.stamps,
      submission: stamp,
    }))
    .with(agreementState.active, () => ({
      ...agreement.stamps,
      submission: stamp,
      activation: stamp,
    }))
    .with(agreementState.missingCertifiedAttributes, () => agreement.stamps)
    .otherwise(() => {
      throw agreementNotInExpectedState(agreement.id, state);
    });
