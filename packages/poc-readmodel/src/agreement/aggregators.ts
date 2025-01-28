import {
  Agreement,
  AgreementAttribute,
  AgreementAttributeSQL,
  AgreementDocument,
  agreementDocumentKind,
  AgreementDocumentSQL,
  AgreementSQL,
  AgreementStamp,
  AgreementStamps,
  attributeKind,
} from "pagopa-interop-models";

export const agreementSQLtoAgreement = (
  agreementSQL: AgreementSQL,
  agreementDocumentsSQL: AgreementDocumentSQL[],
  agreementAttributesSQL: AgreementAttributeSQL[]
): Agreement => {
  const agreementContractSQL = agreementDocumentsSQL.find(
    (doc) => doc.kind === agreementDocumentKind.agreementContract
  );

  const parsedContract = agreementContractSQL
    ? agreementDocumentSQLtoAgreementDocument(agreementContractSQL)
    : undefined;

  const consumerDocumentsSQL = agreementDocumentsSQL.filter(
    (doc) => doc.kind === agreementDocumentKind.agreementConsumerDocument
  );

  const parsedDocuments = consumerDocumentsSQL.map((doc) =>
    agreementDocumentSQLtoAgreementDocument(doc)
  );
  const submissionStamp: AgreementStamp | undefined =
    agreementSQL.submission_at && agreementSQL.submission_by
      ? { who: agreementSQL.submission_by, when: agreementSQL.submission_at }
      : undefined;

  const activationStamp: AgreementStamp | undefined =
    agreementSQL.activation_at && agreementSQL.activation_by
      ? { who: agreementSQL.activation_by, when: agreementSQL.activation_at }
      : undefined;

  const rejectionStamp: AgreementStamp | undefined =
    agreementSQL.rejection_at && agreementSQL.rejection_by
      ? { who: agreementSQL.rejection_by, when: agreementSQL.rejection_at }
      : undefined;

  const suspensionByProducerStamp: AgreementStamp | undefined =
    agreementSQL.suspension_by_producer_at &&
    agreementSQL.suspension_by_producer_by
      ? {
          who: agreementSQL.suspension_by_producer_by,
          when: agreementSQL.suspension_by_producer_at,
        }
      : undefined;

  const suspensionByConsumerStamp: AgreementStamp | undefined =
    agreementSQL.suspension_by_consumer_at &&
    agreementSQL.suspension_by_consumer_by
      ? {
          who: agreementSQL.suspension_by_consumer_by,
          when: agreementSQL.suspension_by_consumer_at,
        }
      : undefined;

  const upgradeStamp: AgreementStamp | undefined =
    agreementSQL.upgrade_at && agreementSQL.upgrade_by
      ? { who: agreementSQL.upgrade_by, when: agreementSQL.upgrade_at }
      : undefined;

  const archivingStamp: AgreementStamp | undefined =
    agreementSQL.archiving_at && agreementSQL.archiving_by
      ? { who: agreementSQL.archiving_by, when: agreementSQL.archiving_at }
      : undefined;

  const stamps: AgreementStamps = {
    submission: submissionStamp,
    activation: activationStamp,
    rejection: rejectionStamp,
    suspensionByProducer: suspensionByProducerStamp,
    suspensionByConsumer: suspensionByConsumerStamp,
    upgrade: upgradeStamp,
    archiving: archivingStamp,
  };

  const verifiedAttributes: AgreementAttribute[] = agreementAttributesSQL
    .filter((attr) => attr.kind === attributeKind.verified)
    .map((attr) => ({ id: attr.attribute_id }));

  const certifiedAttributes: AgreementAttribute[] = agreementAttributesSQL
    .filter((attr) => attr.kind === attributeKind.certified)
    .map((attr) => ({ id: attr.attribute_id }));

  const declaredAttributes: AgreementAttribute[] = agreementAttributesSQL
    .filter((attr) => attr.kind === attributeKind.declared)
    .map((attr) => ({ id: attr.attribute_id }));

  const agreement: Agreement = {
    id: agreementSQL.id,
    eserviceId: agreementSQL.eservice_id,
    descriptorId: agreementSQL.descriptor_id,
    producerId: agreementSQL.producer_id,
    consumerId: agreementSQL.consumer_id,
    state: agreementSQL.state,
    verifiedAttributes,
    certifiedAttributes,
    declaredAttributes,
    suspendedByConsumer: agreementSQL.suspended_by_consumer,
    suspendedByProducer: agreementSQL.suspended_by_producer,
    suspendedByPlatform: agreementSQL.suspended_by_platform,
    consumerDocuments: parsedDocuments,
    createdAt: agreementSQL.created_at,
    updatedAt: agreementSQL.updated_at,
    consumerNotes: agreementSQL.consumer_notes,
    contract: parsedContract,
    stamps,
    rejectionReason: agreementSQL.rejection_reason,
    suspendedAt: agreementSQL.suspended_at,
  };
  return agreement;
};

const agreementDocumentSQLtoAgreementDocument = (
  docSQL: AgreementDocumentSQL
): AgreementDocument => ({
  path: docSQL.path,
  name: docSQL.name,
  id: docSQL.id,
  prettyName: docSQL.pretty_name,
  contentType: docSQL.content_type,
  createdAt: docSQL.created_at,
});
