/* eslint-disable functional/no-let */
import {
  decodeProtobufPayload,
  getMockDelegation,
  getMockTenant,
  getMockEService,
  getRandomAuthData,
} from "pagopa-interop-commons-test/index.js";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProducerDelegationApprovedV2,
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
  formatDateyyyyMMddHHmmss,
  genericLogger,
} from "pagopa-interop-commons";
import {
  delegationNotFound,
  operationRestrictedToDelegate,
  incorrectState,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import { contractBuilder } from "../src/services/delegationContractBuilder.js";
import {
  addOneDelegation,
  addOneTenant,
  addOneEservice,
  delegationProducerService,
  fileManager,
  readLastDelegationEvent,
  pdfGenerator,
  flushPDFMetadata,
} from "./utils.js";

describe("approve producer delegation", () => {
  const currentExecutionTime = new Date();
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
    const delegationId = generateId<DelegationId>();
    const authData = getRandomAuthData(delegate.id);

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      id: delegationId,
      state: "WaitingForApproval",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);
    const { version } = await readLastDelegationEvent(delegation.id);
    expect(version).toBe("0");

    await delegationProducerService.approveProducerDelegation(delegation.id, {
      authData,
      serviceName: "",
      correlationId: generateId(),
      logger: genericLogger,
    });

    const event = await readLastDelegationEvent(delegation.id);
    expect(event.version).toBe("1");

    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType: ProducerDelegationApprovedV2,
      payload: event.data,
    });

    const expectedContractFilePath = (
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    )[0];

    const documentId = unsafeBrandId<DelegationContractId>(
      expectedContractFilePath.split("/")[2]
    );

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
      activationContract: {
        id: documentId,
        contentType: "application/pdf",
        createdAt: currentExecutionTime,
        name: `${formatDateyyyyMMddHHmmss(
          currentExecutionTime
        )}_delegation_activation_contract.pdf`,
        path: expectedContractFilePath,
        prettyName: "Delega",
      },
    });
    expect(actualDelegation).toEqual(expectedDelegation);

    const actualContract = await fileManager.get(
      config.s3Bucket,
      expectedContractFilePath,
      genericLogger
    );

    const { path: expectedContractPath } =
      await contractBuilder.createActivationContract({
        delegation: approvedDelegationWithoutContract,
        delegator,
        delegate,
        eservice,
        pdfGenerator,
        fileManager,
        config,
        logger: genericLogger,
      });

    const expectedContract = await fileManager.get(
      config.s3Bucket,
      expectedContractPath,
      genericLogger
    );

    expect(flushPDFMetadata(actualContract, currentExecutionTime)).toEqual(
      flushPDFMetadata(expectedContract, currentExecutionTime)
    );
  });

  it("should throw delegationNotFound when delegation doesn't exist", async () => {
    const delegateId = getMockTenant().id;
    const nonExistentDelegationId =
      unsafeBrandId<DelegationId>("non-existent-id");

    await expect(
      delegationProducerService.approveProducerDelegation(
        nonExistentDelegationId,
        {
          authData: getRandomAuthData(delegateId),
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrow(delegationNotFound(nonExistentDelegationId));
  });

  it("should throw operationRestrictedToDelegate when approver is not the delegate", async () => {
    const wrongDelegate = getMockTenant();
    await addOneTenant(wrongDelegate);
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      state: "WaitingForApproval",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    await expect(
      delegationProducerService.approveProducerDelegation(delegation.id, {
        authData: getRandomAuthData(wrongDelegate.id),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrow(
      operationRestrictedToDelegate(wrongDelegate.id, delegation.id)
    );
  });

  it("should throw incorrectState when delegation is not in WaitingForApproval state", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      state: "Active",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    await expect(
      delegationProducerService.approveProducerDelegation(delegation.id, {
        authData: getRandomAuthData(delegate.id),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrow(
      incorrectState(
        delegation.id,
        delegationState.active,
        delegationState.waitingForApproval
      )
    );
  });

  it("should generete a pdf document for a delegation", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      state: "WaitingForApproval",
      delegateId: delegate.id,
      delegatorId: delegator.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);
    const { version } = await readLastDelegationEvent(delegation.id);
    expect(version).toBe("0");

    await delegationProducerService.approveProducerDelegation(delegation.id, {
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
