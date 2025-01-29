/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockTenant,
  getMockPurpose,
  getMockValidRiskAnalysisForm,
  getMockDelegation,
  addSomeRandomDelegations,
  getMockAgreement,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import {
  tenantKind,
  Purpose,
  generateId,
  PurposeId,
  EServiceId,
  TenantId,
  EService,
  Delegation,
  delegationKind,
  delegationState,
  Agreement,
  PurposeVersion,
  agreementState,
  eserviceMode,
  purposeVersionState,
  DelegationId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  eserviceNotFound,
  tenantNotFound,
  tenantKindNotFound,
} from "../src/model/domain/errors.js";
import {
  getMockEService,
  addOnePurpose,
  purposeService,
  addOneDelegation,
  addOneAgreement,
  addOneEService,
  addOneTenant,
} from "./utils.js";

describe("getPurposeById", () => {
  it("should get the purpose if it exists", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService = getMockEService();
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
    };
    const mockPurpose2: Purpose = {
      ...getMockPurpose(),
      id: generateId(),
      title: "another purpose",
    };
    await addOnePurpose(mockPurpose1);
    await addOnePurpose(mockPurpose2);
    await addOneEService(mockEService);
    await addOneTenant(mockTenant);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      mockTenant.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: mockPurpose1,
      isRiskAnalysisValid: false,
    });
  });
  it("should get the purpose with the risk analysis form if the requester is the active e-service producer", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
      producerId: mockTenant.id,
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
    };

    await addOnePurpose(mockPurpose1);
    await addOneEService(mockEService);
    await addOneTenant(mockTenant);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      mockTenant.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: mockPurpose1,
      isRiskAnalysisValid: true,
    });
  });
  it("should get the purpose with the risk analysis form if the requester is the purpose agreement consumer", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
    };

    await addOnePurpose(mockPurpose1);
    await addOneEService(mockEService);
    await addOneTenant(mockTenant);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      mockTenant.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: mockPurpose1,
      isRiskAnalysisValid: true,
    });
  });
  it("should get the purpose with the risk analysis form if the requester is an e-service delegated producer", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
    };

    const mockProducerDelegation: Delegation = {
      ...getMockDelegation({ kind: delegationKind.delegatedProducer }),
      delegatorId: mockEService.producerId,
      eserviceId: mockEService.id,
      delegateId: mockTenant.id,
      state: delegationState.active,
    };

    await addOnePurpose(mockPurpose1);
    await addOneEService(mockEService);
    await addOneTenant(mockTenant);
    await addOneDelegation(mockProducerDelegation);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      mockTenant.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: mockPurpose1,
      isRiskAnalysisValid: true,
    });
  });
  it("should get the purpose without the risk analysis form if the requester is not the producer nor the consumer", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
    };

    await addOnePurpose(mockPurpose1);
    await addOneEService(mockEService);
    await addOneTenant(mockTenant);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      mockTenant.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: { ...mockPurpose1, riskAnalysisForm: undefined },
      isRiskAnalysisValid: false,
    });
  });
  it.each(
    Object.values(delegationState).filter((s) => s !== delegationState.active)
  )(
    "should get the purpose without the risk analysis form if the requester has a producer delegation with state %s with the e-service purpose",
    async (delegationState) => {
      const mockTenant = {
        ...getMockTenant(),
        kind: tenantKind.PA,
      };

      const mockEService: EService = {
        ...getMockEService(),
      };
      const mockPurpose1: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      };

      const mockProducerDelegation: Delegation = {
        ...getMockDelegation({ kind: delegationKind.delegatedProducer }),
        delegatorId: mockEService.producerId,
        eserviceId: mockEService.id,
        delegateId: mockTenant.id,
        state: delegationState,
      };

      await addOnePurpose(mockPurpose1);
      await addOneEService(mockEService);
      await addOneTenant(mockTenant);
      await addOneDelegation(mockProducerDelegation);

      const result = await purposeService.getPurposeById(
        mockPurpose1.id,
        mockTenant.id,
        genericLogger
      );
      expect(result).toMatchObject({
        purpose: { ...mockPurpose1, riskAnalysisForm: undefined },
        isRiskAnalysisValid: false,
      });
    }
  );

  it("should get the purpose created by the delegated consumer with the risk analysis form if the requester is an e-service delegated consumer", async () => {
    const consumer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const consumerDelegate = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: mockPurpose1.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose1.eserviceId,
      delegatorId: mockPurpose1.consumerId,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose1);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(mockPurpose1, addOneDelegation);
    await addOneEService(mockEService);
    await addOneTenant(consumer);
    await addOneTenant(consumerDelegate);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      consumerDelegate.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: mockPurpose1,
      isRiskAnalysisValid: true,
    });
  });

  it("should get the purpose created by the delegated consumer with the risk analysis form if the requester is an e-service delegated producer", async () => {
    const producer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const producerDelegate = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      delegationId: generateId<DelegationId>(),
    };

    const consumerDelegation = getMockDelegation({
      id: mockPurpose1.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose1.eserviceId,
      delegatorId: mockPurpose1.consumerId,
      state: delegationState.active,
    });

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockPurpose1.eserviceId,
      delegatorId: producer.id,
      delegateId: producerDelegate.id,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose1);
    await addOneDelegation(consumerDelegation);
    await addOneDelegation(producerDelegation);
    await addSomeRandomDelegations(mockPurpose1, addOneDelegation);
    await addOneEService(mockEService);
    await addOneTenant(producer);
    await addOneTenant(producerDelegate);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      producerDelegate.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: mockPurpose1,
      isRiskAnalysisValid: true,
    });
  });

  it("should get the purpose created by the delegated consumer with the risk analysis form if the requester is an e-service producer", async () => {
    const producer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      delegationId: generateId<DelegationId>(),
    };

    const consumerDelegation = getMockDelegation({
      id: mockPurpose1.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose1.eserviceId,
      delegatorId: mockPurpose1.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose1);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(mockPurpose1, addOneDelegation);
    await addOneEService(mockEService);
    await addOneTenant(producer);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      producer.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: mockPurpose1,
      isRiskAnalysisValid: true,
    });
  });

  it("should get the purpose created by the delegated consumer with the risk analysis form if the requester is an e-service consumer", async () => {
    const consumer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      consumerId: consumer.id,
      delegationId: generateId<DelegationId>(),
    };

    const consumerDelegation = getMockDelegation({
      id: mockPurpose1.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose1.eserviceId,
      delegatorId: mockPurpose1.consumerId,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose1);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(mockPurpose1, addOneDelegation);
    await addOneEService(mockEService);
    await addOneTenant(consumer);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      consumer.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: mockPurpose1,
      isRiskAnalysisValid: true,
    });
  });

  it("should succeed, with the risk analysis, when requester is Consumer Delegate and the eservice was created by a delegated producer", async () => {
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

    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
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

    const result = await purposeService.getPurposeById(
      delegatePurpose.id,
      consumerDelegate.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: delegatePurpose,
      isRiskAnalysisValid: true,
    });
  });

  it("Should return an empty list if the requester is a delegate for the eservice when retrieving a purpose created by the consumer", async () => {
    const tenant = { ...getMockTenant(), kind: tenantKind.PA };
    const eservice = getMockEService();
    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      delegationId: undefined,
    };

    const purposeDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: tenant.id,
      state: delegationState.active,
    });
    await addOnePurpose(purpose);
    await addOneEService(eservice);
    await addOneDelegation(purposeDelegation);
    await addOneTenant(tenant);

    const result = await purposeService.getPurposeById(
      purpose.id,
      purposeDelegation.delegateId,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: {},
      isRiskAnalysisValid: false,
    });
  });
  it("Should return an empty list if exists a purpose delegation but the requester is not the purpose delegate", async () => {
    const tenant = { ...getMockTenant(), kind: tenantKind.PA };
    const eservice = getMockEService();
    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: generateId<DelegationId>(),
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: tenant.id,
      state: delegationState.active,
    });

    const purposeDelegation = getMockDelegation({
      id: purpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });
    await addOnePurpose(purpose);
    await addOneEService(eservice);
    await addOneDelegation(delegation);
    await addOneDelegation(purposeDelegation);
    await addOneTenant(tenant);

    const result = await purposeService.getPurposeById(
      purpose.id,
      delegation.delegateId,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: {},
      isRiskAnalysisValid: false,
    });
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const notExistingId: PurposeId = generateId();
    const mockTenant = getMockTenant();
    const mockPurpose = getMockPurpose();
    await addOnePurpose(mockPurpose);
    await addOneTenant(mockTenant);

    expect(
      purposeService.getPurposeById(notExistingId, mockTenant.id, genericLogger)
    ).rejects.toThrowError(purposeNotFound(notExistingId));
  });
  it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const notExistingId: EServiceId = generateId();
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: notExistingId,
    };
    await addOnePurpose(mockPurpose);
    await addOneTenant(mockTenant);

    expect(
      purposeService.getPurposeById(
        mockPurpose.id,
        mockTenant.id,
        genericLogger
      )
    ).rejects.toThrowError(eserviceNotFound(notExistingId));
  });
  it("should throw tenantNotFound if the tenant doesn't exist", async () => {
    const notExistingId: TenantId = generateId();
    const mockEService = getMockEService();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.getPurposeById(
        mockPurpose.id,
        notExistingId,
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(notExistingId));
  });
  it("should throw tenantKindNotFound if the tenant doesn't exist", async () => {
    const mockTenant = getMockTenant();
    const mockEService = getMockEService();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneTenant(mockTenant);

    expect(
      purposeService.getPurposeById(
        mockPurpose.id,
        mockTenant.id,
        genericLogger
      )
    ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
  });
});
