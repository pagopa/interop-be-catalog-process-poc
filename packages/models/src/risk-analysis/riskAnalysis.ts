import { z } from "zod";
import {
  EServiceId,
  RiskAnalysisFormId,
  RiskAnalysisId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
} from "../brandedIds.js";

export const RiskAnalysisSingleAnswer = z.object({
  id: RiskAnalysisSingleAnswerId,
  key: z.string(),
  value: z.string().optional(),
});
export type RiskAnalysisSingleAnswer = z.infer<typeof RiskAnalysisSingleAnswer>;

export const RiskAnalysisMultiAnswer = z.object({
  id: RiskAnalysisMultiAnswerId,
  key: z.string(),
  values: z.array(z.string()),
});
export type RiskAnalysisMultiAnswer = z.infer<typeof RiskAnalysisMultiAnswer>;

export const RiskAnalysisForm = z.object({
  id: RiskAnalysisFormId,
  version: z.string(),
  singleAnswers: z.array(RiskAnalysisSingleAnswer),
  multiAnswers: z.array(RiskAnalysisMultiAnswer),
});
export type RiskAnalysisForm = z.infer<typeof RiskAnalysisForm>;

export const PurposeRiskAnalysisForm = RiskAnalysisForm.and(
  z.object({
    riskAnalysisId: RiskAnalysisId.optional(),
  })
);

export type PurposeRiskAnalysisForm = z.infer<typeof PurposeRiskAnalysisForm>;

export const RiskAnalysis = z.object({
  id: RiskAnalysisId,
  name: z.string(),
  riskAnalysisForm: RiskAnalysisForm,
  createdAt: z.coerce.date(),
});
export type RiskAnalysis = z.infer<typeof RiskAnalysis>;

export const EserviceRiskAnalysisSQL = z.object({
  risk_analysis_id: RiskAnalysisId,
  eservice_id: EServiceId,
  name: z.string(),
  created_at: z.coerce.date(),
  risk_analysis_form_id: RiskAnalysisFormId,
  risk_analysis_form_version: z.string(),
});
export type EserviceRiskAnalysisSQL = z.infer<typeof EserviceRiskAnalysisSQL>;

export const riskAnalysisAnswerKind = {
  single: "SINGLE",
  multi: "MULTI",
} as const;
export const RiskAnalysisAnswerKind = z.enum([
  Object.values(riskAnalysisAnswerKind)[0],
  ...Object.values(riskAnalysisAnswerKind).slice(1),
]);
export type RiskAnalysisAnswerKind = z.infer<typeof RiskAnalysisAnswerKind>;

export const RiskAnalysisAnswerSQL = z.object({
  id: RiskAnalysisSingleAnswerId.or(RiskAnalysisMultiAnswerId),
  risk_analysis_form_id: RiskAnalysisFormId,
  kind: RiskAnalysisAnswerKind,
  key: z.string(),
  value: z.array(z.string()),
});
export type RiskAnalysisAnswerSQL = z.infer<typeof RiskAnalysisAnswerSQL>;

// export const RiskAnalysisMultiAnswerSQL = z.object({
//   id: RiskAnalysisMultiAnswerId,
//   riskAnalysisFormId: RiskAnalysisFormId,
//   key: z.string(),
//   values: z.array(z.string()),
// });
// export type RiskAnalysisMultiAnswerSQL = z.infer<
//   typeof RiskAnalysisMultiAnswerSQL
// >;
