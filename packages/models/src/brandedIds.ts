import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

export const AgreementId = z.string().uuid().brand("AgreementId");
export type AgreementId = z.infer<typeof AgreementId>;

export const AgreementDocumentId = z
  .string()
  .uuid()
  .brand("AgreementDocumentId");
export type AgreementDocumentId = z.infer<typeof AgreementDocumentId>;

export const AttributeId = z.string().uuid().brand("AttributeId");
export type AttributeId = z.infer<typeof AttributeId>;

export const DescriptorId = z.string().uuid().brand("DescriptorId");
export type DescriptorId = z.infer<typeof DescriptorId>;

type IDS = AgreementId | AgreementDocumentId | DescriptorId | AttributeId;

export function generateId<T extends IDS>(): T {
  return uuidv4() as T;
}

export function unsafeBrandId<T extends IDS>(id: string): T {
  return id as T;
}
