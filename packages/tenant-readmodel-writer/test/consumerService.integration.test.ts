/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, it, expect } from "vitest";
import { getMockTenant, writeInReadmodel } from "pagopa-interop-commons-test";
import {
  SelfcareMappingCreatedV1,
  SelfcareMappingDeletedV1,
  Tenant,
  TenantCreatedV1,
  TenantDeletedV1,
  TenantEventEnvelope,
  TenantUpdatedV1,
  generateId,
} from "pagopa-interop-models";
import { handleMessage } from "../src/tenantConsumerService.js";
import { toTenantV1 } from "./converterV1.js";
import { tenants } from "./utils.js";

describe("Integration tests", async () => {
  describe("Events V1", async () => {
    const mockTenant = getMockTenant();

    it("TenantCreated", async () => {
      const payload: TenantCreatedV1 = {
        tenant: toTenantV1(mockTenant),
      };
      const message: TenantEventEnvelope = {
        sequence_num: 1,
        stream_id: mockTenant.id,
        version: 1,
        type: "TenantCreated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessage(message, tenants);

      const retrievedTenant = await tenants.findOne({
        "data.id": mockTenant.id,
      });

      expect(retrievedTenant).toMatchObject({
        data: mockTenant,
        metadata: { version: 1 },
      });
    });

    it("TenantDeleted", async () => {
      await writeInReadmodel<Tenant>(mockTenant, tenants, 1);

      const payload: TenantDeletedV1 = {
        tenantId: mockTenant.id,
      };
      const message: TenantEventEnvelope = {
        sequence_num: 1,
        stream_id: mockTenant.id,
        version: 1,
        type: "TenantDeleted",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessage(message, tenants);

      const retrievedTenant = await tenants.findOne({
        "data.id": mockTenant.id,
      });

      expect(retrievedTenant?.data).toBeUndefined();
    });

    it("TenantUpdated", async () => {
      await writeInReadmodel<Tenant>(mockTenant, tenants, 1);

      const updatedTenant: Tenant = {
        ...mockTenant,
        name: "updated name",
      };
      const payload: TenantUpdatedV1 = {
        tenant: toTenantV1(updatedTenant),
      };
      const message: TenantEventEnvelope = {
        sequence_num: 1,
        stream_id: mockTenant.id,
        version: 2,
        type: "TenantUpdated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessage(message, tenants);

      const retrievedTenant = await tenants.findOne({
        "data.id": mockTenant.id,
      });

      expect(retrievedTenant).toMatchObject({
        data: updatedTenant,
        metadata: { version: 2 },
      });
    });

    it("SelfcareMappingCreated", async () => {
      await writeInReadmodel<Tenant>(mockTenant, tenants, 1);

      const selfcareId = generateId();

      const updatedTenant: Tenant = {
        ...mockTenant,
        selfcareId,
      };
      const payload: SelfcareMappingCreatedV1 = {
        tenantId: mockTenant.id,
        selfcareId,
      };
      const message: TenantEventEnvelope = {
        sequence_num: 1,
        stream_id: mockTenant.id,
        version: 2,
        type: "SelfcareMappingCreated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessage(message, tenants);

      const retrievedTenant = await tenants.findOne({
        "data.id": mockTenant.id,
      });

      expect(retrievedTenant).toMatchObject({
        data: updatedTenant,
        metadata: { version: 2 },
      });
    });

    it("SelfcareMappingDeleted", async () => {
      const selfcareId = generateId();

      const tenant: Tenant = {
        ...mockTenant,
        selfcareId,
      };
      await writeInReadmodel<Tenant>(tenant, tenants, 1);

      const updatedTenant: Tenant = {
        ...mockTenant,
        selfcareId: undefined,
      };

      const payload: SelfcareMappingDeletedV1 = {
        selfcareId,
      };
      const message: TenantEventEnvelope = {
        sequence_num: 1,
        stream_id: mockTenant.id,
        version: 2,
        type: "SelfcareMappingDeleted",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessage(message, tenants);

      const retrievedTenant = await tenants.findOne({
        "data.id": mockTenant.id,
      });

      expect(retrievedTenant).toMatchObject({
        data: updatedTenant,
        metadata: { version: 2 },
      });
    });

    it("TenantMailAdded", () => {});

    it("TenantMailDeleted", () => {});
  });
});
