import { CreateEvent, FileManager, logger } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementDocument,
  AgreementEvent,
  AgreementId,
  EService,
  SelfcareId,
  Tenant,
} from "pagopa-interop-models";
import { toCreateEventAgreementContractAdded } from "../model/domain/toEvent.js";
import { ApiAgreementDocumentSeed } from "../model/types.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import { pdfGenerator } from "./pdfGenerator.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const contractBuilder = (
  selfcareId: SelfcareId,
  attributeQuery: AttributeQuery,
  storeFile: FileManager["storeBytes"]
) => ({
  createContract: async (
    agreement: Agreement,
    eservice: EService,
    consumer: Tenant,
    producer: Tenant,
    seed: UpdateAgreementSeed
  ): Promise<ApiAgreementDocumentSeed> =>
    await pdfGenerator.createDocumentSeed(
      selfcareId,
      agreement,
      eservice,
      consumer,
      producer,
      seed,
      attributeQuery,
      storeFile
    ),
});

export type ContractBuilder = ReturnType<typeof contractBuilder>;

export async function addAgreementContractLogic(
  agreementId: AgreementId,
  agreementDocument: AgreementDocument,
  version: number,
  correlationId: string
): Promise<CreateEvent<AgreementEvent>> {
  logger.info(
    `Adding contract ${agreementDocument.id} to Agreement ${agreementId}`
  );

  return toCreateEventAgreementContractAdded(
    agreementId,
    agreementDocument,
    version,
    correlationId
  );
}
