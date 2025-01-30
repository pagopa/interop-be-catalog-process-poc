/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import {
  Attribute,
  generateId,
  EServiceTemplateVersionAddedV2,
  toEServiceTemplateV2,
  EServiceTemplateVersion,
  operationForbidden,
  eserviceTemplateVersionState,
  EServiceTemplate,
  AttributeId,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  draftEServiceTemplateVersionAlreadyExists,
  attributeNotFound,
  inconsistentDailyCalls,
  eServiceTemplateNotFound,
} from "../src/model/domain/errors.js";
import { agreementApprovalPolicyToApiAgreementApprovalPolicy } from "../src/model/domain/apiConverter.js";
import {
  addOneAttribute,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
  addOneEServiceTemplate,
} from "./utils.js";

const buildCreateEServiceTemplateVersionSeed = (
  eserviceTemplateVersion: EServiceTemplateVersion = getMockEServiceTemplateVersion()
): eserviceTemplateApi.EServiceTemplateVersionSeed => ({
  voucherLifespan: eserviceTemplateVersion.voucherLifespan,
  dailyCallsPerConsumer: eserviceTemplateVersion.dailyCallsPerConsumer,
  dailyCallsTotal: eserviceTemplateVersion.dailyCallsTotal,
  agreementApprovalPolicy:
    eserviceTemplateVersion.agreementApprovalPolicy &&
    agreementApprovalPolicyToApiAgreementApprovalPolicy(
      eserviceTemplateVersion.agreementApprovalPolicy
    ),
  description: eserviceTemplateVersion.description,
  attributes: {
    certified: [],
    declared: [],
    verified: [],
  },
  docs: eserviceTemplateVersion.docs.map((d) => ({
    ...d,
    kind: "DOCUMENT",
    serverUrls: [],
    documentId: d.id,
    filePath: d.path,
    fileName: d.name,
  })),
});

describe("createEServiceTemplateVersion", async () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  const publishedTemplateVersion: EServiceTemplateVersion = {
    ...getMockEServiceTemplateVersion(),
    state: eserviceTemplateVersionState.published,
    interface: getMockDocument(),
    version: "1",
  };

  it("should write on event-store for the creation of an e-service template version", async () => {
    const newEServiceTemplateVersion = getMockEServiceTemplateVersion();
    const eserviceTemplateVersionSeed: eserviceTemplateApi.EServiceTemplateVersionSeed =
      buildCreateEServiceTemplateVersionSeed(newEServiceTemplateVersion);

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [publishedTemplateVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    const returnedEServiceTemplateVersion =
      await eserviceTemplateService.createEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersionSeed,
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      );
    const newEServiceTemplateVersionId = returnedEServiceTemplateVersion.id;
    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateVersionAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateVersionAddedV2,
      payload: writtenEvent.data,
    });

    const expectedEserviceTemplate = toEServiceTemplateV2({
      ...eserviceTemplate,
      versions: [
        publishedTemplateVersion,
        {
          ...newEServiceTemplateVersion,
          version: "2",
          id: newEServiceTemplateVersionId,
        },
      ],
    });

    expect(writtenPayload).toEqual({
      eserviceTemplateVersionId: newEServiceTemplateVersionId,
      eserviceTemplate: expectedEserviceTemplate,
    });
  });

  it("should throw draftEServiceTemplateVersionAlreadyExists if an e-service template version draft already exists", async () => {
    const eserviceTemplateDraftVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [publishedTemplateVersion, eserviceTemplateDraftVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        eserviceTemplate.id,
        buildCreateEServiceTemplateVersionSeed(eserviceTemplateDraftVersion),
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      draftEServiceTemplateVersionAlreadyExists(eserviceTemplate.id)
    );
  });

  it("should throw eServiceTemplateNotFound if the eservice doesn't exist", async () => {
    const mockEServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [publishedTemplateVersion],
    };
    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        mockEServiceTemplate.id,
        buildCreateEServiceTemplateVersionSeed(
          getMockEServiceTemplateVersion()
        ),
        {
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw attributeNotFound if at least one of the attributes doesn't exist", async () => {
    const mockEServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [publishedTemplateVersion],
    };
    await addOneEServiceTemplate(mockEServiceTemplate);

    const attribute: Attribute = {
      name: "Attribute name",
      id: generateId(),
      kind: "Declared",
      description: "Attribute Description",
      creationTime: new Date(),
    };
    await addOneAttribute(attribute);
    const notExistingId1 = generateId<AttributeId>();
    const notExistingId2 = generateId<AttributeId>();
    const eserviceTemplateVersionSeed = {
      ...buildCreateEServiceTemplateVersionSeed(
        getMockEServiceTemplateVersion()
      ),
      attributes: {
        certified: [],
        declared: [
          [
            { id: attribute.id, explicitAttributeVerification: false },
            {
              id: notExistingId1,
              explicitAttributeVerification: false,
            },
            {
              id: notExistingId2,
              explicitAttributeVerification: false,
            },
          ],
        ],
        verified: [],
      },
    };

    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        mockEServiceTemplate.id,
        eserviceTemplateVersionSeed,
        {
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(attributeNotFound(notExistingId1));
  });

  it("should throw operationForbidden if the requester is not the template creator", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [publishedTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        eserviceTemplate.id,
        buildCreateEServiceTemplateVersionSeed(),
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const eserviceTemplateVersionSeed: eserviceTemplateApi.EServiceTemplateVersionSeed =
      {
        ...buildCreateEServiceTemplateVersionSeed(
          getMockEServiceTemplateVersion()
        ),
        dailyCallsPerConsumer: 100,
        dailyCallsTotal: 50,
      };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [publishedTemplateVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersionSeed,
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
});
