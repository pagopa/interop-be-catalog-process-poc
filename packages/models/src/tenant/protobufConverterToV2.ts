import { match } from "ts-pattern";
import {
  TenantAttributeV2,
  TenantFeatureV2,
  TenantKindV2,
  TenantMailKindV2,
  TenantMailV2,
  TenantRevokerV2,
  TenantUnitTypeV2,
  TenantV2,
  TenantVerifierV2,
  dateToBigInt,
} from "../index.js";
import {
  Tenant,
  TenantAttribute,
  TenantFeature,
  TenantKind,
  TenantMail,
  TenantMailKind,
  TenantRevoker,
  TenantUnitType,
  TenantVerifier,
  tenantAttributeType,
  tenantKind,
  tenantMailKind,
  tenantUnitType,
} from "./tenant.js";

export function toFeatureV2(feature: TenantFeature): TenantFeatureV2 {
  return match<TenantFeature, TenantFeatureV2>(feature)
    .with({ type: "PersistentCertifier" }, (feature) => ({
      sealedValue: {
        oneofKind: "certifier",
        certifier: {
          certifierId: feature.certifierId,
        },
      },
    }))
    .with({ type: "DelegatedProducer" }, (feature) => ({
      sealedValue: {
        oneofKind: "delegatedProducer",
        delegatedProducer: {
          availabilityTimestamp: dateToBigInt(feature.availabilityTimestamp),
        },
      },
    }))
    .with({ type: "DelegatedConsumer" }, (feature) => ({
      sealedValue: {
        oneofKind: "delegatedConsumer",
        delegatedConsumer: {
          availabilityTimestamp: dateToBigInt(feature.availabilityTimestamp),
        },
      },
    }))
    .exhaustive();
}

export function toTenantVerifierV2(verifier: TenantVerifier): TenantVerifierV2 {
  return {
    id: verifier.id,
    delegationId: verifier.delegationId,
    verificationDate: dateToBigInt(verifier.verificationDate),
    expirationDate: dateToBigInt(verifier.expirationDate),
    extensionDate: dateToBigInt(verifier.extensionDate),
  };
}

export function toTenantRevokerV2(revoker: TenantRevoker): TenantRevokerV2 {
  return {
    id: revoker.id,
    delegationId: revoker.delegationId,
    verificationDate: dateToBigInt(revoker.verificationDate),
    expirationDate: dateToBigInt(revoker.expirationDate),
    extensionDate: dateToBigInt(revoker.extensionDate),
    revocationDate: dateToBigInt(revoker.revocationDate),
  };
}

export function toAttributeV2(input: TenantAttribute): TenantAttributeV2 {
  return match<TenantAttribute, TenantAttributeV2>(input)
    .with({ type: tenantAttributeType.CERTIFIED }, (attribute) => ({
      sealedValue: {
        oneofKind: "certifiedAttribute",
        certifiedAttribute: {
          id: attribute.id,
          assignmentTimestamp: dateToBigInt(attribute.assignmentTimestamp),
          revocationTimestamp: dateToBigInt(attribute.revocationTimestamp),
        },
      },
    }))
    .with({ type: tenantAttributeType.VERIFIED }, (attribute) => ({
      sealedValue: {
        oneofKind: "verifiedAttribute",
        verifiedAttribute: {
          id: attribute.id,
          assignmentTimestamp: dateToBigInt(attribute.assignmentTimestamp),
          verifiedBy: attribute.verifiedBy.map(toTenantVerifierV2),
          revokedBy: attribute.revokedBy.map(toTenantRevokerV2),
        },
      },
    }))
    .with({ type: tenantAttributeType.DECLARED }, (attribute) => ({
      sealedValue: {
        oneofKind: "declaredAttribute",
        declaredAttribute: {
          id: attribute.id,
          assignmentTimestamp: dateToBigInt(attribute.assignmentTimestamp),
          revocationTimestamp: dateToBigInt(attribute.revocationTimestamp),
          delegationId: attribute.delegationId,
        },
      },
    }))
    .exhaustive();
}

export function toTenantMailV2(mail: TenantMail): TenantMailV2 {
  return {
    ...mail,
    kind: toTenantMailKindV2(mail.kind),
    createdAt: dateToBigInt(mail.createdAt),
    description: mail.description ?? undefined,
  };
}

export function toTenantMailKindV2(kind: TenantMailKind): TenantMailKindV2 {
  return match(kind)
    .with(tenantMailKind.ContactEmail, () => TenantMailKindV2.CONTACT_EMAIL)
    .with(tenantMailKind.DigitalAddress, () => TenantMailKindV2.DIGITAL_ADDRESS)
    .exhaustive();
}

export function toTenantKindV2(input: TenantKind): TenantKindV2 {
  return match<TenantKind, TenantKindV2>(input)
    .with(tenantKind.GSP, () => TenantKindV2.GSP)
    .with(tenantKind.PA, () => TenantKindV2.PA)
    .with(tenantKind.PRIVATE, () => TenantKindV2.PRIVATE)
    .with(tenantKind.SCP, () => TenantKindV2.SCP)
    .exhaustive();
}

export function toTenantUnitTypeV2(input: TenantUnitType): TenantUnitTypeV2 {
  return match<TenantUnitType, TenantUnitTypeV2>(input)
    .with(tenantUnitType.AOO, () => TenantUnitTypeV2.AOO)
    .with(tenantUnitType.UO, () => TenantUnitTypeV2.UO)
    .exhaustive();
}

function checkSelfcareId(selfcareId: string | undefined): string {
  if (selfcareId === undefined) {
    throw new Error("SelfcareId can't be undefined");
  }
  return selfcareId;
}

export const toTenantV2 = (tenant: Tenant): TenantV2 => ({
  ...tenant,
  selfcareId: checkSelfcareId(tenant.selfcareId),
  features: tenant.features.map(toFeatureV2),
  attributes: tenant.attributes.map(toAttributeV2),
  createdAt: dateToBigInt(tenant.createdAt),
  updatedAt: dateToBigInt(tenant.updatedAt),
  mails: tenant.mails.map(toTenantMailV2),
  kind: tenant.kind ? toTenantKindV2(tenant.kind) : undefined,
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  onboardedAt: dateToBigInt(tenant.onboardedAt!),
  subUnitType: tenant.subUnitType
    ? toTenantUnitTypeV2(tenant.subUnitType)
    : undefined,
});
