import {
  EService,
  EServiceSQL,
  DescriptorSQL,
  DescriptorAttributeSQL,
  DocumentSQL,
  Descriptor,
  attributeKind,
  documentKind,
  EServiceId,
  EServiceAttribute,
  DescriptorId,
  Document,
  DocumentKind,
  RiskAnalysis,
  EserviceRiskAnalysisSQL,
  RiskAnalysisAnswerSQL,
  riskAnalysisAnswerKind,
  AttributeKind,
} from "pagopa-interop-models";

export const splitEserviceIntoObjectsSQL = (
  eservice: EService,
  version: number
): {
  eserviceSQL: EServiceSQL;
  riskAnalysisSQL: EserviceRiskAnalysisSQL[];
  riskAnalysisAnswersSQL: RiskAnalysisAnswerSQL[];
  descriptorsSQL: DescriptorSQL[];
  attributesSQL: DescriptorAttributeSQL[];
  documentsSQL: DocumentSQL[];
} => {
  const eserviceSQL: EServiceSQL = {
    name: eservice.name,
    id: eservice.id,
    created_at: eservice.createdAt,
    producer_id: eservice.producerId,
    description: eservice.description,
    technology: eservice.technology,
    mode: eservice.mode,
    version,
  };

  const { riskAnalysisSQL, riskAnalysisAnswersSQL } =
    eservice.riskAnalysis.reduce(
      (
        acc: {
          riskAnalysisSQL: EserviceRiskAnalysisSQL[];
          riskAnalysisAnswersSQL: RiskAnalysisAnswerSQL[];
        },
        currentRiskAnalysis: RiskAnalysis
      ) => {
        const { eserviceRiskAnalysisSQL, riskAnalysisAnswersSQL } =
          splitRiskAnalysisIntoObjectsSQL(currentRiskAnalysis, eservice.id);
        return {
          riskAnalysisSQL: acc.riskAnalysisSQL.concat(eserviceRiskAnalysisSQL),
          riskAnalysisAnswersSQL: acc.riskAnalysisAnswersSQL.concat(
            riskAnalysisAnswersSQL
          ),
        };
      },
      {
        riskAnalysisSQL: [],
        riskAnalysisAnswersSQL: [],
      }
    );

  const { descriptorsSQL, attributesSQL, documentsSQL } =
    eservice.descriptors.reduce(
      (
        acc: {
          descriptorsSQL: DescriptorSQL[];
          attributesSQL: DescriptorAttributeSQL[];
          documentsSQL: DocumentSQL[];
        },
        currentDescriptor: Descriptor
      ) => {
        const { descriptorSQL, attributesSQL, documentsSQL } =
          splitDescriptorIntoObjectsSQL(eservice.id, currentDescriptor);

        return {
          descriptorsSQL: acc.descriptorsSQL.concat([descriptorSQL]),
          attributesSQL: acc.attributesSQL.concat(attributesSQL),
          documentsSQL: acc.documentsSQL.concat(documentsSQL),
        };
      },
      { descriptorsSQL: [], attributesSQL: [], documentsSQL: [] }
    );

  return {
    eserviceSQL,
    riskAnalysisSQL,
    riskAnalysisAnswersSQL,
    descriptorsSQL,
    attributesSQL,
    documentsSQL,
  };
};

const attributeToAttributeSQL = ({
  attribute,
  descriptorId,
  group_set,
  kind,
}: {
  attribute: EServiceAttribute;
  descriptorId: DescriptorId;
  group_set: number;
  kind: AttributeKind;
}): DescriptorAttributeSQL => ({
  attribute_id: attribute.id,
  descriptor_id: descriptorId,
  explicit_attribute_verification: attribute.explicitAttributeVerification,
  kind,
  group_set,
});

const attributesNestedArrayToAttributeSQLarray = (
  descriptorId: DescriptorId,
  attributes: EServiceAttribute[][],
  kind: AttributeKind
): DescriptorAttributeSQL[] =>
  attributes.flatMap((group, index) =>
    group.map((attribute) =>
      attributeToAttributeSQL({
        attribute,
        descriptorId,
        group_set: index,
        kind,
      })
    )
  );

export const splitDescriptorIntoObjectsSQL = (
  eserviceId: EServiceId,
  descriptor: Descriptor
): {
  descriptorSQL: DescriptorSQL;
  attributesSQL: DescriptorAttributeSQL[];
  documentsSQL: DocumentSQL[];
} => {
  const descriptorSQL = descriptorToDescriptorSQL(eserviceId, descriptor);

  const attributesSQL = [
    ...attributesNestedArrayToAttributeSQLarray(
      descriptor.id,
      descriptor.attributes.certified,
      attributeKind.certified
    ),
    ...attributesNestedArrayToAttributeSQLarray(
      descriptor.id,
      descriptor.attributes.declared,
      attributeKind.declared
    ),
    ...attributesNestedArrayToAttributeSQLarray(
      descriptor.id,
      descriptor.attributes.verified,
      attributeKind.verified
    ),
  ];
  const interfaceSQL = descriptor.interface
    ? documentToDocumentSQL(
        descriptor.interface,
        documentKind.descriptorInterface,
        descriptor.id
      )
    : undefined;

  const documentsSQL = descriptor.docs.map((doc) =>
    documentToDocumentSQL(doc, documentKind.descriptorInterface, descriptor.id)
  );
  return {
    descriptorSQL,
    attributesSQL,
    documentsSQL: interfaceSQL ? [interfaceSQL, ...documentsSQL] : documentsSQL,
  };
};

export const splitRiskAnalysisIntoObjectsSQL = (
  riskAnalysis: RiskAnalysis,
  eserviceId: EServiceId
): {
  eserviceRiskAnalysisSQL: EserviceRiskAnalysisSQL;
  riskAnalysisAnswersSQL: RiskAnalysisAnswerSQL[];
} => {
  const eserviceRiskAnalysisSQL: EserviceRiskAnalysisSQL = {
    risk_analysis_id: riskAnalysis.id,
    eservice_id: eserviceId,
    name: riskAnalysis.name,
    created_at: riskAnalysis.createdAt,
    risk_analysis_form_id: riskAnalysis.riskAnalysisForm.id,
    risk_analysis_form_version: riskAnalysis.riskAnalysisForm.version,
  };

  const riskAnalysisSingleAnwers: RiskAnalysisAnswerSQL[] =
    riskAnalysis.riskAnalysisForm.singleAnswers.map(
      (a) =>
        ({
          id: a.id,
          key: a.key,
          value: a.value ? [a.value] : [],
          risk_analysis_form_id: riskAnalysis.riskAnalysisForm.id,
          kind: riskAnalysisAnswerKind.single,
        } satisfies RiskAnalysisAnswerSQL)
    );
  const riskAnalysisMultiAnwers: RiskAnalysisAnswerSQL[] =
    riskAnalysis.riskAnalysisForm.multiAnswers.map(
      (a) =>
        ({
          id: a.id,
          key: a.key,
          value: a.values,
          risk_analysis_form_id: riskAnalysis.riskAnalysisForm.id,
          kind: riskAnalysisAnswerKind.multi,
        } satisfies RiskAnalysisAnswerSQL)
    );

  return {
    eserviceRiskAnalysisSQL,
    riskAnalysisAnswersSQL: [
      ...riskAnalysisSingleAnwers,
      ...riskAnalysisMultiAnwers,
    ],
  };
};

export const documentToDocumentSQL = (
  document: Document,
  documentKind: DocumentKind,
  descriptorId: DescriptorId
): DocumentSQL => ({
  id: document.id,
  descriptor_id: descriptorId,
  name: document.name,
  content_type: document.contentType,
  pretty_name: document.prettyName,
  path: document.path,
  checksum: document.checksum,
  upload_date: document.uploadDate,
  document_kind: documentKind,
});

export const descriptorToDescriptorSQL = (
  eserviceId: EServiceId,
  descriptor: Descriptor
): DescriptorSQL => ({
  version: descriptor.version,
  id: descriptor.id,
  description: descriptor.description,
  created_at: descriptor.createdAt,
  eservice_id: eserviceId,
  state: descriptor.state,
  audience: descriptor.audience,
  voucher_lifespan: descriptor.voucherLifespan,
  daily_calls_per_consumer: descriptor.dailyCallsPerConsumer,
  daily_calls_total: descriptor.dailyCallsTotal,
  server_urls: descriptor.serverUrls,
  agreement_approval_policy: descriptor.agreementApprovalPolicy,
  published_at: descriptor.publishedAt,
  suspended_at: descriptor.suspendedAt,
  deprecated_at: descriptor.deprecatedAt,
  archived_at: descriptor.archivedAt,
});

export const eserviceToEserviceSQL = (
  eservice: EService,
  version: number
): EServiceSQL => ({
  name: eservice.name,
  id: eservice.id,
  created_at: eservice.createdAt,
  producer_id: eservice.producerId,
  description: eservice.description,
  technology: eservice.technology,
  mode: eservice.mode,
  version,
});

/*
export const splitEserviceIntoObjectsSQL = (
  eservice: EService
): {
  eserviceSQL: EServiceSQL;
  descriptorsSQL: DescriptorSQL[];
  attributesSQL: DescriptorAttributeSQL[];
  documentsSQL: DocumentSQL[];
} => {
  const eserviceSQL: EServiceSQL = {
    name: eservice.name,
    id: eservice.id,
    created_at: eservice.createdAt,
    producer_id: eservice.producerId,
    description: eservice.description,
    technology: eservice.technology,
    mode: eservice.mode,
  };

  const { descriptorsSQL, attributesSQL, documentsSQL } =
    eservice.descriptors.reduce(
      (
        acc: {
          descriptorsSQL: DescriptorSQL[];
          attributesSQL: DescriptorAttributeSQL[];
          documentsSQL: DocumentSQL[];
        },
        currentDescriptor: Descriptor
      ) => {
        const descriptorSQL: DescriptorSQL = {
          version: currentDescriptor.version,
          id: currentDescriptor.id,
          description: currentDescriptor.description,
          created_at: currentDescriptor.createdAt,
          eservice_id: eservice.id,
          state: currentDescriptor.state,
          audience: currentDescriptor.audience,
          voucher_lifespan: currentDescriptor.voucherLifespan,
          daily_calls_per_consumer: currentDescriptor.dailyCallsPerConsumer,
          daily_calls_total: currentDescriptor.dailyCallsTotal,
          server_urls: currentDescriptor.serverUrls,
          agreement_approval_policy: currentDescriptor.agreementApprovalPolicy,
          published_at: currentDescriptor.publishedAt,
          suspended_at: currentDescriptor.suspendedAt,
          deprecated_at: currentDescriptor.deprecatedAt,
          archived_at: currentDescriptor.archivedAt,
        };

        const attributesSQL = [
          ...currentDescriptor.attributes.certified.flatMap((group, index) =>
            group.map(
              (attribute) =>
                ({
                  attribute_id: attribute.id,
                  descriptor_id: currentDescriptor.id,
                  explicit_attribute_verification:
                    attribute.explicitAttributeVerification,
                  kind: attributeKind.certified,
                  group_set: index,
                } satisfies DescriptorAttributeSQL)
            )
          ),
          ...currentDescriptor.attributes.declared.flatMap((group, index) =>
            group.map(
              (attribute) =>
                ({
                  attribute_id: attribute.id,
                  descriptor_id: currentDescriptor.id,
                  explicit_attribute_verification:
                    attribute.explicitAttributeVerification,
                  kind: attributeKind.declared,
                  group_set: index,
                } satisfies DescriptorAttributeSQL)
            )
          ),
          ...currentDescriptor.attributes.verified.flatMap((group, index) =>
            group.map(
              (attribute) =>
                ({
                  attribute_id: attribute.id,
                  descriptor_id: currentDescriptor.id,
                  explicit_attribute_verification:
                    attribute.explicitAttributeVerification,
                  kind: attributeKind.verified,
                  group_set: index,
                } satisfies DescriptorAttributeSQL)
            )
          ),
        ];
        const interfaceSQL = currentDescriptor.interface
          ? ({
              id: currentDescriptor.interface.id,
              descriptor_id: currentDescriptor.id,
              name: currentDescriptor.interface.name,
              content_type: currentDescriptor.interface.contentType,
              pretty_name: currentDescriptor.interface.prettyName,
              path: currentDescriptor.interface.path,
              checksum: currentDescriptor.interface.checksum,
              upload_date: currentDescriptor.interface.uploadDate,
              document_kind: documentKind.descriptorInterface,
            } satisfies DocumentSQL)
          : undefined;
        const documentsSQL = currentDescriptor.docs.map((doc) => {
          const documentSQL: DocumentSQL = {
            path: doc.path,
            name: doc.name,
            id: doc.id,
            pretty_name: doc.prettyName,
            content_type: doc.contentType,
            descriptor_id: currentDescriptor.id,
            checksum: doc.checksum,
            upload_date: doc.uploadDate,
            document_kind: documentKind.descriptorDocument,
          };
          return documentSQL;
        });

        // console.log(acc);
        return {
          descriptorsSQL: acc.descriptorsSQL.concat([descriptorSQL]),
          attributesSQL: acc.attributesSQL.concat(attributesSQL),
          documentsSQL: interfaceSQL
            ? acc.documentsSQL.concat([interfaceSQL, ...documentsSQL])
            : acc.documentsSQL.concat(documentsSQL),
        };
      },
      { descriptorsSQL: [], attributesSQL: [], documentsSQL: [] }
    );

  return { eserviceSQL, descriptorsSQL, attributesSQL, documentsSQL };
};

*/
