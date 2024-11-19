/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  Descriptor,
  EService,
  descriptorState,
  tenantAttributeType,
  TenantVerifiedAttributeRevokedV2,
  Agreement,
  toReadModelEService,
  toReadModelAgreement,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  writeInReadmodel,
  readLastEventByStreamId,
  getMockAuthData,
  getMockDescriptor,
  getMockTenant,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  tenantNotFound,
  attributeAlreadyRevoked,
  attributeNotFound,
  attributeRevocationNotAllowed,
  verifiedAttributeSelfRevocationNotAllowed,
} from "../src/model/domain/errors.js";
import { toApiTenant } from "../src/model/domain/apiConverter.js";
import {
  addOneTenant,
  getMockAgreement,
  getMockVerifiedTenantAttribute,
  getMockVerifiedBy,
  getMockRevokedBy,
  eservices,
  agreements,
  tenantService,
  postgresDB,
} from "./utils.js";
import { mockTenantAttributeRouterRequest } from "./supertestSetup.js";

describe("revokeVerifiedAttribute", async () => {
  const targetTenant = getMockTenant();
  const revokerTenant = getMockTenant();
  const authData = getMockAuthData(revokerTenant.id);
  const verifiedAttribute = getMockVerifiedTenantAttribute();
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
    attributes: {
      verified: [
        [
          {
            id: verifiedAttribute.id,
            explicitAttributeVerification: false,
          },
        ],
      ],
      declared: [],
      certified: [],
    },
  };
  const eService: EService = {
    ...getMockEService(),
    producerId: revokerTenant.id,
    descriptors: [descriptor],
  };
  const agreementEservice: Agreement = getMockAgreement({
    eserviceId: eService.id,
    descriptorId: descriptor.id,
    producerId: eService.producerId,
    consumerId: targetTenant.id,
  });

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should revoke the VerifiedAttribute if it exist", async () => {
    const mockVerifiedBy = getMockVerifiedBy();
    const tenantWithVerifiedAttribute: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...verifiedAttribute,
          assignmentTimestamp: new Date(),
          verifiedBy: [
            {
              ...mockVerifiedBy,
              id: revokerTenant.id,
            },
          ],
          revokedBy: [],
        },
      ],
      updatedAt: new Date(),
    };

    await addOneTenant(tenantWithVerifiedAttribute);
    await addOneTenant(revokerTenant);
    await writeInReadmodel(toReadModelEService(eService), eservices);
    await writeInReadmodel(toReadModelAgreement(agreementEservice), agreements);

    const returnedTenant = await mockTenantAttributeRouterRequest.delete({
      path: "/tenants/:tenantId/attributes/verified/:attributeId",
      pathParams: {
        tenantId: tenantWithVerifiedAttribute.id,
        attributeId: verifiedAttribute.id,
      },
      authData,
    });

    const writtenEvent = await readLastEventByStreamId(
      tenantWithVerifiedAttribute.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenantWithVerifiedAttribute.id,
      version: "1",
      type: "TenantVerifiedAttributeRevoked",
      event_version: 2,
    });

    const writtenPayload = protobufDecoder(
      TenantVerifiedAttributeRevokedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenantWithVerifiedAttribute,
      attributes: [
        {
          id: verifiedAttribute.id,
          type: tenantAttributeType.VERIFIED,
          assignmentTimestamp: new Date(),
          verifiedBy: [],
          revokedBy: [
            {
              id: revokerTenant.id,
              verificationDate: mockVerifiedBy.verificationDate,
              revocationDate: new Date(),
            },
          ],
        },
      ],
      updatedAt: new Date(),
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(toApiTenant(updatedTenant));
  });
  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    await writeInReadmodel(toReadModelEService(eService), eservices);
    await writeInReadmodel(toReadModelAgreement(agreementEservice), agreements);
    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: targetTenant.id,
          attributeId: verifiedAttribute.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(tenantNotFound(targetTenant.id));
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    const tenantWithoutSameAttributeId: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...verifiedAttribute,
          id: generateId(),
          verifiedBy: [{ ...getMockVerifiedBy() }],
          revokedBy: [{ ...getMockRevokedBy() }],
        },
      ],
    };

    await addOneTenant(tenantWithoutSameAttributeId);
    await addOneTenant(revokerTenant);
    await writeInReadmodel(toReadModelEService(eService), eservices);
    await writeInReadmodel(toReadModelAgreement(agreementEservice), agreements);
    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: tenantWithoutSameAttributeId.id,
          attributeId: verifiedAttribute.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(attributeNotFound(verifiedAttribute.id));
  });
  it("Should throw attributeRevocationNotAllowed if the organization is not allowed to revoke the attribute", async () => {
    const tenantWithVerifiedAttribute: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...verifiedAttribute,
          verifiedBy: [
            {
              ...getMockVerifiedBy(),
              id: generateId(),
            },
          ],
          revokedBy: [{ ...getMockRevokedBy() }],
        },
      ],
    };

    await addOneTenant(tenantWithVerifiedAttribute);
    await addOneTenant(revokerTenant);
    await writeInReadmodel(toReadModelEService(eService), eservices);
    await writeInReadmodel(toReadModelAgreement(agreementEservice), agreements);

    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: tenantWithVerifiedAttribute.id,
          attributeId: verifiedAttribute.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      attributeRevocationNotAllowed(targetTenant.id, verifiedAttribute.id)
    );
  });
  it("Should throw verifiedAttributeSelfRevocationNotAllowed when trying to revoke own attributes", async () => {
    await addOneTenant(revokerTenant);
    await writeInReadmodel(toReadModelEService(eService), eservices);
    await writeInReadmodel(toReadModelAgreement(agreementEservice), agreements);

    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: revokerTenant.id,
          attributeId: verifiedAttribute.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(verifiedAttributeSelfRevocationNotAllowed());
  });
  it("Should throw attributeAlreadyRevoked if the attribute is already revoked", async () => {
    const tenantWithVerifiedAttribute: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...verifiedAttribute,
          verifiedBy: [{ ...getMockVerifiedBy(), id: revokerTenant.id }],
          revokedBy: [{ ...getMockRevokedBy(), id: revokerTenant.id }],
        },
      ],
    };

    await addOneTenant(tenantWithVerifiedAttribute);
    await addOneTenant(revokerTenant);
    await writeInReadmodel(toReadModelEService(eService), eservices);
    await writeInReadmodel(toReadModelAgreement(agreementEservice), agreements);

    expect(
      tenantService.revokeVerifiedAttribute(
        {
          tenantId: tenantWithVerifiedAttribute.id,
          attributeId: verifiedAttribute.id,
        },
        {
          authData,
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      attributeAlreadyRevoked(
        targetTenant.id,
        revokerTenant.id,
        verifiedAttribute.id
      )
    );
  });
});
