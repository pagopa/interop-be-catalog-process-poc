import {
  EServiceTemplateTopicConfig,
  ReadModelWriterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const ESErviceTemplateReadModelWriterConfig = ReadModelWriterConfig.and(
  EServiceTemplateTopicConfig
);

export type ESErviceTemplateReadModelWriterConfig = z.infer<
  typeof ESErviceTemplateReadModelWriterConfig
>;

export const config: ESErviceTemplateReadModelWriterConfig =
  ESErviceTemplateReadModelWriterConfig.parse(process.env);
