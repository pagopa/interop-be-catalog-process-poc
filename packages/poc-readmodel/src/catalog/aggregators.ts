import {
  DocumentSQL,
  Document,
  attributeKind,
  Descriptor,
  DescriptorAttributeSQL,
  DescriptorSQL,
  documentKind,
  EServiceAttribute,
  EServiceSQL,
  EService,
  EserviceRiskAnalysisSQL,
  RiskAnalysisAnswerSQL,
  RiskAnalysis,
  riskAnalysisAnswerKind,
  RiskAnalysisSingleAnswer,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisMultiAnswer,
  RiskAnalysisMultiAnswerId,
  WithMetadata,
} from "pagopa-interop-models";

export const documentSQLtoDocument = (input: DocumentSQL): Document => {
  const d: Document = {
    id: input.id,
    path: input.path,
    name: input.name,
    prettyName: input.pretty_name,
    contentType: input.content_type,
    checksum: input.checksum,
    uploadDate: input.upload_date || undefined,
  };

  return d;
};

export const descriptorSQLtoDescriptor = (
  input: DescriptorSQL,
  documentsSQL: DocumentSQL[],
  attributesSQL: DescriptorAttributeSQL[]
): Descriptor => {
  const interfaceSQL = documentsSQL.find(
    (d) => d.document_kind === documentKind.descriptorInterface
  );

  const docsSQL = documentsSQL.filter(
    (d) => d.document_kind === documentKind.descriptorDocument
  );
  const parsedInterface = interfaceSQL
    ? documentSQLtoDocument(interfaceSQL)
    : undefined;

  const certifiedAttributesSQL = attributesSQL.filter(
    (a) => a.kind === attributeKind.certified
  );
  const declaredAttributesSQL = attributesSQL.filter(
    (a) => a.kind === attributeKind.declared
  );
  const verifiedAttributesSQL = attributesSQL.filter(
    (a) => a.kind === attributeKind.verified
  );

  const certifiedAttributes = attributesSQLtoAttributes(certifiedAttributesSQL);
  const declaredAttributes = attributesSQLtoAttributes(declaredAttributesSQL);
  const verifiedAttributes = attributesSQLtoAttributes(verifiedAttributesSQL);

  // console.log(certifiedAttrMap);
  const d: Descriptor = {
    id: input.id,
    version: input.version,
    description: input.description || undefined,
    interface: parsedInterface,
    docs: docsSQL.map(documentSQLtoDocument),
    state: input.state,
    audience: input.audience,
    voucherLifespan: input.voucher_lifespan,
    dailyCallsPerConsumer: input.daily_calls_per_consumer,
    dailyCallsTotal: input.daily_calls_total,
    agreementApprovalPolicy: input.agreement_approval_policy,
    createdAt: input.created_at,
    serverUrls: input.server_urls,
    publishedAt: input.published_at || undefined,
    suspendedAt: input.suspended_at || undefined,
    deprecatedAt: input.deprecated_at || undefined,
    archivedAt: input.archived_at || undefined,
    attributes: {
      certified: certifiedAttributes,
      declared: declaredAttributes,
      verified: verifiedAttributes,
    },
  };
  // console.log(d);
  return d;
};

export const eserviceSQLtoEservice = (
  eserviceSQL: EServiceSQL,
  riskAnalysisSQL: EserviceRiskAnalysisSQL[],
  riskAnalysisAnswersSQL: RiskAnalysisAnswerSQL[],
  descriptorsSQL: DescriptorSQL[],
  documentsSQL: DocumentSQL[],
  attributesSQL: DescriptorAttributeSQL[]
  // eslint-disable-next-line max-params
): WithMetadata<EService> => {
  const descriptors = descriptorsSQL.map((descriptor) =>
    descriptorSQLtoDescriptor(
      descriptor,
      documentsSQL.filter((d) => d.descriptor_id === descriptor.id),
      attributesSQL.filter((a) => a.descriptor_id === descriptor.id)
    )
  );

  const riskAnalysis = riskAnalysisSQL.map((ra) =>
    riskAnalysisSQLtoRiskAnalysis(
      ra,
      riskAnalysisAnswersSQL.filter(
        (answer) => answer.risk_analysis_form_id === ra.risk_analysis_form_id
      )
    )
  );
  const eservice: EService = {
    name: eserviceSQL.name,
    id: eserviceSQL.id,
    createdAt: eserviceSQL.created_at || undefined,
    producerId: eserviceSQL.producer_id,
    description: eserviceSQL.description,
    technology: eserviceSQL.technology,
    descriptors,
    riskAnalysis,
    mode: eserviceSQL.mode,
  };
  return {
    data: eservice,
    metadata: { version: eserviceSQL.version },
  };
};

export const eserviceSQLArraytoEserviceArray = (
  eservicesSQL: EServiceSQL[],
  riskAnalysisSQL: EserviceRiskAnalysisSQL[],
  riskAnalysisAnswers: RiskAnalysisAnswerSQL[],
  descriptorsSQL: DescriptorSQL[],
  documentsSQL: DocumentSQL[],
  attributesSQL: DescriptorAttributeSQL[]
  // eslint-disable-next-line max-params
): Array<WithMetadata<EService>> =>
  eservicesSQL.map((eservice) => {
    const riskAnalysisSQLOfCurrentEservice = riskAnalysisSQL.filter(
      (ra) => ra.eservice_id === eservice.id
    );

    const formIds = riskAnalysisSQLOfCurrentEservice.map(
      (ra) => ra.risk_analysis_form_id
    );

    const riskAnalysisAnswersSQLOfCurrentEservice = riskAnalysisAnswers.filter(
      (ra) => formIds.includes(ra.risk_analysis_form_id)
    );

    const descriptorsSQLOfCurrentEservice = descriptorsSQL.filter(
      (d) => d.eservice_id === eservice.id
    );
    const descriptorsIds = descriptorsSQL.map((d) => d.id);

    const documentsSQLOfCurrentEservice = documentsSQL.filter((doc) =>
      descriptorsIds.includes(doc.descriptor_id)
    );

    const attributesSQLOfCurrentEservice = attributesSQL.filter((attr) =>
      descriptorsIds.includes(attr.descriptor_id)
    );

    return eserviceSQLtoEservice(
      eservice,
      riskAnalysisSQLOfCurrentEservice,
      riskAnalysisAnswersSQLOfCurrentEservice,
      descriptorsSQLOfCurrentEservice,
      documentsSQLOfCurrentEservice,
      attributesSQLOfCurrentEservice
    );
  });

export const riskAnalysisSQLtoRiskAnalysis = (
  riskAnalysisSQL: EserviceRiskAnalysisSQL,
  answers: RiskAnalysisAnswerSQL[]
): RiskAnalysis => {
  const singleAnswers = answers
    .filter((a) => a.kind === riskAnalysisAnswerKind.single)
    .map(
      (a) =>
        ({
          id: a.id as RiskAnalysisSingleAnswerId,
          key: a.key,
          value: a.value[0],
        } satisfies RiskAnalysisSingleAnswer)
    );

  const multiAnswers = answers
    .filter((a) => a.kind === riskAnalysisAnswerKind.multi)
    .map(
      (a) =>
        ({
          id: a.id as RiskAnalysisMultiAnswerId,
          key: a.key,
          values: a.value,
        } satisfies RiskAnalysisMultiAnswer)
    );

  const riskAnalysis: RiskAnalysis = {
    name: riskAnalysisSQL.name,
    id: riskAnalysisSQL.risk_analysis_id,
    createdAt: riskAnalysisSQL.created_at,
    riskAnalysisForm: {
      version: riskAnalysisSQL.risk_analysis_form_version,
      id: riskAnalysisSQL.risk_analysis_form_id,
      singleAnswers,
      multiAnswers,
    },
  };
  return riskAnalysis;
};

export const attributesSQLtoAttributes = (
  attributesSQL: DescriptorAttributeSQL[]
): EServiceAttribute[][] => {
  const certifiedAttrMap = new Map<number, EServiceAttribute[]>();
  attributesSQL.forEach((current) => {
    const currentAttribute: EServiceAttribute = {
      id: current.attribute_id,
      explicitAttributeVerification: current.explicit_attribute_verification,
    };
    const group = certifiedAttrMap.get(current.group_set);
    if (group) {
      certifiedAttrMap.set(current.group_set, [...group, currentAttribute]);
    } else {
      certifiedAttrMap.set(current.group_set, [currentAttribute]);
    }
  });

  return Array.from(certifiedAttrMap.values());
};
