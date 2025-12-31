import { ProtoProfileSchema } from 'idena-sdk-js-lite';
import { fromBinary } from '@bufbuild/protobuf';
import { hexToUint8Array } from 'idena-sdk-js-lite';

type Ad = { cid: string, target: string, contract: string, author: string };

export class Profile {
    ads: Ad[];

    constructor(profile: { ads: Ad[] }) {
        this.ads = profile.ads;
    }

    static fromBytes = (bytes: Uint8Array) => {
        try {
            return new Profile({
                ads: fromBinary(ProtoProfileSchema, bytes).ads as Ad[],
            });
        } catch (error) {
            return new Profile({ ads: [] });
        }
    };

    static fromHex = (hex: string) =>
        Profile.fromBytes(hexToUint8Array(hex));
}
