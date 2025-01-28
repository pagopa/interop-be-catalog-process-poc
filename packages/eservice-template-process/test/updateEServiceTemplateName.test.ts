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
  operationForbidden,
  generateId,
  TenantId,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  EServiceTemplate,
  toEServiceTemplateV2,
  EServiceTemplateNameUpdatedV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eserviceTemplateWithoutPublishedVersion,
  eServiceTemplateNotFound,
  eServiceTemplateDuplicate,
} from "../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
} from "./utils.js";

describe("updateEServiceTemplateName", () => {
  it("should write on event-store for the update of the eService template name", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    const updatedName = "eservice template new name";
    const returnedEServiceTemplate =
      await eserviceTemplateService.updateEServiceTemplateName(
        eserviceTemplate.id,
        updatedName,
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      );
    const updatedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      name: updatedName,
    };
    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateNameUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateNameUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(updatedEServiceTemplate)
    );
    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(returnedEServiceTemplate)
    );
  });

  it("should throw eServiceTemplateNotFound if the eservice template doesn't exist", async () => {
    const eserviceTemplate = getMockEServiceTemplate();
    expect(
      eserviceTemplateService.updateEServiceTemplateName(
        eserviceTemplate.id,
        "eservice template new name",
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceTemplateNotFound(eserviceTemplate.id));
  });
  it("should throw operationForbidden if the requester is not the eservice template creator", async () => {
    const eserviceTemplate = getMockEServiceTemplate();
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.updateEServiceTemplateName(
        eserviceTemplate.id,
        "eservice template new name",
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw eserviceTemplateWithoutPublishedVersion if the eservice template doesn't have any published versions", async () => {
    const eserviceTemplate = getMockEServiceTemplate();
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.updateEServiceTemplateName(
        eserviceTemplate.id,
        "eservice template new name",
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eserviceTemplateWithoutPublishedVersion(eserviceTemplate.id)
    );
  });
  it("should throw eserviceTemplateWithoutPublishedVersion if the eservice template has only draft versions", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.updateEServiceTemplateName(
        eserviceTemplate.id,
        "eservice template new name",
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eserviceTemplateWithoutPublishedVersion(eserviceTemplate.id)
    );
  });
  it("should throw eServiceTemplateDuplicate is there is another eservice template with the same name by the same creator", async () => {
    const creatorId = generateId<TenantId>();

    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.published,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      creatorId,
      versions: [eserviceTemplateVersion],
    };

    const duplicateName = "eservice duplciate name";

    const eserviceTemplateWithSameName: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      creatorId,
      name: duplicateName,
    };

    await addOneEServiceTemplate(eserviceTemplate);
    await addOneEServiceTemplate(eserviceTemplateWithSameName);

    const updatedName = duplicateName;
    expect(
      eserviceTemplateService.updateEServiceTemplateName(
        eserviceTemplate.id,
        updatedName,
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceTemplateDuplicate(duplicateName));
  });
});
