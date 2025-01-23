import { match } from "ts-pattern";
import { dateToBigInt } from "../utils.js";
import {
  EServiceTemplateV2,
  EServiceTemplateVersionStateV2,
  EServiceTemplateVersionV2,
} from "../gen/v2/eservice-template/eservice-template.js";
import {
  toAgreementApprovalPolicyV2,
  toDocumentV2,
  toEServiceAttributeV2,
  toEServiceModeV2,
  toEServiceTechnologyV2,
  toRiskAnalysisV2,
} from "../eservice/protobufConverterToV2.js";
import {
  EServiceTemplate,
  EServiceTemplateVersion,
  EServiceTemplateVersionState,
  eserviceTemplateVersionState,
} from "./eserviceTemplate.js";

export const toEServiceTemplateVersionStateV2 = (
  state: EServiceTemplateVersionState
): EServiceTemplateVersionStateV2 =>
  match(state)
    .with(
      eserviceTemplateVersionState.published,
      () => EServiceTemplateVersionStateV2.PUBLISHED
    )
    .with(
      eserviceTemplateVersionState.draft,
      () => EServiceTemplateVersionStateV2.DRAFT
    )
    .with(
      eserviceTemplateVersionState.suspended,
      () => EServiceTemplateVersionStateV2.SUSPENDED
    )
    .with(
      eserviceTemplateVersionState.deprecated,
      () => EServiceTemplateVersionStateV2.DEPRECATED
    )
    .exhaustive();

export const toEServiceTemplateVersionV2 = (
  input: EServiceTemplateVersion
): EServiceTemplateVersionV2 => ({
  ...input,
  version: BigInt(input.version),
  attributes: {
    certified: input.attributes.certified.map(toEServiceAttributeV2),
    declared: input.attributes.declared.map(toEServiceAttributeV2),
    verified: input.attributes.verified.map(toEServiceAttributeV2),
  },
  docs: input.docs.map(toDocumentV2),
  state: toEServiceTemplateVersionStateV2(input.state),
  interface:
    input.interface != null ? toDocumentV2(input.interface) : undefined,
  agreementApprovalPolicy: toAgreementApprovalPolicyV2(
    input.agreementApprovalPolicy
  ),
  createdAt: dateToBigInt(input.createdAt),
  publishedAt: dateToBigInt(input.publishedAt),
  suspendedAt: dateToBigInt(input.suspendedAt),
  deprecatedAt: dateToBigInt(input.deprecatedAt),
});

export const toEServiceTemplateV2 = (
  input: EServiceTemplate
): EServiceTemplateV2 => ({
  ...input,
  technology: toEServiceTechnologyV2(input.technology),
  versions: input.versions.map(toEServiceTemplateVersionV2),
  createdAt: dateToBigInt(input.createdAt),
  mode: toEServiceModeV2(input.mode),
  riskAnalysis: input.riskAnalysis.map(toRiskAnalysisV2),
});
