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
  DelegationId,
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
  createdAt: agreement.createdAt?.toJSON(),
  updatedAt: agreement.updatedAt?.toJSON(),
  contract: agreement.contract
    ? agreementDocumentToApiAgreementDocument(agreement.contract)
    : undefined,
  suspendedAt: agreement.suspendedAt?.toJSON(),
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
    delegationId: verifier.delegationId
      ? unsafeBrandId<DelegationId>(verifier.delegationId)
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
    delegationId: revoker.delegationId
      ? unsafeBrandId<DelegationId>(revoker.delegationId)
      : undefined,
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
        delegationId: declared.delegationId
          ? unsafeBrandId<DelegationId>(declared.delegationId)
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
