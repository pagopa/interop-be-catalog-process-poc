import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockEService,
  getMockTenant,
  getRandomAuthData,
} from "pagopa-interop-commons-test";
import {
  delegationKind,
  delegationState,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  delegationRelatedAgreementExists,
  eserviceNotDelegable,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneEservice,
  addOneTenant,
  delegationService,
} from "./utils.js";

describe("create consumer delegation", () => {
  it("should throw an eserviceNotDelegable error if Eservice is not delegable", async () => {
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
          type: delegationKind.delegatedConsumer,
          availabilityTimestamp: new Date(),
        },
      ],
    };

    const eservice = getMockEService({
      producerId: delegatorId,
      isDelegable: false,
    });

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
    ).rejects.toThrowError(eserviceNotDelegable(eservice.id));
  });

  it("should throw a delegationRelatedAgreementExists error if an agreement exists", async () => {
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
          type: delegationKind.delegatedConsumer,
          availabilityTimestamp: new Date(),
        },
      ],
    };

    const eservice = getMockEService({
      producerId: delegatorId,
      isDelegable: true,
    });

    const activeAgreement = getMockAgreement(
      eservice.id,
      delegator.id,
      delegationState.active
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
  });
});
