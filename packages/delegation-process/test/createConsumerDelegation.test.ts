import { fail } from "assert";
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockDelegation,
  getMockEService,
  getMockTenant,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  DelegationId,
  delegationKind,
  delegationState,
  ConsumerDelegationSubmittedV2,
  EServiceId,
  generateId,
  TenantId,
  toDelegationV2,
  agreementState,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  delegationAlreadyExists,
  delegationRelatedAgreementExists,
  delegatorAndDelegateSameIdError,
  eserviceNotConsumerDelegable,
  eserviceNotFound,
  originNotCompliant,
  tenantNotAllowedToDelegation,
  tenantNotFound,
} from "../src/model/domain/errors.js";

import {
  activeDelegationStates,
  inactiveDelegationStates,
} from "../src/services/validators.js";
import { config } from "../src/config/config.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEservice,
  addOneTenant,
  delegationService,
  readLastDelegationEvent,
} from "./utils.js";

/**
 * Validates the creation of a delegation by comparing the actual delegation
 * with the expected delegation. It ensures that the delegation IDs are defined
 * and equal, and verifies that the last delegation event matches the expected
 * delegation data.
 *
 * @param actualDelegation - The actual delegation object to be validated,
 * typically a response from an API.
 * @param expectedDelegation - The expected delegation object to compare against.
 * @returns A promise that resolves to void.
 * @throws Will fail if the delegation is not found in the event store.
 */
const expectedDelegationCreation = async (
  actualDelegation: Delegation,
  expectedDelegation: Delegation
): Promise<void> => {
  expect(actualDelegation.id).toBeDefined();
  expect(expectedDelegation.id).toBeDefined();
  expect(actualDelegation.id).toEqual(expectedDelegation.id);

  const lastDelegationEvent = await readLastDelegationEvent(
    actualDelegation.id
  );

  if (!lastDelegationEvent) {
    fail("Creation fails: delegation not found in event-store");
  }

  const actualDelegationData = decodeProtobufPayload({
    messageType: ConsumerDelegationSubmittedV2,
    payload: lastDelegationEvent.data,
  });

  expect(actualDelegation).toMatchObject(expectedDelegation);
  expect(actualDelegationData.delegation).toEqual(
    toDelegationV2(expectedDelegation)
  );
};

describe("create consumer delegation", () => {
  config.delegationsAllowedOrigins = ["IPA", "TEST"];

  it.each(config.delegationsAllowedOrigins)(
    "should create a delegation if it does not exist (origin: %s)",
    async (origin) => {
      const currentExecutionTime = new Date();
      vi.useFakeTimers();
      vi.setSystemTime(currentExecutionTime);

      const delegatorId = generateId<TenantId>();
      const authData = getRandomAuthData(delegatorId);
      const delegator = {
        ...getMockTenant(delegatorId),
        externalId: {
          origin,
          value: "test",
        },
      };

      const delegate = {
        ...getMockTenant(),
        features: [
          {
            type: "DelegatedConsumer" as const,
            availabilityTimestamp: currentExecutionTime,
          },
        ],
      };
      const eservice = {
        ...getMockEService(generateId<EServiceId>(), delegatorId),
        isDelegable: true,
      };

      await addOneTenant(delegator);
      await addOneTenant(delegate);
      await addOneEservice(eservice);

      const actualDelegation = await delegationService.createConsumerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: eservice.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      );

      const expectedDelegation: Delegation = {
        id: actualDelegation.id,
        delegatorId,
        delegateId: delegate.id,
        eserviceId: eservice.id,
        kind: delegationKind.delegatedConsumer,
        state: delegationState.waitingForApproval,
        createdAt: currentExecutionTime,
        submittedAt: currentExecutionTime,
        stamps: {
          submission: {
            who: authData.userId,
            when: currentExecutionTime,
          },
        },
      };

      await expectedDelegationCreation(actualDelegation, expectedDelegation);
      vi.useRealTimers();
    }
  );

  it.each(inactiveDelegationStates)(
    "should create a new delegation if the same delegation exists and is in state %s",
    async (inactiveDelegationState) => {
      const currentExecutionTime = new Date();
      vi.useFakeTimers();
      vi.setSystemTime(currentExecutionTime);

      const delegatorId = generateId<TenantId>();
      const authData = getRandomAuthData(delegatorId);
      const delegator = {
        ...getMockTenant(delegatorId),
        externalId: {
          origin: "IPA",
          value: "test",
        },
      };

      const delegate = {
        ...getMockTenant(),
        features: [
          {
            type: "DelegatedConsumer" as const,
            availabilityTimestamp: currentExecutionTime,
          },
        ],
      };
      const eservice = {
        ...getMockEService(generateId<EServiceId>(), delegatorId),
        isDelegable: true,
      };

      const existentDelegation = {
        ...getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          id: generateId<DelegationId>(),
          delegatorId,
          delegateId: delegate.id,
          eserviceId: eservice.id,
        }),
        state: inactiveDelegationState,
      };

      await addOneTenant(delegator);
      await addOneTenant(delegate);
      await addOneEservice(eservice);
      await addOneDelegation(existentDelegation);

      const actualDelegation = await delegationService.createConsumerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: eservice.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      );

      const expectedDelegation: Delegation = {
        id: actualDelegation.id,
        delegatorId,
        delegateId: delegate.id,
        eserviceId: eservice.id,
        kind: delegationKind.delegatedConsumer,
        state: delegationState.waitingForApproval,
        createdAt: currentExecutionTime,
        submittedAt: currentExecutionTime,
        stamps: {
          submission: {
            who: authData.userId,
            when: currentExecutionTime,
          },
        },
      };

      await expectedDelegationCreation(actualDelegation, expectedDelegation);
      expect(actualDelegation.id).not.toEqual(existentDelegation.id);

      vi.useRealTimers();
    }
  );

  it.each(activeDelegationStates)(
    "should throw a delegationAlreadyExists error when a consumer Delegation in state %s already exists with same delegator, delegate and eservice",
    async (activeDelegationState) => {
      const delegatorId = generateId<TenantId>();
      const authData = getRandomAuthData(delegatorId);
      const delegator = {
        ...getMockTenant(delegatorId),
        externalId: {
          origin: "IPA",
          value: "test",
        },
      };

      const delegate = {
        ...getMockTenant(),
        features: [
          {
            type: "DelegatedConsumer" as const,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      const eservice = {
        ...getMockEService(generateId<EServiceId>(), delegatorId),
        isDelegable: true,
      };
      const existientActiveDelegation = {
        ...getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          id: generateId<DelegationId>(),
          delegatorId,
          delegateId: delegate.id,
          eserviceId: eservice.id,
        }),
        state: activeDelegationState,
      };

      await addOneTenant(delegate);
      await addOneTenant(delegator);
      await addOneEservice(eservice);
      // Add existent active delegation for the same delegator, delegate and eservice
      await addOneDelegation(existientActiveDelegation);
      // Add existent inactive delegation for the same delegator, delegate and eservice
      await addOneDelegation({
        ...existientActiveDelegation,
        id: generateId<DelegationId>(),
        state: randomArrayItem(inactiveDelegationStates),
      });

      // Add another generic delegation
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedConsumer,
        })
      );

      // Add another delegation with same delegator
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          delegatorId,
        })
      );

      // Add another delegation with same delegate
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          delegateId: delegate.id,
        })
      );

      // Add another delegation for the same eservice
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          eserviceId: eservice.id,
        })
      );

      await expect(
        delegationService.createConsumerDelegation(
          {
            delegateId: delegate.id,
            eserviceId: eservice.id,
          },
          {
            authData,
            logger: genericLogger,
            correlationId: generateId(),
            serviceName: "DelegationServiceTest",
          }
        )
      ).rejects.toThrowError(
        delegationAlreadyExists(
          delegatorId,
          existientActiveDelegation.eserviceId,
          delegationKind.delegatedConsumer
        )
      );
    }
  );

  it("should throw a tenantNotFound error if delegated tenant does not exist", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "test",
      },
    };
    const delegateId = generateId<TenantId>();
    const eservice = { ...getMockEService(), isDelegable: true };

    await addOneTenant(delegator);
    await addOneEservice(eservice);

    await expect(
      delegationService.createConsumerDelegation(
        {
          delegateId,
          eserviceId: eservice.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(tenantNotFound(delegateId));
  });

  it("should throw a tenantNotFound error if delegator tenant does not exist", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);

    const delegate = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedConsumer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };
    const eservice = { ...getMockEService(), isDelegable: true };

    await addOneTenant(delegate);
    await addOneEservice(eservice);

    await expect(
      delegationService.createConsumerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: eservice.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(tenantNotFound(delegatorId));
  });

  it("should throw an invalidDelegatorAndDelegateAreSame error if delegatorId and delegateId is the same", async () => {
    const sameTenantId = generateId<TenantId>();
    const authData = getRandomAuthData(sameTenantId);

    await expect(
      delegationService.createConsumerDelegation(
        {
          delegateId: sameTenantId,
          eserviceId: generateId<EServiceId>(),
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(delegatorAndDelegateSameIdError());
  });

  it("should throw a originNotCompliant error if delegator has externalId origin not compliant", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "UNKNOWN_ORIGIN",
        value: "test",
      },
    };
    const delegate = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedConsumer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };
    const eservice = {
      ...getMockEService(generateId<EServiceId>(), delegatorId),
      isDelegable: true,
    };

    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEservice(eservice);

    await expect(
      delegationService.createConsumerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: eservice.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(originNotCompliant(delegator, "Delegator"));
  });

  it("should throw a originNotCompliant error if delegate has externalId origin not compliant", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "test",
      },
    };

    const delegate = {
      ...getMockTenant(),
      externalId: {
        origin: "UNKNOWN_ORIGIN",
        value: "test",
      },
      features: [
        {
          type: "DelegatedConsumer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };
    const eservice = {
      ...getMockEService(generateId<EServiceId>(), delegatorId),
      isDelegable: true,
    };

    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEservice(eservice);

    await expect(
      delegationService.createConsumerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: eservice.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(originNotCompliant(delegate, "Delegate"));
  });

  it("should throw an eserviceNotFound error if Eservice does not exist", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "test",
      },
    };

    const delegate = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedConsumer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };
    const eserviceId = generateId<EServiceId>();

    await addOneTenant(delegator);
    await addOneTenant(delegate);

    await expect(
      delegationService.createConsumerDelegation(
        {
          delegateId: delegate.id,
          eserviceId,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(eserviceNotFound(eserviceId));
  });

  it("should throw a tenantNotAllowedToDelegation error if delegate tenant has no DelegatedConsumer feature", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "test",
      },
    };

    const delegate = getMockTenant();
    const eservice = {
      ...getMockEService(generateId<EServiceId>(), delegatorId),
      isDelegable: true,
    };

    await addOneTenant(delegate);
    await addOneTenant(delegator);
    await addOneEservice(eservice);

    await expect(
      delegationService.createConsumerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: eservice.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(
      tenantNotAllowedToDelegation(
        delegate.id,
        delegationKind.delegatedConsumer
      )
    );
  });

  it("should throw an eserviceNotConsumerDelegable error if Eservice is not consumer delegable", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "test",
      },
    };

    const delegate = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedConsumer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };

    const eservice = {
      ...getMockEService(generateId<EServiceId>(), delegatorId),
      isDelegable: false,
    };

    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEservice(eservice);

    await expect(
      delegationService.createConsumerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: eservice.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(eserviceNotConsumerDelegable(eservice.id));
  });

  it.each([
    agreementState.active,
    agreementState.pending,
    agreementState.suspended,
  ])(
    "should throw delegationRelatedAgreementExists error for %s agreement",
    async (state) => {
      const delegatorId = generateId<TenantId>();
      const authData = getRandomAuthData(delegatorId);
      const delegator = {
        ...getMockTenant(delegatorId),
        externalId: {
          origin: "IPA",
          value: "test",
        },
      };
      const delegate = {
        ...getMockTenant(),
        features: [
          {
            type: "DelegatedConsumer" as const,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      const eservice = {
        ...getMockEService(generateId<EServiceId>(), delegatorId),
        isDelegable: true,
      };

      const activeAgreement = getMockAgreement(
        eservice.id,
        delegator.id,
        state
      );

      await addOneTenant(delegator);
      await addOneTenant(delegate);
      await addOneEservice(eservice);
      await addOneAgreement(activeAgreement);

      await expect(
        delegationService.createConsumerDelegation(
          {
            delegateId: delegate.id,
            eserviceId: eservice.id,
          },
          {
            authData,
            logger: genericLogger,
            correlationId: generateId(),
            serviceName: "DelegationServiceTest",
          }
        )
      ).rejects.toThrowError(
        delegationRelatedAgreementExists(
          activeAgreement.id,
          eservice.id,
          delegator.id
        )
      );
    }
  );
});
