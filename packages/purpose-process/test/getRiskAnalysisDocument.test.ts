/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockPurposeVersionDocument,
  getMockPurposeVersion,
  getMockPurpose,
  getMockAuthData,
  getMockDelegation,
  getMockTenant,
  addSomeRandomDelegations,
  getMockAgreement,
} from "pagopa-interop-commons-test";
import {
  Purpose,
  generateId,
  PurposeId,
  PurposeVersionId,
  PurposeVersionDocumentId,
  TenantId,
  delegationState,
  delegationKind,
  DelegationId,
  tenantKind,
  EService,
  Agreement,
  agreementState,
  eserviceMode,
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
  purposeService,
  addOneEService,
  addOneDelegation,
  addOneTenant,
  addOneAgreement,
} from "./utils.js";

describe("getRiskAnalysisDocument", () => {
  it("should get the purpose version document (consumer)", async () => {
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
    await addOneEService(mockEService);

    const result = await purposeService.getRiskAnalysisDocument({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      documentId: mockDocument.id,
      organizationId: mockPurpose.consumerId,
      logger: genericLogger,
    });
    expect(result).toEqual(mockDocument);
  });
  it("should get the purpose version document (producer)", async () => {
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
    await addOneEService(mockEService);

    const result = await purposeService.getRiskAnalysisDocument({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      documentId: mockDocument.id,
      organizationId: mockEService.producerId,
      logger: genericLogger,
    });
    expect(result).toEqual(mockDocument);
  });
  it("should get the purpose version document (delegate)", async () => {
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
    await addOneEService(mockEService);

    const delegate = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId: delegate.organizationId,
      state: delegationState.active,
      delegatorId: mockEService.producerId,
    });

    await addOneDelegation(delegation);

    const result = await purposeService.getRiskAnalysisDocument({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      documentId: mockDocument.id,
      organizationId: delegate.organizationId,
      logger: genericLogger,
    });
    expect(result).toEqual(mockDocument);
  });
  it("should get the purpose version document created by the delegated consumer if the requester is an e-service delegated consumer", async () => {
    const consumer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const consumerDelegate = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

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
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockEService.id,
      delegatorId: mockPurpose.consumerId,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addSomeRandomDelegations(mockPurpose, addOneDelegation);
    await addOneDelegation(delegation);
    await addOneTenant(consumer);
    await addOneTenant(consumerDelegate);

    const result = await purposeService.getRiskAnalysisDocument({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      documentId: mockDocument.id,
      organizationId: consumerDelegate.id,
      logger: genericLogger,
    });
    expect(result).toEqual(mockDocument);
  });
  it("should get the purpose version document created by the delegated consumer if the requester is an e-service delegated producer", async () => {
    const producer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const producerDelegate = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockDocument = getMockPurposeVersionDocument();
    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
    };
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      riskAnalysis: mockDocument,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    const consumerDelegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      state: delegationState.active,
    });

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: producer.id,
      delegateId: producerDelegate.id,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addSomeRandomDelegations(mockPurpose, addOneDelegation);
    await addOneDelegation(consumerDelegation);
    await addOneDelegation(producerDelegation);
    await addOneTenant(producer);
    await addOneTenant(producerDelegate);

    const result = await purposeService.getRiskAnalysisDocument({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      documentId: mockDocument.id,
      organizationId: producerDelegate.id,
      logger: genericLogger,
    });
    expect(result).toEqual(mockDocument);
  });
  it("should get the purpose version document created by the delegated consumer if the requester is an e-service producer", async () => {
    const producer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockDocument = getMockPurposeVersionDocument();
    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
    };
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      riskAnalysis: mockDocument,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    const consumerDelegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addSomeRandomDelegations(mockPurpose, addOneDelegation);
    await addOneDelegation(consumerDelegation);
    await addOneTenant(producer);

    const result = await purposeService.getRiskAnalysisDocument({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      documentId: mockDocument.id,
      organizationId: producer.id,
      logger: genericLogger,
    });
    expect(result).toEqual(mockDocument);
  });
  it("should get the purpose version document created by the delegated consumer if the requester is an e-service consumer", async () => {
    const consumer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockDocument = getMockPurposeVersionDocument();
    const mockEService: EService = {
      ...getMockEService(),
    };
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      riskAnalysis: mockDocument,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      consumerId: consumer.id,
      delegationId: generateId<DelegationId>(),
    };

    const consumerDelegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addSomeRandomDelegations(mockPurpose, addOneDelegation);
    await addOneDelegation(consumerDelegation);
    await addOneTenant(consumer);

    const result = await purposeService.getRiskAnalysisDocument({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      documentId: mockDocument.id,
      organizationId: consumer.id,
      logger: genericLogger,
    });
    expect(result).toEqual(mockDocument);
  });
  it("should succeed, with purpose version document, when requester is Consumer Delegate and the eservice was created by a delegated producer", async () => {
    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const producerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const eservice: EService = {
      ...getMockEService(),
      mode: eserviceMode.receive,
      producerId: producer.id,
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
      state: agreementState.active,
    };

    const mockDocument = getMockPurposeVersionDocument();
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      riskAnalysis: mockDocument,
    };

    const delegatePurpose: Purpose = {
      ...getMockPurpose(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: producer.id,
      delegateId: producerDelegate.id,
      state: delegationState.active,
    });

    const consumerDelegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOneTenant(producerDelegate);
    await addOneTenant(producer);
    await addOneTenant(consumerDelegate);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOnePurpose(delegatePurpose);
    await addOneDelegation(producerDelegation);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(delegatePurpose, addOneDelegation);

    const result = await purposeService.getRiskAnalysisDocument({
      purposeId: delegatePurpose.id,
      versionId: mockPurposeVersion.id,
      documentId: mockDocument.id,
      organizationId: consumerDelegate.id,
      logger: genericLogger,
    });
    expect(result).toEqual(mockDocument);
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
    await addOneEService(mockEService);

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
    await addOneEService(mockEService);

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
  it("should throw organizationNotAllowed if the requester is not the producer nor the consumer nor the delegate", async () => {
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
    await addOneEService(mockEService);

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
  it.each(
    Object.values(delegationState).filter((s) => s !== delegationState.active)
  )(
    "should throw organizationNotAllowed if the requester is the delegate but the delegation is in %s state",
    async (delegationState) => {
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
      await addOneEService(mockEService);

      const delegate = getMockAuthData();
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: mockEService.id,
        delegateId: delegate.organizationId,
        state: delegationState,
      });

      await addOneDelegation(delegation);

      expect(
        purposeService.getRiskAnalysisDocument({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          documentId: mockDocument.id,
          organizationId: delegate.organizationId,
          logger: genericLogger,
        })
      ).rejects.toThrowError(organizationNotAllowed(delegate.organizationId));
    }
  );
});
