import { EServiceTemplate } from "pagopa-interop-models";
import { z } from "zod";
import { invalidEServiceTemplateVersion } from "../model/domain/errors.js";

export const nextEServiceTemplateVersion = (
  eserviceTemplate: EServiceTemplate
): string => {
  const currentVersion = eserviceTemplate.versions.reduce(
    (max, eserviceTemplateVersion) => {
      const currentVersionNumber = z.coerce
        .number()
        .safeParse(eserviceTemplateVersion.version);
      if (!currentVersionNumber.success) {
        throw invalidEServiceTemplateVersion(
          `${eserviceTemplateVersion.version} is not a valid eservice template version`
        );
      }

      return currentVersionNumber.data > max ? currentVersionNumber.data : max;
    },
    0
  );

  return (currentVersion + 1).toString();
};
