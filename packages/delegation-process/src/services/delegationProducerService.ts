import { delegationApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  DB,
  eventRepository,
  FileManager,
  PDFGenerator,
  WithLogger,
} from "pagopa-interop-commons";
import {
  Delegation,
  DelegationId,
  delegationEventToBinaryDataV2,
  delegationKind,
  EService,
  delegationState,
  EServiceId,
  generateId,
  Tenant,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { eserviceNotFound, tenantNotFound } from "../model/domain/errors.js";
import {
  toCreateEventProducerDelegationSubmitted,
  toCreateEventProducerDelegationRevoked,
  toCreateEventProducerDelegationApproved,
  toCreateEventProducerDelegationRejected,
} from "../model/domain/toEvent.js";
import { config } from "../config/config.js";
import { ReadModelService } from "./readModelService.js";
import {
  assertDelegationNotExists,
  assertDelegatorIsNotDelegate,
  assertDelegatorIsProducer,
  assertTenantAllowedToReceiveDelegation,
  assertIsDelegate,
  assertIsState,
  assertDelegatorAndDelegateAllowedOrigins,
  assertIsDelegator,
  activeDelegationStates,
} from "./validators.js";
import { contractBuilder } from "./delegationContractBuilder.js";
import { retrieveDelegationById } from "./delegationService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationProducerServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager
) {
  const retrieveTenantById = async (tenantId: TenantId): Promise<Tenant> => {
    const tenant = await readModelService.getTenantById(tenantId);
    if (!tenant) {
      throw tenantNotFound(tenantId);
    }
    return tenant;
  };

  const retrieveEserviceById = async (id: EServiceId): Promise<EService> => {
    const eservice = await readModelService.getEServiceById(id);
    if (!eservice) {
      throw eserviceNotFound(id);
    }
    return eservice.data;
  };

  const repository = eventRepository(dbInstance, delegationEventToBinaryDataV2);
  return {
    async createProducerDelegation(
      delegationSeed: delegationApi.DelegationSeed,
      { authData, logger, correlationId }: WithLogger<AppContext>
    ): Promise<Delegation> {
      const delegatorId = unsafeBrandId<TenantId>(authData.organizationId);
      const delegateId = unsafeBrandId<TenantId>(delegationSeed.delegateId);
      const eserviceId = unsafeBrandId<EServiceId>(delegationSeed.eserviceId);

      logger.info(
        `Creating a delegation for tenant ${delegationSeed.delegateId} by producer ${delegatorId}`
      );

      assertDelegatorIsNotDelegate(delegatorId, delegateId);

      const delegator = await retrieveTenantById(delegatorId);
      const delegate = await retrieveTenantById(delegateId);

      assertTenantAllowedToReceiveDelegation(
        delegate,
        delegationKind.delegatedProducer
      );
      await assertDelegatorAndDelegateAllowedOrigins(delegator, delegate);

      const eservice = await retrieveEserviceById(eserviceId);
      assertDelegatorIsProducer(delegatorId, eservice);
      await assertDelegationNotExists(
        delegator,
        eserviceId,
        delegationKind.delegatedProducer,
        readModelService
      );

      const creationDate = new Date();
      const delegation = {
        // add type of delegation
        id: generateId<DelegationId>(),
        delegatorId,
        delegateId,
        eserviceId,
        createdAt: creationDate,
        submittedAt: creationDate,
        state: delegationState.waitingForApproval,
        kind: delegationKind.delegatedProducer,
        stamps: {
          submission: {
            who: authData.userId,
            when: creationDate,
          },
        },
      };

      await repository.createEvent(
        toCreateEventProducerDelegationSubmitted(delegation, correlationId)
      );

      return delegation;
    },
    async revokeProducerDelegation(
      delegationId: DelegationId,
      { authData, logger, correlationId }: WithLogger<AppContext>
    ): Promise<void> {
      const delegatorId = unsafeBrandId<TenantId>(authData.organizationId);
      logger.info(
        `Revoking delegation ${delegationId} by producer ${delegatorId}`
      );

      const { data: delegation, metadata } = await retrieveDelegationById(
        readModelService,
        delegationId
      );

      assertIsDelegator(delegation, delegatorId);
      assertIsState(activeDelegationStates, delegation);

      const [delegator, delegate, eservice] = await Promise.all([
        retrieveTenantById(delegation.delegatorId),
        retrieveTenantById(delegation.delegateId),
        retrieveEserviceById(delegation.eserviceId),
      ]);

      const now = new Date();
      const revokedDelegationWithoutContract = {
        // add type of revokedDelegationWithoutContract
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

      const revocationContract = await contractBuilder.createRevocationContract(
        {
          delegation: revokedDelegationWithoutContract,
          delegator,
          delegate,
          eservice,
          pdfGenerator,
          fileManager,
          config,
          logger,
        }
      );

      const revokedDelegation = {
        // add type of revokedDelegation
        ...revokedDelegationWithoutContract,
        revocationContract,
      };
      await repository.createEvent(
        toCreateEventProducerDelegationRevoked(
          {
            data: revokedDelegation,
            metadata,
          },
          correlationId
        )
      );
    },
    async approveProducerDelegation(
      delegationId: DelegationId,
      { logger, correlationId, authData }: WithLogger<AppContext>
    ): Promise<void> {
      const delegateId = unsafeBrandId<TenantId>(authData.organizationId);

      logger.info(
        `Approving delegation ${delegationId} by delegate ${delegateId}`
      );

      const { data: delegation, metadata } = await retrieveDelegationById(
        readModelService,
        delegationId
      );

      assertIsDelegate(delegation, delegateId);
      assertIsState(delegationState.waitingForApproval, delegation);

      const [delegator, delegate, eservice] = await Promise.all([
        retrieveTenantById(delegation.delegatorId),
        retrieveTenantById(delegation.delegateId),
        retrieveEserviceById(delegation.eserviceId),
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

      const activationContract = await contractBuilder.createActivationContract(
        {
          delegation: approvedDelegationWithoutContract,
          delegator,
          delegate,
          eservice,
          pdfGenerator,
          fileManager,
          config,
          logger,
        }
      );

      const approvedDelegation = {
        // add type of approvedDelegation
        ...approvedDelegationWithoutContract,
        activationContract,
      };

      await repository.createEvent(
        toCreateEventProducerDelegationApproved(
          {
            data: approvedDelegation,
            metadata,
          },
          correlationId
        )
      );
    },
    async rejectProducerDelegation(
      delegationId: DelegationId,
      rejectionReason: string,
      { logger, correlationId, authData }: WithLogger<AppContext>
    ): Promise<void> {
      const delegateId = unsafeBrandId<TenantId>(authData.organizationId);

      logger.info(
        `Rejecting delegation ${delegationId} by delegate ${delegateId}`
      );

      const { data: delegation, metadata } = await retrieveDelegationById(
        readModelService,
        delegationId
      );

      assertIsDelegate(delegation, delegateId);
      assertIsState(delegationState.waitingForApproval, delegation);

      const now = new Date();
      await repository.createEvent(
        toCreateEventProducerDelegationRejected(
          {
            data: {
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
            },
            metadata,
          },
          correlationId
        )
      );
    },
  };
}

export type DelegationProducerService = ReturnType<
  typeof delegationProducerServiceBuilder
>;
