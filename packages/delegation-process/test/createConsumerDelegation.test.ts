import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockEService,
  getMockTenant,
  getRandomAuthData,
} from "pagopa-interop-commons-test";
import {
  EServiceId,
  generateId,
  TenantId,
  agreementState,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  delegationRelatedAgreementExists,
  eserviceNotConsumerDelegable,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import {
  addOneAgreement,
  addOneEservice,
  addOneTenant,
  delegationService,
} from "./utils.js";

describe("create consumer delegation", () => {
  config.delegationsAllowedOrigins = ["IPA", "TEST"];

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
