/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  DocumentSQL,
  genericInternalError,
  EServiceSQL,
  DescriptorSQL,
  DescriptorAttributeSQL,
} from "pagopa-interop-models";

export const parseDocumentSQL = (data: any): DocumentSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = DocumentSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse document item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseEserviceSQL = (data: any): EServiceSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = EServiceSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse eService item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseDescriptorSQL = (data: any): DescriptorSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = DescriptorSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse descriptor item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseDescriptorAttributeSQL = (
  data: any
): DescriptorAttributeSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = DescriptorAttributeSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse descriptor attribute item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};
