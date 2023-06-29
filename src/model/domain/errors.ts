export const ErrorCode = {
  DuplicateEserviceName: "0010",
  ContentTypeParsingError: "0001",
  EServiceNotFound: "0007",
  EServiceCannotBeUpdated: "0009",
  OperationForbidden: "9989",
  UnexpectedError: "9999", // TODO: arbitrary error code retrieve it
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class CatalogProcessError extends Error {
  public readonly code: ErrorCode;

  constructor(message: string, code: ErrorCode) {
    super(message);
    this.code = code;
  }
}

export function eServiceNotFound(eServiceId: string): CatalogProcessError {
  return new CatalogProcessError(
    `EService ${eServiceId} not found`,
    ErrorCode.EServiceNotFound
  );
}

export const operationForbidden = new CatalogProcessError(
  `Insufficient privileges`,
  ErrorCode.OperationForbidden
);

export function eServiceCannotBeUpdated(
  eServiceId: string
): CatalogProcessError {
  return new CatalogProcessError(
    `EService ${eServiceId} contains valid descriptors and cannot be updated`,
    ErrorCode.EServiceCannotBeUpdated
  );
}
