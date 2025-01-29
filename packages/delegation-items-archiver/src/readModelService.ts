import { ReadModelFilter, ReadModelRepository } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementState,
  DelegationId,
  DelegationV2,
  Purpose,
  PurposeVersionState,
} from "pagopa-interop-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { purposes, agreements } = readModelRepository;

  return {
    async getPurposes(delegationId: DelegationId): Promise<Purpose[]> {
      return await purposes
        .find({
          "data.delegationId": delegationId,
          "data.versions.state": {
            $in: [
              "Active",
              "Suspended",
              "Draft",
              "WaitingForApproval",
            ] satisfies PurposeVersionState[],
          },
        } satisfies ReadModelFilter<Purpose>)
        .map(({ data }) => Purpose.parse(data))
        .toArray();
    },
    async getAgreement(
      delegation: DelegationV2
    ): Promise<Agreement | undefined> {
      const data = await agreements.findOne(
        {
          "data.eserviceId": delegation.eserviceId,
          "data.consumerId": delegation.delegatorId,
          "data.state": {
            $in: [
              "Active",
              "Suspended",
              "Draft",
              "MissingCertifiedAttributes",
              "Pending",
            ] satisfies AgreementState[],
          },
        } satisfies ReadModelFilter<Agreement>,
        { projection: { data: true } }
      );

      if (!data) {
        return undefined;
      }
      return Agreement.parse(data.data);
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
