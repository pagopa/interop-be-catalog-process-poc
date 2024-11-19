/* eslint-disable fp/no-delete */
/* eslint-disable functional/immutable-data */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getMockVerifiedTenantAttribute,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementId,
  AgreementRejectedV2,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Descriptor,
  EService,
  Tenant,
  TenantId,
  VerifiedTenantAttribute,
  agreementState,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { agreementRejectableStates } from "../src/model/domain/agreement-validators.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  descriptorNotFound,
  eServiceNotFound,
  operationNotAllowed,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import { agreementToApiAgreement } from "../src/model/domain/apiConverter.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  agreementService,
  readLastAgreementEvent,
} from "./utils.js";
import { mockAgreementRouterRequest } from "./supertestSetup.js";

describe("reject agreement", () => {
  it("should succeed when requester is Producer and the Agreement is in a rejectable state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const producerId = generateId<TenantId>();
    const tenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const revokedTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const tenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const revokedTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const tenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producerId,
          verificationDate: new Date(),
          extensionDate: new Date(new Date().getTime() + 3600 * 1000),
        },
      ],
    };

    const tenantVerifiedAttributeByAnotherProducer: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        { id: generateId<TenantId>(), verificationDate: new Date() },
      ],
    };

    const tenantVerfiedAttributeWithExpiredExtension: VerifiedTenantAttribute =
      {
        ...getMockVerifiedTenantAttribute(),
        verifiedBy: [
          {
            id: producerId,
            verificationDate: new Date(),
            extensionDate: new Date(),
          },
        ],
      };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        tenantCertifiedAttribute,
        revokedTenantCertifiedAttribute,
        tenantDeclaredAttribute,
        revokedTenantDeclaredAttribute,
        tenantVerifiedAttribute,
        tenantVerifiedAttributeByAnotherProducer,
        tenantVerfiedAttributeWithExpiredExtension,
        // Adding some attributes not matching with descriptor attributes
        // to test that they are not kept in the agreement
        getMockVerifiedTenantAttribute(),
        getMockCertifiedTenantAttribute(),
        getMockDeclaredTenantAttribute(),
      ],
    };
    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        // I add also some attributes not matching with tenant attributes
        // to test that they are not kept in the agreement
        certified: [
          [
            getMockEServiceAttribute(tenantCertifiedAttribute.id),
            getMockEServiceAttribute(revokedTenantCertifiedAttribute.id),
            getMockEServiceAttribute(),
          ],
        ],
        verified: [
          [
            getMockEServiceAttribute(tenantVerifiedAttribute.id),
            getMockEServiceAttribute(
              tenantVerifiedAttributeByAnotherProducer.id
            ),
            getMockEServiceAttribute(
              tenantVerfiedAttributeWithExpiredExtension.id
            ),
            getMockEServiceAttribute(),
          ],
        ],
        declared: [
          [
            getMockEServiceAttribute(tenantDeclaredAttribute.id),
            getMockEServiceAttribute(revokedTenantDeclaredAttribute.id),
            getMockEServiceAttribute(),
          ],
        ],
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor],
    };

    const agreement = {
      ...getMockAgreement(),
      eserviceId: eservice.id,
      producerId: eservice.producerId,
      descriptorId: descriptor.id,
      consumerId: consumer.id,
      state: randomArrayItem(agreementRejectableStates),
    };
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(agreement.producerId);
    const returnedAgreement = await mockAgreementRouterRequest.post({
      path: "/agreements/:agreementId/reject",
      pathParams: { agreementId: agreement.id },
      body: {
        reason: "Rejected by producer due to test reasons",
      },
      authData,
    });

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    expect(agreementEvent).toMatchObject({
      type: "AgreementRejected",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementRejected = decodeProtobufPayload({
      messageType: AgreementRejectedV2,
      payload: agreementEvent.data,
    }).agreement;

    /* We must delete some properties because the rejection
    sets them to undefined thus and the protobuf
    serialization strips them from the payload */
    delete agreement.suspendedByConsumer;
    delete agreement.suspendedByProducer;
    delete agreement.suspendedByPlatform;
    const expectedAgreemenentRejected: Agreement = {
      ...agreement,
      state: agreementState.rejected,
      rejectionReason: "Rejected by producer due to test reasons",
      // Keeps only not revoked attributes that are matching in descriptor and tenant
      verifiedAttributes: [{ id: tenantVerifiedAttribute.id }],
      declaredAttributes: [{ id: tenantDeclaredAttribute.id }],
      certifiedAttributes: [{ id: tenantCertifiedAttribute.id }],
      stamps: {
        ...agreement.stamps,
        rejection: {
          who: authData.userId,
          when: new Date(),
        },
      },
    };
    expect(actualAgreementRejected).toMatchObject(
      toAgreementV2(expectedAgreemenentRejected)
    );
    expect(agreementToApiAgreement(expectedAgreemenentRejected)).toEqual(
      returnedAgreement
    );
    vi.useRealTimers();
  });

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    await addOneAgreement(getMockAgreement());
    const authData = getRandomAuthData();
    const agreementId = generateId<AgreementId>();
    await expect(
      agreementService.rejectAgreement(
        agreementId,
        "Rejected by producer due to test reasons",
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw operationNotAllowed when the requester is not the Producer", async () => {
    const authData = getRandomAuthData();
    const agreement = getMockAgreement();
    await addOneAgreement(agreement);
    await expect(
      agreementService.rejectAgreement(
        agreement.id,
        "Rejected by producer due to test reasons",
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw agreementNotInExpectedState when the agreement is not in a rejectable state", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (s) => !agreementRejectableStates.includes(s)
        )
      ),
    };
    await addOneAgreement(agreement);
    const authData = getRandomAuthData(agreement.producerId);
    await expect(
      agreementService.rejectAgreement(
        agreement.id,
        "Rejected by producer due to test reasons",
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });

  it("should throw an eServiceNotFound error when the eService does not exist", async () => {
    await addOneEService(getMockEService());
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementRejectableStates),
    };
    await addOneAgreement(agreement);
    const authData = getRandomAuthData(agreement.producerId);
    await expect(
      agreementService.rejectAgreement(
        agreement.id,
        "Rejected by producer due to test reasons",
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
  });

  it("should throw a tenantNotFound error when the consumer does not exist", async () => {
    await addOneTenant(getMockTenant());

    const descriptor = getMockDescriptorPublished();

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    const consumer = getMockTenant();
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementRejectableStates),
      eserviceId: eservice.id,
      producerId: eservice.producerId,
      consumerId: consumer.id,
      descriptorId: descriptor.id,
    };
    await addOneAgreement(agreement);
    await addOneEService(eservice);
    const authData = getRandomAuthData(agreement.producerId);

    await expect(
      agreementService.rejectAgreement(
        agreement.id,
        "Rejected by producer due to test reasons",
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
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
      state: randomArrayItem(agreementRejectableStates),
      eserviceId: eservice.id,
      producerId: eservice.producerId,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    const authData = getRandomAuthData(agreement.producerId);

    await expect(
      agreementService.rejectAgreement(
        agreement.id,
        "Rejected by producer due to test reasons",
        {
          authData,
          serviceName: "",
          correlationId: generateId(),
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      descriptorNotFound(eservice.id, agreement.descriptorId)
    );
  });
});
