import {
  Delegation,
  DelegationContractDocument,
  DelegationContractId,
  delegationEventToBinaryDataV2,
  DelegationId,
  delegationKind,
  DelegationKind,
  delegationState,
  DelegationState,
  EService,
  EServiceId,
  generateId,
  Tenant,
  ListResult,
  TenantId,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";

import {
  AppContext,
  DB,
  eventRepository,
  FileManager,
  Logger,
  PDFGenerator,
  WithLogger,
} from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { delegationApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";
import {
  delegationNotFound,
  eserviceNotFound,
  tenantNotFound,
  delegationContractNotFound,
  requesterIsNotConsumerDelegate,
} from "../model/domain/errors.js";
import {
  toCreateEventConsumerDelegationApproved,
  toCreateEventConsumerDelegationRejected,
  toCreateEventConsumerDelegationSubmitted,
  toCreateEventConsumerDelegationRevoked,
  toCreateEventProducerDelegationApproved,
  toCreateEventProducerDelegationRejected,
  toCreateEventProducerDelegationRevoked,
  toCreateEventProducerDelegationSubmitted,
} from "../model/domain/toEvent.js";
import { ReadModelService } from "./readModelService.js";
import {
  activeDelegationStates,
  assertDelegationNotExists,
  assertDelegatorAndDelegateAllowedOrigins,
  assertDelegatorIsNotDelegate,
  assertDelegatorIsProducer,
  assertEserviceIsConsumerDelegable,
  assertIsDelegate,
  assertIsDelegator,
  assertIsState,
  assertNoDelegationRelatedAgreementExists,
  assertRequesterIsDelegateOrDelegator,
  assertTenantAllowedToReceiveDelegation,
} from "./validators.js";
import { contractBuilder } from "./delegationContractBuilder.js";

export const retrieveDelegationById = async (
  {
    delegationId,
    kind,
  }: {
    delegationId: DelegationId;
    kind: DelegationKind | undefined;
  },
  readModelService: ReadModelService
): Promise<WithMetadata<Delegation>> => {
  const delegation = await readModelService.getDelegationById(
    delegationId,
    kind
  );
  if (!delegation?.data) {
    throw delegationNotFound(delegationId, kind);
  }
  return delegation;
};

export const retrieveTenantById = async (
  readModelService: ReadModelService,
  tenantId: TenantId
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

export const retrieveEserviceById = async (
  readModelService: ReadModelService,
  id: EServiceId
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(id);
  if (!eservice) {
    throw eserviceNotFound(id);
  }
  return eservice.data;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationServiceBuilder(
  readModelService: ReadModelService,
  dbInstance: DB,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager
) {
  const repository = eventRepository(dbInstance, delegationEventToBinaryDataV2);

  async function createDelegation(
    {
      delegateId,
      eserviceId,
      kind,
    }: {
      delegateId: TenantId;
      eserviceId: EServiceId;
      kind: DelegationKind;
    },
    { authData, logger, correlationId }: WithLogger<AppContext>
  ): Promise<Delegation> {
    const delegatorId = unsafeBrandId<TenantId>(authData.organizationId);

    logger.info(
      `Creating a delegation for tenant ${delegateId} by ${
        kind === delegationKind.delegatedConsumer ? "consumer" : "producer"
      } ${delegatorId}`
    );

    assertDelegatorIsNotDelegate(delegatorId, delegateId);

    const [delegator, delegate, eservice] = await Promise.all([
      retrieveTenantById(readModelService, delegatorId),
      retrieveTenantById(readModelService, delegateId),
      retrieveEserviceById(readModelService, eserviceId),
    ]);

    assertTenantAllowedToReceiveDelegation(delegate, kind);
    await assertDelegatorAndDelegateAllowedOrigins(delegator, delegate);

    await match(kind)
      .with(delegationKind.delegatedProducer, () =>
        assertDelegatorIsProducer(delegatorId, eservice)
      )
      .with(delegationKind.delegatedConsumer, async () => {
        assertEserviceIsConsumerDelegable(eservice);

        await assertNoDelegationRelatedAgreementExists(
          delegator.id,
          eservice.id,
          readModelService
        );
      })
      .exhaustive();

    await assertDelegationNotExists(
      delegator,
      eserviceId,
      kind,
      readModelService
    );

    const creationDate = new Date();
    const delegation = {
      id: generateId<DelegationId>(),
      delegatorId,
      delegateId,
      eserviceId,
      createdAt: creationDate,
      submittedAt: creationDate,
      state: delegationState.waitingForApproval,
      kind,
      stamps: {
        submission: {
          who: authData.userId,
          when: creationDate,
        },
      },
    };

    await repository.createEvent(
      match(kind)
        .with(delegationKind.delegatedProducer, () =>
          toCreateEventProducerDelegationSubmitted(delegation, correlationId)
        )
        .with(delegationKind.delegatedConsumer, () =>
          toCreateEventConsumerDelegationSubmitted(delegation, correlationId)
        )
        .exhaustive()
    );

    return delegation;
  }

  async function approveDelegation(
    delegationId: DelegationId,
    kind: DelegationKind,
    { logger, correlationId, authData }: WithLogger<AppContext>
  ): Promise<void> {
    const delegateId = unsafeBrandId<TenantId>(authData.organizationId);

    logger.info(
      `Approving delegation ${delegationId} by delegate ${delegateId}`
    );

    const { data: delegation, metadata } = await retrieveDelegationById(
      {
        delegationId,
        kind,
      },
      readModelService
    );

    assertIsDelegate(delegation, delegateId);
    assertIsState(delegationState.waitingForApproval, delegation);

    const [delegator, delegate, eservice] = await Promise.all([
      retrieveTenantById(readModelService, delegation.delegatorId),
      retrieveTenantById(readModelService, delegation.delegateId),
      retrieveEserviceById(readModelService, delegation.eserviceId),
    ]);

    const now = new Date();
    const approvedDelegationWithoutContract: Delegation = {
      ...delegation,
      state: delegationState.active,
      approvedAt: now,
      stamps: {
        ...delegation.stamps,
        activation: {
          who: authData.userId,
          when: now,
        },
      },
    };

    const activationContract = await contractBuilder.createActivationContract({
      delegation: approvedDelegationWithoutContract,
      delegator,
      delegate,
      eservice,
      pdfGenerator,
      fileManager,
      config,
      logger,
    });

    const approvedDelegation = {
      ...approvedDelegationWithoutContract,
      activationContract,
    };

    await repository.createEvent(
      match(kind)
        .with(delegationKind.delegatedProducer, () =>
          toCreateEventProducerDelegationApproved(
            { data: approvedDelegation, metadata },
            correlationId
          )
        )
        .with(delegationKind.delegatedConsumer, () =>
          toCreateEventConsumerDelegationApproved(
            { data: approvedDelegation, metadata },
            correlationId
          )
        )
        .exhaustive()
    );
  }

  async function rejectDelegation(
    delegationId: DelegationId,
    rejectionReason: string,
    kind: DelegationKind,
    { logger, correlationId, authData }: WithLogger<AppContext>
  ): Promise<void> {
    const delegateId = unsafeBrandId<TenantId>(authData.organizationId);

    logger.info(
      `Rejecting delegation ${delegationId} by delegate ${delegateId}`
    );

    const { data: delegation, metadata } = await retrieveDelegationById(
      {
        delegationId,
        kind,
      },
      readModelService
    );

    assertIsDelegate(delegation, delegateId);
    assertIsState(delegationState.waitingForApproval, delegation);

    const now = new Date();

    const rejectedDelegation = {
      ...delegation,
      state: delegationState.rejected,
      rejectedAt: now,
      rejectionReason,
      stamps: {
        ...delegation.stamps,
        rejection: {
          who: authData.userId,
          when: now,
        },
      },
    };

    await repository.createEvent(
      match(kind)
        .with(delegationKind.delegatedProducer, () =>
          toCreateEventProducerDelegationRejected(
            { data: rejectedDelegation, metadata },
            correlationId
          )
        )
        .with(delegationKind.delegatedConsumer, () =>
          toCreateEventConsumerDelegationRejected(
            { data: rejectedDelegation, metadata },
            correlationId
          )
        )
        .exhaustive()
    );
  }

  async function revokeDelegation(
    delegationId: DelegationId,
    kind: DelegationKind,
    { authData, logger, correlationId }: WithLogger<AppContext>
  ): Promise<void> {
    const delegatorId = unsafeBrandId<TenantId>(authData.organizationId);
    logger.info(
      `Revoking delegation ${delegationId} by ${
        kind === delegationKind.delegatedProducer ? "producer" : "consumer"
      } ${delegatorId}`
    );

    const { data: delegation, metadata } = await retrieveDelegationById(
      {
        delegationId,
        kind,
      },
      readModelService
    );

    assertIsDelegator(delegation, delegatorId);
    assertIsState(activeDelegationStates, delegation);

    const [delegator, delegate, eservice] = await Promise.all([
      retrieveTenantById(readModelService, delegation.delegatorId),
      retrieveTenantById(readModelService, delegation.delegateId),
      retrieveEserviceById(readModelService, delegation.eserviceId),
    ]);

    const now = new Date();
    const revokedDelegationWithoutContract = {
      ...delegation,
      state: delegationState.revoked,
      revokedAt: now,
      stamps: {
        ...delegation.stamps,
        revocation: {
          who: authData.userId,
          when: now,
        },
      },
    };

    const revocationContract = await contractBuilder.createRevocationContract({
      delegation: revokedDelegationWithoutContract,
      delegator,
      delegate,
      eservice,
      pdfGenerator,
      fileManager,
      config,
      logger,
    });

    const revokedDelegation = {
      ...revokedDelegationWithoutContract,
      revocationContract,
    };
    await repository.createEvent(
      match(kind)
        .with(delegationKind.delegatedProducer, () =>
          toCreateEventProducerDelegationRevoked(
            {
              data: revokedDelegation,
              metadata,
            },
            correlationId
          )
        )
        .with(delegationKind.delegatedConsumer, () =>
          toCreateEventConsumerDelegationRevoked(
            {
              data: revokedDelegation,
              metadata,
            },
            correlationId
          )
        )
        .exhaustive()
    );
  }

  return {
    async getDelegationById(
      delegationId: DelegationId,
      logger: Logger
    ): Promise<Delegation> {
      logger.info(`Retrieving delegation by id ${delegationId}`);

      const delegation = await retrieveDelegationById(
        { delegationId, kind: undefined },
        readModelService
      );
      return delegation.data;
    },
    async getDelegations(
      {
        delegateIds,
        delegatorIds,
        delegationStates,
        eserviceIds,
        kind,
        offset,
        limit,
      }: {
        delegateIds: TenantId[];
        delegatorIds: TenantId[];
        delegationStates: DelegationState[];
        eserviceIds: EServiceId[];
        kind: DelegationKind | undefined;
        offset: number;
        limit: number;
      },
      logger: Logger
    ): Promise<ListResult<Delegation>> {
      logger.info(
        `Retrieving delegations with filters: delegateIds=${delegateIds}, delegatorIds=${delegatorIds}, delegationStates=${delegationStates}, eserviceIds=${eserviceIds}, kind=${kind}, offset=${offset}, limit=${limit}`
      );

      return readModelService.getDelegations({
        delegateIds,
        delegatorIds,
        eserviceIds,
        delegationStates,
        kind,
        offset,
        limit,
      });
    },
    async getDelegationContract(
      delegationId: DelegationId,
      contractId: DelegationContractId,
      { logger, authData }: WithLogger<AppContext>
    ): Promise<DelegationContractDocument> {
      logger.info(
        `Retrieving delegation ${delegationId} contract ${contractId}`
      );
      const delegation = await retrieveDelegationById(
        { delegationId, kind: undefined },
        readModelService
      );

      assertRequesterIsDelegateOrDelegator(
        delegation.data,
        authData.organizationId
      );

      const { activationContract, revocationContract } = delegation.data;

      if (contractId === activationContract?.id) {
        return activationContract;
      }

      if (contractId === revocationContract?.id) {
        return revocationContract;
      }

      throw delegationContractNotFound(delegationId, contractId);
    },
    async createProducerDelegation(
      {
        delegateId,
        eserviceId,
      }: {
        delegateId: TenantId;
        eserviceId: EServiceId;
      },
      ctx: WithLogger<AppContext>
    ): Promise<Delegation> {
      return createDelegation(
        {
          delegateId,
          eserviceId,
          kind: delegationKind.delegatedProducer,
        },
        ctx
      );
    },
    async createConsumerDelegation(
      {
        delegateId,
        eserviceId,
      }: {
        delegateId: TenantId;
        eserviceId: EServiceId;
      },
      ctx: WithLogger<AppContext>
    ): Promise<Delegation> {
      return createDelegation(
        {
          delegateId,
          eserviceId,
          kind: delegationKind.delegatedConsumer,
        },
        ctx
      );
    },
    async approveProducerDelegation(
      delegationId: DelegationId,
      ctx: WithLogger<AppContext>
    ): Promise<void> {
      await approveDelegation(
        delegationId,
        delegationKind.delegatedProducer,
        ctx
      );
    },
    async approveConsumerDelegation(
      delegationId: DelegationId,
      ctx: WithLogger<AppContext>
    ): Promise<void> {
      await approveDelegation(
        delegationId,
        delegationKind.delegatedConsumer,
        ctx
      );
    },
    async rejectProducerDelegation(
      delegationId: DelegationId,
      rejectionReason: string,
      ctx: WithLogger<AppContext>
    ): Promise<void> {
      await rejectDelegation(
        delegationId,
        rejectionReason,
        delegationKind.delegatedProducer,
        ctx
      );
    },
    async rejectConsumerDelegation(
      delegationId: DelegationId,
      rejectionReason: string,
      ctx: WithLogger<AppContext>
    ): Promise<void> {
      await rejectDelegation(
        delegationId,
        rejectionReason,
        delegationKind.delegatedConsumer,
        ctx
      );
    },
    async revokeProducerDelegation(
      delegationId: DelegationId,
      ctx: WithLogger<AppContext>
    ): Promise<void> {
      await revokeDelegation(
        delegationId,
        delegationKind.delegatedProducer,
        ctx
      );
    },
    async revokeConsumerDelegation(
      delegationId: DelegationId,
      ctx: WithLogger<AppContext>
    ): Promise<void> {
      await revokeDelegation(
        delegationId,
        delegationKind.delegatedConsumer,
        ctx
      );
    },
    async getConsumerDelegators(
      filters: {
        requesterId: TenantId;
        delegatorName?: string;
        eserviceIds: EServiceId[];
        limit: number;
        offset: number;
      },
      logger: Logger
    ): Promise<delegationApi.CompactTenants> {
      logger.info(
        `Retrieving consumer delegators with filters: ${JSON.stringify(
          filters
        )}`
      );

      const delegation = await readModelService.findDelegations({
        delegateId: filters.requesterId,
        delegationKind: delegationKind.delegatedConsumer,
        states: [delegationState.active],
      });
      if (!delegation || delegation.length === 0) {
        throw requesterIsNotConsumerDelegate(filters.requesterId);
      }

      return await readModelService.getConsumerDelegators(filters);
    },
    async getConsumerDelegatorsWithAgreements(
      filters: {
        requesterId: TenantId;
        delegatorName?: string;
        limit: number;
        offset: number;
      },
      logger: Logger
    ): Promise<delegationApi.CompactTenants> {
      logger.info(
        `Retrieving consumer delegators with active agreements and filters: ${JSON.stringify(
          filters
        )}`
      );
      return await readModelService.getConsumerDelegatorsWithAgreements(
        filters
      );
    },
    async getConsumerEservices(
      filters: {
        requesterId: TenantId;
        delegatorId: TenantId;
        limit: number;
        offset: number;
        eserviceName?: string;
      },
      logger: Logger
    ): Promise<delegationApi.CompactEServices> {
      logger.info(
        `Retrieving delegated consumer eservices with filters: ${JSON.stringify(
          filters
        )}`
      );

      const delegation = await readModelService.findDelegations({
        delegatorId: filters.delegatorId,
        delegateId: filters.requesterId,
        delegationKind: delegationKind.delegatedConsumer,
        states: [delegationState.active],
      });
      if (!delegation || delegation.length === 0) {
        throw requesterIsNotConsumerDelegate(
          filters.requesterId,
          filters.delegatorId
        );
      }

      return await readModelService.getConsumerEservices(filters);
    },
  };
}
