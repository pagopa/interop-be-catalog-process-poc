import { SaslAuthenticationResponse } from "kafkajs";
import { INT32_SIZE } from "./constants.js";

/** @internal */
export const createSaslAuthenticationResponse: SaslAuthenticationResponse<unknown> =
  {
    decode: (rawData: Buffer) => {
      const byteLength = rawData.readInt32BE(0);
      return rawData.slice(INT32_SIZE, INT32_SIZE + byteLength);
    },

    parse: (data: Buffer) => JSON.parse(data.toString()),
  };
