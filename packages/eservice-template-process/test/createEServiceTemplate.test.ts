/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  randomArrayItem,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test/index.js";
import {
  generateId,
  EServiceTemplate,
  toEServiceTemplateV2,
  EServiceTemplateAddedV2,
} from "pagopa-interop-models";
import { expect, describe, it, beforeAll, vi, afterAll } from "vitest";
import {
  eServiceTemplateDuplicate,
  inconsistentDailyCalls,
  originNotCompliant,
} from "../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  eserviceTemplateToApiEServiceTemplateSeed,
  postgresDB,
} from "./utils.js";

describe("create eservice template", () => {
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockVersion = getMockEServiceTemplateVersion();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it("should write on event-store for the creation of an eservice template", async () => {
    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const eserviceTemplate =
      await eserviceTemplateService.createEServiceTemplate(
        eserviceTemplateToApiEServiceTemplateSeed({
          ...mockEServiceTemplate,
          isSignalHubEnabled,
        }),
        {
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      );

    expect(eserviceTemplate).toBeDefined();

    const eserviceTemplateCreationEvent = await readEventByStreamIdAndVersion(
      eserviceTemplate.id,
      0,
      "eservice_template",
      postgresDB
    );

    expect(eserviceTemplateCreationEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "0",
      type: "EServiceTemplateAdded",
      event_version: 2,
    });

    const eserviceCreationPayload = decodeProtobufPayload({
      messageType: EServiceTemplateAddedV2,
      payload: eserviceTemplateCreationEvent.data,
    });

    const expectedEserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      createdAt: eserviceTemplate.createdAt,
      id: eserviceTemplate.id,
      versions: [
        {
          ...mockVersion,
          agreementApprovalPolicy: undefined,
          id: eserviceTemplate.versions[0].id,
          createdAt: eserviceTemplate.versions[0].createdAt,
        },
      ],
      isSignalHubEnabled,
    };

    expect(eserviceCreationPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(expectedEserviceTemplate)
    );
  });

  it("should throw originNotCompliant if the requester is not in the allowed origins", async () => {
    await expect(
      eserviceTemplateService.createEServiceTemplate(
        eserviceTemplateToApiEServiceTemplateSeed(mockEServiceTemplate),
        {
          authData: {
            ...getMockAuthData(mockEServiceTemplate.creatorId),
            externalId: { origin: "not-allowed-origin", value: "aaa" },
          },
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
  });

  it("should throw eServiceTemplateDuplicate if an eservice template with the same name already exists, case insensitive", async () => {
    await addOneEServiceTemplate(mockEServiceTemplate);
    await expect(
      eserviceTemplateService.createEServiceTemplate(
        eserviceTemplateToApiEServiceTemplateSeed(mockEServiceTemplate),
        {
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceTemplateDuplicate(mockEServiceTemplate.name)
    );
  });

  it("should throw inconsistentDailyCalls if the version seed has dailyCallsPerConsumer > dailyCallsTotal", async () => {
    await expect(
      eserviceTemplateService.createEServiceTemplate(
        eserviceTemplateToApiEServiceTemplateSeed({
          ...mockEServiceTemplate,
          versions: [
            { ...mockVersion, dailyCallsPerConsumer: 1, dailyCallsTotal: 0 },
          ],
        }),
        {
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
});
