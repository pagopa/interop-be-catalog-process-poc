/* eslint-disable functional/no-let */
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Purpose,
  toReadModelAgreement,
  toReadModelPurpose,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import { readModelServiceBuilder } from "../src/readModelService.js";

export const { cleanup, readModelRepository } = await setupTestContainersVitest(
  inject("readModelConfig")
);
afterEach(cleanup);

export const { purposes, agreements } = readModelRepository;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await writeInReadmodel(toReadModelPurpose(purpose), purposes);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
};
