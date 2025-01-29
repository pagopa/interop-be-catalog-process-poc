/* eslint-disable functional/no-let */
import { fileURLToPath } from "url";
import path from "path";
import {
  decodeProtobufPayload,
  getMockDelegation,
  getMockTenant,
  getMockEService,
  getRandomAuthData,
} from "pagopa-interop-commons-test/index.js";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConsumerDelegationApprovedV2,
  DelegationContractId,
  DelegationId,
  EService,
  generateId,
  Tenant,
  toDelegationV2,
  unsafeBrandId,
  delegationKind,
  Delegation,
} from "pagopa-interop-models";
import { delegationState } from "pagopa-interop-models";
import {
  dateAtRomeZone,
  formatDateyyyyMMddHHmmss,
  genericLogger,
  timeAtRomeZone,
} from "pagopa-interop-commons";
import {
  delegationNotFound,
  operationRestrictedToDelegate,
  incorrectState,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import { DelegationActivationPDFPayload } from "../src/model/domain/models.js";
import {
  addOneDelegation,
  addOneTenant,
  addOneEservice,
  fileManager,
  readLastDelegationEvent,
  pdfGenerator,
  delegationService,
} from "./utils.js";

const currentExecutionTime = new Date();

describe.each([
  delegationKind.delegatedConsumer,
  delegationKind.delegatedProducer,
])("approve %s delegation", (kind) => {
  const approveFn =
    kind === delegationKind.delegatedConsumer
      ? delegationService.approveConsumerDelegation
      : delegationService.approveProducerDelegation;

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);
  });

  let delegate: Tenant;
  let delegator: Tenant;
  let eservice: EService;

  beforeEach(async () => {
    delegate = getMockTenant();
    delegator = getMockTenant();
    eservice = getMockEService();
    await addOneTenant(delegate);
    await addOneTenant(delegator);
    await addOneEservice(eservice);
  });

  it("should approve delegation if validations succeed", async () => {
    vi.spyOn(pdfGenerator, "generate");
    const delegationId = generateId<DelegationId>();
    const authData = getRandomAuthData(delegate.id);

    const delegation = getMockDelegation({
      kind,
      id: delegationId,
      state: "WaitingForApproval",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);
    const { version } = await readLastDelegationEvent(delegation.id);
    expect(version).toBe("0");

    await approveFn(delegation.id, {
      authData,
      serviceName: "",
      correlationId: generateId(),
      logger: genericLogger,
    });

    const event = await readLastDelegationEvent(delegation.id);
    expect(event.version).toBe("1");

    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType: ConsumerDelegationApprovedV2,
      payload: event.data,
    });

    const expectedContractId = unsafeBrandId<DelegationContractId>(
      actualDelegation!.activationContract!.id
    );
    const expectedContractName = `${formatDateyyyyMMddHHmmss(
      currentExecutionTime
    )}_delegation_activation_contract.pdf`;
    const expectedContract = {
      id: expectedContractId,
      contentType: "application/pdf",
      createdAt: currentExecutionTime,
      name: expectedContractName,
      path: `${config.delegationDocumentPath}/${delegation.id}/${expectedContractId}/${expectedContractName}`,
      prettyName: `Delega_${eservice.name}`,
    };

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(expectedContract.path);

    const approvedDelegationWithoutContract: Delegation = {
      ...delegation,
      state: delegationState.active,
      approvedAt: currentExecutionTime,
      stamps: {
        ...delegation.stamps,
        activation: {
          who: authData.userId,
          when: currentExecutionTime,
        },
      },
    };

    const expectedDelegation = toDelegationV2({
      ...approvedDelegationWithoutContract,
      activationContract: expectedContract,
    });
    expect(actualDelegation).toEqual(expectedDelegation);

    const expectedPdfPayload: DelegationActivationPDFPayload = {
      delegationKindText:
        kind === delegationKind.delegatedConsumer
          ? "alla fruizione"
          : "all’erogazione",
      todayDate: dateAtRomeZone(currentExecutionTime),
      todayTime: timeAtRomeZone(currentExecutionTime),
      delegationId: approvedDelegationWithoutContract.id,
      delegatorName: delegator.name,
      delegateIpaCode: delegate.externalId.value,
      delegateName: delegate.name,
      delegatorIpaCode: delegator.externalId.value,
      eserviceId: eservice.id,
      eserviceName: eservice.name,
      submitterId: approvedDelegationWithoutContract.stamps.submission.who,
      submissionDate: dateAtRomeZone(currentExecutionTime),
      submissionTime: timeAtRomeZone(currentExecutionTime),
      activatorId: approvedDelegationWithoutContract.stamps.activation!.who,
      activationDate: dateAtRomeZone(currentExecutionTime),
      activationTime: timeAtRomeZone(currentExecutionTime),
    };

    expect(pdfGenerator.generate).toHaveBeenCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../src",
        "resources/templates",
        "delegationApprovedTemplate.html"
      ),
      expectedPdfPayload
    );
  });

  it("should throw delegationNotFound when delegation doesn't exist", async () => {
    const delegateId = getMockTenant().id;
    const nonExistentDelegationId =
      unsafeBrandId<DelegationId>("non-existent-id");

    await expect(
      approveFn(nonExistentDelegationId, {
        authData: getRandomAuthData(delegateId),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrow(delegationNotFound(nonExistentDelegationId, kind));
  });

  it(`should throw delegationNotFound when delegation kind is not ${kind}`, async () => {
    const delegation = getMockDelegation({
      kind:
        kind === delegationKind.delegatedConsumer
          ? delegationKind.delegatedProducer
          : delegationKind.delegatedConsumer,
      state: "WaitingForApproval",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    await expect(
      approveFn(delegation.id, {
        authData: getRandomAuthData(delegate.id),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrow(delegationNotFound(delegation.id, kind));
  });

  it("should throw operationRestrictedToDelegate when approver is not the delegate", async () => {
    const wrongDelegate = getMockTenant();
    await addOneTenant(wrongDelegate);
    const delegation = getMockDelegation({
      kind,
      state: "WaitingForApproval",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    await expect(
      approveFn(delegation.id, {
        authData: getRandomAuthData(wrongDelegate.id),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrow(
      operationRestrictedToDelegate(wrongDelegate.id, delegation.id)
    );
  });

  it.each(
    Object.values(delegationState).filter(
      (state) => state !== delegationState.waitingForApproval
    )
  )(
    "should throw incorrectState when delegation is in %s state",
    async (state) => {
      const delegation = getMockDelegation({
        kind,
        state,
        delegateId: delegate.id,
        delegatorId: delegator.id,
        eserviceId: eservice.id,
      });
      await addOneDelegation(delegation);

      await expect(
        approveFn(delegation.id, {
          authData: getRandomAuthData(delegate.id),
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrow(
        incorrectState(delegation.id, state, delegationState.waitingForApproval)
      );
    }
  );

  it("should generete a pdf document for a delegation", async () => {
    const delegation = getMockDelegation({
      kind,
      state: "WaitingForApproval",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);
    const { version } = await readLastDelegationEvent(delegation.id);
    expect(version).toBe("0");

    await approveFn(delegation.id, {
      authData: getRandomAuthData(delegate.id),
      serviceName: "",
      correlationId: generateId(),
      logger: genericLogger,
    });

    const contracts = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    const hasActivationContract = contracts.some(
      (contract) =>
        contract.includes("activation") && contract.includes(delegation.id)
    );

    expect(hasActivationContract).toBeTruthy();
  });
});
