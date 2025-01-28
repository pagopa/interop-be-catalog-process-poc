import {
  AgreementApprovalPolicy,
  DescriptorState,
  EService,
  AgreementState,
  agreementState,
  Technology,
  agreementApprovalPolicy,
  descriptorState,
  technology,
  EServiceMode,
  eserviceMode,
  Descriptor,
  Document,
} from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";

export function technologyToApiTechnology(
  input: Technology
): catalogApi.EServiceTechnology {
  return match<Technology, catalogApi.EServiceTechnology>(input)
    .with(technology.rest, () => "REST")
    .with(technology.soap, () => "SOAP")
    .exhaustive();
}

export function apiTechnologyToTechnology(
  input: catalogApi.EServiceTechnology
): Technology {
  return match<catalogApi.EServiceTechnology, Technology>(input)
    .with("REST", () => technology.rest)
    .with("SOAP", () => technology.soap)
    .exhaustive();
}

export function descriptorStateToApiEServiceDescriptorState(
  input: DescriptorState
): catalogApi.EServiceDescriptorState {
  return match<DescriptorState, catalogApi.EServiceDescriptorState>(input)
    .with(descriptorState.draft, () => "DRAFT")
    .with(descriptorState.published, () => "PUBLISHED")
    .with(descriptorState.suspended, () => "SUSPENDED")
    .with(descriptorState.deprecated, () => "DEPRECATED")
    .with(descriptorState.archived, () => "ARCHIVED")
    .with(descriptorState.waitingForApproval, () => "WAITING_FOR_APPROVAL")
    .exhaustive();
}

export function apiDescriptorStateToDescriptorState(
  input: catalogApi.EServiceDescriptorState
): DescriptorState {
  return match<catalogApi.EServiceDescriptorState, DescriptorState>(input)
    .with("DRAFT", () => descriptorState.draft)
    .with("PUBLISHED", () => descriptorState.published)
    .with("SUSPENDED", () => descriptorState.suspended)
    .with("DEPRECATED", () => descriptorState.deprecated)
    .with("ARCHIVED", () => descriptorState.archived)
    .with("WAITING_FOR_APPROVAL", () => descriptorState.waitingForApproval)
    .exhaustive();
}

export function agreementApprovalPolicyToApiAgreementApprovalPolicy(
  input: AgreementApprovalPolicy | undefined
): catalogApi.AgreementApprovalPolicy {
  return match<
    AgreementApprovalPolicy | undefined,
    catalogApi.AgreementApprovalPolicy
  >(input)
    .with(agreementApprovalPolicy.automatic, () => "AUTOMATIC")
    .with(agreementApprovalPolicy.manual, () => "MANUAL")
    .otherwise(() => "AUTOMATIC");
}

export function apiAgreementApprovalPolicyToAgreementApprovalPolicy(
  input: catalogApi.AgreementApprovalPolicy
): AgreementApprovalPolicy {
  return match<catalogApi.AgreementApprovalPolicy, AgreementApprovalPolicy>(
    input
  )
    .with("AUTOMATIC", () => agreementApprovalPolicy.automatic)
    .with("MANUAL", () => agreementApprovalPolicy.manual)
    .exhaustive();
}

export function agreementStateToApiAgreementState(
  input: AgreementState
): catalogApi.AgreementState {
  return match<AgreementState, catalogApi.AgreementState>(input)
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
  input: catalogApi.AgreementState
): AgreementState {
  return match<catalogApi.AgreementState, AgreementState>(input)
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

export function apiEServiceModeToEServiceMode(
  input: catalogApi.EServiceMode
): EServiceMode {
  return match<catalogApi.EServiceMode, EServiceMode>(input)
    .with("RECEIVE", () => eserviceMode.receive)
    .with("DELIVER", () => eserviceMode.deliver)
    .exhaustive();
}

export function eServiceModeToApiEServiceMode(
  input: EServiceMode
): catalogApi.EServiceMode {
  return match<EServiceMode, catalogApi.EServiceMode>(input)
    .with(eserviceMode.receive, () => "RECEIVE")
    .with(eserviceMode.deliver, () => "DELIVER")
    .exhaustive();
}

export const documentToApiDocument = (
  document: Document
): catalogApi.EServiceDoc => ({
  id: document.id,
  name: document.name,
  contentType: document.contentType,
  prettyName: document.prettyName,
  path: document.path,
  checksum: document.checksum,
});

export const descriptorToApiDescriptor = (
  descriptor: Descriptor
): catalogApi.EServiceDescriptor => ({
  id: descriptor.id,
  version: descriptor.version,
  description: descriptor.description,
  audience: descriptor.audience,
  voucherLifespan: descriptor.voucherLifespan,
  dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
  dailyCallsTotal: descriptor.dailyCallsTotal,
  interface: descriptor.interface
    ? documentToApiDocument(descriptor.interface)
    : undefined,
  docs: descriptor.docs.map(documentToApiDocument),
  state: descriptorStateToApiEServiceDescriptorState(descriptor.state),
  agreementApprovalPolicy: agreementApprovalPolicyToApiAgreementApprovalPolicy(
    descriptor.agreementApprovalPolicy
  ),
  serverUrls: descriptor.serverUrls,
  publishedAt: descriptor.publishedAt?.toJSON(),
  suspendedAt: descriptor.suspendedAt?.toJSON(),
  deprecatedAt: descriptor.deprecatedAt?.toJSON(),
  archivedAt: descriptor.archivedAt?.toJSON(),
  attributes: {
    certified: descriptor.attributes.certified,
    declared: descriptor.attributes.declared,
    verified: descriptor.attributes.verified,
  },
  rejectionReasons: descriptor.rejectionReasons?.map((reason) => ({
    rejectionReason: reason.rejectionReason,
    rejectedAt: reason.rejectedAt.toJSON(),
  })),
});

export const eServiceToApiEService = (
  eservice: EService
): catalogApi.EService => ({
  id: eservice.id,
  producerId: eservice.producerId,
  name: eservice.name,
  description: eservice.description,
  technology: technologyToApiTechnology(eservice.technology),
  mode: eServiceModeToApiEServiceMode(eservice.mode),
  riskAnalysis: eservice.riskAnalysis.map((riskAnalysis) => ({
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
  descriptors: eservice.descriptors.map(descriptorToApiDescriptor),
  isSignalHubEnabled: eservice.isSignalHubEnabled,
});
