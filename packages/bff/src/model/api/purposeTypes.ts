import { ZodiosBodyByPath } from "@zodios/core";
import { z } from "zod";
import {
  api as purposeApi,
  schemas,
} from "../generated/purpose-process/api.js";

type PurposeApi = typeof purposeApi.api;

export type ApiPurposePayload = ZodiosBodyByPath<
  PurposeApi,
  "post",
  "/purposes"
>;

export type ApiEServicePurposeSeedPayload = ZodiosBodyByPath<
  PurposeApi,
  "post",
  "/reverse/purposes"
>;

export type ApiUpdateReversePurposePayload = ZodiosBodyByPath<
  PurposeApi,
  "post",
  "/reverse/purposes/:id"
>;

export type PurposeProcessApiPurpose = z.infer<typeof schemas.Purpose>;
export type PurposeProcessApiPurposeVersion = z.infer<
  typeof schemas.PurposeVersion
>;
export type PurposeProcessApiPurposeVersionState = z.infer<
  typeof schemas.PurposeVersionState
>;
