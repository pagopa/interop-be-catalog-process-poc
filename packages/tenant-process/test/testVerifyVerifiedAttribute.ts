/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/index.js";
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
} from "pagopa-interop-models";
import { describe, it, expect, vi } from "vitest";
import {
  tenantNotFound,
  attributeVerificationNotAllowed,
  verifiedAttributeSelfVerification,
  attributeNotFound,
} from "../src/model/domain/errors.js";
import { ApiVerifiedTenantAttributeSeed } from "../src/model/types.js";
import {
  getMockAuthData,
  addOneTenant,
  addOneAgreement,
  addOneEService,
  getMockAgreement,
  getMockTenant,
  getMockDescriptor,
  getMockEService,
  getMockVerifiedTenantAttribute,
  getMockVerifiedBy,
  getMockRevokedBy,
  getMockAttribute,
  addOneAttribute,
} from "./utils.js";
import {
  agreements,
  eservices,
  postgresDB,
  tenants,
  tenantService,
  attributes,
} from "./tenant.integration.test.js";

export const testVerifyVerifiedAttribute = (): ReturnType<typeof describe> =>
  describe("verifyVerifiedAttribute", async () => {
    const tenantAttributeSeed: ApiVerifiedTenantAttributeSeed = {
      id: generateId(),
    };
    const correlationId = generateId();
    const targetTenant: Tenant = getMockTenant();
    const requesterTenant: Tenant = getMockTenant();
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

    const agreementEservice1 = getMockAgreement({
      eserviceId: eService1.id,
      descriptorId: descriptor1.id,
      producerId: eService1.producerId,
      consumerId: targetTenant.id,
    });

    const organizationId = getMockAuthData(requesterTenant.id).organizationId;

    it("Should verify the VerifiedAttribute if verifiedTenantAttribute doesn't exist", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await addOneAttribute(attribute, attributes);
      await addOneEService(eService1, eservices);
      await addOneAgreement(agreementEservice1, agreements);
      await tenantService.verifyVerifiedAttribute({
        tenantId: targetTenant.id,
        tenantAttributeSeed,
        organizationId,
        correlationId,
      });

      const writtenEvent = await readLastEventByStreamId(
        targetTenant.id,
        "tenant",
        postgresDB
      );
      if (!writtenEvent) {
        fail("Update failed: tenant not found in event-store");
      }
      expect(writtenEvent).toMatchObject({
        stream_id: targetTenant.id,
        version: "1",
        type: "TenantVerifiedAttributeAssigned",
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
                id: organizationId,
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
      vi.useRealTimers();
    });
    it("Should verify the VerifiedAttribute if verifiedTenantAttribute exist", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
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

      await addOneTenant(tenantWithVerifiedAttribute, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await addOneAttribute(attribute, attributes);
      await addOneEService(eService1, eservices);
      await addOneAgreement(agreementEservice1, agreements);

      await tenantService.verifyVerifiedAttribute({
        tenantId: tenantWithVerifiedAttribute.id,
        tenantAttributeSeed,
        organizationId,
        correlationId,
      });
      const writtenEvent = await readLastEventByStreamId(
        tenantWithVerifiedAttribute.id,
        "tenant",
        postgresDB
      );
      if (!writtenEvent) {
        fail("Update failed: tenant not found in event-store");
      }
      expect(writtenEvent).toMatchObject({
        stream_id: tenantWithVerifiedAttribute.id,
        version: "1",
        type: "TenantVerifiedAttributeAssigned",
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
                id: organizationId,
                verificationDate: new Date(),
              },
            ],
            revokedBy: [{ ...mockRevokedBy }],
          },
        ],
        updatedAt: new Date(),
      };

      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      vi.useRealTimers();
    });
    it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
      await addOneEService(eService1, eservices);
      await addOneAgreement(agreementEservice1, agreements);
      expect(
        tenantService.verifyVerifiedAttribute({
          tenantId: targetTenant.id,
          tenantAttributeSeed,
          organizationId,
          correlationId,
        })
      ).rejects.toThrowError(tenantNotFound(targetTenant.id));
    });
    it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await addOneEService(eService1, eservices);
      await addOneAgreement(agreementEservice1, agreements);
      expect(
        tenantService.verifyVerifiedAttribute({
          tenantId: targetTenant.id,
          tenantAttributeSeed,
          organizationId,
          correlationId,
        })
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

      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await addOneEService(eServiceWithNotAllowedDescriptor, eservices);
      await addOneAgreement(
        agreementEserviceWithNotAllowedDescriptor,
        agreements
      );

      expect(
        tenantService.verifyVerifiedAttribute({
          tenantId: targetTenant.id,
          tenantAttributeSeed,
          organizationId,
          correlationId,
        })
      ).rejects.toThrowError(
        attributeVerificationNotAllowed(
          targetTenant.id,
          unsafeBrandId(tenantAttributeSeed.id)
        )
      );
    });
    it("Should throw verifiedAttributeSelfVerification if the organizations are not allowed to revoke own attributes", async () => {
      await addOneTenant(targetTenant, postgresDB, tenants);
      await addOneTenant(requesterTenant, postgresDB, tenants);
      await addOneEService(eService1, eservices);
      await addOneAgreement(agreementEservice1, agreements);

      expect(
        tenantService.verifyVerifiedAttribute({
          tenantId: targetTenant.id,
          tenantAttributeSeed,
          organizationId: targetTenant.id,
          correlationId,
        })
      ).rejects.toThrowError(verifiedAttributeSelfVerification());
    });
  });
