import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import {
  Agreement,
  EService,
  toReadModelAgreement,
  toReadModelEService,
} from "pagopa-interop-models";
import { readModelServiceBuilder } from "../src/services/readModelService.js";

export const { cleanup, ...testSetupServices } = setupTestContainersVitest(
  inject("readModelConfig")
);

afterEach(cleanup);

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const readModelRepository = testSetupServices.readModelRepository!;

export const agreements = readModelRepository.agreements;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};
