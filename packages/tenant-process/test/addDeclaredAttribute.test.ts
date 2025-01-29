/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  attributeKind,
  DelegationId,
  TenantId,
  toReadModelAttribute,
} from "pagopa-interop-models";
import {
  writeInReadmodel,
  getMockAttribute,
  readLastEventByStreamId,
  getMockTenant,
  getMockDelegation,
} from "pagopa-interop-commons-test";
import {
  generateId,
  Tenant,
  unsafeBrandId,
  protobufDecoder,
  fromTenantKindV2,
  toTenantV2,
  TenantDeclaredAttributeAssignedV2,
  Attribute,
  tenantAttributeType,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  tenantNotFound,
  attributeNotFound,
  delegationNotFound,
  operationRestrictedToDelegate,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  attributes,
  postgresDB,
  tenantService,
  addOneDelegation,
} from "./utils.js";

describe("addDeclaredAttribute", async () => {
  const declaredAttribute: Attribute = {
    ...getMockAttribute(),
    kind: attributeKind.declared,
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const tenant = getMockTenant();

  it("Should add the declared attribute if the tenant doesn't have that", async () => {
    const tenantWithoutDeclaredAttribute: Tenant = {
      ...getMockTenant(),
      attributes: [],
    };

    await writeInReadmodel(toReadModelAttribute(declaredAttribute), attributes);
    await addOneTenant(tenantWithoutDeclaredAttribute);
    const returnedTenant = await tenantService.addDeclaredAttribute(
      {
        tenantAttributeSeed: { id: declaredAttribute.id },
        organizationId: tenantWithoutDeclaredAttribute.id,
        correlationId: generateId(),
      },
      genericLogger
    );
    const writtenEvent = await readLastEventByStreamId(
      tenantWithoutDeclaredAttribute.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenantWithoutDeclaredAttribute.id,
      version: "1",
      type: "TenantDeclaredAttributeAssigned",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantDeclaredAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenantWithoutDeclaredAttribute,
      attributes: [
        {
          id: declaredAttribute.id,
          type: "PersistentDeclaredAttribute",
          assignmentTimestamp: new Date(),
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(updatedTenant);
  });
  it("Should re-assign the declared attribute if it was revoked", async () => {
    const tenantWithAttributeRevoked: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          id: declaredAttribute.id,
          type: tenantAttributeType.DECLARED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
    };
    await writeInReadmodel(toReadModelAttribute(declaredAttribute), attributes);
    await addOneTenant(tenantWithAttributeRevoked);
    const returnedTenant = await tenantService.addDeclaredAttribute(
      {
        tenantAttributeSeed: { id: declaredAttribute.id },
        organizationId: tenantWithAttributeRevoked.id,
        correlationId: generateId(),
      },
      genericLogger
    );
    const writtenEvent = await readLastEventByStreamId(
      tenantWithAttributeRevoked.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenantWithAttributeRevoked.id,
      version: "1",
      type: "TenantDeclaredAttributeAssigned",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantDeclaredAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenantWithAttributeRevoked,
      attributes: [
        {
          id: declaredAttribute.id,
          type: "PersistentDeclaredAttribute",
          assignmentTimestamp: new Date(),
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(updatedTenant);
  });
  it("Should add the declared attribute to the delegator if the delegator doesn't have that", async () => {
    const delegateWithoutDeclaredAttribute: Tenant = {
      ...getMockTenant(),
      attributes: [],
    };
    const delegatorWithoutDeclaredAttribute: Tenant = {
      ...getMockTenant(),
      attributes: [],
    };

    await writeInReadmodel(toReadModelAttribute(declaredAttribute), attributes);
    await addOneTenant(delegateWithoutDeclaredAttribute);
    await addOneTenant(delegatorWithoutDeclaredAttribute);

    const delegationId: DelegationId = generateId();

    await addOneDelegation(
      getMockDelegation({
        id: delegationId,
        kind: "DelegatedConsumer",
        state: "Active",
        delegatorId: delegatorWithoutDeclaredAttribute.id,
        delegateId: delegateWithoutDeclaredAttribute.id,
      })
    );

    const returnedTenant = await tenantService.addDeclaredAttribute(
      {
        tenantAttributeSeed: {
          id: declaredAttribute.id,
          delegationId,
        },
        organizationId: delegateWithoutDeclaredAttribute.id,
        correlationId: generateId(),
      },
      genericLogger
    );
    const writtenEvent = await readLastEventByStreamId(
      delegatorWithoutDeclaredAttribute.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: delegatorWithoutDeclaredAttribute.id,
      version: "1",
      type: "TenantDeclaredAttributeAssigned",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantDeclaredAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...delegatorWithoutDeclaredAttribute,
      attributes: [
        {
          id: declaredAttribute.id,
          type: "PersistentDeclaredAttribute",
          assignmentTimestamp: new Date(),
          delegationId,
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(updatedTenant);
  });
  it("Should re-assign the declared attribute to the delegator if it was revoked", async () => {
    const delegateWithoutDeclaredAttribute: Tenant = {
      ...getMockTenant(),
      attributes: [],
    };
    const delegatorWithAttributeRevoked: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          id: declaredAttribute.id,
          type: tenantAttributeType.DECLARED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
    };
    await writeInReadmodel(toReadModelAttribute(declaredAttribute), attributes);
    await addOneTenant(delegateWithoutDeclaredAttribute);
    await addOneTenant(delegatorWithAttributeRevoked);

    const delegationId: DelegationId = generateId();
    await addOneDelegation(
      getMockDelegation({
        id: delegationId,
        kind: "DelegatedConsumer",
        state: "Active",
        delegatorId: delegatorWithAttributeRevoked.id,
        delegateId: delegateWithoutDeclaredAttribute.id,
      })
    );

    const returnedTenant = await tenantService.addDeclaredAttribute(
      {
        tenantAttributeSeed: { id: declaredAttribute.id, delegationId },
        organizationId: delegateWithoutDeclaredAttribute.id,
        correlationId: generateId(),
      },
      genericLogger
    );

    const writtenEvent = await readLastEventByStreamId(
      delegatorWithAttributeRevoked.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: delegatorWithAttributeRevoked.id,
      version: "1",
      type: "TenantDeclaredAttributeAssigned",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantDeclaredAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...delegatorWithAttributeRevoked,
      attributes: [
        {
          id: declaredAttribute.id,
          type: "PersistentDeclaredAttribute",
          assignmentTimestamp: new Date(),
          delegationId,
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(updatedTenant);
  });
  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    await writeInReadmodel(toReadModelAttribute(declaredAttribute), attributes);
    expect(
      tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: { id: declaredAttribute.id },
          organizationId: tenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    await addOneTenant(tenant);

    expect(
      tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: { id: declaredAttribute.id },
          organizationId: tenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      attributeNotFound(unsafeBrandId(declaredAttribute.id))
    );
  });
  it("Should throw delegationNotFound if the delegation doesn't exist", async () => {
    await addOneTenant(tenant);

    const delegationId: DelegationId = generateId();
    expect(
      tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: {
            id: declaredAttribute.id,
            delegationId,
          },
          organizationId: tenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(delegationNotFound(delegationId));
  });
  it("Should throw delegationNotFound if the delegation is not active", async () => {
    await addOneTenant(tenant);

    const delegationId: DelegationId = generateId();
    await addOneDelegation(
      getMockDelegation({
        id: delegationId,
        kind: "DelegatedConsumer",
        state: "WaitingForApproval",
        delegatorId: generateId<TenantId>(),
        delegateId: generateId<TenantId>(),
      })
    );
    expect(
      tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: {
            id: declaredAttribute.id,
            delegationId,
          },
          organizationId: tenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(delegationNotFound(delegationId));
  });
  it("Should throw delegationNotFound if the delegation is not of kind DelegatedConsumer", async () => {
    await addOneTenant(tenant);

    const delegationId: DelegationId = generateId();
    await addOneDelegation(
      getMockDelegation({
        id: delegationId,
        kind: "DelegatedProducer",
        state: "Active",
        delegatorId: generateId<TenantId>(),
        delegateId: generateId<TenantId>(),
      })
    );
    expect(
      tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: {
            id: declaredAttribute.id,
            delegationId,
          },
          organizationId: tenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(delegationNotFound(delegationId));
  });
  it("Should throw notAllowedToAddDeclaredAttribute if the caller is not the delegate", async () => {
    await addOneTenant(tenant);

    const delegationId: DelegationId = generateId();
    await addOneDelegation(
      getMockDelegation({
        id: delegationId,
        kind: "DelegatedConsumer",
        state: "Active",
        delegatorId: generateId<TenantId>(),
        delegateId: generateId<TenantId>(),
      })
    );
    expect(
      tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: {
            id: declaredAttribute.id,
            delegationId,
          },
          organizationId: generateId<TenantId>(),
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(operationRestrictedToDelegate());
  });
});
