import {
  EServiceTemplateCollection,
  ReadModelRepository,
} from "pagopa-interop-commons";
import {
  EServiceTemplate,
  EServiceTemplateId,
  TenantId,
  WithMetadata,
  genericInternalError,
} from "pagopa-interop-models";
import { Filter, WithId } from "mongodb";
import { z } from "zod";

async function getEServiceTemplate(
  eserviceTemplates: EServiceTemplateCollection,
  filter: Filter<WithId<WithMetadata<EServiceTemplate>>>
): Promise<WithMetadata<EServiceTemplate> | undefined> {
  const data = await eserviceTemplates.findOne(filter, {
    projection: { data: true, metadata: true },
  });
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
        `Unable to parse eService item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const eserviceTemplates = readModelRepository.eserviceTemplates;

  return {
    async getEServiceTemplateById(
      id: EServiceTemplateId
    ): Promise<WithMetadata<EServiceTemplate> | undefined> {
      return getEServiceTemplate(eserviceTemplates, { "data.id": id });
    },

    async getEServiceTemplateByNameAndProducerId({
      name,
      creatorId,
    }: {
      name: string;
      creatorId: TenantId;
    }): Promise<WithMetadata<EServiceTemplate> | undefined> {
      return getEServiceTemplate(eserviceTemplates, {
        "data.name": {
          $regex: `^${ReadModelRepository.escapeRegExp(name)}$$`,
          $options: "i",
        },
        "data.creatorId": creatorId,
      });
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
