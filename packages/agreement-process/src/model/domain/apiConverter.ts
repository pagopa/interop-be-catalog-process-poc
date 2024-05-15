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
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

import {
  ApiAgreement,
  ApiAgreementDocument,
  ApiAgreementDocumentSeed,
  ApiAgreementState,
  ApiCompactTenant,
  ApiTenantAttribute,
  ApiTenantRevoker,
  ApiTenantVerifier,
} from "../types.js";
import { CompactTenant } from "./models.js";

export function agreementStateToApiAgreementState(
  input: AgreementState
): ApiAgreementState {
  return match<AgreementState, ApiAgreementState>(input)
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
  input: ApiAgreementState
): AgreementState {
  return match<ApiAgreementState, AgreementState>(input)
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
): ApiAgreementDocument => ({
  id: input.id,
  name: input.name,
  prettyName: input.prettyName,
  contentType: input.contentType,
  path: input.path,
  createdAt: input.createdAt?.toJSON(),
});

export const agreementToApiAgreement = (
  agreement: Agreement
): ApiAgreement => ({
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
  input: ApiAgreementDocumentSeed
): AgreementDocument => ({
  id: unsafeBrandId(input.id),
  name: input.name,
  prettyName: input.prettyName,
  contentType: input.contentType,
  path: input.path,
  createdAt: new Date(),
});

function fromApiTenantVerifier(verifier: ApiTenantVerifier): TenantVerifier {
  return {
    id: verifier.id,
    verificationDate: new Date(verifier.verificationDate),
    expirationDate: verifier.expirationDate
      ? new Date(verifier.expirationDate)
      : undefined,
    extensionDate: verifier.extensionDate
      ? new Date(verifier.extensionDate)
      : undefined,
  };
}

function fromApiTenantRevoker(revoker: ApiTenantRevoker): TenantRevoker {
  return {
    id: revoker.id,
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
  input: ApiTenantAttribute
): TenantAttribute =>
  match<ApiTenantAttribute, TenantAttribute>(input)
    .with(
      { certified: P.nonNullable, verified: P.nullish, declared: P.nullish },
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
      { certified: P.nullish, verified: P.nonNullable, declared: P.nullish },
      ({ verified }) => ({
        type: tenantAttributeType.VERIFIED,
        id: unsafeBrandId<AttributeId>(verified.id),
        assignmentTimestamp: new Date(verified.assignmentTimestamp),
        verifiedBy: verified.verifiedBy.map(fromApiTenantVerifier),
        revokedBy: verified.revokedBy.map(fromApiTenantRevoker),
      })
    )
    .with(
      { certified: P.nullish, verified: P.nullish, declared: P.nonNullable },
      ({ declared }) => ({
        type: tenantAttributeType.DECLARED,
        id: unsafeBrandId<AttributeId>(declared.id),
        assignmentTimestamp: new Date(declared.assignmentTimestamp),
      })
    )
    .otherwise(() => {
      throw badRequestError("Invalid tenant attribute in API request");
    });

export const fromApiCompactTenant = (
  input: ApiCompactTenant
): CompactTenant => ({
  id: unsafeBrandId(input.id),
  attributes: input.attributes.map(fromApiTenantAttribute),
});
