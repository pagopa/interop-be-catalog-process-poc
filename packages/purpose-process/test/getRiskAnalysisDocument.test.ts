/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockPurposeVersionDocument,
  getMockPurposeVersion,
  getMockPurpose,
  writeInReadmodel,
  getMockAuthData,
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
  getMockEService,
  addOnePurpose,
  eservices,
  purposeService,
} from "./utils.js";
import { mockPurposeRouterRequest } from "./supertestSetup.js";

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
    await addOnePurpose(mockPurpose1);
    await addOnePurpose(mockPurpose2);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const result = await mockPurposeRouterRequest.get({
      path: "/purposes/:purposeId/versions/:versionId/documents/:documentId",
      pathParams: {
        purposeId: mockPurpose1.id,
        versionId: mockPurposeVersion.id,
        documentId: mockDocument.id,
      },
      authData: getMockAuthData(mockEService.producerId),
    });

    expect(result).toEqual({
      ...mockDocument,
      createdAt: mockDocument.createdAt.toISOString(),
    });
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const notExistingId: PurposeId = generateId();
    await addOnePurpose(getMockPurpose());

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

    await addOnePurpose(mockPurpose);
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

    await addOnePurpose(mockPurpose);
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

    await addOnePurpose(mockPurpose);
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
