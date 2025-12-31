import { hexToUint8Array } from 'idena-sdk-js-lite';
import { ProtoAdSchema, type ProtoAd } from 'idena-sdk-js-lite';
import { fromBinary } from '@bufbuild/protobuf';

export const adFallbackSrc = '/static/body-medium-pic-icn.svg';

export type AdDetails = {
  title: string,
  desc: string,
  url: string,
  thumb: string,
  media: string,
};

export class Ad {
    details: AdDetails;

    constructor(details: AdDetails) {
        this.details = details;
    }

    static fromBytes = (bytes: Uint8Array) => {

        try {
            const protoAd = fromBinary(ProtoAdSchema, bytes) as ProtoAd;

            return new Ad({
                title: protoAd.title,
                desc: protoAd.desc,
                url: protoAd.url,
                thumb: protoAd.thumb ? URL.createObjectURL(new Blob([new Uint8Array(protoAd.thumb)])) : adFallbackSrc,
                media: protoAd.media ? URL.createObjectURL(new Blob([new Uint8Array(protoAd.media)])) : adFallbackSrc,
            });

        } catch (error) {
            return new Ad({
                title: '',
                desc: '',
                url: '',
                thumb: adFallbackSrc,
                media: adFallbackSrc,
            });
        }
    };

    static fromHex = (hex: string) => Ad.fromBytes(hexToUint8Array(hex));
}
