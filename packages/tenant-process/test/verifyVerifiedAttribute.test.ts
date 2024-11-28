/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  Tenant,
  unsafeBrandId,
  protobufDecoder,
  toTenantV2,
  Descriptor,
  EService,
  TenantVerifiedAttributeAssignedV2,
  descriptorState,
  tenantAttributeType,
  Attribute,
  attributeKind,
  Agreement,
  toReadModelAttribute,
  toReadModelEService,
  toReadModelAgreement,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  writeInReadmodel,
  getMockAttribute,
  readLastEventByStreamId,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  tenantNotFound,
  attributeVerificationNotAllowed,
  verifiedAttributeSelfVerificationNotAllowed,
  attributeNotFound,
  expirationDateCannotBeInThePast,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  getMockAgreement,
  getMockVerifiedTenantAttribute,
  getMockVerifiedBy,
  getMockRevokedBy,
  tenantService,
  attributes,
  eservices,
  agreements,
  postgresDB,
} from "./utils.js";

describe("verifyVerifiedAttribute", async () => {
  const targetTenant = getMockTenant();
  const requesterTenant = getMockTenant();
  const tenantAttributeSeed: tenantApi.VerifiedTenantAttributeSeed = {
    id: generateId(),
  };
  const attribute: Attribute = {
    ...getMockAttribute(),
    id: unsafeBrandId(tenantAttributeSeed.id),
    kind: attributeKind.verified,
  };
  const descriptor1: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
    attributes: {
      verified: [
        [
          {
            id: unsafeBrandId(tenantAttributeSeed.id),
            explicitAttributeVerification: false,
          },
        ],
      ],
      declared: [],
      certified: [],
    },
  };
  const eService1: EService = {
    ...getMockEService(),
    producerId: requesterTenant.id,
    descriptors: [descriptor1],
  };
  const agreementEservice1: Agreement = getMockAgreement({
    eserviceId: eService1.id,
    descriptorId: descriptor1.id,
    producerId: eService1.producerId,
    consumerId: targetTenant.id,
  });

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should verify the VerifiedAttribute if verifiedTenantAttribute doesn't exist", async () => {
    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await writeInReadmodel(toReadModelEService(eService1), eservices);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );
    const returnedTenant = await tenantService.verifyVerifiedAttribute(
      {
        tenantId: targetTenant.id,
        tenantAttributeSeed,
        organizationId: requesterTenant.id,
        correlationId: generateId(),
      },
      genericLogger
    );

    const writtenEvent = await readLastEventByStreamId(
      targetTenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: targetTenant.id,
      version: "1",
      type: "TenantVerifiedAttributeAssigned",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantVerifiedAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...targetTenant,
      attributes: [
        {
          id: unsafeBrandId(tenantAttributeSeed.id),
          type: tenantAttributeType.VERIFIED,
          assignmentTimestamp: new Date(),
          verifiedBy: [
            {
              id: requesterTenant.id,
              verificationDate: new Date(),
              expirationDate: tenantAttributeSeed.expirationDate
                ? new Date(tenantAttributeSeed.expirationDate)
                : undefined,
              extensionDate: tenantAttributeSeed.expirationDate
                ? new Date(tenantAttributeSeed.expirationDate)
                : undefined,
            },
          ],
          revokedBy: [],
        },
      ],
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(updatedTenant);
  });
  it("Should verify the VerifiedAttribute if verifiedTenantAttribute exist", async () => {
    const mockVerifiedBy = getMockVerifiedBy();
    const mockRevokedBy = getMockRevokedBy();

    const tenantWithVerifiedAttribute: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...getMockVerifiedTenantAttribute(),
          id: attribute.id,
          verifiedBy: [
            {
              ...mockVerifiedBy,
            },
          ],
          revokedBy: [{ ...mockRevokedBy }],
        },
      ],
    };

    await addOneTenant(tenantWithVerifiedAttribute);
    await addOneTenant(requesterTenant);
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await writeInReadmodel(toReadModelEService(eService1), eservices);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );

    const returnedTenant = await tenantService.verifyVerifiedAttribute(
      {
        tenantId: tenantWithVerifiedAttribute.id,
        tenantAttributeSeed,
        organizationId: requesterTenant.id,
        correlationId: generateId(),
      },
      genericLogger
    );
    const writtenEvent = await readLastEventByStreamId(
      tenantWithVerifiedAttribute.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenantWithVerifiedAttribute.id,
      version: "1",
      type: "TenantVerifiedAttributeAssigned",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantVerifiedAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenantWithVerifiedAttribute,
      attributes: [
        {
          id: attribute.id,
          type: "PersistentVerifiedAttribute",
          assignmentTimestamp: new Date(),
          verifiedBy: [
            { ...mockVerifiedBy },
            {
              ...mockVerifiedBy,
              id: requesterTenant.id,
              verificationDate: new Date(),
            },
          ],
          revokedBy: [{ ...mockRevokedBy }],
        },
      ],
      updatedAt: new Date(),
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(updatedTenant);
  });
  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    await writeInReadmodel(toReadModelEService(eService1), eservices);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );
    expect(
      tenantService.verifyVerifiedAttribute(
        {
          tenantId: targetTenant.id,
          tenantAttributeSeed,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(targetTenant.id));
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);
    await writeInReadmodel(toReadModelEService(eService1), eservices);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );
    expect(
      tenantService.verifyVerifiedAttribute(
        {
          tenantId: targetTenant.id,
          tenantAttributeSeed,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(attributeNotFound(attribute.id));
  });
  it("Should throw attributeVerificationNotAllowed if the organization is not allowed to verify the attribute", async () => {
    const descriptorAttributeVerificationNotAllowed: Descriptor = {
      ...descriptor1,
      attributes: {
        verified: [
          [
            {
              id: generateId(),
              explicitAttributeVerification: false,
            },
          ],
        ],
        declared: [],
        certified: [],
      },
    };

    const eServiceWithNotAllowedDescriptor: EService = {
      ...eService1,
      descriptors: [descriptorAttributeVerificationNotAllowed],
    };

    const agreementEserviceWithNotAllowedDescriptor = getMockAgreement({
      ...agreementEservice1,
      eserviceId: eServiceWithNotAllowedDescriptor.id,
      descriptorId: descriptorAttributeVerificationNotAllowed.id,
    });

    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);
    await writeInReadmodel(
      toReadModelEService(eServiceWithNotAllowedDescriptor),
      eservices
    );
    await writeInReadmodel(
      toReadModelAgreement(agreementEserviceWithNotAllowedDescriptor),
      agreements
    );

    expect(
      tenantService.verifyVerifiedAttribute(
        {
          tenantId: targetTenant.id,
          tenantAttributeSeed,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      attributeVerificationNotAllowed(
        targetTenant.id,
        unsafeBrandId(tenantAttributeSeed.id)
      )
    );
  });
  it("Should throw verifiedAttributeSelfVerificationNotAllowed if the organizations are not allowed to revoke own attributes", async () => {
    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);
    await writeInReadmodel(toReadModelEService(eService1), eservices);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );

    expect(
      tenantService.verifyVerifiedAttribute(
        {
          tenantId: targetTenant.id,
          tenantAttributeSeed,
          organizationId: targetTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(verifiedAttributeSelfVerificationNotAllowed());
  });
  it("Should throw expirationDateCannotBeInThePast if the expirationDate is in the past", async () => {
    const mockVerifiedBy = getMockVerifiedBy();
    const mockRevokedBy = getMockRevokedBy();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const tenantWithVerifiedAttribute: Tenant = {
      ...targetTenant,
      attributes: [
        {
          ...getMockVerifiedTenantAttribute(),
          id: attribute.id,
          verifiedBy: [
            {
              ...mockVerifiedBy,
            },
          ],
          revokedBy: [{ ...mockRevokedBy }],
        },
      ],
    };

    const tenantAttributeSeedWithExpirationDateInThePast: tenantApi.VerifiedTenantAttributeSeed =
      {
        id: tenantAttributeSeed.id,
        expirationDate: yesterday.toISOString(),
      };

    await addOneTenant(tenantWithVerifiedAttribute);
    await addOneTenant(requesterTenant);
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await writeInReadmodel(toReadModelEService(eService1), eservices);
    await writeInReadmodel(
      toReadModelAgreement(agreementEservice1),
      agreements
    );

    expect(
      tenantService.verifyVerifiedAttribute(
        {
          tenantId: targetTenant.id,
          tenantAttributeSeed: tenantAttributeSeedWithExpirationDateInThePast,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(expirationDateCannotBeInThePast(yesterday));
  });
});
