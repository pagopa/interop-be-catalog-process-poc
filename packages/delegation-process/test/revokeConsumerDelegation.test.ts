import { fileURLToPath } from "url";
import path from "path";
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
  ConsumerDelegationRevokedV2,
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
  dateAtRomeZone,
  formatDateyyyyMMddHHmmss,
  genericLogger,
  timeAtRomeZone,
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
  delegationConsumerService,
  fileManager,
  pdfGenerator,
  readLastDelegationEvent,
} from "./utils.js";

describe("revoke consumer delegation", () => {
  const TEST_EXECUTION_DATE = new Date();

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_EXECUTION_DATE);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should revoke a delegation if it exists", async () => {
    vi.spyOn(pdfGenerator, "generate");
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
        kind: delegationKind.delegatedConsumer,
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

    await delegationConsumerService.revokeConsumerDelegation(
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
      messageType: ConsumerDelegationRevokedV2,
      payload: event.data,
    });

    const expectedContractId = unsafeBrandId<DelegationContractId>(
      actualDelegation!.revocationContract!.id
    );
    const expectedContractName = `${formatDateyyyyMMddHHmmss(
      currentExecutionTime
    )}_delegation_revocation_contract.pdf`;
    const expectedContract = {
      id: expectedContractId,
      contentType: "application/pdf",
      createdAt: currentExecutionTime,
      name: expectedContractName,
      path: `${config.delegationDocumentPath}/${existentDelegation.id}/${expectedContractId}/${expectedContractName}`,
      prettyName: "Revoca della delega",
    };

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(expectedContract.path);

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
      revocationContract: expectedContract,
    });
    expect(actualDelegation).toEqual(expectedDelegation);

    expect(pdfGenerator.generate).toHaveBeenCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../src",
        "resources/templates",
        "delegationRevokedTemplate.html"
      ),
      {
        delegationKindText: "alla fruizione",
        todayDate: dateAtRomeZone(currentExecutionTime),
        todayTime: timeAtRomeZone(currentExecutionTime),
        delegationId: revokedDelegationWithoutContract.id,
        delegatorName: delegator.name,
        delegatorCode: delegator.externalId.value,
        delegateName: delegate.name,
        delegateCode: delegate.externalId.value,
        eserviceId: eservice.id,
        eserviceName: eservice.name,
        submitterId: revokedDelegationWithoutContract.stamps.submission.who,
        revokerId: revokedDelegationWithoutContract.stamps.revocation!.who,
        revocationDate: dateAtRomeZone(currentExecutionTime),
        revocationTime: timeAtRomeZone(currentExecutionTime),
      }
    );
  });

  it("should throw a delegationNotFound if Delegation does not exist", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegationId = generateId<DelegationId>();
    await expect(
      delegationConsumerService.revokeConsumerDelegation(delegationId, {
        authData,
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "DelegationServiceTest",
      })
    ).rejects.toThrow(
      delegationNotFound(delegationId, delegationKind.delegatedConsumer)
    );
  });

  it("should throw delegationNotFound when delegation kind is not DelegatedConsumer", async () => {
    const delegate = getMockTenant();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      state: "WaitingForApproval",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    await expect(
      delegationConsumerService.revokeConsumerDelegation(delegation.id, {
        authData: getRandomAuthData(delegate.id),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrow(
      delegationNotFound(delegation.id, delegationKind.delegatedConsumer)
    );
  });

  it("should throw a delegatorNotAllowToRevoke if Requester is not Delegator", async () => {
    const delegatorId = generateId<TenantId>();
    const delegateId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegationId = generateId<DelegationId>();

    const existentDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      id: delegationId,
      delegateId,
    });

    await addOneDelegation(existentDelegation);

    await expect(
      delegationConsumerService.revokeConsumerDelegation(delegationId, {
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
        kind: delegationKind.delegatedConsumer,
        delegatorId,
        delegateId,
        state,
      });

      await addOneDelegation(existentDelegation);

      await expect(
        delegationConsumerService.revokeConsumerDelegation(
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
