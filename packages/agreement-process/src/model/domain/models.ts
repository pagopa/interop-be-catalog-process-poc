import {
  AgreementAttribute,
  AgreementId,
  AgreementStamps,
  AgreementState,
  Delegation,
  DescriptorId,
  EServiceId,
  UserId,
} from "pagopa-interop-models";
import { z } from "zod";

export const CertifiedAgreementAttribute =
  AgreementAttribute.brand<"CertifiedAgreementAttribute">();
export type CertifiedAgreementAttribute = z.infer<
  typeof CertifiedAgreementAttribute
>;

export const DeclaredAgreementAttribute =
  AgreementAttribute.brand<"DeclaredAgreementAttribute">();
export type DeclaredAgreementAttribute = z.infer<
  typeof DeclaredAgreementAttribute
>;

export const VerifiedAgreementAttribute =
  AgreementAttribute.brand<"VerifiedAgreementAttribute">();
export type VerifiedAgreementAttribute = z.infer<
  typeof VerifiedAgreementAttribute
>;

export type UpdateAgreementSeed = {
  state: AgreementState;
  certifiedAttributes?: CertifiedAgreementAttribute[];
  declaredAttributes?: DeclaredAgreementAttribute[];
  verifiedAttributes?: VerifiedAgreementAttribute[];
  suspendedByConsumer?: boolean;
  suspendedByProducer?: boolean;
  suspendedByPlatform?: boolean;
  stamps: AgreementStamps;
  consumerNotes?: string;
  rejectionReason?: string;
  suspendedAt?: Date;
};

export const CompactOrganization = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export type CompactOrganization = z.infer<typeof CompactOrganization>;

export const CompactEService = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export type CompactEService = z.infer<typeof CompactEService>;

export type ActiveDelegations = {
  producerDelegation: Delegation | undefined;
  consumerDelegation: Delegation | undefined;
};

export type AgreementContractPDFPayload = {
  todayDate: string;
  todayTime: string;
  agreementId: AgreementId;
  submitterId: UserId;
  submissionDate: string;
  submissionTime: string;
  activatorId: UserId;
  activationDate: string;
  activationTime: string;
  eserviceId: EServiceId;
  eserviceName: string;
  descriptorId: DescriptorId;
  descriptorVersion: string;
  producerName: string;
  producerIpaCode: string | undefined;
  consumerName: string;
  consumerIpaCode: string | undefined;
  certifiedAttributes: Array<{
    assignmentDate: string;
    assignmentTime: string;
    attributeName: string;
    attributeId: string;
  }>;
  declaredAttributes: Array<{
    assignmentDate: string;
    assignmentTime: string;
    attributeName: string;
    attributeId: string;
    delegationId: string | undefined;
  }>;
  verifiedAttributes: Array<{
    assignmentDate: string;
    assignmentTime: string;
    attributeName: string;
    attributeId: string;
    expirationDate: string | undefined;
    delegationId: string | undefined;
  }>;
  producerDelegationId: string | undefined;
  producerDelegateName: string | undefined;
  producerDelegateIpaCode: string | undefined;
  consumerDelegationId: string | undefined;
  consumerDelegateName: string | undefined;
  consumerDelegateIpaCode: string | undefined;
};
