/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockPurposeVersionDocument,
  getMockPurposeVersion,
  getMockPurpose,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Purpose,
  generateId,
  toReadModelEService,
  PurposeId,
  PurposeVersionId,
  PurposeVersionDocumentId,
  TenantId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  purposeVersionNotFound,
  purposeVersionDocumentNotFound,
  organizationNotAllowed,
} from "../src/model/domain/errors.js";
import {
  postgresDB,
  purposes,
  eservices,
  purposeService,
} from "./purposeService.integration.test.js";
import { getMockEService, addOnePurpose } from "./utils.js";

export const testGetRiskAnalysisDocument = (): ReturnType<typeof describe> =>
  describe("getRiskAnalysisDocument", () => {
    it("should get the purpose version document", async () => {
      const mockDocument = getMockPurposeVersionDocument();
      const mockEService = getMockEService();
      const mockPurposeVersion = {
        ...getMockPurposeVersion(),
        riskAnalysis: mockDocument,
      };
      const mockPurpose1: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };
      const mockPurpose2 = getMockPurpose();
      await addOnePurpose(mockPurpose1, postgresDB, purposes);
      await addOnePurpose(mockPurpose2, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      const result = await purposeService.getRiskAnalysisDocument({
        purposeId: mockPurpose1.id,
        versionId: mockPurposeVersion.id,
        documentId: mockDocument.id,
        organizationId: mockEService.producerId,
        logger: genericLogger,
      });
      expect(result).toEqual(mockDocument);
    });
    it("should throw purposeNotFound if the purpose doesn't exist", async () => {
      const notExistingId: PurposeId = generateId();
      await addOnePurpose(getMockPurpose(), postgresDB, purposes);

      expect(
        purposeService.getRiskAnalysisDocument({
          purposeId: notExistingId,
          versionId: generateId(),
          documentId: generateId(),
          organizationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(purposeNotFound(notExistingId));
    });
    it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
      const randomVersionId: PurposeVersionId = generateId();
      const randomDocumentId: PurposeVersionDocumentId = generateId();
      const mockDocument = getMockPurposeVersionDocument();
      const mockEService = getMockEService();
      const mockPurposeVersion = {
        ...getMockPurposeVersion(),
        riskAnalysis: mockDocument,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.getRiskAnalysisDocument({
          purposeId: mockPurpose.id,
          versionId: randomVersionId,
          documentId: randomDocumentId,
          organizationId: mockEService.producerId,
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        purposeVersionNotFound(mockPurpose.id, randomVersionId)
      );
    });
    it("should throw purposeVersionDocumentNotFound if the document doesn't exist", async () => {
      const mockDocument = getMockPurposeVersionDocument();
      const randomDocumentId: PurposeVersionDocumentId = generateId();
      const mockEService = getMockEService();
      const mockPurposeVersion = {
        ...getMockPurposeVersion(),
        riskAnalysis: mockDocument,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.getRiskAnalysisDocument({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          documentId: randomDocumentId,
          organizationId: mockEService.producerId,
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        purposeVersionDocumentNotFound(
          mockPurpose.id,
          mockPurposeVersion.id,
          randomDocumentId
        )
      );
    });
    it("should throw organizationNotAllowed if the requester is not the producer nor the consumer", async () => {
      const randomId: TenantId = generateId();
      const mockDocument = getMockPurposeVersionDocument();
      const mockEService = getMockEService();
      const mockPurposeVersion = {
        ...getMockPurposeVersion(),
        riskAnalysis: mockDocument,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.getRiskAnalysisDocument({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          documentId: mockDocument.id,
          organizationId: randomId,
          logger: genericLogger,
        })
      ).rejects.toThrowError(organizationNotAllowed(randomId));
    });
  });
