import { ReadModelRepository } from "pagopa-interop-commons";
import {
  EServiceTemplate,
  EServiceTemplateId,
  genericInternalError,
  WithMetadata,
} from "pagopa-interop-models";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const eserviceTemplates = readModelRepository.eserviceTemplates;

  return {
    async getEServiceTemplateById(
      id: EServiceTemplateId
    ): Promise<WithMetadata<EServiceTemplate> | undefined> {
      const data = await eserviceTemplates.findOne(
        { "data.id": id },
        {
          projection: { data: true, metadata: true },
        }
      );
      if (!data) {
        return undefined;
      } else {
        const result = z
          .object({
            metadata: z.object({ version: z.number() }),
            data: EServiceTemplate,
          })
          .safeParse(data);
        if (!result.success) {
          throw genericInternalError(
            `Unable to parse eService template item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }
        return {
          data: result.data.data,
          metadata: { version: result.data.metadata.version },
        };
      }
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
