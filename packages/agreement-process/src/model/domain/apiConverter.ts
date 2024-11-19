import {
  Agreement,
  AgreementState,
  AgreementDocument,
  agreementState,
  unsafeBrandId,
  TenantAttribute,
  tenantAttributeType,
  AttributeId,
  TenantVerifier,
  TenantRevoker,
  badRequestError,
  CompactTenant,
  AgreementStamps,
  AgreementAttribute,
} from "pagopa-interop-models";
import { agreementApi } from "pagopa-interop-api-clients";
import { P, match } from "ts-pattern";

export function agreementStateToApiAgreementState(
  input: AgreementState
): agreementApi.AgreementState {
  return match<AgreementState, agreementApi.AgreementState>(input)
    .with(agreementState.pending, () => "PENDING")
    .with(agreementState.rejected, () => "REJECTED")
    .with(agreementState.active, () => "ACTIVE")
    .with(agreementState.suspended, () => "SUSPENDED")
    .with(agreementState.archived, () => "ARCHIVED")
    .with(agreementState.draft, () => "DRAFT")
    .with(
      agreementState.missingCertifiedAttributes,
      () => "MISSING_CERTIFIED_ATTRIBUTES"
    )
    .exhaustive();
}

export function apiAgreementStateToAgreementState(
  input: agreementApi.AgreementState
): AgreementState {
  return match<agreementApi.AgreementState, AgreementState>(input)
    .with("PENDING", () => agreementState.pending)
    .with("REJECTED", () => agreementState.rejected)
    .with("ACTIVE", () => agreementState.active)
    .with("SUSPENDED", () => agreementState.suspended)
    .with("ARCHIVED", () => agreementState.archived)
    .with("DRAFT", () => agreementState.draft)
    .with(
      "MISSING_CERTIFIED_ATTRIBUTES",
      () => agreementState.missingCertifiedAttributes
    )
    .exhaustive();
}

export const agreementDocumentToApiAgreementDocument = (
  input: AgreementDocument
): agreementApi.Document => ({
  id: input.id,
  name: input.name,
  prettyName: input.prettyName,
  contentType: input.contentType,
  path: input.path,
  createdAt: input.createdAt?.toJSON(),
});

export const agreementToApiAgreement = (
  agreement: Agreement
): agreementApi.Agreement => ({
  id: agreement.id,
  eserviceId: agreement.eserviceId,
  descriptorId: agreement.descriptorId,
  producerId: agreement.producerId,
  consumerId: agreement.consumerId,
  state: agreementStateToApiAgreementState(agreement.state),
  verifiedAttributes: agreement.verifiedAttributes,
  certifiedAttributes: agreement.certifiedAttributes,
  declaredAttributes: agreement.declaredAttributes,
  suspendedByConsumer: agreement.suspendedByConsumer,
  suspendedByProducer: agreement.suspendedByProducer,
  suspendedByPlatform: agreement.suspendedByPlatform,
  consumerNotes: agreement.consumerNotes,
  rejectionReason: agreement.rejectionReason,
  consumerDocuments: agreement.consumerDocuments.map(
    agreementDocumentToApiAgreementDocument
  ),
  createdAt: agreement.createdAt.toJSON(),
  updatedAt: agreement.updatedAt?.toJSON(),
  contract: agreement.contract
    ? agreementDocumentToApiAgreementDocument(agreement.contract)
    : undefined,
  suspendedAt: agreement.suspendedAt?.toJSON(),
  stamps: stampsToApiStamps(agreement.stamps),
});

export const apiAgreementDocumentToAgreementDocument = (
  input: agreementApi.DocumentSeed
): AgreementDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: new Date(),
});

function fromApiTenantVerifier(
  verifier: agreementApi.TenantVerifier
): TenantVerifier {
  return {
    id: unsafeBrandId(verifier.id),
    verificationDate: new Date(verifier.verificationDate),
    expirationDate: verifier.expirationDate
      ? new Date(verifier.expirationDate)
      : undefined,
    extensionDate: verifier.extensionDate
      ? new Date(verifier.extensionDate)
      : undefined,
  };
}

function fromApiTenantRevoker(
  revoker: agreementApi.TenantRevoker
): TenantRevoker {
  return {
    id: unsafeBrandId(revoker.id),
    verificationDate: new Date(revoker.verificationDate),
    expirationDate: revoker.expirationDate
      ? new Date(revoker.expirationDate)
      : undefined,
    extensionDate: revoker.extensionDate
      ? new Date(revoker.extensionDate)
      : undefined,
    revocationDate: new Date(revoker.revocationDate),
  };
}

export const fromApiTenantAttribute = (
  input: agreementApi.TenantAttribute
): TenantAttribute =>
  match(input)
    .with(
      {
        certified: P.not(P.nullish),
        verified: P.optional(P.nullish),
        declared: P.optional(P.nullish),
      },
      ({ certified }) => ({
        type: tenantAttributeType.CERTIFIED,
        id: unsafeBrandId<AttributeId>(certified.id),
        assignmentTimestamp: new Date(certified.assignmentTimestamp),
        revocationTimestamp: certified.revocationTimestamp
          ? new Date(certified.revocationTimestamp)
          : undefined,
      })
    )
    .with(
      {
        verified: P.not(P.nullish),
        certified: P.optional(P.nullish),
        declared: P.optional(P.nullish),
      },
      ({ verified }) => ({
        type: tenantAttributeType.VERIFIED,
        id: unsafeBrandId<AttributeId>(verified.id),
        assignmentTimestamp: new Date(verified.assignmentTimestamp),
        verifiedBy: verified.verifiedBy.map(fromApiTenantVerifier),
        revokedBy: verified.revokedBy.map(fromApiTenantRevoker),
      })
    )
    .with(
      {
        declared: P.not(P.nullish),
        certified: P.optional(P.nullish),
        verified: P.optional(P.nullish),
      },
      ({ declared }) => ({
        type: tenantAttributeType.DECLARED,
        id: unsafeBrandId<AttributeId>(declared.id),
        assignmentTimestamp: new Date(declared.assignmentTimestamp),
        revocationTimestamp: declared.revocationTimestamp
          ? new Date(declared.revocationTimestamp)
          : undefined,
      })
    )
    .otherwise(() => {
      throw badRequestError(
        `Invalid tenant attribute in API request: ${JSON.stringify(input)}`
      );
    });

export const fromApiCompactTenant = (
  input: agreementApi.CompactTenant
): CompactTenant => ({
  id: unsafeBrandId(input.id),
  attributes: input.attributes.map(fromApiTenantAttribute),
});

export const stampsToApiStamps = (
  input: AgreementStamps
): agreementApi.Stamps => ({
  submission: input.submission
    ? {
        who: unsafeBrandId(input.submission.who),
        when: input.submission.when.toJSON(),
      }
    : undefined,
  activation: input.activation
    ? {
        who: unsafeBrandId(input.activation.who),
        when: input.activation.when.toJSON(),
      }
    : undefined,
  rejection: input.rejection
    ? {
        who: unsafeBrandId(input.rejection.who),
        when: input.rejection.when.toJSON(),
      }
    : undefined,
  suspensionByProducer: input.suspensionByProducer
    ? {
        who: unsafeBrandId(input.suspensionByProducer.who),
        when: input.suspensionByProducer.when.toJSON(),
      }
    : undefined,
  suspensionByConsumer: input.suspensionByConsumer
    ? {
        who: unsafeBrandId(input.suspensionByConsumer.who),
        when: input.suspensionByConsumer.when.toJSON(),
      }
    : undefined,
  upgrade: input.upgrade
    ? {
        who: unsafeBrandId(input.upgrade.who),
        when: input.upgrade.when.toJSON(),
      }
    : undefined,
  archiving: input.archiving
    ? {
        who: unsafeBrandId(input.archiving.who),
        when: input.archiving.when.toJSON(),
      }
    : undefined,
});

const apiAttributeToAgreementAttribute = (
  apiAttribute:
    | agreementApi.VerifiedAttribute
    | agreementApi.DeclaredAttribute
    | agreementApi.CertifiedAttribute
): AgreementAttribute => ({
  ...apiAttribute,
  id: unsafeBrandId(apiAttribute.id),
});

export const apiAgreementToAgreement = (
  apiAgreement: agreementApi.Agreement
): Agreement => ({
  id: unsafeBrandId(apiAgreement.id),
  createdAt: new Date(apiAgreement.createdAt),
  eserviceId: unsafeBrandId(apiAgreement.eserviceId),
  descriptorId: unsafeBrandId(apiAgreement.descriptorId),
  producerId: unsafeBrandId(apiAgreement.producerId),
  consumerId: unsafeBrandId(apiAgreement.consumerId),
  suspendedAt: apiAgreement.suspendedAt
    ? new Date(apiAgreement.suspendedAt)
    : undefined,
  updatedAt: apiAgreement.updatedAt
    ? new Date(apiAgreement.updatedAt)
    : undefined,
  state: apiAgreementStateToAgreementState(apiAgreement.state),
  verifiedAttributes: apiAgreement.verifiedAttributes.map((attr) =>
    apiAttributeToAgreementAttribute(attr)
  ),
  certifiedAttributes: apiAgreement.certifiedAttributes.map((attr) =>
    apiAttributeToAgreementAttribute(attr)
  ),
  declaredAttributes: apiAgreement.declaredAttributes.map((attr) =>
    apiAttributeToAgreementAttribute(attr)
  ),
  consumerDocuments: apiAgreement.consumerDocuments.map((doc) =>
    apiAgreementDocumentToAgreementDocument(doc)
  ),
  suspendedByConsumer: apiAgreement.suspendedByConsumer,
  suspendedByProducer: apiAgreement.suspendedByProducer,
  suspendedByPlatform: apiAgreement.suspendedByPlatform,
  consumerNotes: apiAgreement.consumerNotes,
  rejectionReason: apiAgreement.rejectionReason,
  contract: apiAgreement.contract
    ? apiAgreementDocumentToAgreementDocument(apiAgreement.contract)
    : undefined,
  stamps: apiStampsToStamps(apiAgreement.stamps),
});

export const apiStampsToStamps = (
  input: agreementApi.Stamps
): AgreementStamps => ({
  submission: input.submission
    ? {
        who: unsafeBrandId(input.submission.who),
        when: new Date(input.submission.when),
      }
    : undefined,
  activation: input.activation
    ? {
        who: unsafeBrandId(input.activation.who),
        when: new Date(input.activation.when),
      }
    : undefined,
  rejection: input.rejection
    ? {
        who: unsafeBrandId(input.rejection.who),
        when: new Date(input.rejection.when),
      }
    : undefined,
  suspensionByProducer: input.suspensionByProducer
    ? {
        who: unsafeBrandId(input.suspensionByProducer.who),
        when: new Date(input.suspensionByProducer.when),
      }
    : undefined,
  suspensionByConsumer: input.suspensionByConsumer
    ? {
        who: unsafeBrandId(input.suspensionByConsumer.who),
        when: new Date(input.suspensionByConsumer.when),
      }
    : undefined,
  upgrade: input.upgrade
    ? {
        who: unsafeBrandId(input.upgrade.who),
        when: new Date(input.upgrade.when),
      }
    : undefined,
  archiving: input.archiving
    ? {
        who: unsafeBrandId(input.archiving.who),
        when: new Date(input.archiving.when),
      }
    : undefined,
});
