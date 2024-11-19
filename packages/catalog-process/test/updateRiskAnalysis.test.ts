/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  genericLogger,
  unexpectedFieldValueError,
  unexpectedFieldError,
} from "pagopa-interop-commons";
import {
  randomArrayItem,
  getMockTenant,
  getMockValidRiskAnalysis,
  decodeProtobufPayload,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  TenantKind,
  tenantKind,
  Tenant,
  EService,
  eserviceMode,
  descriptorState,
  EServiceRiskAnalysisUpdatedV2,
  unsafeBrandId,
  RiskAnalysisFormId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  toEServiceV2,
  generateId,
  operationForbidden,
  RiskAnalysisId,
} from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eserviceNotInDraftState,
  eserviceNotInReceiveMode,
  tenantNotFound,
  tenantKindNotFound,
  eServiceRiskAnalysisNotFound,
  riskAnalysisValidationFailed,
  riskAnalysisDuplicated,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  addOneEService,
  buildRiskAnalysisSeed,
  catalogService,
  readLastEserviceEvent,
  getMockDescriptor,
  getMockEService,
} from "./utils.js";
import { mockEserviceRouterRequest } from "./supertestSetup.js";

describe("update risk analysis", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  it("should write on event-store for the update of a risk analysis", async () => {
    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const riskAnalysis = getMockValidRiskAnalysis(producerTenantKind);

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
      riskAnalysis: [riskAnalysis],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    const riskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed =
      buildRiskAnalysisSeed(riskAnalysis);

    const riskAnalysisUpdatedSeed: catalogApi.EServiceRiskAnalysisSeed = {
      ...riskAnalysisSeed,
      riskAnalysisForm: {
        ...riskAnalysisSeed.riskAnalysisForm,
        answers: {
          ...riskAnalysisSeed.riskAnalysisForm.answers,
          purpose: ["OTHER"], // we modify the purpose field, present in the mock for all tenant kinds
          otherPurpose: ["updated other purpose"], // we add a new field
          ruleOfLawText: [], // we remove the ruleOfLawText field, present in the mock for all tenant kinds
        },
      },
    };

    await mockEserviceRouterRequest.post({
      path: "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      pathParams: { eServiceId: eservice.id, riskAnalysisId: riskAnalysis.id },
      body: { ...riskAnalysisUpdatedSeed },
      authData: getMockAuthData(eservice.producerId),
    });

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceRiskAnalysisUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceRiskAnalysisUpdatedV2,
      payload: writtenEvent.data,
    });

    const updatedEservice: EService = {
      ...eservice,
      riskAnalysis: [
        {
          ...riskAnalysis,
          name: riskAnalysisUpdatedSeed.name,
          riskAnalysisForm: {
            ...riskAnalysis.riskAnalysisForm,
            id: unsafeBrandId<RiskAnalysisFormId>(
              writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.id
            ),
            multiAnswers: riskAnalysis.riskAnalysisForm.multiAnswers.map(
              (multiAnswer) => ({
                ...multiAnswer,
                id: unsafeBrandId<RiskAnalysisMultiAnswerId>(
                  writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.multiAnswers.find(
                    (ma) => ma.key === multiAnswer.key
                  )!.id
                ),
              })
            ),
            singleAnswers: riskAnalysis.riskAnalysisForm.singleAnswers
              .filter((singleAnswer) => singleAnswer.key !== "ruleOfLawText")
              .map((singleAnswer) => ({
                ...singleAnswer,
                id: unsafeBrandId<RiskAnalysisSingleAnswerId>(
                  writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.singleAnswers.find(
                    (sa) => sa.key === singleAnswer.key
                  )!.id
                ),
                value:
                  singleAnswer.key === "purpose" ? "OTHER" : singleAnswer.value,
              }))
              .concat([
                {
                  key: "otherPurpose",
                  value: "updated other purpose",
                  id: unsafeBrandId<RiskAnalysisSingleAnswerId>(
                    writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.singleAnswers.find(
                      (sa) => sa.key === "otherPurpose"
                    )!.id
                  ),
                },
              ]),
          },
        },
      ],
    };

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEservice));
  });
  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    expect(
      catalogService.updateRiskAnalysis(
        mockEService.id,
        generateId(),
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });
  it("should throw operationForbidden if the requester is not the producer", async () => {
    await addOneEService(mockEService);
    expect(
      catalogService.updateRiskAnalysis(
        mockEService.id,
        generateId(),
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw eserviceNotInDraftState if the eservice is not in draft state", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.published,
        },
      ],
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateRiskAnalysis(
        eservice.id,
        generateId(),
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
  });
  it("should throw eserviceNotInReceiveMode if the eservice is not in receive mode", async () => {
    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.deliver,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateRiskAnalysis(
        eservice.id,
        generateId(),
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eserviceNotInReceiveMode(eservice.id));
  });
  it("should throw tenantNotFound if the producer tenant doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateRiskAnalysis(
        eservice.id,
        generateId(),
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(tenantNotFound(eservice.producerId));
  });
  it("should throw tenantKindNotFound if the producer tenant kind doesn't exist", async () => {
    const producer: Tenant = {
      ...getMockTenant(),
      kind: undefined,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    expect(
      catalogService.updateRiskAnalysis(
        eservice.id,
        generateId(),
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        {
          authData: getMockAuthData(producer.id),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(tenantKindNotFound(producer.id));
  });
  it("should throw eServiceRiskAnalysisNotFound if the risk analysis doesn't exist", async () => {
    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    const riskAnalysisId = generateId<RiskAnalysisId>();
    expect(
      catalogService.updateRiskAnalysis(
        eservice.id,
        riskAnalysisId,
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        {
          authData: getMockAuthData(producer.id),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceRiskAnalysisNotFound(eservice.id, riskAnalysisId)
    );
  });
  it("should throw riskAnalysisDuplicated if risk analysis name is duplicated, case insensitive", async () => {
    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const riskAnalysis_1 = getMockValidRiskAnalysis(producerTenantKind);
    const riskAnalysis_2 = getMockValidRiskAnalysis(producerTenantKind);

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
      riskAnalysis: [
        riskAnalysis_1,
        {
          ...riskAnalysis_2,
          name: riskAnalysis_2.name.toUpperCase(),
        },
      ],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    const riskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed = {
      ...buildRiskAnalysisSeed(riskAnalysis_1),
      name: riskAnalysis_2.name.toLowerCase(),
    };
    expect(
      catalogService.updateRiskAnalysis(
        eservice.id,
        riskAnalysis_1.id,
        riskAnalysisSeed,
        {
          authData: getMockAuthData(producer.id),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      riskAnalysisDuplicated(riskAnalysis_2.name.toLowerCase(), eservice.id)
    );
  });
  it("should throw riskAnalysisValidationFailed if the risk analysis is not valid", async () => {
    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const riskAnalysis = getMockValidRiskAnalysis(producerTenantKind);

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
      riskAnalysis: [riskAnalysis],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    const riskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed =
      buildRiskAnalysisSeed(riskAnalysis);

    const riskAnalysisUpdatedSeed: catalogApi.EServiceRiskAnalysisSeed = {
      ...riskAnalysisSeed,
      riskAnalysisForm: {
        ...riskAnalysisSeed.riskAnalysisForm,
        answers: {
          ...riskAnalysisSeed.riskAnalysisForm.answers,
          purpose: ["INVALID"], // "purpose" is field expected for all tenant kinds
          unexpectedField: ["unexpected field value"],
          /*
            This risk analysis form has an unexpected field and an invalid value for the purpose field.
            The validation on update is schemaOnly: it does not check missing required fields or dependencies.
            However, it checks for unexpected fields and invalid values.
            So, the validation should fail with just two errors corresponding to the two invalid fields.
         */
        },
      },
    };

    expect(
      catalogService.updateRiskAnalysis(
        eservice.id,
        riskAnalysis.id,
        riskAnalysisUpdatedSeed,
        {
          authData: getMockAuthData(producer.id),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([
        unexpectedFieldValueError(
          "purpose",
          new Set(["INSTITUTIONAL", "OTHER"])
        ),
        unexpectedFieldError("unexpectedField"),
      ])
    );
  });
});
