import type { AnnotationMetadata, Label } from "@/types/annotation";

export const buildDefaultMetadata = (label: Label): AnnotationMetadata | undefined => {
  if (!label.properties?.length) {
    return undefined;
  }

  return label.properties.reduce<AnnotationMetadata>((acc, property) => {
    switch (property.type) {
      case "boolean":
        acc[property.id] = false;
        break;
      case "number":
        acc[property.id] = null;
        break;
      case "select":
        acc[property.id] = property.options?.[0] ?? "";
        break;
      default:
        acc[property.id] = "";
    }
    return acc;
  }, {});
};
