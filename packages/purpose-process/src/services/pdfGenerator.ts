/* eslint-disable max-params */
/*
  IMPORTANT
  TODO: This service is a mock for the PDF generator it is used as entrypoint for the PDF generation.
  It must be substituted with the real service when it will be developed.
 */

import fs from "fs";
import path from "path";

import { FileManager } from "pagopa-interop-commons";
import {
  EServiceInfo,
  Purpose,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionDocumentId,
  RiskAnalysisPDFPayload,
  TenantKind,
  generateId,
} from "pagopa-interop-models";
import { missingRiskAnalysis } from "../model/domain/errors.js";
import { config } from "../utilities/config.js";

// TODO : implement this method following this implementation https://github.com/pagopa/interop-be-agreement-process/blob/66781549a6db2470d8c407965b7561d1fe493107/src/main/scala/it/pagopa/interop/agreementprocess/service/PDFCreator.scala#L37
const create = async (
  _template: string,
  _pdfPayload: RiskAnalysisPDFPayload
): Promise<ArrayBuffer> => Buffer.from("Mock Document", "utf8");

const riskAnalysisTemplateMock = fs
  .readFileSync(
    path.resolve(new URL(import.meta.url + "/../..").pathname) +
      "/resources/templates/documents/riskAnalysisTemplate.html"
  )
  .toString();

const createRiskAnalysisDocumentName = (): string =>
  `${new Date().toISOString()}_${generateId()}_risk_analysis.pdf`;

export const pdfGenerator = {
  createRiskAnalysisDocument: async (
    documentId: PurposeVersionDocumentId,
    purpose: Purpose,
    purposeVersion: PurposeVersion,
    eserviceInfo: EServiceInfo,
    kind: TenantKind,
    storeFile: FileManager["storeBytes"]
  ): Promise<PurposeVersionDocument> => {
    if (!purpose.riskAnalysisForm) {
      throw missingRiskAnalysis(purpose.id);
    }

    const riskAnalysisPDFPayload: RiskAnalysisPDFPayload = {
      riskAnalysisForm: purpose.riskAnalysisForm,
      dailyCalls: purposeVersion.dailyCalls,
      eserviceInfo,
      isFreeOfCharge: purpose.isFreeOfCharge,
      freeOfChargeReason: purpose.freeOfChargeReason,
      kind,
    };

    const document = await create(
      riskAnalysisTemplateMock,
      riskAnalysisPDFPayload
    );

    const documentName = createRiskAnalysisDocumentName();

    const path = await storeFile(
      config.s3Bucket,
      config.riskAnalysisDocumentsPath,
      documentId,
      documentName,
      Buffer.from(document)
    );

    return {
      id: documentId,
      contentType: "application/pdf",
      path,
      createdAt: new Date(),
    };
  },
};
