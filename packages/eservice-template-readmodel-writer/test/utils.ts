import { inject, afterEach } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";

export const { cleanup, readModelRepository } = await setupTestContainersVitest(
  inject("readModelConfig")
);

afterEach(cleanup);

export const eserviceTemplates = readModelRepository.eserviceTemplates;
