import { bffApi, purposeApi } from "pagopa-interop-api-clients";

function toBffApiPurposeVersionDocument(
  riskAnalysis: purposeApi.PurposeVersionDocument
): bffApi.PurposeVersionDocument {
  return {
    id: riskAnalysis.id,
    contentType: riskAnalysis.contentType,
    createdAt: riskAnalysis.createdAt,
  };
}

export function toBffApiPurposeVersion(
  purposeVersion: purposeApi.PurposeVersion
): bffApi.PurposeVersion {
  return {
    id: purposeVersion.id,
    state: purposeVersion.state,
    createdAt: purposeVersion.createdAt,
    suspendedAt: purposeVersion.suspendedAt,
    updatedAt: purposeVersion.updatedAt,
    firstActivationAt: purposeVersion.firstActivationAt,
    dailyCalls: purposeVersion.dailyCalls,
    riskAnalysisDocument:
      purposeVersion.riskAnalysis &&
      toBffApiPurposeVersionDocument(purposeVersion.riskAnalysis),
    rejectionReason: purposeVersion.rejectionReason,
  };
}
