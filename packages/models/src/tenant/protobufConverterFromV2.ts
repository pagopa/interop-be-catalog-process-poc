import { createHash } from "crypto";
import { match } from "ts-pattern";
import { DelegationId, unsafeBrandId } from "../brandedIds.js";
import { genericError } from "../errors.js";
import {
  TenantKindV2,
  TenantMailKindV2,
  TenantMailV2,
  TenantFeatureV2,
  TenantVerifierV2,
  TenantRevokerV2,
  TenantAttributeV2,
  TenantV2,
  TenantUnitTypeV2,
} from "../gen/v2/tenant/tenant.js";
import { bigIntToDate } from "../utils.js";
import {
  TenantKind,
  tenantKind,
  TenantMailKind,
  tenantMailKind,
  TenantMail,
  TenantVerifier,
  TenantRevoker,
  TenantAttribute,
  Tenant,
  ExternalId,
  tenantAttributeType,
  TenantUnitType,
  tenantUnitType,
  TenantFeature,
} from "./tenant.js";

export const fromTenantKindV2 = (input: TenantKindV2): TenantKind => {
  switch (input) {
    case TenantKindV2.GSP:
      return tenantKind.GSP;
    case TenantKindV2.PA:
      return tenantKind.PA;
    case TenantKindV2.PRIVATE:
      return tenantKind.PRIVATE;
    case TenantKindV2.SCP:
      return tenantKind.SCP;
  }
};

export const fromTenantMailKindV2 = (
  input: TenantMailKindV2
): TenantMailKind => {
  switch (input) {
    case TenantMailKindV2.CONTACT_EMAIL:
      return tenantMailKind.ContactEmail;
    case TenantMailKindV2.DIGITAL_ADDRESS:
      return tenantMailKind.DigitalAddress;
  }
};

export const fromTenantMailV2 = (input: TenantMailV2): TenantMail => ({
  ...input,
  id: input.id ?? createHash("sha256").update(input.address).digest("hex"),
  createdAt: bigIntToDate(input.createdAt),
  kind: fromTenantMailKindV2(input.kind),
});

export const fromTenantFeatureV2 = (input: TenantFeatureV2): TenantFeature =>
  match<TenantFeatureV2["sealedValue"], TenantFeature>(input.sealedValue)
    .with({ oneofKind: "certifier" }, ({ certifier }) => ({
      type: "PersistentCertifier",
      certifierId: certifier.certifierId,
    }))
    .with({ oneofKind: "delegatedProducer" }, ({ delegatedProducer }) => ({
      type: "DelegatedProducer",
      availabilityTimestamp: bigIntToDate(
        delegatedProducer.availabilityTimestamp
      ),
    }))
    .with({ oneofKind: "delegatedConsumer" }, ({ delegatedConsumer }) => ({
      type: "DelegatedConsumer",
      availabilityTimestamp: bigIntToDate(
        delegatedConsumer.availabilityTimestamp
      ),
    }))
    .with({ oneofKind: undefined }, () => {
      throw new Error("Unable to deserialize TenantFeature");
    })
    .exhaustive();

export const fromTenantVerifierV2 = (
  input: TenantVerifierV2
): TenantVerifier => ({
  ...input,
  id: unsafeBrandId(input.id),
  delegationId: input.delegationId
    ? unsafeBrandId<DelegationId>(input.delegationId)
    : undefined,
  verificationDate: bigIntToDate(input.verificationDate),
  expirationDate: bigIntToDate(input.expirationDate),
  extensionDate: bigIntToDate(input.extensionDate),
});

export const fromTenantRevokerV2 = (input: TenantRevokerV2): TenantRevoker => ({
  ...input,
  id: unsafeBrandId(input.id),
  delegationId: input.delegationId
    ? unsafeBrandId<DelegationId>(input.delegationId)
    : undefined,
  expirationDate: bigIntToDate(input.expirationDate),
  extensionDate: bigIntToDate(input.extensionDate),
  revocationDate: bigIntToDate(input.revocationDate),
  verificationDate: bigIntToDate(input.verificationDate),
});

export const fromTenantAttributesV2 = (
  input: TenantAttributeV2
): TenantAttribute => {
  const { sealedValue } = input;

  switch (sealedValue.oneofKind) {
    case "certifiedAttribute":
      const { certifiedAttribute } = sealedValue;
      return {
        id: unsafeBrandId(certifiedAttribute.id),
        assignmentTimestamp: bigIntToDate(
          certifiedAttribute.assignmentTimestamp
        ),
        revocationTimestamp: bigIntToDate(
          certifiedAttribute.revocationTimestamp
        ),
        type: tenantAttributeType.CERTIFIED,
      };
    case "verifiedAttribute":
      const { verifiedAttribute } = sealedValue;
      return {
        id: unsafeBrandId(verifiedAttribute.id),
        assignmentTimestamp: bigIntToDate(
          verifiedAttribute.assignmentTimestamp
        ),
        verifiedBy: verifiedAttribute.verifiedBy.map(fromTenantVerifierV2),
        revokedBy: verifiedAttribute.revokedBy.map(fromTenantRevokerV2),
        type: tenantAttributeType.VERIFIED,
      };
    case "declaredAttribute":
      const { declaredAttribute } = sealedValue;
      return {
        id: unsafeBrandId(declaredAttribute.id),
        assignmentTimestamp: bigIntToDate(
          declaredAttribute.assignmentTimestamp
        ),
        revocationTimestamp: bigIntToDate(
          declaredAttribute.revocationTimestamp
        ),
        delegationId: declaredAttribute.delegationId
          ? unsafeBrandId<DelegationId>(declaredAttribute.delegationId)
          : undefined,
        type: tenantAttributeType.DECLARED,
      };
    default:
      throw genericError(`Invalid attribute kind: ${sealedValue.oneofKind}`);
  }
};

export const fromTenantUnitTypeV2 = (
  input: TenantUnitTypeV2
): TenantUnitType => {
  switch (input) {
    case TenantUnitTypeV2.AOO:
      return tenantUnitType.AOO;
    case TenantUnitTypeV2.UO:
      return tenantUnitType.UO;
  }
};

export const fromTenantV2 = (input: TenantV2): Tenant => {
  /**
   * The `externalId` field is required in the TenantV2 protobuf model but
   * for some reasons the @protobuf-ts/protoc library generates it as optional.
   * This issue has been reported here: https://github.com/timostamm/protobuf-ts/issues/340
   */
  const externalId = ExternalId.safeParse(input.externalId);
  if (!externalId.success) {
    throw genericError(
      `Error while deserializing TenantV2 (${input.id}): missing externalId`
    );
  }

  return {
    ...input,
    id: unsafeBrandId(input.id),
    name: input.name ?? "",
    createdAt: bigIntToDate(input.createdAt),
    attributes: input.attributes.map(fromTenantAttributesV2),
    externalId: externalId.data,
    features: input.features.map(fromTenantFeatureV2),
    mails: input.mails.map(fromTenantMailV2),
    kind: input.kind != null ? fromTenantKindV2(input.kind) : undefined,
    updatedAt: bigIntToDate(input.updatedAt),
    onboardedAt: bigIntToDate(input.onboardedAt),
    subUnitType:
      input.subUnitType != null
        ? fromTenantUnitTypeV2(input.subUnitType)
        : undefined,
  };
};
