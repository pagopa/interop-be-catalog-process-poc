import { EService } from "pagopa-interop-models";
import { z } from "zod";
import { invalidDescriptorVersion } from "../model/domain/errors.js";

export const nextDescriptorVersion = (eservice: EService): string => {
  const currentVersion = eservice.descriptors.reduce((max, descriptor) => {
    const currentVersionNumber = z.coerce
      .number()
      .safeParse(descriptor.version);
    if (!currentVersionNumber.success) {
      throw invalidDescriptorVersion(
        `${descriptor.version} is not a valid descriptor version`
      );
    }

    return currentVersionNumber.data > max ? currentVersionNumber.data : max;
  }, 0);

  return (currentVersion + 1).toString();
};
