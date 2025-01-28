import {
  DescriptorAttributeSQL,
  DescriptorId,
  DescriptorSQL,
  DocumentSQL,
  EServiceDocumentId,
  EServiceId,
  EserviceRiskAnalysisSQL,
  EServiceSQL,
  RiskAnalysisAnswerSQL,
  RiskAnalysisFormId,
  RiskAnalysisId,
  TenantId,
} from "pagopa-interop-models";
import pgPromise from "pg-promise";

export const prepareInsertEservice = (
  eserviceSQL: EServiceSQL
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "insert-eservice",
    text: "INSERT INTO readmodel.eservice(id, producer_id, name, description, technology, created_at, mode, version) VALUES($1, $2, $3, $4, $5, $6, $7, $8)",
    values: [
      eserviceSQL.id,
      eserviceSQL.producer_id,
      eserviceSQL.name,
      eserviceSQL.description,
      eserviceSQL.technology,
      eserviceSQL.created_at,
      eserviceSQL.mode,
      eserviceSQL.version,
    ],
  });

export const prepareInsertEserviceWithExtraTypeCheck = ({
  // this function makes sure that we don't forget new fields of EServiceSQL
  id,
  description,
  mode,
  name,
  producer_id,
  technology,
  created_at,
  version,
  ...rest
}: EServiceSQL): pgPromise.PreparedStatement => {
  void (rest satisfies Record<string, never>);

  return new pgPromise.PreparedStatement({
    name: "insert-eservice",
    text: "INSERT INTO readmodel.eservice(id, producer_id, name, description, technology, created_at, mode, version) VALUES($1, $2, $3, $4, $5, $6, $7, $8)",
    values: [
      id,
      producer_id,
      name,
      description,
      technology,
      created_at,
      mode,
      version,
    ],
  });
};

export const prepareReadEservice = (
  id: EServiceId
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "read-eservice",
    text: "SELECT * FROM readmodel.eservice WHERE id = $1",
    values: [id],
  });

export const prepareReadEserviceByNameAndProducerId = (
  eserviceName: string,
  producerId: TenantId
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "read-eservice-by-name-and-producer-id",
    text: "SELECT * FROM readmodel.eservice WHERE name LIKE $1 AND producerId = $2",
    values: [eserviceName, producerId],
  });

export const prepareUpdateEservice = (
  eservice: EServiceSQL
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "update-eservice",
    text: "UPDATE readmodel.eservice SET producer_id = $1, name = $2, description = $3, technology = $4, created_at = $5, mode = $6 WHERE id = $7",
    values: [
      eservice.producer_id,
      eservice.name,
      eservice.description,
      eservice.technology,
      eservice.created_at,
      eservice.mode,
      eservice.id,
    ],
  });

export const prepareDeleteEservice = (
  id: EServiceId
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "delete-eservice",
    text: "DELETE FROM readmodel.eservice WHERE id = $1",
    values: [id],
  });

export const prepareInsertDescriptor = (
  descriptorSQL: DescriptorSQL
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "insert-descriptor",
    text: "INSERT INTO readmodel.descriptor(id, eservice_id, version, description, state, audience, voucher_lifespan, daily_calls_per_consumer, daily_calls_total, agreement_approval_policy, created_at, server_urls, published_at, suspended_at, deprecated_at, archived_at) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)",
    values: [
      descriptorSQL.id,
      descriptorSQL.eservice_id,
      descriptorSQL.version,
      descriptorSQL.description,
      descriptorSQL.state,
      descriptorSQL.audience,
      descriptorSQL.voucher_lifespan,
      descriptorSQL.daily_calls_per_consumer,
      descriptorSQL.daily_calls_total,
      descriptorSQL.agreement_approval_policy,
      descriptorSQL.created_at,
      descriptorSQL.server_urls,
      descriptorSQL.published_at,
      descriptorSQL.suspended_at,
      descriptorSQL.deprecated_at,
      descriptorSQL.archived_at,
    ],
  });

export const prepareUpdateDescriptor = (
  descriptorSQL: DescriptorSQL
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "update-descriptor",
    text: "UPDATE readmodel.descriptor SET eservice_id = $1, version = $2, description = $3, state = $4, audience = $5, voucher_lifespan = $6, daily_calls_per_consumer = $7, daily_calls_total = $8, agreement_approval_policy = $9, created_at = $10, server_urls = $11, published_at = $12, suspended_at = $13, deprecated_at = $14, archived_at = $15 WHERE id = $16",
    values: [
      descriptorSQL.eservice_id,
      descriptorSQL.version,
      descriptorSQL.description,
      descriptorSQL.state,
      descriptorSQL.audience,
      descriptorSQL.voucher_lifespan,
      descriptorSQL.daily_calls_per_consumer,
      descriptorSQL.daily_calls_total,
      descriptorSQL.agreement_approval_policy,
      descriptorSQL.created_at,
      descriptorSQL.server_urls,
      descriptorSQL.published_at,
      descriptorSQL.suspended_at,
      descriptorSQL.deprecated_at,
      descriptorSQL.archived_at,
      descriptorSQL.id,
    ],
  });

export const prepareDeleteDescriptor = (
  id: DescriptorId
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "delete-descriptor",
    text: "DELETE FROM readmodel.descriptor WHERE id = $1",
    values: [id],
  });

export const prepareReadDescriptorsByEserviceId = (
  id: EServiceId
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "read-descriptors-by-eservice-id",
    text: "SELECT * FROM readmodel.descriptor WHERE eservice_id = $1",
    values: [id],
  });

export const prepareInsertDescriptorDocument = (
  documentSQL: DocumentSQL
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "insert-document",
    text: "INSERT INTO readmodel.descriptor_document(id, descriptor_id, name, content_type, pretty_name, path, checksum, upload_date, document_kind) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    values: [
      documentSQL.id,
      documentSQL.descriptor_id,
      documentSQL.name,
      documentSQL.content_type,
      documentSQL.pretty_name,
      documentSQL.path,
      documentSQL.checksum,
      documentSQL.upload_date,
      documentSQL.document_kind,
    ],
  });

export const prepareUpdateDescriptorDocument = (
  documentSQL: DocumentSQL
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "update-document",
    text: "UPDATE readmodel.descriptor_document SET descriptor_id = $1, name = $2, content_type = $3, pretty_name = $4, path = $5, checksum = $6, upload_date = $7, document_kind = $8 WHERE id = $9",
    values: [
      documentSQL.descriptor_id,
      documentSQL.name,
      documentSQL.content_type,
      documentSQL.pretty_name,
      documentSQL.path,
      documentSQL.checksum,
      documentSQL.upload_date,
      documentSQL.document_kind,
      documentSQL.id,
    ],
  });

export const prepareDeleteDocument = (
  id: EServiceDocumentId
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "delete-document",
    text: "DELETE FROM readmodel.descriptor_document WHERE id = $1",
    values: [id],
  });

export const prepareReadDocumentsByDescriptorId = (
  id: DescriptorId
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "read-descriptor-documents-by-descriptor-id",
    text: "SELECT * FROM readmodel.descriptor_document WHERE descriptor_id = $1",
    values: [id],
  });

export const prepareReadDocumentsByEserviceId = (
  id: EServiceId
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "read-documents-by-eservice-id",
    text: "SELECT * FROM readmodel.descriptor_document WHERE descriptor_document.descriptor_id IN (SELECT id FROM readmodel.descriptor WHERE descriptor.eservice_id = $1)",
    values: [id],
  });

export const prepareReadDocumentsByDescriptorIds = (
  ids: DescriptorId[]
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "read-descriptor-documents-by-descriptors-ids",
    text: "SELECT * FROM readmodel.descriptor_document WHERE descriptor_id = ANY ($1)",
    values: [ids],
  });

export const prepareInsertDescriptorAttribute = (
  attributeSQL: DescriptorAttributeSQL
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "insert-descriptor-attribute",
    text: "INSERT INTO readmodel.descriptor_attribute(attribute_id, descriptor_id, explicit_attribute_verification, kind, group_set) VALUES($1, $2, $3, $4, $5)",
    values: [
      attributeSQL.attribute_id,
      attributeSQL.descriptor_id,
      attributeSQL.explicit_attribute_verification,
      attributeSQL.kind,
      attributeSQL.group_set,
    ],
  });

export const prepareReadDescriptorAttributesByDescriptorId = (
  id: DescriptorId
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "read-descriptor-attributes",
    text: "SELECT * FROM readmodel.descriptor_attribute WHERE descriptor_id = $1",
    values: [id],
  });

export const prepareReadDescriptorAttributesByEserviceId = (
  id: EServiceId
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "read-descriptor-attributes-by-eservice-id",
    text: "SELECT * FROM readmodel.descriptor_attribute as attribute WHERE attribute.descriptor_id IN (SELECT id FROM readmodel.descriptor WHERE descriptor.eservice_id = $1)",
    values: [id],
  });

export const prepareReadDescriptorsByEserviceIds = (
  ids: EServiceId[]
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "read-descriptors-by-eservices-ids",
    text: "SELECT * FROM readmodel.descriptor WHERE eservice_id = ANY ($1)",
    values: [ids],
  });

export const prepareReadDescriptorAttributesByDescriptorIds = (
  ids: DescriptorId[]
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "read-descriptor-attributes",
    text: "SELECT * FROM readmodel.descriptor_attribute WHERE descriptor_id = ANY ($1)",
    values: [ids],
  });

export const prepareInsertRiskAnalysis = (
  riskAnalysisSQL: EserviceRiskAnalysisSQL
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "insert-risk-analysis",
    text: "INSERT INTO readmodel.eservice_risk_analysis(risk_analysis_id, eservice_id, name, created_at, risk_analysis_form_id, risk_analysis_form_version) VALUES($1, $2, $3, $4, $5, $6)",
    values: [
      riskAnalysisSQL.risk_analysis_id,
      riskAnalysisSQL.eservice_id,
      riskAnalysisSQL.name,
      riskAnalysisSQL.created_at,
      riskAnalysisSQL.risk_analysis_form_id,
      riskAnalysisSQL.risk_analysis_form_version,
    ],
  });

export const prepareDeleteRiskAnalysis = (
  riskAnalysisId: RiskAnalysisId
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "delete-risk-analysis",
    text: "DELETE FROM readmodel.eservice_risk_analysis WHERE risk_analysis_id = $1",
    values: [riskAnalysisId],
  });

export const prepareInsertRiskAnalysisAnswer = (
  riskAnalysisAnswerSQL: RiskAnalysisAnswerSQL
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "insert-risk-analysis-answer",
    text: "INSERT INTO readmodel.eservice_risk_analysis_answer(id, risk_analysis_form_id, kind, key, value) VALUES($1, $2, $3, $4, $5)",
    values: [
      riskAnalysisAnswerSQL.id,
      riskAnalysisAnswerSQL.risk_analysis_form_id,
      riskAnalysisAnswerSQL.kind,
      riskAnalysisAnswerSQL.key,
      riskAnalysisAnswerSQL.value,
    ],
  });

export const prepareReadRiskAnalysesByEserviceIds = (
  eserviceIds: EServiceId[]
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "read-risk-analyses-by-eservice-ids",
    text: "SELECT * FROM readmodel.eservice_risk_analysis WHERE eservice_id = ANY ($1)",
    values: [eserviceIds],
  });

export const prepareReadRiskAnalysesByEserviceId = (
  eserviceId: EServiceId
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "read-risk-analyses-by-eservice-id",
    text: "SELECT * FROM readmodel.eservice_risk_analysis WHERE eservice_id = $1",
    values: [eserviceId],
  });

export const prepareReadRiskAnalysesAnswersByFormIds = (
  formIds: RiskAnalysisFormId[]
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "read-risk-analysis-answers-by-form-ids",
    text: "SELECT * FROM readmodel.eservice_risk_analysis_answer WHERE risk_analysis_form_id = ANY ($1)",
    values: [formIds],
  });

export const prepareSetEserviceVersion = (
  eserviceId: EServiceId,
  eserviceVersion: number
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "set-eservice-version",
    text: "UPDATE readmodel.eservice SET version = $1 WHERE id = $2",
    values: [eserviceVersion, eserviceId],
  });
