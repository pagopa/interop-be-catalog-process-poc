import { genericInternalError } from "pagopa-interop-models";
import {
  AgreementSQL,
  AgreementDocumentSQL,
  AgreementAttributeSQL,
} from "pagopa-interop-models";

export const parseAgreementDocumentSQL = (
  data: any
): AgreementDocumentSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = AgreementDocumentSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse agreement document item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseAgreementSQL = (data: any): AgreementSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = AgreementSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse agreement item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseAgreementAttributeSQL = (
  data: any
): AgreementAttributeSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = AgreementAttributeSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse agreement attribute item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};
