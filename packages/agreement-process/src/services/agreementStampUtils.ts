import { AuthData } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementStamp,
  AgreementState,
  TenantId,
  agreementState,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { ActiveDelegations } from "../model/domain/models.js";

export const createStamp = (
  authData: AuthData,
  activeDelegations: ActiveDelegations
): AgreementStamp => {
  const isProducerDelegate =
    activeDelegations.producerDelegation?.delegateId ===
    authData.organizationId;
  const isConsumerDelegate =
    activeDelegations.consumerDelegation?.delegateId ===
    authData.organizationId;

  const delegationId = isProducerDelegate
    ? activeDelegations.producerDelegation?.id
    : isConsumerDelegate
    ? activeDelegations.consumerDelegation?.id
    : undefined;

  return {
    who: authData.userId,
    delegationId,
    when: new Date(),
  };
};

export const suspendedByConsumerStamp = (
  agreement: Agreement,
  requesterOrgId: TenantId,
  destinationState: AgreementState,
  stamp: AgreementStamp,
  delegateConsumerId: TenantId | undefined
): AgreementStamp | undefined =>
  match<[TenantId | undefined, AgreementState]>([
    requesterOrgId,
    destinationState,
  ])
    .with(
      [agreement.consumerId, agreementState.suspended],
      [delegateConsumerId, agreementState.suspended],
      () => stamp
    )
    .with(
      [agreement.consumerId, P.any],
      [delegateConsumerId, P.any],
      () => undefined
    )
    .otherwise(() => agreement.stamps.suspensionByConsumer);

export const suspendedByProducerStamp = (
  agreement: Agreement,
  requesterOrgId: TenantId,
  destinationState: AgreementState,
  stamp: AgreementStamp,
  delegateProducerId: TenantId | undefined
): AgreementStamp | undefined =>
  match<[TenantId | undefined, AgreementState]>([
    requesterOrgId,
    destinationState,
  ])
    .with(
      [agreement.producerId, agreementState.suspended],
      [delegateProducerId, agreementState.suspended],
      () => stamp
    )
    .with(
      [agreement.producerId, P.any],
      [delegateProducerId, P.any],
      () => undefined
    )
    .otherwise(() => agreement.stamps.suspensionByProducer);
