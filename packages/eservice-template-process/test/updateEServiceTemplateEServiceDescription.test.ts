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
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  EServiceTemplate,
  toEServiceTemplateV2,
  EServiceTemplateEServiceDescriptionUpdatedV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eserviceTemplateWithoutPublishedVersion,
  eServiceTemplateNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
} from "./utils.js";

describe("updateEServiceTemplateEServiceDescription", () => {
  it("should write on event-store for the update of the eService template e-service description", async () => {
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
    const updatedEServiceDescription =
      "eservice template new eservice description";
    const returnedEServiceTemplate =
      await eserviceTemplateService.updateEServiceTemplateEServiceDescription(
        eserviceTemplate.id,
        updatedEServiceDescription,
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      );
    const updatedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      eserviceDescription: updatedEServiceDescription,
    };
    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateEServiceDescriptionUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateEServiceDescriptionUpdatedV2,
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
      eserviceTemplateService.updateEServiceTemplateEServiceDescription(
        eserviceTemplate.id,
        "eservice template new eservice description",
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
      eserviceTemplateService.updateEServiceTemplateEServiceDescription(
        eserviceTemplate.id,
        "eservice template new eservice description",
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
      eserviceTemplateService.updateEServiceTemplateEServiceDescription(
        eserviceTemplate.id,
        "eservice template new eservice description",
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
      eserviceTemplateService.updateEServiceTemplateEServiceDescription(
        eserviceTemplate.id,
        "eservice template new eservice description",
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
});
