import { agreementApi } from "pagopa-interop-api-clients";
import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  invalidAgreementState: "0001",
  producerAndConsumerParamMissing: "0002",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function invalidAgreementState(
  state: agreementApi.AgreementState,
  agreementId: agreementApi.Agreement["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Cannot retrieve agreement in ${state} state - id: ${agreementId}`,
    code: "invalidAgreementState",
    title: "Invalid agreement state",
  });
}

export function producerAndConsumerParamMissing(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Either producerId or consumerId required",
    code: "producerAndConsumerParamMissing",
    title: "Producer and Consumer param missing",
  });
}
