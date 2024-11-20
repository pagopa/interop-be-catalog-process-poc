import {
  decodeProtobufPayload,
  getMockDelegation,
  getMockEService,
  getMockTenant,
  getRandomAuthData,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  DelegationId,
  ProducerDelegationRevokedV2,
  delegationState,
  generateId,
  TenantId,
  EServiceId,
  unsafeBrandId,
  DelegationContractId,
  delegationKind,
  UserId,
  toDelegationV2,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  formatDateyyyyMMddHHmmss,
  genericLogger,
} from "pagopa-interop-commons";
import {
  delegationNotFound,
  incorrectState,
  operationRestrictedToDelegator,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import {
  activeDelegationStates,
  inactiveDelegationStates,
} from "../src/services/validators.js";
import {
  addOneDelegation,
  addOneEservice,
  addOneTenant,
  delegationProducerService,
  fileManager,
  readLastDelegationEvent,
} from "./utils.js";

describe("revoke producer delegation", () => {
  const TEST_EXECUTION_DATE = new Date();

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_EXECUTION_DATE);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should revoke a delegation if it exists", async () => {
    const currentExecutionTime = new Date();
    const eserviceId = generateId<EServiceId>();
    const delegatorId = generateId<TenantId>();
    const delegateId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);

    const delegationCreationDate = new Date();
    delegationCreationDate.setMonth(currentExecutionTime.getMonth() - 2);

    const delegationActivationDate = new Date();
    delegationActivationDate.setMonth(currentExecutionTime.getMonth() - 1);

    const delegate = getMockTenant(delegateId);
    const delegator = getMockTenant(delegatorId);
    const eservice = getMockEService(eserviceId);

    await addOneTenant(delegate);
    await addOneTenant(delegator);
    await addOneEservice(eservice);

    const existentDelegation: Delegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegatorId,
        delegateId,
      }),
      eserviceId,
      approvedAt: delegationActivationDate,
      submittedAt: delegationCreationDate,
      stamps: {
        submission: {
          who: generateId<UserId>(),
          when: delegationCreationDate,
        },
        activation: {
          who: generateId<UserId>(),
          when: delegationActivationDate,
        },
      },
    };

    await addOneDelegation(existentDelegation);

    await delegationProducerService.revokeProducerDelegation(
      existentDelegation.id,
      {
        authData,
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "DelegationServiceTest",
      }
    );

    const event = await readLastDelegationEvent(existentDelegation.id);
    expect(event.version).toBe("1");

    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType: ProducerDelegationRevokedV2,
      payload: event.data,
    });

    // TODO expected contract - refactor to do what it's done in activateAgreementTests
    const actualContractPath = (
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    )[0];

    const documentId = unsafeBrandId<DelegationContractId>(
      actualContractPath.split("/")[2]
    );

    const revokedDelegationWithoutContract: Delegation = {
      ...existentDelegation,
      state: delegationState.revoked,
      revokedAt: currentExecutionTime,
      stamps: {
        ...existentDelegation.stamps,
        revocation: {
          who: authData.userId,
          when: currentExecutionTime,
        },
      },
    };

    const expectedDelegation = toDelegationV2({
      ...revokedDelegationWithoutContract,
      revocationContract: {
        id: documentId,
        contentType: "application/pdf",
        createdAt: currentExecutionTime,
        name: `${formatDateyyyyMMddHHmmss(
          currentExecutionTime
        )}_delegation_revocation_contract.pdf`,
        path: actualContractPath,
        prettyName: "Revoca della delega",
      },
    });
    expect(actualDelegation).toEqual(expectedDelegation);

    // TODO spy on pdfGenerator.generate and check that it's actually called with what's expected
  });

  it("should throw a delegationNotFound if Delegation does not exist", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegationId = generateId<DelegationId>();
    await expect(
      delegationProducerService.revokeProducerDelegation(delegationId, {
        authData,
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "DelegationServiceTest",
      })
    ).rejects.toThrow(delegationNotFound(delegationId));
  });

  it("should throw a delegatorNotAllowToRevoke if Requester is not Delegator", async () => {
    const delegatorId = generateId<TenantId>();
    const delegateId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegationId = generateId<DelegationId>();

    const existentDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      id: delegationId,
      delegateId,
    });

    await addOneDelegation(existentDelegation);

    await expect(
      delegationProducerService.revokeProducerDelegation(delegationId, {
        authData,
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "DelegationServiceTest",
      })
    ).rejects.toThrow(
      operationRestrictedToDelegator(delegatorId, delegationId)
    );
    vi.useRealTimers();
  });

  it.each(inactiveDelegationStates)(
    "should throw incorrectState when delegation is in %s state",
    async (state) => {
      const delegatorId = generateId<TenantId>();
      const delegateId = generateId<TenantId>();
      const authData = getRandomAuthData(delegatorId);

      const existentDelegation: Delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegatorId,
        delegateId,
        state,
      });

      await addOneDelegation(existentDelegation);

      await expect(
        delegationProducerService.revokeProducerDelegation(
          existentDelegation.id,
          {
            authData,
            logger: genericLogger,
            correlationId: generateId(),
            serviceName: "DelegationServiceTest",
          }
        )
      ).rejects.toThrow(
        incorrectState(
          existentDelegation.id,
          existentDelegation.state,
          activeDelegationStates
        )
      );
    }
  );
});
