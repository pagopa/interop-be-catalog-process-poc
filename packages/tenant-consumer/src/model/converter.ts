import {
  PersistentTenant,
  PersistentTenantAttribute,
  PersistentTenantVerifier,
  PersistentTenantRevoker,
  TenantAttributeV1,
  TenantRevokerV1,
  TenantV1,
  TenantVerifierV1,
  TenantFeatureV1,
  PersistentTenantFeature,
  TenantMailV1,
  PersistentTenantMail,
  TenantMailKindV1,
  PersistentTenantMailKind,
  persistentTenantMailKind,
  TenantKindV1,
  PersistentTenantKind,
  persistentTenantKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export const fromTenantKindV1 = (input: TenantKindV1): PersistentTenantKind => {
  switch (input) {
    case TenantKindV1.GSP:
      return persistentTenantKind.gsp;
    case TenantKindV1.PA:
      return persistentTenantKind.pa;
    case TenantKindV1.PRIVATE:
      return persistentTenantKind.private;
    case TenantKindV1.UNSPECIFIED$:
      throw new Error("Unspecified tenant kind");
  }
};

export const fromTenantMailKindV1 = (
  input: TenantMailKindV1
): PersistentTenantMailKind => {
  switch (input) {
    case TenantMailKindV1.CONTACT_EMAIL:
      return persistentTenantMailKind.contactMail;
    case TenantMailKindV1.UNSPECIFIED$:
      throw new Error("Unspecified tenant mail kind");
  }
};

export const fromTenantMailV1 = (
  input: TenantMailV1
): PersistentTenantMail => ({
  address: input.address,
  description: input.description,
  createdAt: new Date(Number(input.createdAt)),
  kind: fromTenantMailKindV1(input.kind),
});

export const fromTenantFeatureV1 = (
  input: TenantFeatureV1
): PersistentTenantFeature =>
  match<TenantFeatureV1["sealedValue"], PersistentTenantFeature>(
    input.sealedValue
  )
    .with({ oneofKind: "certifier" }, ({ certifier }) => ({
      type: "PersistentCertifier",
      certifierId: certifier.certifierId,
    }))
    .with({ oneofKind: undefined }, () => {
      throw new Error("Unable to deserialize PersistentTenantFeature");
    })
    .exhaustive();

export const fromTenantVerifierV1 = (
  input: TenantVerifierV1
): PersistentTenantVerifier => ({
  id: input.id,
  verificationDate: new Date(Number(input.verificationDate)),
  expirationDate: input.expirationDate
    ? new Date(Number(input.expirationDate))
    : undefined,
  extensionDate: input.extensionDate
    ? new Date(Number(input.extensionDate))
    : undefined,
});

export const fromTenantRevokerV1 = (
  input: TenantRevokerV1
): PersistentTenantRevoker => ({
  id: input.id,
  expirationDate: input.expirationDate
    ? new Date(Number(input.expirationDate))
    : undefined,
  extensionDate: input.extensionDate
    ? new Date(Number(input.extensionDate))
    : undefined,
  revocationDate: new Date(Number(input.revocationDate)),
  verificationDate: new Date(Number(input.verificationDate)),
});

export const fromTenantAttributesV1 = (
  input: TenantAttributeV1
): PersistentTenantAttribute =>
  match<TenantAttributeV1["sealedValue"], PersistentTenantAttribute>(
    input.sealedValue
  )
    .with({ oneofKind: "certifiedAttribute" }, ({ certifiedAttribute }) => ({
      id: certifiedAttribute.id,
      assignmentTimestamp: new Date(
        Number(certifiedAttribute.assignmentTimestamp)
      ),
      type: "PersistentCertifiedAttribute",
    }))
    .with({ oneofKind: "verifiedAttribute" }, ({ verifiedAttribute }) => ({
      id: verifiedAttribute.id,
      assignmentTimestamp: new Date(
        Number(verifiedAttribute.assignmentTimestamp)
      ),
      verifiedBy: verifiedAttribute.verifiedBy.map(fromTenantVerifierV1),
      revokedBy: verifiedAttribute.revokedBy.map(fromTenantRevokerV1),
      type: "PersistentVerifiedAttribute",
    }))
    .with({ oneofKind: "declaredAttribute" }, ({ declaredAttribute }) => ({
      id: declaredAttribute.id,
      assignmentTimestamp: new Date(
        Number(declaredAttribute.assignmentTimestamp)
      ),
      type: "PersistentDeclaredAttribute",
    }))
    .otherwise(() => {
      throw new Error("Booom"); // Ported "as is" from Scala codebase :D
    });

export const fromTenantV1 = (input: TenantV1): PersistentTenant => {
  /**
   * The `externalId` field is required in the TenantV1 protobuf model but
   * for some reasons the @protobuf-ts/protoc library generates it as optional.
   * This issue has been reported here: https://github.com/timostamm/protobuf-ts/issues/340
   */
  if (!input.externalId) {
    throw new Error(
      `Error while deserializing TenantV1 (${input.id}): missing externalId`
    );
  }

  return {
    id: input.id,
    selfcareId: input.selfcareId,
    name: input.name ?? "",
    createdAt: new Date(Number(input.createdAt)),
    attributes: input.attributes.map(fromTenantAttributesV1),
    externalId: input.externalId,
    features: input.features.map(fromTenantFeatureV1),
    mails: input.mails.map(fromTenantMailV1),
    kind: input.kind ? fromTenantKindV1(input.kind) : undefined,
    updatedAt: input.updatedAt ? new Date(Number(input.updatedAt)) : undefined,
  };
};
