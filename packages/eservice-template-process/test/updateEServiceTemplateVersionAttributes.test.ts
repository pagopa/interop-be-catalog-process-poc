/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAttribute,
  getMockAuthData,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  eserviceTemplateVersionState,
  toEServiceTemplateV2,
  generateId,
  attributeKind,
  EServiceTemplateVersionAttributesUpdatedV2,
  operationForbidden,
  AttributeId,
  EServiceTemplateVersion,
  EServiceTemplate,
} from "pagopa-interop-models";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { expect, describe, it, beforeEach } from "vitest";
import {
  attributeNotFound,
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  inconsistentAttributesSeedGroupsCount,
  notValidEServiceTemplateVersionState,
  unchangedAttributes,
  versionAttributeGroupSupersetMissingInAttributesSeed,
} from "../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneEServiceTemplate,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
} from "./utils.js";

describe("updateEServiceTemplateVersionAttributes", () => {
  const mockCertifiedAttribute1 = getMockAttribute(attributeKind.certified);
  const mockCertifiedAttribute2 = getMockAttribute(attributeKind.certified);
  const mockCertifiedAttribute3 = getMockAttribute(attributeKind.certified);
  const mockVerifiedAttribute1 = getMockAttribute(attributeKind.verified);
  const mockVerifiedAttribute2 = getMockAttribute(attributeKind.verified);
  const mockVerifiedAttribute3 = getMockAttribute(attributeKind.verified);
  const mockDeclaredAttribute1 = getMockAttribute(attributeKind.declared);
  const mockDeclaredAttribute2 = getMockAttribute(attributeKind.declared);
  const mockDeclaredAttribute3 = getMockAttribute(attributeKind.declared);

  const validMockVersionCertifiedAttributes = [
    [
      {
        id: mockCertifiedAttribute1.id,
        explicitAttributeVerification: false,
      },
      {
        id: mockCertifiedAttribute2.id,
        explicitAttributeVerification: false,
      },
    ],
  ];

  const validMockVersionVerifiedAttributes = [
    [
      {
        id: mockVerifiedAttribute1.id,
        explicitAttributeVerification: false,
      },
    ],
    [
      {
        id: mockVerifiedAttribute2.id,
        explicitAttributeVerification: false,
      },
    ],
  ];

  const validMockVersionAttributeSeed: eserviceTemplateApi.AttributesSeed = {
    certified: [
      [
        ...validMockVersionCertifiedAttributes[0],
        {
          id: mockCertifiedAttribute3.id,
          explicitAttributeVerification: false,
        },
      ],
    ],
    verified: [
      [
        ...validMockVersionVerifiedAttributes[0],
        {
          id: mockVerifiedAttribute3.id,
          explicitAttributeVerification: false,
        },
      ],
      validMockVersionVerifiedAttributes[1],
    ],
    declared: [],
  };

  beforeEach(async () => {
    await addOneAttribute(mockCertifiedAttribute1);
    await addOneAttribute(mockCertifiedAttribute2);
    await addOneAttribute(mockCertifiedAttribute3);
    await addOneAttribute(mockVerifiedAttribute1);
    await addOneAttribute(mockVerifiedAttribute2);
    await addOneAttribute(mockVerifiedAttribute3);
    await addOneAttribute(mockDeclaredAttribute1);
    await addOneAttribute(mockDeclaredAttribute2);
    await addOneAttribute(mockDeclaredAttribute3);
  });

  it.each([
    eserviceTemplateVersionState.published,
    eserviceTemplateVersionState.suspended,
  ])(
    "should write on event-store for the attributes update of a eservice template version with state %s",
    async (eserviceTemplateVersionState) => {
      const mockEServiceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState,
        attributes: {
          certified: validMockVersionCertifiedAttributes,
          verified: validMockVersionVerifiedAttributes,
          declared: [],
        },
      };

      const mockEServiceTemplate: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [mockEServiceTemplateVersion],
      };

      await addOneEServiceTemplate(mockEServiceTemplate);

      const updatedEServiceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [
          {
            ...mockEServiceTemplateVersion,
            attributes:
              validMockVersionAttributeSeed as Descriptor["attributes"],
          },
        ],
      };

      const returnedEServiceTemplate =
        await eserviceTemplateService.updateEServiceTemplateVersionAttributes(
          updatedEServiceTemplate.id,
          mockEServiceTemplateVersion.id,
          validMockVersionAttributeSeed,
          {
            authData: getMockAuthData(mockEServiceTemplate.creatorId),
            correlationId: generateId(),
            serviceName: "",
            logger: genericLogger,
          }
        );

      const writtenEvent = await readLastEserviceTemplateEvent(
        mockEServiceTemplate.id
      );
      expect(writtenEvent).toMatchObject({
        stream_id: mockEServiceTemplate.id,
        version: "1",
        type: "EServiceTemplateVersionAttributesUpdated",
        event_version: 2,
      });
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceTemplateVersionAttributesUpdatedV2,
        payload: writtenEvent.data,
      });
      expect(writtenPayload.eserviceTemplate).toEqual(
        toEServiceTemplateV2(updatedEServiceTemplate)
      );
      expect(writtenPayload.eserviceTemplate).toEqual(
        toEServiceTemplateV2(returnedEServiceTemplate)
      );
    }
  );

  it("should throw eServiceTemplateNotFound if the eservice template doesn't exist", async () => {
    const mockEServiceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      attributes: {
        certified: validMockVersionCertifiedAttributes,
        verified: validMockVersionVerifiedAttributes,
        declared: [],
      },
    };

    const mockEServiceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [mockEServiceTemplateVersion],
    };

    expect(
      eserviceTemplateService.updateEServiceTemplateVersionAttributes(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id,
        validMockVersionAttributeSeed,
        {
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw eServiceTemplateVersionNotFound if the eservice template version doesn't exist", async () => {
    const mockEServiceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      attributes: {
        certified: validMockVersionCertifiedAttributes,
        verified: validMockVersionVerifiedAttributes,
        declared: [],
      },
    };

    const mockEServiceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [],
    };

    await addOneEServiceTemplate(mockEServiceTemplate);

    expect(
      eserviceTemplateService.updateEServiceTemplateVersionAttributes(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id,
        validMockVersionAttributeSeed,
        {
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceTemplateVersionNotFound(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id
      )
    );
  });

  it("should throw attributeNotFound if the attribute doesn't exist", async () => {
    const notExistingAttributeId = generateId<AttributeId>();

    const mockEServiceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      attributes: {
        certified: validMockVersionCertifiedAttributes,
        verified: validMockVersionVerifiedAttributes,
        declared: [
          [
            {
              id: notExistingAttributeId,
              explicitAttributeVerification: false,
            },
          ],
        ],
      },
    };

    const mockEServiceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [mockEServiceTemplateVersion],
    };

    await addOneEServiceTemplate(mockEServiceTemplate);

    expect(
      eserviceTemplateService.updateEServiceTemplateVersionAttributes(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id,
        {
          ...validMockVersionAttributeSeed,
          declared: [
            [
              {
                id: notExistingAttributeId,
                explicitAttributeVerification: false,
              },
            ],
          ],
        },
        {
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(attributeNotFound(notExistingAttributeId));
  });

  it("should throw operationForbidden if the requester is not the e-service template creator", async () => {
    const mockEServiceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      attributes: {
        certified: validMockVersionCertifiedAttributes,
        verified: validMockVersionVerifiedAttributes,
        declared: [],
      },
    };

    const mockEServiceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [mockEServiceTemplateVersion],
    };

    await addOneEServiceTemplate(mockEServiceTemplate);

    expect(
      eserviceTemplateService.updateEServiceTemplateVersionAttributes(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id,
        validMockVersionAttributeSeed,
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it.each([
    eserviceTemplateVersionState.draft,
    eserviceTemplateVersionState.deprecated,
  ])(
    "should throw notValidDescriptorState if the eservice template version is in %s state",
    async (eserviceTemplateVersionState) => {
      const mockEServiceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState,
        attributes: {
          certified: validMockVersionCertifiedAttributes,
          verified: validMockVersionVerifiedAttributes,
          declared: [],
        },
      };

      const mockEServiceTemplate: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [mockEServiceTemplateVersion],
      };

      await addOneEServiceTemplate(mockEServiceTemplate);

      expect(
        eserviceTemplateService.updateEServiceTemplateVersionAttributes(
          mockEServiceTemplate.id,
          mockEServiceTemplateVersion.id,
          validMockVersionAttributeSeed,
          {
            authData: getMockAuthData(mockEServiceTemplate.creatorId),
            correlationId: generateId(),
            serviceName: "",
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(
        notValidEServiceTemplateVersionState(
          mockEServiceTemplateVersion.id,
          eserviceTemplateVersionState
        )
      );
    }
  );

  it("should throw unchangedAttributes if the passed seed does not differ from the actual eservice template version attributes", async () => {
    const mockEServiceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      attributes: {
        certified: validMockVersionCertifiedAttributes,
        verified: validMockVersionVerifiedAttributes,
        declared: [],
      },
    };

    const mockEServiceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [mockEServiceTemplateVersion],
    };

    await addOneEServiceTemplate(mockEServiceTemplate);

    expect(
      eserviceTemplateService.updateEServiceTemplateVersionAttributes(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id,
        {
          certified: validMockVersionCertifiedAttributes,
          verified: validMockVersionVerifiedAttributes,
          declared: [],
        },
        {
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      unchangedAttributes(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id
      )
    );
  });

  it("should throw inconsistentAttributesSeedGroupsCount if the passed seed contains an additional attribute group", async () => {
    const mockEServiceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      attributes: {
        certified: validMockVersionCertifiedAttributes,
        verified: validMockVersionVerifiedAttributes,
        declared: [],
      },
    };

    const mockEServiceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [mockEServiceTemplateVersion],
    };

    await addOneEServiceTemplate(mockEServiceTemplate);

    expect(
      eserviceTemplateService.updateEServiceTemplateVersionAttributes(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id,
        {
          certified: validMockVersionCertifiedAttributes,
          verified: [
            ...validMockVersionVerifiedAttributes,
            [
              {
                id: mockVerifiedAttribute3.id,
                explicitAttributeVerification: false,
              },
            ],
          ],
          declared: [],
        },
        {
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      inconsistentAttributesSeedGroupsCount(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id
      )
    );
  });

  it("should throw versionAttributeGroupSupersetMissingInAttributesSeed if the passed seed does not contains all the actual eservice template version attributes", async () => {
    const mockEServiceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      attributes: {
        certified: validMockVersionCertifiedAttributes,
        verified: validMockVersionVerifiedAttributes,
        declared: [],
      },
    };

    const mockEServiceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [mockEServiceTemplateVersion],
    };

    await addOneEServiceTemplate(mockEServiceTemplate);

    expect(
      eserviceTemplateService.updateEServiceTemplateVersionAttributes(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id,
        {
          certified: validMockVersionCertifiedAttributes,
          verified: [
            [
              {
                id: mockVerifiedAttribute1.id,
                explicitAttributeVerification: false,
              },
            ],
            [
              {
                id: mockVerifiedAttribute3.id,
                explicitAttributeVerification: false,
              },
            ],
          ],
          declared: [],
        },
        {
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      versionAttributeGroupSupersetMissingInAttributesSeed(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id
      )
    );
  });
});
