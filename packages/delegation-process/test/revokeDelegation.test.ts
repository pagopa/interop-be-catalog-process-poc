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
  ProducerDelegationRevokedV2,
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
import { DelegationRevocationPDFPayload } from "../src/model/domain/models.js";
import {
  addOneDelegation,
  addOneEservice,
  addOneTenant,
  delegationService,
  fileManager,
  pdfGenerator,
  readLastDelegationEvent,
} from "./utils.js";

const TEST_EXECUTION_DATE = new Date();

describe.each([
  delegationKind.delegatedConsumer,
  delegationKind.delegatedProducer,
])("revoke %s delegation", (kind) => {
  const revokeFn =
    kind === delegationKind.delegatedConsumer
      ? delegationService.revokeConsumerDelegation
      : delegationService.revokeProducerDelegation;

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
        kind,
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

    await revokeFn(existentDelegation.id, {
      authData,
      logger: genericLogger,
      correlationId: generateId(),
      serviceName: "DelegationServiceTest",
    });

    const event = await readLastDelegationEvent(existentDelegation.id);
    expect(event.version).toBe("1");

    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType:
        kind === delegationKind.delegatedConsumer
          ? ConsumerDelegationRevokedV2
          : ProducerDelegationRevokedV2,
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
      prettyName: `Revoca_Delega_${eservice.name}`,
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

    const expectedPdfPayload: DelegationRevocationPDFPayload = {
      delegationKindText:
        kind === delegationKind.delegatedConsumer
          ? "alla fruizione"
          : "all’erogazione",
      todayDate: dateAtRomeZone(currentExecutionTime),
      todayTime: timeAtRomeZone(currentExecutionTime),
      delegationId: revokedDelegationWithoutContract.id,
      delegatorName: delegator.name,
      delegatorIpaCode: delegator.externalId.value,
      delegateName: delegate.name,
      delegateIpaCode: delegate.externalId.value,
      eserviceId: eservice.id,
      eserviceName: eservice.name,
      submitterId: revokedDelegationWithoutContract.stamps.submission.who,
      revokerId: revokedDelegationWithoutContract.stamps.revocation!.who,
      revocationDate: dateAtRomeZone(currentExecutionTime),
      revocationTime: timeAtRomeZone(currentExecutionTime),
    };

    expect(pdfGenerator.generate).toHaveBeenCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../src",
        "resources/templates",
        "delegationRevokedTemplate.html"
      ),
      expectedPdfPayload
    );
  });

  it("should throw a delegationNotFound if Delegation does not exist", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegationId = generateId<DelegationId>();
    await expect(
      revokeFn(delegationId, {
        authData,
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "DelegationServiceTest",
      })
    ).rejects.toThrow(delegationNotFound(delegationId, kind));
  });

  it(`should throw delegationNotFound when delegation kind is not ${kind}`, async () => {
    const delegate = getMockTenant();
    const delegation = getMockDelegation({
      kind:
        kind === delegationKind.delegatedConsumer
          ? delegationKind.delegatedProducer
          : delegationKind.delegatedConsumer,
      state: "WaitingForApproval",
      delegateId: delegate.id,
    });
    await addOneDelegation(delegation);

    await expect(
      revokeFn(delegation.id, {
        authData: getRandomAuthData(delegate.id),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrow(delegationNotFound(delegation.id, kind));
  });

  it("should throw a delegatorNotAllowToRevoke if Requester is not Delegator", async () => {
    const delegatorId = generateId<TenantId>();
    const delegateId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegationId = generateId<DelegationId>();

    const existentDelegation = getMockDelegation({
      kind,
      id: delegationId,
      delegateId,
    });

    await addOneDelegation(existentDelegation);

    await expect(
      revokeFn(delegationId, {
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
        kind,
        delegatorId,
        delegateId,
        state,
      });

      await addOneDelegation(existentDelegation);

      await expect(
        revokeFn(existentDelegation.id, {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        })
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
