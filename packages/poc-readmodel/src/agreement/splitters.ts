import {
  Agreement,
  AgreementAttributeSQL,
  AgreementDocument,
  agreementDocumentKind,
  AgreementDocumentKind,
  AgreementDocumentSQL,
  AgreementId,
  AgreementSQL,
  attributeKind,
} from "pagopa-interop-models";

export const splitAgreementIntoObjectsSQL = (
  agreement: Agreement
): {
  agreementSQL: AgreementSQL;
  agreementDocumentsSQL: AgreementDocumentSQL[];
  agreementAttributesSQL: AgreementAttributeSQL[];
} => {
  const agreementSQL = agreementToAgreementSQL(agreement);

  const agreementContractSQL = agreement.contract
    ? agreementDocumentToAgreementDocumentSQL(
        agreement.contract,
        agreementDocumentKind.agreementContract,
        agreement.id
      )
    : undefined;

  const consumerDocumentsSQL = agreement.consumerDocuments.map((doc) =>
    agreementDocumentToAgreementDocumentSQL(
      doc,
      agreementDocumentKind.agreementConsumerDocument,
      agreement.id
    )
  );

  const agreementAttributesSQL: AgreementAttributeSQL[] = [
    ...agreement.certifiedAttributes.map((attr) => ({
      attribute_id: attr.id,
      agreement_id: agreement.id,
      kind: attributeKind.certified,
    })),
    ...agreement.declaredAttributes.map((attr) => ({
      attribute_id: attr.id,
      agreement_id: agreement.id,
      kind: attributeKind.declared,
    })),
    ...agreement.verifiedAttributes.map((attr) => ({
      attribute_id: attr.id,
      agreement_id: agreement.id,
      kind: attributeKind.verified,
    })),
  ];

  const documentsSQL = agreementContractSQL
    ? [agreementContractSQL, ...consumerDocumentsSQL]
    : [...consumerDocumentsSQL];
  return {
    agreementSQL,
    agreementDocumentsSQL: documentsSQL,
    agreementAttributesSQL,
  };
};

const agreementToAgreementSQL = (agreement: Agreement): AgreementSQL => ({
  id: agreement.id,
  eservice_id: agreement.eserviceId,
  descriptor_id: agreement.descriptorId,
  producer_id: agreement.producerId,
  consumer_id: agreement.consumerId,
  state: agreement.state,
  suspended_by_consumer: agreement.suspendedByConsumer,
  suspended_by_producer: agreement.suspendedByProducer,
  suspended_by_platform: agreement.suspendedByPlatform,
  created_at: agreement.createdAt,
  updated_at: agreement.updatedAt,
  consumer_notes: agreement.consumerNotes,
  rejection_reason: agreement.rejectionReason,
  suspended_at: agreement.suspendedAt,
  submission_by: agreement.stamps.submission?.who,
  submission_at: agreement.stamps.submission?.when,
  activation_by: agreement.stamps.activation?.who,
  activation_at: agreement.stamps.activation?.when,
  rejection_by: agreement.stamps.rejection?.who,
  rejection_at: agreement.stamps.rejection?.when,
  suspension_by_producer_by: agreement.stamps.suspensionByProducer?.who,
  suspension_by_producer_at: agreement.stamps.suspensionByProducer?.when,
  suspension_by_consumer_by: agreement.stamps.suspensionByConsumer?.who,
  suspension_by_consumer_at: agreement.stamps.suspensionByConsumer?.when,
  upgrade_by: agreement.stamps.upgrade?.who,
  upgrade_at: agreement.stamps.upgrade?.when,
  archiving_by: agreement.stamps.archiving?.who,
  archiving_at: agreement.stamps.archiving?.when,
});

export const agreementDocumentToAgreementDocumentSQL = (
  doc: AgreementDocument,
  kind: AgreementDocumentKind,
  agreementId: AgreementId
): AgreementDocumentSQL => ({
  id: doc.id,
  agreement_id: agreementId,
  name: doc.name,
  pretty_name: doc.prettyName,
  content_type: doc.contentType,
  path: doc.path,
  created_at: doc.createdAt,
  kind,
});
