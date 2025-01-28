import { describe, expect, it } from "vitest";
import {
  getMockValidRiskAnalysis,
  getMockEServiceTemplate,
  writeInReadmodel,
  getMockEServiceTemplateVersion,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  Document,
  EServiceTemplate,
  EServiceTemplateVersionActivatedV2,
  EServiceTemplateVersionAddedV2,
  EServiceTemplateVersionDocumentAddedV2,
  EServiceTemplateVersionDocumentDeletedV2,
  EServiceTemplateVersionDocumentUpdatedV2,
  EServiceTemplateVersionInterfaceAddedV2,
  EServiceTemplateVersionInterfaceDeletedV2,
  EServiceTemplateVersionInterfaceUpdatedV2,
  EServiceTemplateVersionPublishedV2,
  EServiceTemplateVersionQuotasUpdatedV2,
  EServiceTemplateVersionSuspendedV2,
  EServiceTemplateEventEnvelope,
  EServiceTemplateRiskAnalysisAddedV2,
  EServiceTemplateRiskAnalysisDeletedV2,
  RiskAnalysis,
  EServiceTemplateDeletedV2,
  toEServiceTemplateV2,
  EServiceTemplateAddedV2,
  EServiceTemplateDraftUpdatedV2,
  EServiceTemplateVersion,
  EServiceTemplateDraftVersionDeletedV2,
  EServiceTemplateDraftVersionUpdatedV2,
  eserviceTemplateVersionState,
  EServiceTemplateNameUpdatedV2,
} from "pagopa-interop-models";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import { eserviceTemplates } from "./utils.js";

describe("database test", async () => {
  describe("Events V2", async () => {
    const mockEServiceTemplate = getMockEServiceTemplate();
    it("EServiceTemplateDeleted", async () => {
      await writeInReadmodel(mockEServiceTemplate, eserviceTemplates, 1);

      const payload: EServiceTemplateDeletedV2 = {
        eserviceTemplate: toEServiceTemplateV2(mockEServiceTemplate),
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice?.data).toBeUndefined();
    });

    it("EServiceTemplateAdded", async () => {
      const payload: EServiceTemplateAddedV2 = {
        eserviceTemplate: toEServiceTemplateV2(mockEServiceTemplate),
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 1,
        type: "EServiceTemplateAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: mockEServiceTemplate,
        metadata: { version: 1 },
      });
    });

    it("EServiceTemplateDraftUpdated", async () => {
      await writeInReadmodel<EServiceTemplate>(
        mockEServiceTemplate,
        eserviceTemplates,
        1
      );

      const updatedEServiceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        audienceDescription: "updated description",
      };

      const payload: EServiceTemplateDraftUpdatedV2 = {
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
      };

      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateDraftUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: updatedEServiceTemplate,
        metadata: { version: 2 },
      });
    });

    it("EServiceTemplateVersionAdded", async () => {
      const draftVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.draft,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [],
      };
      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);

      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [draftVersion],
      };
      const payload: EServiceTemplateVersionAddedV2 = {
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
        eserviceTemplateVersionId: updatedEServiceTemplate.id,
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateVersionAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice?.data).toEqual(updatedEServiceTemplate);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceTemplateDraftVersionDeleted", async () => {
      const draftVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.draft,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [draftVersion],
      };
      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);

      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [],
      };
      const payload: EServiceTemplateDraftVersionDeletedV2 = {
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
        eserviceTemplateVersionId: draftVersion.id,
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateDraftVersionDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: updatedEServiceTemplate,
        metadata: { version: 2 },
      });
    });

    it("EServiceTemplateDraftVersionUpdated", async () => {
      const draftVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        interface: getMockDocument(),
        state: eserviceTemplateVersionState.draft,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [draftVersion],
      };
      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);

      const updatedDraftVersion: EServiceTemplateVersion = {
        ...draftVersion,
        description: "updated description",
      };
      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [updatedDraftVersion],
      };
      const payload: EServiceTemplateDraftVersionUpdatedV2 = {
        eserviceTemplateVersionId: updatedDraftVersion.id,
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateDraftVersionUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice?.data).toEqual(updatedEServiceTemplate);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceTemplateVersionQuotasUpdated", async () => {
      const publishedVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        interface: getMockDocument(),
        state: eserviceTemplateVersionState.published,
        publishedAt: new Date(),
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [publishedVersion],
      };
      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);

      const updatedPublishedVersion: EServiceTemplateVersion = {
        ...publishedVersion,
        dailyCallsTotal: publishedVersion.voucherLifespan + 1000,
      };
      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [updatedPublishedVersion],
      };
      const payload: EServiceTemplateVersionQuotasUpdatedV2 = {
        eserviceTemplateVersionId: updatedPublishedVersion.id,
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
      };

      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateVersionQuotasUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice?.data).toEqual(updatedEServiceTemplate);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceTemplateVersionActivated", async () => {
      const suspendedEServiceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        interface: getMockDocument(),
        state: eserviceTemplateVersionState.suspended,
        publishedAt: new Date(),
        suspendedAt: new Date(),
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [suspendedEServiceTemplateVersion],
      };
      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);

      const publishedEServiceTemplateVersion: EServiceTemplateVersion = {
        ...suspendedEServiceTemplateVersion,
        publishedAt: new Date(),
        suspendedAt: new Date(),
        state: eserviceTemplateVersionState.published,
      };
      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [publishedEServiceTemplateVersion],
      };
      const payload: EServiceTemplateVersionActivatedV2 = {
        eserviceTemplateVersionId: publishedEServiceTemplateVersion.id,
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateVersionActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice?.data).toEqual(updatedEServiceTemplate);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceTemplateVersionPublished", async () => {
      const draftEServiceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        interface: getMockDocument(),
        state: eserviceTemplateVersionState.draft,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [draftEServiceTemplateVersion],
      };
      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);

      const publishedEServiceTemplateVersion: EServiceTemplateVersion = {
        ...draftEServiceTemplateVersion,
        publishedAt: new Date(),
        state: eserviceTemplateVersionState.published,
      };
      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [publishedEServiceTemplateVersion],
      };
      const payload: EServiceTemplateVersionPublishedV2 = {
        eserviceTemplateVersionId: publishedEServiceTemplateVersion.id,
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateVersionPublished",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice?.data).toEqual(updatedEServiceTemplate);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceEServiceTemplateVersionSuspended", async () => {
      const publishedEServiceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        interface: getMockDocument(),
        state: eserviceTemplateVersionState.published,
        publishedAt: new Date(),
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [publishedEServiceTemplateVersion],
      };
      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);

      const suspendedEServiceTemplateVersion: EServiceTemplateVersion = {
        ...publishedEServiceTemplateVersion,
        suspendedAt: new Date(),
        state: eserviceTemplateVersionState.suspended,
      };
      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [suspendedEServiceTemplateVersion],
      };
      const payload: EServiceTemplateVersionSuspendedV2 = {
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
        eserviceTemplateVersionId: suspendedEServiceTemplateVersion.id,
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateVersionSuspended",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice?.data).toEqual(updatedEServiceTemplate);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceTemplateVersionInterfaceAdded", async () => {
      const descriptorInterface = getMockDocument();
      const draftEServiceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.draft,
        docs: [],
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [draftEServiceTemplateVersion],
      };
      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);
      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [
          { ...draftEServiceTemplateVersion, interface: descriptorInterface },
        ],
      };
      const payload: EServiceTemplateVersionInterfaceAddedV2 = {
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
        eserviceTemplateVersionId: draftEServiceTemplateVersion.id,
        documentId: descriptorInterface.id,
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateVersionInterfaceAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice?.data).toEqual(updatedEServiceTemplate);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceTemplateVersionDocumentAdded", async () => {
      const document = getMockDocument();
      const draftEServiceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.draft,
        docs: [],
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [draftEServiceTemplateVersion],
      };
      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);

      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [{ ...draftEServiceTemplateVersion, docs: [document] }],
      };
      const payload: EServiceTemplateVersionDocumentAddedV2 = {
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
        eserviceTemplateVersionId: draftEServiceTemplateVersion.id,
        documentId: document.id,
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateVersionDocumentAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice?.data).toEqual(updatedEServiceTemplate);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceTemplateVersionInterfaceUpdated", async () => {
      const descriptorInterface = getMockDocument();
      const draftEServiceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.draft,
        interface: descriptorInterface,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [draftEServiceTemplateVersion],
      };
      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);

      const updatedInterface: Document = {
        ...descriptorInterface,
        prettyName: "updated pretty name",
      };
      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [
          { ...draftEServiceTemplateVersion, interface: updatedInterface },
        ],
      };
      const payload: EServiceTemplateVersionInterfaceUpdatedV2 = {
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
        eserviceTemplateVersionId: draftEServiceTemplateVersion.id,
        documentId: updatedInterface.id,
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateVersionInterfaceUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice?.data).toEqual(updatedEServiceTemplate);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceTemplateVersionDocumentUpdated", async () => {
      const document = getMockDocument();
      const draftEServiceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.draft,
        docs: [document],
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [draftEServiceTemplateVersion],
      };
      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);

      const updatedDocument: Document = {
        ...document,
        prettyName: "updated pretty name",
      };
      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [
          { ...draftEServiceTemplateVersion, docs: [updatedDocument] },
        ],
      };
      const payload: EServiceTemplateVersionDocumentUpdatedV2 = {
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
        eserviceTemplateVersionId: draftEServiceTemplateVersion.id,
        documentId: document.id,
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateVersionDocumentUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice?.data).toEqual(updatedEServiceTemplate);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceTemplateVersionInterfaceDeleted", async () => {
      const descriptorInterface = getMockDocument();
      const draftEServiceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.draft,
        interface: descriptorInterface,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [draftEServiceTemplateVersion],
      };
      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);

      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [
          {
            ...draftEServiceTemplateVersion,
            interface: undefined,
          },
        ],
      };
      const payload: EServiceTemplateVersionInterfaceDeletedV2 = {
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
        eserviceTemplateVersionId: draftEServiceTemplateVersion.id,
        documentId: descriptorInterface.id,
      };

      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateVersionInterfaceDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice?.data).toEqual(updatedEServiceTemplate);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceTemplateVersionDocumentDeleted", async () => {
      const document = getMockDocument();
      const draftEServiceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.draft,
        docs: [document],
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [draftEServiceTemplateVersion],
      };
      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);

      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [{ ...draftEServiceTemplateVersion, docs: [] }],
      };
      const payload: EServiceTemplateVersionDocumentDeletedV2 = {
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
        eserviceTemplateVersionId: draftEServiceTemplateVersion.id,
        documentId: document.id,
      };

      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateVersionDocumentDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice?.data).toEqual(updatedEServiceTemplate);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceTemplateRiskAnalysisAdded", async () => {
      await writeInReadmodel<EServiceTemplate>(
        mockEServiceTemplate,
        eserviceTemplates,
        1
      );

      const mockRiskAnalysis = getMockValidRiskAnalysis("PA");
      const updatedEServiceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        riskAnalysis: [mockRiskAnalysis],
      };
      const payload: EServiceTemplateRiskAnalysisAddedV2 = {
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
        riskAnalysisId: mockRiskAnalysis.id,
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateRiskAnalysisAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: updatedEServiceTemplate,
        metadata: { version: 2 },
      });
    });

    it("EServiceTemplateRiskAnalysisUpdated", async () => {
      const mockRiskAnalysis = getMockValidRiskAnalysis("PA");
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        riskAnalysis: [mockRiskAnalysis],
      };
      await writeInReadmodel<EServiceTemplate>(
        eserviceTemplate,
        eserviceTemplates,
        1
      );

      const updatedRiskAnalysis: RiskAnalysis = {
        ...mockRiskAnalysis,
        riskAnalysisForm: {
          ...mockRiskAnalysis.riskAnalysisForm,
          singleAnswers: mockRiskAnalysis.riskAnalysisForm.singleAnswers.map(
            (singleAnswer) => ({
              ...singleAnswer,
              value:
                singleAnswer.key === "purpose" ? "OTHER" : singleAnswer.value,
            })
          ),
        },
      };
      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        riskAnalysis: [updatedRiskAnalysis],
      };
      const payload: EServiceTemplateRiskAnalysisAddedV2 = {
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
        riskAnalysisId: mockRiskAnalysis.id,
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateRiskAnalysisUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: updatedEServiceTemplate,
        metadata: { version: 2 },
      });
    });

    it("EServiceTemplateRiskAnalysisDeleted", async () => {
      const riskAnalysis = getMockValidRiskAnalysis("PA");
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        riskAnalysis: [riskAnalysis],
      };

      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);

      const updatedEServiceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        riskAnalysis: [],
      };
      const payload: EServiceTemplateRiskAnalysisDeletedV2 = {
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
        riskAnalysisId: riskAnalysis.id,
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateRiskAnalysisDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);

      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: updatedEServiceTemplate,
        metadata: { version: 2 },
      });
    });

    it("EServiceNameUpdated", async () => {
      const publishedEServiceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        interface: getMockDocument(),
        state: eserviceTemplateVersionState.published,
        publishedAt: new Date(),
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        name: "previousName",
        versions: [publishedEServiceTemplateVersion],
      };
      await writeInReadmodel(eserviceTemplate, eserviceTemplates, 1);
      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        name: "newName",
      };
      const payload: EServiceTemplateNameUpdatedV2 = {
        eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
      };
      const message: EServiceTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEServiceTemplate.id,
        version: 2,
        type: "EServiceTemplateNameUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, eserviceTemplates);
      const retrievedEservice = await eserviceTemplates.findOne({
        "data.id": mockEServiceTemplate.id,
      });
      expect(retrievedEservice?.data).toEqual(updatedEServiceTemplate);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });
  });
});
