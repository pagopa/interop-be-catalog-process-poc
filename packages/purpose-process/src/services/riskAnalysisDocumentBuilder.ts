import path from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";
import {
  FileManager,
  FormQuestionRules,
  LocalizedText,
  Logger,
  PDFGenerator,
  RiskAnalysisFormRules,
  answerNotFoundInConfigError,
  dataType,
  dateAtRomeZone,
  formatDateyyyyMMddHHmmss,
  getFormRulesByVersion,
  incompatibleConfigError,
  unexpectedEmptyAnswerError,
} from "pagopa-interop-commons";
import {
  Purpose,
  PurposeVersionDocument,
  PurposeVersionDocumentId,
  TenantKind,
  generateId,
  PurposeRiskAnalysisForm,
  eserviceMode,
  RiskAnalysisSingleAnswer,
  RiskAnalysisMultiAnswer,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import {
  missingRiskAnalysis,
  riskAnalysisConfigVersionNotFound,
} from "../model/domain/errors.js";
import { PurposeProcessConfig } from "../config/config.js";
import {
  PurposeDocumentEServiceInfo,
  RiskAnalysisDocumentPDFPayload,
} from "../model/domain/models.js";

const YES = "Sì";
const NO = "No";
const NOT_AVAILABLE = "N/A";
const CONTENT_TYPE_PDF = "application/pdf";

type Language = keyof LocalizedText;

const createRiskAnalysisDocumentName = (): string =>
  `${formatDateyyyyMMddHHmmss(new Date())}_${generateId()}_risk_analysis.pdf`;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const riskAnalysisDocumentBuilder = (
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  config: PurposeProcessConfig,
  logger: Logger
) => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);

  return {
    createRiskAnalysisDocument: async (
      purpose: Purpose,
      dailyCalls: number,
      eserviceInfo: PurposeDocumentEServiceInfo,
      tenantKind: TenantKind,
      language: Language
    ): Promise<PurposeVersionDocument> => {
      const templateFilePath = path.resolve(
        dirname,
        "..",
        "resources/templates/documents",
        "riskAnalysisTemplate.html"
      );

      if (!purpose.riskAnalysisForm) {
        throw missingRiskAnalysis(purpose.id);
      }

      const riskAnalysisVersion = purpose.riskAnalysisForm.version;

      const riskAnalysisFormConfig = getFormRulesByVersion(
        tenantKind,
        riskAnalysisVersion
      );

      if (!riskAnalysisFormConfig) {
        throw riskAnalysisConfigVersionNotFound(
          riskAnalysisVersion,
          tenantKind
        );
      }

      const pdfPayload = getPdfPayload({
        riskAnalysisFormConfig,
        riskAnalysisForm: purpose.riskAnalysisForm,
        dailyCalls,
        eserviceInfo,
        isFreeOfCharge: purpose.isFreeOfCharge,
        freeOfChargeReason: purpose.freeOfChargeReason,
        language,
      });

      const pdfBuffer: Buffer = await pdfGenerator.generate(
        templateFilePath,
        pdfPayload
      );

      const documentId = generateId<PurposeVersionDocumentId>();
      const documentName = createRiskAnalysisDocumentName();

      const documentPath = await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: config.riskAnalysisDocumentsPath,
          resourceId: documentId,
          name: documentName,
          content: pdfBuffer,
        },
        logger
      );

      return {
        id: documentId,
        contentType: CONTENT_TYPE_PDF,
        path: documentPath,
        createdAt: new Date(),
      };
    },
  };
};

const getPdfPayload = ({
  riskAnalysisFormConfig,
  riskAnalysisForm,
  dailyCalls,
  eserviceInfo,
  isFreeOfCharge,
  freeOfChargeReason,
  language,
}: {
  riskAnalysisFormConfig: RiskAnalysisFormRules;
  riskAnalysisForm: PurposeRiskAnalysisForm;
  dailyCalls: number;
  eserviceInfo: PurposeDocumentEServiceInfo;
  isFreeOfCharge: boolean;
  freeOfChargeReason?: string;
  language: Language;
}): RiskAnalysisDocumentPDFPayload => {
  const answers = formatAnswers(
    riskAnalysisFormConfig,
    riskAnalysisForm,
    language
  );
  const { freeOfChargeHtml, freeOfChargeReasonHtml } = formatFreeOfCharge(
    isFreeOfCharge,
    freeOfChargeReason
  );
  const eServiceMode = match({ mode: eserviceInfo.mode, language })
    .with({ mode: eserviceMode.receive, language: "it" }, () => "Riceve")
    .with({ mode: eserviceMode.deliver, language: "it" }, () => "Eroga")
    .with({ mode: eserviceMode.receive, language: "en" }, () => "Receives")
    .with({ mode: eserviceMode.deliver, language: "en" }, () => "Delivers")
    .exhaustive();

  return {
    dailyCalls: dailyCalls.toString(),
    answers,
    eServiceName: eserviceInfo.name,
    producerName: eserviceInfo.producerName,
    producerIpaCode: eserviceInfo.producerIpaCode,
    consumerName: eserviceInfo.consumerName,
    consumerIpaCode: eserviceInfo.consumerIpaCode,
    freeOfCharge: freeOfChargeHtml,
    freeOfChargeReason: freeOfChargeReasonHtml,
    date: dateAtRomeZone(new Date()),
    eServiceMode,
    producerDelegationId: eserviceInfo.producerDelegationId,
    producerDelegateName: eserviceInfo.producerDelegateName,
    producerDelegateIpaCode: eserviceInfo.producerDelegateIpaCode,
    consumerDelegationId: eserviceInfo.consumerDelegationId,
    consumerDelegateName: eserviceInfo.consumerDelegateName,
    consumerDelegateIpaCode: eserviceInfo.consumerDelegateIpaCode,
  };
};

function getLocalizedLabel(text: LocalizedText, language: Language): string {
  return match(language)
    .with("it", () => text.it)
    .with("en", () => text.en)
    .exhaustive();
}

function formatAnswers(
  formConfig: RiskAnalysisFormRules,
  riskAnalysisForm: PurposeRiskAnalysisForm,
  language: Language
): string {
  return formConfig.questions
    .flatMap((questionRules) => {
      const singleAnswers = riskAnalysisForm.singleAnswers
        .filter((a) => a.key === questionRules.id)
        .map((a) => formatSingleAnswer(questionRules, a, language));
      const multiAnswers = riskAnalysisForm.multiAnswers
        .filter((a) => a.key === questionRules.id)
        .map((a) => formatMultiAnswer(questionRules, a, language));
      return singleAnswers.concat(multiAnswers);
    })
    .join("\n");
}

function getSingleAnswerText(
  language: Language,
  questionRules: FormQuestionRules,
  answer: RiskAnalysisSingleAnswer
): string {
  return match(questionRules)
    .with({ dataType: dataType.freeText }, (questionConfig) => {
      if (!answer.value) {
        throw unexpectedEmptyAnswerError(questionConfig.id);
      }
      return Handlebars.escapeExpression(answer.value);
    })
    .with({ dataType: dataType.single }, (questionConfig) => {
      if (!answer.value) {
        throw unexpectedEmptyAnswerError(questionConfig.id);
      }
      const labeledValue = questionConfig.options.find(
        (q) => q.value === answer.value
      );
      if (!labeledValue) {
        throw answerNotFoundInConfigError(questionConfig.id, questionRules.id);
      }
      return getLocalizedLabel(labeledValue.label, language);
    })
    .with({ dataType: dataType.multi }, (questionConfig) => {
      throw incompatibleConfigError(questionConfig.id, questionRules.id);
    })
    .exhaustive();
}

function getMultiAnswerText(
  language: Language,
  questionRules: FormQuestionRules,
  answer: RiskAnalysisMultiAnswer
): string {
  return match(questionRules)
    .returnType<string>()
    .with(
      { dataType: P.union(dataType.freeText, dataType.single) },
      (questionConfig) => {
        throw incompatibleConfigError(questionConfig.id, questionRules.id);
      }
    )
    .with({ dataType: dataType.multi }, (questionConfig) =>
      answer.values
        .map((value) => {
          const labeledValue = questionConfig.options.find(
            (q) => q.value === value
          );
          if (!labeledValue) {
            throw answerNotFoundInConfigError(
              questionConfig.id,
              questionRules.id
            );
          }
          return getLocalizedLabel(labeledValue.label, language);
        })
        .join(", ")
    )
    .exhaustive();
}

function formatSingleAnswer(
  questionRules: FormQuestionRules,
  singleAnswer: RiskAnalysisSingleAnswer,
  language: Language
): string {
  return formatAnswer(
    questionRules,
    singleAnswer,
    language,
    getSingleAnswerText.bind(null, language)
  );
}

function formatMultiAnswer(
  questionRules: FormQuestionRules,
  multiAnswer: RiskAnalysisMultiAnswer,
  language: Language
): string {
  return formatAnswer(
    questionRules,
    multiAnswer,
    language,
    getMultiAnswerText.bind(null, language)
  );
}

function formatAnswer<T>(
  questionRules: FormQuestionRules,
  answer: T,
  language: Language,
  getAnswerText: (questionRules: FormQuestionRules, answer: T) => string
): string {
  const questionLabel = getLocalizedLabel(questionRules.label, language);
  const infoLabel =
    questionRules.infoLabel &&
    getLocalizedLabel(questionRules.infoLabel, language);
  const answerText = getAnswerText(questionRules, answer);
  return `<div class="item">
  <div class="label">${questionLabel}</div>
  ${infoLabel ? `<div class="info-label">${infoLabel}</div>` : ""}
  <div class="answer">${answerText}</div>
</div>
`;
}

function formatFreeOfCharge(
  isFreeOfCharge: boolean,
  freeOfChargeReason?: string
): { freeOfChargeHtml: string; freeOfChargeReasonHtml: string } {
  const freeOfChargeHtml = `<div class="item">
  <div class="label">Indicare se l'accesso ai dati messi a disposizione con la fruizione del presente e-service è a titolo gratuito</div>
  <div class="value">${isFreeOfCharge ? YES : NO}</div>
</div>`;

  const freeOfChargeReasonHtml = isFreeOfCharge
    ? `<div class="item">
  <div class="label">Motivazione titolo gratuito</div>
  <div class="value">${
    freeOfChargeReason
      ? Handlebars.escapeExpression(freeOfChargeReason)
      : NOT_AVAILABLE
  }</div>
</div>`
    : '<div class="item-not-visible"></div>';

  return {
    freeOfChargeHtml,
    freeOfChargeReasonHtml,
  };
}
