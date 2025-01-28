import {
  AgreementApprovalPolicy,
  Technology,
  agreementApprovalPolicy,
  technology,
  EServiceMode,
  eserviceMode,
  Document,
  eserviceTemplateVersionState,
  EServiceTemplateVersionState,
  EServiceTemplateVersion,
  EServiceTemplate,
} from "pagopa-interop-models";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";

export function technologyToApiTechnology(
  input: Technology
): eserviceTemplateApi.EServiceTechnology {
  return match<Technology, eserviceTemplateApi.EServiceTechnology>(input)
    .with(technology.rest, () => "REST")
    .with(technology.soap, () => "SOAP")
    .exhaustive();
}

export function apiTechnologyToTechnology(
  input: eserviceTemplateApi.EServiceTechnology
): Technology {
  return match<eserviceTemplateApi.EServiceTechnology, Technology>(input)
    .with("REST", () => technology.rest)
    .with("SOAP", () => technology.soap)
    .exhaustive();
}

export function eserviceTemplateVersionStateToApiEServiceTemplateVersionState(
  input: EServiceTemplateVersionState
): eserviceTemplateApi.EServiceTemplateVersionState {
  return match<
    EServiceTemplateVersionState,
    eserviceTemplateApi.EServiceTemplateVersionState
  >(input)
    .with(eserviceTemplateVersionState.draft, () => "DRAFT")
    .with(eserviceTemplateVersionState.published, () => "PUBLISHED")
    .with(eserviceTemplateVersionState.suspended, () => "SUSPENDED")
    .with(eserviceTemplateVersionState.deprecated, () => "DEPRECATED")
    .exhaustive();
}

export function apiEServiceTemplateVersionStateToEServiceTemplateVersionState(
  input: eserviceTemplateApi.EServiceTemplateVersionState
): EServiceTemplateVersionState {
  return match<
    eserviceTemplateApi.EServiceTemplateVersionState,
    EServiceTemplateVersionState
  >(input)
    .with("DRAFT", () => eserviceTemplateVersionState.draft)
    .with("PUBLISHED", () => eserviceTemplateVersionState.published)
    .with("SUSPENDED", () => eserviceTemplateVersionState.suspended)
    .with("DEPRECATED", () => eserviceTemplateVersionState.deprecated)
    .exhaustive();
}

export function agreementApprovalPolicyToApiAgreementApprovalPolicy(
  input: AgreementApprovalPolicy | undefined
): eserviceTemplateApi.AgreementApprovalPolicy {
  return match<
    AgreementApprovalPolicy | undefined,
    eserviceTemplateApi.AgreementApprovalPolicy
  >(input)
    .with(agreementApprovalPolicy.automatic, () => "AUTOMATIC")
    .with(agreementApprovalPolicy.manual, () => "MANUAL")
    .otherwise(() => "AUTOMATIC");
}

export function apiAgreementApprovalPolicyToAgreementApprovalPolicy(
  input: eserviceTemplateApi.AgreementApprovalPolicy | undefined
): AgreementApprovalPolicy {
  return match<
    eserviceTemplateApi.AgreementApprovalPolicy | undefined,
    AgreementApprovalPolicy
  >(input)
    .with("AUTOMATIC", () => agreementApprovalPolicy.automatic)
    .with("MANUAL", () => agreementApprovalPolicy.manual)
    .with(undefined, () => agreementApprovalPolicy.automatic)
    .exhaustive();
}

export function apiEServiceModeToEServiceMode(
  input: eserviceTemplateApi.EServiceMode
): EServiceMode {
  return match<eserviceTemplateApi.EServiceMode, EServiceMode>(input)
    .with("RECEIVE", () => eserviceMode.receive)
    .with("DELIVER", () => eserviceMode.deliver)
    .exhaustive();
}

export function eServiceModeToApiEServiceMode(
  input: EServiceMode
): eserviceTemplateApi.EServiceMode {
  return match<EServiceMode, eserviceTemplateApi.EServiceMode>(input)
    .with(eserviceMode.receive, () => "RECEIVE")
    .with(eserviceMode.deliver, () => "DELIVER")
    .exhaustive();
}

export const documentToApiDocument = (
  document: Document
): eserviceTemplateApi.EServiceDoc => ({
  id: document.id,
  name: document.name,
  contentType: document.contentType,
  prettyName: document.prettyName,
  path: document.path,
  checksum: document.checksum,
});

export const eserviceTemplateVersionToApiEServiceTemplateVersion = (
  eserviceTemplateVersion: EServiceTemplateVersion
): eserviceTemplateApi.EServiceTemplateVersion => ({
  id: eserviceTemplateVersion.id,
  version: eserviceTemplateVersion.version,
  description: eserviceTemplateVersion.description,
  voucherLifespan: eserviceTemplateVersion.voucherLifespan,
  dailyCallsPerConsumer: eserviceTemplateVersion.dailyCallsPerConsumer,
  dailyCallsTotal: eserviceTemplateVersion.dailyCallsTotal,
  interface: eserviceTemplateVersion.interface
    ? documentToApiDocument(eserviceTemplateVersion.interface)
    : undefined,
  docs: eserviceTemplateVersion.docs.map(documentToApiDocument),
  state: eserviceTemplateVersionStateToApiEServiceTemplateVersionState(
    eserviceTemplateVersion.state
  ),
  agreementApprovalPolicy: agreementApprovalPolicyToApiAgreementApprovalPolicy(
    eserviceTemplateVersion.agreementApprovalPolicy
  ),
  publishedAt: eserviceTemplateVersion.publishedAt?.toJSON(),
  suspendedAt: eserviceTemplateVersion.suspendedAt?.toJSON(),
  deprecatedAt: eserviceTemplateVersion.deprecatedAt?.toJSON(),
  attributes: {
    certified: eserviceTemplateVersion.attributes.certified,
    declared: eserviceTemplateVersion.attributes.declared,
    verified: eserviceTemplateVersion.attributes.verified,
  },
});

export const eserviceTemplateToApiEServiceTemplate = (
  eserviceTemplate: EServiceTemplate
): eserviceTemplateApi.EServiceTemplate => ({
  id: eserviceTemplate.id,
  creatorId: eserviceTemplate.creatorId,
  name: eserviceTemplate.name,
  audienceDescription: eserviceTemplate.audienceDescription,
  eserviceDescription: eserviceTemplate.eserviceDescription,
  technology: technologyToApiTechnology(eserviceTemplate.technology),
  mode: eServiceModeToApiEServiceMode(eserviceTemplate.mode),
  riskAnalysis: eserviceTemplate.riskAnalysis.map((riskAnalysis) => ({
    id: riskAnalysis.id,
    name: riskAnalysis.name,
    createdAt: riskAnalysis.createdAt.toJSON(),
    riskAnalysisForm: {
      id: riskAnalysis.riskAnalysisForm.id,
      version: riskAnalysis.riskAnalysisForm.version,
      singleAnswers: riskAnalysis.riskAnalysisForm.singleAnswers,
      multiAnswers: riskAnalysis.riskAnalysisForm.multiAnswers,
    },
  })),
  versions: eserviceTemplate.versions.map(
    eserviceTemplateVersionToApiEServiceTemplateVersion
  ),
  isSignalHubEnabled: eserviceTemplate.isSignalHubEnabled,
});
