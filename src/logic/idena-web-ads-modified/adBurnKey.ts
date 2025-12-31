import { ProtoAdBurnKeySchema } from 'idena-sdk-js-lite';
import { fromBinary } from '@bufbuild/protobuf';
import { hexToUint8Array } from 'idena-sdk-js-lite';

type BurnKey = { cid: string, target: string };

export class AdBurnKey {
    burnKey: BurnKey;

    constructor(burnKey: BurnKey) {
        this.burnKey = burnKey;
    }

    static fromBytes = (bytes: Uint8Array) => {
        try {
            const protoAdBurnKey = fromBinary(ProtoAdBurnKeySchema, bytes);
            return new AdBurnKey({
                cid: protoAdBurnKey.cid,
                target: protoAdBurnKey.target,
            });
        } catch (error) {
            return new AdBurnKey({cid: '', target: ''});
        }
    };

    static fromHex = (hex: string) =>
        AdBurnKey.fromBytes(hexToUint8Array(hex));
}
