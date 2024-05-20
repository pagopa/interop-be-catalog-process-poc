/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable fp/no-delete */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
  getRandomAuthData,
  randomArrayItem,
  randomBoolean,
} from "pagopa-interop-commons-test/index.js";
import {
  Agreement,
  AgreementId,
  AgreementSuspendedByConsumerV2,
  AgreementSuspendedByProducerV2,
  Descriptor,
  EService,
  TenantId,
  agreementState,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { agreementSuspendableStates } from "../src/model/domain/validators.js";
import { createStamp } from "../src/services/agreementStampUtils.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  descriptorNotFound,
  eServiceNotFound,
  operationNotAllowed,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  agreementService,
  readLastAgreementEvent,
} from "./utils.js";

describe("suspend agreement", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should succeed when requester is Consumer or Producer and the Agreement is in an suspendable state", async () => {
    const producerId = generateId<TenantId>();

    const consumer = getMockTenant();

    const descriptor = getMockDescriptorPublished();
    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: eservice.producerId,
      state: randomArrayItem(agreementSuspendableStates),
    };

    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);

    const requesterId = randomArrayItem([
      agreement.consumerId,
      agreement.producerId,
    ]);
    const authData = getRandomAuthData(requesterId);

    await agreementService.suspendAgreement(agreement.id, {
      authData,
      serviceName: "",
      correlationId: "",
      logger: genericLogger,
    });

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    const isConsumer = requesterId === agreement.consumerId;
    expect(agreementEvent).toMatchObject({
      type: isConsumer
        ? "AgreementSuspendedByConsumer"
        : "AgreementSuspendedByProducer",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementSuspended = decodeProtobufPayload({
      messageType: isConsumer
        ? AgreementSuspendedByConsumerV2
        : AgreementSuspendedByProducerV2,
      payload: agreementEvent.data,
    }).agreement;

    /* The agreement will be suspended with suspendedByConsumer or suspendedByProducer flag set
    to true depending on the requester (consumer or producer) */
    const expectedStamps = {
      suspensionByConsumer: isConsumer
        ? {
            who: authData.userId,
            when: new Date(),
          }
        : agreement.stamps.suspensionByConsumer,
      suspensionByProducer: !isConsumer
        ? {
            who: authData.userId,
            when: new Date(),
          }
        : agreement.stamps.suspensionByProducer,
    };
    const expectedSuspensionFlags = {
      suspendedByConsumer: isConsumer
        ? true
        : agreement.suspendedByConsumer ?? false,
      suspendedByProducer: !isConsumer
        ? true
        : agreement.suspendedByProducer ?? false,
    };
    const expectedAgreementSuspended: Agreement = {
      ...agreement,
      ...expectedSuspensionFlags,
      state: agreementState.suspended,
      suspendedAt: agreement.suspendedAt ?? new Date(),
      stamps: {
        ...agreement.stamps,
        ...expectedStamps,
      },
    };
    expect(actualAgreementSuspended).toMatchObject(
      toAgreementV2(expectedAgreementSuspended)
    );
  });

  it("should succeed when requester is Consumer or Producer, Agreement producer and consumer are the same, and the Agreement is in an suspendable state", async () => {
    const producerAndConsumerId = generateId<TenantId>();

    const consumer = getMockTenant(producerAndConsumerId);
    const descriptor: Descriptor = getMockDescriptorPublished();

    const eservice: EService = {
      ...getMockEService(),
      producerId: producerAndConsumerId,
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: eservice.producerId,
      state: randomArrayItem(agreementSuspendableStates),
    };

    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(producerAndConsumerId);

    await agreementService.suspendAgreement(agreement.id, {
      authData,
      serviceName: "",
      correlationId: "",
      logger: genericLogger,
    });

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    expect(agreementEvent).toMatchObject({
      type: "AgreementSuspendedByProducer",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementSuspended = decodeProtobufPayload({
      messageType: AgreementSuspendedByProducerV2,
      payload: agreementEvent.data,
    }).agreement;

    /* If the consumer and producer of the agreement are the same the agreement will be
    suspended with suspendedByConsumer and suspendedByProducer flags both set to true */
    const expectedAgreementSuspended: Agreement = {
      ...agreement,
      suspendedByConsumer: true,
      suspendedByProducer: true,
      state: agreementState.suspended,
      suspendedAt: agreement.suspendedAt ?? new Date(),
      stamps: {
        ...agreement.stamps,
        suspensionByConsumer: {
          who: authData.userId,
          when: new Date(),
        },
        suspensionByProducer: {
          who: authData.userId,
          when: new Date(),
        },
      },
    };
    expect(actualAgreementSuspended).toMatchObject(
      toAgreementV2(expectedAgreementSuspended)
    );
  });

  it("should preserve the suspension flags and the stamps that it does not update", async () => {
    const producerId = generateId<TenantId>();

    const consumer = getMockTenant();
    const descriptor: Descriptor = getMockDescriptorPublished();
    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor],
    };

    const requesterId = randomArrayItem([consumer.id, producerId]);

    const authData = getRandomAuthData(requesterId);
    const agreement: Agreement = {
      ...getMockAgreement(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: eservice.producerId,
      state: agreementState.suspended,
      suspendedByConsumer: randomBoolean(),
      suspendedByProducer: randomBoolean(),
      suspendedByPlatform: randomBoolean(),
      stamps: {
        activation: createStamp(authData),
        archiving: createStamp(authData),
        rejection: createStamp(authData),
        submission: createStamp(authData),
        upgrade: createStamp(authData),
        suspensionByConsumer: createStamp(authData),
        suspensionByProducer: createStamp(authData),
      },
    };

    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);

    await agreementService.suspendAgreement(agreement.id, {
      authData,
      serviceName: "",
      correlationId: "",
      logger: genericLogger,
    });

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    const isConsumer = requesterId === agreement.consumerId;
    expect(agreementEvent).toMatchObject({
      type: isConsumer
        ? "AgreementSuspendedByConsumer"
        : "AgreementSuspendedByProducer",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementSuspended = decodeProtobufPayload({
      messageType: isConsumer
        ? AgreementSuspendedByConsumerV2
        : AgreementSuspendedByProducerV2,
      payload: agreementEvent.data,
    }).agreement;

    const expectedStamps = {
      suspensionByConsumer: isConsumer
        ? {
            who: authData.userId,
            when: new Date(),
          }
        : agreement.stamps.suspensionByConsumer,
      suspensionByProducer: !isConsumer
        ? {
            who: authData.userId,
            when: new Date(),
          }
        : agreement.stamps.suspensionByProducer,
    };
    const expectedSuspensionFlags = {
      suspendedByConsumer: isConsumer
        ? true
        : agreement.suspendedByConsumer ?? false,
      suspendedByProducer: !isConsumer
        ? true
        : agreement.suspendedByProducer ?? false,
    };
    const expectedAgreementSuspended: Agreement = {
      ...agreement,
      ...expectedSuspensionFlags,
      state: agreementState.suspended,
      suspendedAt: agreement.suspendedAt ?? new Date(),
      stamps: {
        ...agreement.stamps,
        ...expectedStamps,
      },
    };
    expect(actualAgreementSuspended).toMatchObject(
      toAgreementV2(expectedAgreementSuspended)
    );
  });

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    await addOneAgreement(getMockAgreement());
    const authData = getRandomAuthData();
    const agreementId = generateId<AgreementId>();
    await expect(
      agreementService.suspendAgreement(agreementId, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw operationNotAllowed when the requester is not the Consumer or the Producer", async () => {
    const authData = getRandomAuthData();
    const agreement = getMockAgreement();
    await addOneAgreement(agreement);
    await expect(
      agreementService.suspendAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw agreementNotInExpectedState when the agreement is not in a rejectable state", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (s) => !agreementSuspendableStates.includes(s)
        )
      ),
    };
    await addOneAgreement(agreement);
    const authData = getRandomAuthData(agreement.producerId);
    await expect(
      agreementService.suspendAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });

  it("should throw an eServiceNotFound error when the eService does not exist", async () => {
    await addOneEService(getMockEService());
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementSuspendableStates),
    };
    await addOneAgreement(agreement);
    const authData = getRandomAuthData(agreement.producerId);
    await expect(
      agreementService.suspendAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
  });

  it("should throw a tenantNotFound error when the consumer does not exist", async () => {
    await addOneTenant(getMockTenant());
    const eservice = getMockEService();
    const consumer = getMockTenant();
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementSuspendableStates),
      eserviceId: eservice.id,
      producerId: eservice.producerId,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);
    await addOneEService(eservice);
    const authData = getRandomAuthData(agreement.producerId);

    await expect(
      agreementService.suspendAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(agreement.consumerId));
  });

  it("should throw a descriptorNotFound error when the descriptor does not exist", async () => {
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [getMockDescriptorPublished()],
    };
    const consumer = getMockTenant();
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementSuspendableStates),
      eserviceId: eservice.id,
      producerId: eservice.producerId,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    const authData = getRandomAuthData(agreement.producerId);

    await expect(
      agreementService.suspendAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      descriptorNotFound(eservice.id, agreement.descriptorId)
    );
  });
});
