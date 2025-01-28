import { ReadModelRepositorySQL } from "pagopa-interop-commons";
import {
  DescriptorId,
  descriptorState,
  EService,
  EServiceDocumentId,
  EServiceEventEnvelopeV2,
  EServiceId,
  EServiceV2,
  fromEServiceV2,
  genericInternalError,
  RiskAnalysisId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import * as poc from "pagopa-interop-poc-readmodel";

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> {
  await match(message)
    .with({ type: "EServiceDeleted" }, async (message) => {
      const eserviceId = unsafeBrandId<EServiceId>(message.data.eserviceId);
      await poc.deleteEService(eserviceId, readModelRepositorySQL);
    })
    .with(
      { type: "EServiceAdded" },
      { type: "EServiceCloned" },
      { type: "DraftEServiceUpdated" },
      async (message) => {
        const eservice = parseEservice(message.data.eservice);
        await poc.upsertEService(
          eservice,
          readModelRepositorySQL,
          message.version
        );
      }
    )
    .with({ type: "EServiceDescriptorAdded" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      await poc.addDescriptor(
        eservice.id,
        descriptor,
        readModelRepositorySQL,
        message.version
      );
    })
    .with({ type: "EServiceDraftDescriptorDeleted" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );

      await poc.deleteDescriptor(
        eservice.id,
        descriptorId,
        readModelRepositorySQL,
        message.version
      );
    })
    .with({ type: "EServiceDraftDescriptorUpdated" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      await poc.replaceDescriptor(
        eservice.id,
        descriptor,
        readModelRepositorySQL,
        message.version
      );
    })
    .with(
      { type: "EServiceDescriptorQuotasUpdated" },
      { type: "EServiceDescriptorActivated" },
      { type: "EServiceDescriptorArchived" },
      { type: "EServiceDescriptorSuspended" },
      async (message) => {
        const eservice = parseEservice(message.data.eservice);
        const descriptorId = unsafeBrandId<DescriptorId>(
          message.data.descriptorId
        );

        const descriptor = eservice.descriptors.find(
          (d) => d.id === descriptorId
        );

        if (!descriptor) {
          throw genericInternalError("");
        }

        await poc.updateDescriptor(
          eservice.id,
          descriptor,
          readModelRepositorySQL,
          message.version
        );
      }
    )
    .with({ type: "EServiceDescriptorPublished" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );
      const publishedDescriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!publishedDescriptor) {
        throw genericInternalError("");
      }

      // TODO double check this: are we sure the "previous descriptor" (that has the side effect of the publication) is always the n-1?
      const previousDescriptor = eservice.descriptors.find(
        (d) =>
          (parseInt(d.version, 10) ===
            parseInt(publishedDescriptor.version, 10) - 1 &&
            d.state === descriptorState.deprecated) ||
          d.state === descriptorState.archived
      );

      await poc.publishDescriptor(
        publishedDescriptor,
        previousDescriptor,
        eservice.id,
        readModelRepositorySQL,
        message.version
      );
    })
    .with({ type: "EServiceDescriptorInterfaceAdded" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      await poc.addInterface(
        eservice.id,
        descriptor,
        readModelRepositorySQL,
        message.version
      );
    })
    .with({ type: "EServiceDescriptorDocumentAdded" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );
      const documentId = unsafeBrandId<EServiceDocumentId>(
        message.data.documentId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      const document = descriptor.docs.find((d) => d.id === documentId);

      if (!document) {
        throw genericInternalError("");
      }

      await poc.addDocument(
        eservice.id,
        document,
        descriptor.id,
        readModelRepositorySQL,
        message.version
      );
    })
    .with({ type: "EServiceDescriptorInterfaceUpdated" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      if (!descriptor.interface) {
        throw genericInternalError("");
      }

      await poc.updateDocument(
        eservice.id,
        descriptor.id,
        descriptor.interface,
        readModelRepositorySQL,
        message.version
      );
    })
    .with({ type: "EServiceDescriptorDocumentUpdated" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );
      const documentId = unsafeBrandId<EServiceDocumentId>(
        message.data.documentId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      const document = descriptor.docs.find((d) => d.id === documentId);

      if (!document) {
        throw genericInternalError("");
      }

      await poc.updateDocument(
        eservice.id,
        descriptor.id,
        document,
        readModelRepositorySQL,
        message.version
      );
    })
    .with({ type: "EServiceDescriptorInterfaceDeleted" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );
      const interfaceId = unsafeBrandId<EServiceDocumentId>(
        message.data.documentId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      await poc.deleteInterface(
        eservice.id,
        descriptor,
        interfaceId,
        readModelRepositorySQL,
        message.version
      );
    })
    .with({ type: "EServiceDescriptorDocumentDeleted" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const descriptorId = unsafeBrandId<DescriptorId>(
        message.data.descriptorId
      );
      const documentId = unsafeBrandId<EServiceDocumentId>(
        message.data.documentId
      );

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw genericInternalError("");
      }

      await poc.deleteDocument(
        eservice.id,
        documentId,
        readModelRepositorySQL,
        message.version
      );
    })
    .with({ type: "EServiceRiskAnalysisAdded" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const riskAnalysisId = unsafeBrandId<RiskAnalysisId>(
        message.data.riskAnalysisId
      );
      const newRiskAnalysis = eservice.riskAnalysis.find(
        (riskAnalysis) => riskAnalysis.id === riskAnalysisId
      );

      if (!newRiskAnalysis) {
        throw genericInternalError("");
      }

      await poc.addRiskAnalysis(
        eservice.id,
        newRiskAnalysis,
        readModelRepositorySQL,
        message.version
      );
    })
    .with({ type: "EServiceRiskAnalysisUpdated" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      const riskAnalysisId = unsafeBrandId<RiskAnalysisId>(
        message.data.riskAnalysisId
      );
      const updatedRiskAnalysis = eservice.riskAnalysis.find(
        (riskAnalysis) => riskAnalysis.id === riskAnalysisId
      );

      if (!updatedRiskAnalysis) {
        throw genericInternalError("");
      }

      await poc.updateRiskAnalysis(
        updatedRiskAnalysis,
        eservice.id,
        readModelRepositorySQL,
        message.version
      );
    })
    .with({ type: "EServiceRiskAnalysisDeleted" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);

      const riskAnalysisId = unsafeBrandId<RiskAnalysisId>(
        message.data.riskAnalysisId
      );
      await poc.deleteRiskAnalysis(
        eservice.id,
        riskAnalysisId,
        readModelRepositorySQL,
        message.version
      );
    })
    .with({ type: "EServiceDescriptionUpdated" }, async (message) => {
      const eservice = parseEservice(message.data.eservice);
      await poc.updateEservice(
        eservice,
        readModelRepositorySQL,
        message.version
      );
    })
    .with(
      { type: "EServiceDescriptorSubmittedByDelegate" },
      { type: "EServiceDescriptorApprovedByDelegator" },
      { type: "EServiceDescriptorRejectedByDelegator" },
      { type: "EServiceDescriptorAttributesUpdated" },
      () => {
        // unhandled for now
      }
    )
    .exhaustive();
}

const parseEservice = (eservice: EServiceV2 | undefined): EService => {
  if (!eservice) {
    throw genericInternalError("Eservice is missing");
  }
  return fromEServiceV2(eservice);
};
