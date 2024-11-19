import {
  AttributeKind,
  Attribute,
  attributeKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";

export const toApiAttributeKind = (
  input: AttributeKind
): attributeRegistryApi.AttributeKind =>
  match<AttributeKind, attributeRegistryApi.AttributeKind>(input)
    .with(attributeKind.certified, () => "CERTIFIED")
    .with(attributeKind.verified, () => "VERIFIED")
    .with(attributeKind.declared, () => "DECLARED")
    .exhaustive();

export const toAttributeKind = (
  input: attributeRegistryApi.AttributeKind
): AttributeKind =>
  match<attributeRegistryApi.AttributeKind, AttributeKind>(input)
    .with("CERTIFIED", () => attributeKind.certified)
    .with("VERIFIED", () => attributeKind.verified)
    .with("DECLARED", () => attributeKind.declared)
    .exhaustive();

export const toApiAttribute = (
  attribute: Attribute
): attributeRegistryApi.Attribute => ({
  id: attribute.id,
  name: attribute.name,
  kind: toApiAttributeKind(attribute.kind),
  description: attribute.description,
  creationTime: attribute.creationTime.toJSON(),
  code: attribute.code,
  origin: attribute.origin,
});

export const toAttribute = (
  attribute: attributeRegistryApi.Attribute
): Attribute => ({
  id: unsafeBrandId(attribute.id),
  name: attribute.name,
  kind: toAttributeKind(attribute.kind),
  description: attribute.description,
  creationTime: new Date(attribute.creationTime),
  code: attribute.code,
  origin: attribute.origin,
});
