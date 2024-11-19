import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockAuthData,
} from "pagopa-interop-commons-test/index.js";
import { Agreement, generateId, AgreementId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { agreementNotFound } from "../src/model/domain/errors.js";
import { agreementToApiAgreement } from "../src/model/domain/apiConverter.js";
import { addOneAgreement, agreementService } from "./utils.js";
import { mockAgreementRouterRequest } from "./supertestSetup.js";

describe("get agreement", () => {
  it("should get an agreement", async () => {
    const agreement: Agreement = getMockAgreement();
    await addOneAgreement(agreement);
    await addOneAgreement(getMockAgreement());

    const result = await mockAgreementRouterRequest.get({
      path: "/agreements/:agreementId",
      pathParams: { agreementId: agreement.id },
      authData: getMockAuthData(),
    });

    expect(result).toEqual(agreementToApiAgreement(agreement));
  });

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    const agreementId = generateId<AgreementId>();

    await addOneAgreement(getMockAgreement());

    await expect(
      agreementService.getAgreementById(agreementId, genericLogger)
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });
});
