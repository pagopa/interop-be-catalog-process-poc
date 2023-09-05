// @generated by protobuf-ts 2.9.0
// @generated from protobuf file "v1/events.proto" (syntax proto2)
// tslint:disable
import type { BinaryWriteOptions } from "@protobuf-ts/runtime";
import type { IBinaryWriter } from "@protobuf-ts/runtime";
import { WireType } from "@protobuf-ts/runtime";
import type { BinaryReadOptions } from "@protobuf-ts/runtime";
import type { IBinaryReader } from "@protobuf-ts/runtime";
import { UnknownFieldHandler } from "@protobuf-ts/runtime";
import type { PartialMessage } from "@protobuf-ts/runtime";
import { reflectionMergePartial } from "@protobuf-ts/runtime";
import { MESSAGE_TYPE } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
import { CatalogDescriptorV1 } from "./catalog-item";
import { CatalogDocumentV1 } from "./catalog-item";
import { CatalogItemV1 } from "./catalog-item";
/**
 * @generated from protobuf message CatalogItemV1AddedV1
 */
export interface CatalogItemV1AddedV1 {
    /**
     * @generated from protobuf field: CatalogItemV1 catalogItem = 1;
     */
    catalogItem?: CatalogItemV1;
}
/**
 * @generated from protobuf message ClonedCatalogItemV1AddedV1
 */
export interface ClonedCatalogItemV1AddedV1 {
    /**
     * @generated from protobuf field: CatalogItemV1 catalogItem = 1;
     */
    catalogItem?: CatalogItemV1;
}
/**
 * @generated from protobuf message CatalogItemV1UpdatedV1
 */
export interface CatalogItemV1UpdatedV1 {
    /**
     * @generated from protobuf field: CatalogItemV1 catalogItem = 1;
     */
    catalogItem?: CatalogItemV1;
}
/**
 * @generated from protobuf message CatalogItemWithDescriptorsDeletedV1
 */
export interface CatalogItemWithDescriptorsDeletedV1 {
    /**
     * @generated from protobuf field: CatalogItemV1 catalogItem = 1;
     */
    catalogItem?: CatalogItemV1;
    /**
     * @generated from protobuf field: string descriptorId = 2;
     */
    descriptorId: string;
}
/**
 * @generated from protobuf message CatalogItemDocumentUpdatedV1
 */
export interface CatalogItemDocumentUpdatedV1 {
    /**
     * @generated from protobuf field: string eServiceId = 1;
     */
    eServiceId: string;
    /**
     * @generated from protobuf field: string descriptorId = 2;
     */
    descriptorId: string;
    /**
     * @generated from protobuf field: string documentId = 3;
     */
    documentId: string;
    /**
     * @generated from protobuf field: CatalogDocumentV1 updatedDocument = 4;
     */
    updatedDocument?: CatalogDocumentV1;
    /**
     * @generated from protobuf field: repeated string serverUrls = 5;
     */
    serverUrls: string[];
}
/**
 * @generated from protobuf message CatalogItemDeletedV1
 */
export interface CatalogItemDeletedV1 {
    /**
     * @generated from protobuf field: string catalogItemId = 1;
     */
    catalogItemId: string;
}
/**
 * @generated from protobuf message CatalogItemDocumentAddedV1
 */
export interface CatalogItemDocumentAddedV1 {
    /**
     * @generated from protobuf field: string eServiceId = 1;
     */
    eServiceId: string;
    /**
     * @generated from protobuf field: string descriptorId = 2;
     */
    descriptorId: string;
    /**
     * @generated from protobuf field: CatalogDocumentV1 document = 3;
     */
    document?: CatalogDocumentV1;
    /**
     * @generated from protobuf field: bool isInterface = 4;
     */
    isInterface: boolean;
    /**
     * @generated from protobuf field: repeated string serverUrls = 5;
     */
    serverUrls: string[];
}
/**
 * @generated from protobuf message CatalogItemDocumentDeletedV1
 */
export interface CatalogItemDocumentDeletedV1 {
    /**
     * @generated from protobuf field: string eServiceId = 1;
     */
    eServiceId: string;
    /**
     * @generated from protobuf field: string descriptorId = 2;
     */
    descriptorId: string;
    /**
     * @generated from protobuf field: string documentId = 3;
     */
    documentId: string;
}
/**
 * @generated from protobuf message CatalogItemDescriptorAddedV1
 */
export interface CatalogItemDescriptorAddedV1 {
    /**
     * @generated from protobuf field: string eServiceId = 1;
     */
    eServiceId: string;
    /**
     * @generated from protobuf field: CatalogDescriptorV1 catalogDescriptor = 2;
     */
    catalogDescriptor?: CatalogDescriptorV1;
}
/**
 * @generated from protobuf message CatalogItemDescriptorUpdatedV1
 */
export interface CatalogItemDescriptorUpdatedV1 {
    /**
     * @generated from protobuf field: string eServiceId = 1;
     */
    eServiceId: string;
    /**
     * @generated from protobuf field: CatalogDescriptorV1 catalogDescriptor = 2;
     */
    catalogDescriptor?: CatalogDescriptorV1;
}
/**
 * @generated from protobuf message MovedAttributesFromEserviceToDescriptorsV1
 */
export interface MovedAttributesFromEserviceToDescriptorsV1 {
    /**
     * @generated from protobuf field: CatalogItemV1 catalogItem = 1;
     */
    catalogItem?: CatalogItemV1;
}
// @generated message type with reflection information, may provide speed optimized methods
class CatalogItemV1AddedV1$Type extends MessageType<CatalogItemV1AddedV1> {
    constructor() {
        super("CatalogItemV1AddedV1", [
            { no: 1, name: "catalogItem", kind: "message", T: () => CatalogItemV1 }
        ]);
    }
    create(value?: PartialMessage<CatalogItemV1AddedV1>): CatalogItemV1AddedV1 {
        const message = {};
        globalThis.Object.defineProperty(message, MESSAGE_TYPE, { enumerable: false, value: this });
        if (value !== undefined)
            reflectionMergePartial<CatalogItemV1AddedV1>(this, message, value);
        return message;
    }
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: CatalogItemV1AddedV1): CatalogItemV1AddedV1 {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* CatalogItemV1 catalogItem */ 1:
                    message.catalogItem = CatalogItemV1.internalBinaryRead(reader, reader.uint32(), options, message.catalogItem);
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message: CatalogItemV1AddedV1, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter {
        /* CatalogItemV1 catalogItem = 1; */
        if (message.catalogItem)
            CatalogItemV1.internalBinaryWrite(message.catalogItem, writer.tag(1, WireType.LengthDelimited).fork(), options).join();
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message CatalogItemV1AddedV1
 */
export const CatalogItemV1AddedV1 = new CatalogItemV1AddedV1$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ClonedCatalogItemV1AddedV1$Type extends MessageType<ClonedCatalogItemV1AddedV1> {
    constructor() {
        super("ClonedCatalogItemV1AddedV1", [
            { no: 1, name: "catalogItem", kind: "message", T: () => CatalogItemV1 }
        ]);
    }
    create(value?: PartialMessage<ClonedCatalogItemV1AddedV1>): ClonedCatalogItemV1AddedV1 {
        const message = {};
        globalThis.Object.defineProperty(message, MESSAGE_TYPE, { enumerable: false, value: this });
        if (value !== undefined)
            reflectionMergePartial<ClonedCatalogItemV1AddedV1>(this, message, value);
        return message;
    }
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: ClonedCatalogItemV1AddedV1): ClonedCatalogItemV1AddedV1 {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* CatalogItemV1 catalogItem */ 1:
                    message.catalogItem = CatalogItemV1.internalBinaryRead(reader, reader.uint32(), options, message.catalogItem);
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message: ClonedCatalogItemV1AddedV1, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter {
        /* CatalogItemV1 catalogItem = 1; */
        if (message.catalogItem)
            CatalogItemV1.internalBinaryWrite(message.catalogItem, writer.tag(1, WireType.LengthDelimited).fork(), options).join();
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message ClonedCatalogItemV1AddedV1
 */
export const ClonedCatalogItemV1AddedV1 = new ClonedCatalogItemV1AddedV1$Type();
// @generated message type with reflection information, may provide speed optimized methods
class CatalogItemV1UpdatedV1$Type extends MessageType<CatalogItemV1UpdatedV1> {
    constructor() {
        super("CatalogItemV1UpdatedV1", [
            { no: 1, name: "catalogItem", kind: "message", T: () => CatalogItemV1 }
        ]);
    }
    create(value?: PartialMessage<CatalogItemV1UpdatedV1>): CatalogItemV1UpdatedV1 {
        const message = {};
        globalThis.Object.defineProperty(message, MESSAGE_TYPE, { enumerable: false, value: this });
        if (value !== undefined)
            reflectionMergePartial<CatalogItemV1UpdatedV1>(this, message, value);
        return message;
    }
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: CatalogItemV1UpdatedV1): CatalogItemV1UpdatedV1 {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* CatalogItemV1 catalogItem */ 1:
                    message.catalogItem = CatalogItemV1.internalBinaryRead(reader, reader.uint32(), options, message.catalogItem);
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message: CatalogItemV1UpdatedV1, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter {
        /* CatalogItemV1 catalogItem = 1; */
        if (message.catalogItem)
            CatalogItemV1.internalBinaryWrite(message.catalogItem, writer.tag(1, WireType.LengthDelimited).fork(), options).join();
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message CatalogItemV1UpdatedV1
 */
export const CatalogItemV1UpdatedV1 = new CatalogItemV1UpdatedV1$Type();
// @generated message type with reflection information, may provide speed optimized methods
class CatalogItemWithDescriptorsDeletedV1$Type extends MessageType<CatalogItemWithDescriptorsDeletedV1> {
    constructor() {
        super("CatalogItemWithDescriptorsDeletedV1", [
            { no: 1, name: "catalogItem", kind: "message", T: () => CatalogItemV1 },
            { no: 2, name: "descriptorId", kind: "scalar", T: 9 /*ScalarType.STRING*/ }
        ]);
    }
    create(value?: PartialMessage<CatalogItemWithDescriptorsDeletedV1>): CatalogItemWithDescriptorsDeletedV1 {
        const message = { descriptorId: "" };
        globalThis.Object.defineProperty(message, MESSAGE_TYPE, { enumerable: false, value: this });
        if (value !== undefined)
            reflectionMergePartial<CatalogItemWithDescriptorsDeletedV1>(this, message, value);
        return message;
    }
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: CatalogItemWithDescriptorsDeletedV1): CatalogItemWithDescriptorsDeletedV1 {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* CatalogItemV1 catalogItem */ 1:
                    message.catalogItem = CatalogItemV1.internalBinaryRead(reader, reader.uint32(), options, message.catalogItem);
                    break;
                case /* string descriptorId */ 2:
                    message.descriptorId = reader.string();
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message: CatalogItemWithDescriptorsDeletedV1, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter {
        /* CatalogItemV1 catalogItem = 1; */
        if (message.catalogItem)
            CatalogItemV1.internalBinaryWrite(message.catalogItem, writer.tag(1, WireType.LengthDelimited).fork(), options).join();
        /* string descriptorId = 2; */
        if (message.descriptorId !== "")
            writer.tag(2, WireType.LengthDelimited).string(message.descriptorId);
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message CatalogItemWithDescriptorsDeletedV1
 */
export const CatalogItemWithDescriptorsDeletedV1 = new CatalogItemWithDescriptorsDeletedV1$Type();
// @generated message type with reflection information, may provide speed optimized methods
class CatalogItemDocumentUpdatedV1$Type extends MessageType<CatalogItemDocumentUpdatedV1> {
    constructor() {
        super("CatalogItemDocumentUpdatedV1", [
            { no: 1, name: "eServiceId", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 2, name: "descriptorId", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 3, name: "documentId", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 4, name: "updatedDocument", kind: "message", T: () => CatalogDocumentV1 },
            { no: 5, name: "serverUrls", kind: "scalar", repeat: 2 /*RepeatType.UNPACKED*/, T: 9 /*ScalarType.STRING*/ }
        ]);
    }
    create(value?: PartialMessage<CatalogItemDocumentUpdatedV1>): CatalogItemDocumentUpdatedV1 {
        const message = { eServiceId: "", descriptorId: "", documentId: "", serverUrls: [] };
        globalThis.Object.defineProperty(message, MESSAGE_TYPE, { enumerable: false, value: this });
        if (value !== undefined)
            reflectionMergePartial<CatalogItemDocumentUpdatedV1>(this, message, value);
        return message;
    }
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: CatalogItemDocumentUpdatedV1): CatalogItemDocumentUpdatedV1 {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* string eServiceId */ 1:
                    message.eServiceId = reader.string();
                    break;
                case /* string descriptorId */ 2:
                    message.descriptorId = reader.string();
                    break;
                case /* string documentId */ 3:
                    message.documentId = reader.string();
                    break;
                case /* CatalogDocumentV1 updatedDocument */ 4:
                    message.updatedDocument = CatalogDocumentV1.internalBinaryRead(reader, reader.uint32(), options, message.updatedDocument);
                    break;
                case /* repeated string serverUrls */ 5:
                    message.serverUrls.push(reader.string());
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message: CatalogItemDocumentUpdatedV1, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter {
        /* string eServiceId = 1; */
        if (message.eServiceId !== "")
            writer.tag(1, WireType.LengthDelimited).string(message.eServiceId);
        /* string descriptorId = 2; */
        if (message.descriptorId !== "")
            writer.tag(2, WireType.LengthDelimited).string(message.descriptorId);
        /* string documentId = 3; */
        if (message.documentId !== "")
            writer.tag(3, WireType.LengthDelimited).string(message.documentId);
        /* CatalogDocumentV1 updatedDocument = 4; */
        if (message.updatedDocument)
            CatalogDocumentV1.internalBinaryWrite(message.updatedDocument, writer.tag(4, WireType.LengthDelimited).fork(), options).join();
        /* repeated string serverUrls = 5; */
        for (let i = 0; i < message.serverUrls.length; i++)
            writer.tag(5, WireType.LengthDelimited).string(message.serverUrls[i]);
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message CatalogItemDocumentUpdatedV1
 */
export const CatalogItemDocumentUpdatedV1 = new CatalogItemDocumentUpdatedV1$Type();
// @generated message type with reflection information, may provide speed optimized methods
class CatalogItemDeletedV1$Type extends MessageType<CatalogItemDeletedV1> {
    constructor() {
        super("CatalogItemDeletedV1", [
            { no: 1, name: "catalogItemId", kind: "scalar", T: 9 /*ScalarType.STRING*/ }
        ]);
    }
    create(value?: PartialMessage<CatalogItemDeletedV1>): CatalogItemDeletedV1 {
        const message = { catalogItemId: "" };
        globalThis.Object.defineProperty(message, MESSAGE_TYPE, { enumerable: false, value: this });
        if (value !== undefined)
            reflectionMergePartial<CatalogItemDeletedV1>(this, message, value);
        return message;
    }
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: CatalogItemDeletedV1): CatalogItemDeletedV1 {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* string catalogItemId */ 1:
                    message.catalogItemId = reader.string();
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message: CatalogItemDeletedV1, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter {
        /* string catalogItemId = 1; */
        if (message.catalogItemId !== "")
            writer.tag(1, WireType.LengthDelimited).string(message.catalogItemId);
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message CatalogItemDeletedV1
 */
export const CatalogItemDeletedV1 = new CatalogItemDeletedV1$Type();
// @generated message type with reflection information, may provide speed optimized methods
class CatalogItemDocumentAddedV1$Type extends MessageType<CatalogItemDocumentAddedV1> {
    constructor() {
        super("CatalogItemDocumentAddedV1", [
            { no: 1, name: "eServiceId", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 2, name: "descriptorId", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 3, name: "document", kind: "message", T: () => CatalogDocumentV1 },
            { no: 4, name: "isInterface", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
            { no: 5, name: "serverUrls", kind: "scalar", repeat: 2 /*RepeatType.UNPACKED*/, T: 9 /*ScalarType.STRING*/ }
        ]);
    }
    create(value?: PartialMessage<CatalogItemDocumentAddedV1>): CatalogItemDocumentAddedV1 {
        const message = { eServiceId: "", descriptorId: "", isInterface: false, serverUrls: [] };
        globalThis.Object.defineProperty(message, MESSAGE_TYPE, { enumerable: false, value: this });
        if (value !== undefined)
            reflectionMergePartial<CatalogItemDocumentAddedV1>(this, message, value);
        return message;
    }
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: CatalogItemDocumentAddedV1): CatalogItemDocumentAddedV1 {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* string eServiceId */ 1:
                    message.eServiceId = reader.string();
                    break;
                case /* string descriptorId */ 2:
                    message.descriptorId = reader.string();
                    break;
                case /* CatalogDocumentV1 document */ 3:
                    message.document = CatalogDocumentV1.internalBinaryRead(reader, reader.uint32(), options, message.document);
                    break;
                case /* bool isInterface */ 4:
                    message.isInterface = reader.bool();
                    break;
                case /* repeated string serverUrls */ 5:
                    message.serverUrls.push(reader.string());
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message: CatalogItemDocumentAddedV1, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter {
        /* string eServiceId = 1; */
        if (message.eServiceId !== "")
            writer.tag(1, WireType.LengthDelimited).string(message.eServiceId);
        /* string descriptorId = 2; */
        if (message.descriptorId !== "")
            writer.tag(2, WireType.LengthDelimited).string(message.descriptorId);
        /* CatalogDocumentV1 document = 3; */
        if (message.document)
            CatalogDocumentV1.internalBinaryWrite(message.document, writer.tag(3, WireType.LengthDelimited).fork(), options).join();
        /* bool isInterface = 4; */
        if (message.isInterface !== false)
            writer.tag(4, WireType.Varint).bool(message.isInterface);
        /* repeated string serverUrls = 5; */
        for (let i = 0; i < message.serverUrls.length; i++)
            writer.tag(5, WireType.LengthDelimited).string(message.serverUrls[i]);
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message CatalogItemDocumentAddedV1
 */
export const CatalogItemDocumentAddedV1 = new CatalogItemDocumentAddedV1$Type();
// @generated message type with reflection information, may provide speed optimized methods
class CatalogItemDocumentDeletedV1$Type extends MessageType<CatalogItemDocumentDeletedV1> {
    constructor() {
        super("CatalogItemDocumentDeletedV1", [
            { no: 1, name: "eServiceId", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 2, name: "descriptorId", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 3, name: "documentId", kind: "scalar", T: 9 /*ScalarType.STRING*/ }
        ]);
    }
    create(value?: PartialMessage<CatalogItemDocumentDeletedV1>): CatalogItemDocumentDeletedV1 {
        const message = { eServiceId: "", descriptorId: "", documentId: "" };
        globalThis.Object.defineProperty(message, MESSAGE_TYPE, { enumerable: false, value: this });
        if (value !== undefined)
            reflectionMergePartial<CatalogItemDocumentDeletedV1>(this, message, value);
        return message;
    }
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: CatalogItemDocumentDeletedV1): CatalogItemDocumentDeletedV1 {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* string eServiceId */ 1:
                    message.eServiceId = reader.string();
                    break;
                case /* string descriptorId */ 2:
                    message.descriptorId = reader.string();
                    break;
                case /* string documentId */ 3:
                    message.documentId = reader.string();
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message: CatalogItemDocumentDeletedV1, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter {
        /* string eServiceId = 1; */
        if (message.eServiceId !== "")
            writer.tag(1, WireType.LengthDelimited).string(message.eServiceId);
        /* string descriptorId = 2; */
        if (message.descriptorId !== "")
            writer.tag(2, WireType.LengthDelimited).string(message.descriptorId);
        /* string documentId = 3; */
        if (message.documentId !== "")
            writer.tag(3, WireType.LengthDelimited).string(message.documentId);
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message CatalogItemDocumentDeletedV1
 */
export const CatalogItemDocumentDeletedV1 = new CatalogItemDocumentDeletedV1$Type();
// @generated message type with reflection information, may provide speed optimized methods
class CatalogItemDescriptorAddedV1$Type extends MessageType<CatalogItemDescriptorAddedV1> {
    constructor() {
        super("CatalogItemDescriptorAddedV1", [
            { no: 1, name: "eServiceId", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 2, name: "catalogDescriptor", kind: "message", T: () => CatalogDescriptorV1 }
        ]);
    }
    create(value?: PartialMessage<CatalogItemDescriptorAddedV1>): CatalogItemDescriptorAddedV1 {
        const message = { eServiceId: "" };
        globalThis.Object.defineProperty(message, MESSAGE_TYPE, { enumerable: false, value: this });
        if (value !== undefined)
            reflectionMergePartial<CatalogItemDescriptorAddedV1>(this, message, value);
        return message;
    }
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: CatalogItemDescriptorAddedV1): CatalogItemDescriptorAddedV1 {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* string eServiceId */ 1:
                    message.eServiceId = reader.string();
                    break;
                case /* CatalogDescriptorV1 catalogDescriptor */ 2:
                    message.catalogDescriptor = CatalogDescriptorV1.internalBinaryRead(reader, reader.uint32(), options, message.catalogDescriptor);
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message: CatalogItemDescriptorAddedV1, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter {
        /* string eServiceId = 1; */
        if (message.eServiceId !== "")
            writer.tag(1, WireType.LengthDelimited).string(message.eServiceId);
        /* CatalogDescriptorV1 catalogDescriptor = 2; */
        if (message.catalogDescriptor)
            CatalogDescriptorV1.internalBinaryWrite(message.catalogDescriptor, writer.tag(2, WireType.LengthDelimited).fork(), options).join();
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message CatalogItemDescriptorAddedV1
 */
export const CatalogItemDescriptorAddedV1 = new CatalogItemDescriptorAddedV1$Type();
// @generated message type with reflection information, may provide speed optimized methods
class CatalogItemDescriptorUpdatedV1$Type extends MessageType<CatalogItemDescriptorUpdatedV1> {
    constructor() {
        super("CatalogItemDescriptorUpdatedV1", [
            { no: 1, name: "eServiceId", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 2, name: "catalogDescriptor", kind: "message", T: () => CatalogDescriptorV1 }
        ]);
    }
    create(value?: PartialMessage<CatalogItemDescriptorUpdatedV1>): CatalogItemDescriptorUpdatedV1 {
        const message = { eServiceId: "" };
        globalThis.Object.defineProperty(message, MESSAGE_TYPE, { enumerable: false, value: this });
        if (value !== undefined)
            reflectionMergePartial<CatalogItemDescriptorUpdatedV1>(this, message, value);
        return message;
    }
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: CatalogItemDescriptorUpdatedV1): CatalogItemDescriptorUpdatedV1 {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* string eServiceId */ 1:
                    message.eServiceId = reader.string();
                    break;
                case /* CatalogDescriptorV1 catalogDescriptor */ 2:
                    message.catalogDescriptor = CatalogDescriptorV1.internalBinaryRead(reader, reader.uint32(), options, message.catalogDescriptor);
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message: CatalogItemDescriptorUpdatedV1, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter {
        /* string eServiceId = 1; */
        if (message.eServiceId !== "")
            writer.tag(1, WireType.LengthDelimited).string(message.eServiceId);
        /* CatalogDescriptorV1 catalogDescriptor = 2; */
        if (message.catalogDescriptor)
            CatalogDescriptorV1.internalBinaryWrite(message.catalogDescriptor, writer.tag(2, WireType.LengthDelimited).fork(), options).join();
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message CatalogItemDescriptorUpdatedV1
 */
export const CatalogItemDescriptorUpdatedV1 = new CatalogItemDescriptorUpdatedV1$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MovedAttributesFromEserviceToDescriptorsV1$Type extends MessageType<MovedAttributesFromEserviceToDescriptorsV1> {
    constructor() {
        super("MovedAttributesFromEserviceToDescriptorsV1", [
            { no: 1, name: "catalogItem", kind: "message", T: () => CatalogItemV1 }
        ]);
    }
    create(value?: PartialMessage<MovedAttributesFromEserviceToDescriptorsV1>): MovedAttributesFromEserviceToDescriptorsV1 {
        const message = {};
        globalThis.Object.defineProperty(message, MESSAGE_TYPE, { enumerable: false, value: this });
        if (value !== undefined)
            reflectionMergePartial<MovedAttributesFromEserviceToDescriptorsV1>(this, message, value);
        return message;
    }
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: MovedAttributesFromEserviceToDescriptorsV1): MovedAttributesFromEserviceToDescriptorsV1 {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* CatalogItemV1 catalogItem */ 1:
                    message.catalogItem = CatalogItemV1.internalBinaryRead(reader, reader.uint32(), options, message.catalogItem);
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message: MovedAttributesFromEserviceToDescriptorsV1, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter {
        /* CatalogItemV1 catalogItem = 1; */
        if (message.catalogItem)
            CatalogItemV1.internalBinaryWrite(message.catalogItem, writer.tag(1, WireType.LengthDelimited).fork(), options).join();
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message MovedAttributesFromEserviceToDescriptorsV1
 */
export const MovedAttributesFromEserviceToDescriptorsV1 = new MovedAttributesFromEserviceToDescriptorsV1$Type();
