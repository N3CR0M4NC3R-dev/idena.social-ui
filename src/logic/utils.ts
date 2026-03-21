import Decimal from "decimal.js";
import { hexToUint8Array, toHexString } from "idena-sdk-js-lite";

const dnaBase = 1e18;
const postMessagePayloadPrefix = 'idena.social-ui:post-content:v1:';
const postImageDataUrlRegex = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=]+$/i;
const ipfsCidRegex = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/i;

export const MAX_POST_IMAGE_BYTES = 1024 * 1024;
export const POST_IMAGE_MAX_SIZE_LABEL = '1MB';
export const POST_IMAGE_FILE_ACCEPT = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/avif';

export type EncodedIpfsImage = {
    cid: string,
    mimeType: string,
    size: number,
    pinnedOn?: string[],
};

type PostMessagePayload = {
    text?: string,
    imageDataUrl?: string,
    image?: {
        scheme?: string,
        cid?: string,
        mimeType?: string,
        size?: number,
        pinnedOn?: string[],
    },
};

export type ParsedPostMessage = {
    text: string,
    image?: {
        kind: 'inline',
        dataUrl: string,
    } | {
        kind: 'ipfs',
        cid: string,
        mimeType: string,
        size?: number,
        pinnedOn: string[],
    },
};

function extractFirstJsonObject(input: string) {
    const trimmed = input.trim();
    if (!trimmed.startsWith('{')) {
        return '';
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (ch === '\\') {
            escaped = true;
            continue;
        }

        if (ch === '"') {
            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (ch === '{') {
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0) {
                return trimmed.slice(0, i + 1);
            }
        }
    }

    return '';
}

export function isSupportedPostImageType(mimeType: string) {
    return POST_IMAGE_FILE_ACCEPT.split(',').includes(mimeType.toLowerCase());
}

export function isSupportedPostImageDataUrl(imageDataUrl: string) {
    return postImageDataUrlRegex.test(imageDataUrl);
}

export function isValidIpfsCid(cid: string) {
    return ipfsCidRegex.test(cid);
}

function sanitizePinnedOnNodes(nodes: unknown) {
    if (!Array.isArray(nodes)) {
        return [];
    }

    const validNodes = nodes.filter((node) => typeof node === 'string' && node.trim() !== '').map((node) => node.trim());
    return [ ...new Set(validNodes) ];
}

export function encodePostMessage(text: string, image?: EncodedIpfsImage) {
    if (!image) {
        return text;
    }

    return `${postMessagePayloadPrefix}${JSON.stringify({
        text,
        image: {
            scheme: 'ipfs',
            cid: image.cid,
            mimeType: image.mimeType,
            size: image.size,
            pinnedOn: image.pinnedOn,
        },
    })}`;
}

export function parsePostMessage(message: string): ParsedPostMessage {
    const normalizedMessage = message.replace(/\u0000/g, '').trim();
    if (!normalizedMessage.includes(postMessagePayloadPrefix)) {
        return { text: message };
    }

    try {
        const prefixIndex = normalizedMessage.indexOf(postMessagePayloadPrefix);
        const payloadRaw = normalizedMessage.slice(prefixIndex + postMessagePayloadPrefix.length).trim();
        let payloadString = payloadRaw;
        let payload = undefined as PostMessagePayload | undefined;

        try {
            payload = JSON.parse(payloadString) as PostMessagePayload;
        } catch {
            const extractedPayload = extractFirstJsonObject(payloadString);
            if (extractedPayload) {
                payload = JSON.parse(extractedPayload) as PostMessagePayload;
                payloadString = extractedPayload;
            }
        }

        if (!payload || typeof payload !== 'object' || !payloadString) {
            return { text: message };
        }

        const text = typeof payload.text === 'string' ? payload.text : '';
        const imageDataUrlRaw = typeof payload.imageDataUrl === 'string' ? payload.imageDataUrl : '';
        if (isSupportedPostImageDataUrl(imageDataUrlRaw)) {
            return {
                text,
                image: {
                    kind: 'inline',
                    dataUrl: imageDataUrlRaw,
                },
            };
        }

        const image = payload.image;
        if (
            image &&
            image.scheme === 'ipfs' &&
            typeof image.cid === 'string' &&
            isValidIpfsCid(image.cid) &&
            typeof image.mimeType === 'string' &&
            typeof image.size === 'number'
        ) {
            return {
                text,
                image: {
                    kind: 'ipfs',
                    cid: image.cid,
                    mimeType: image.mimeType,
                    size: image.size,
                    pinnedOn: sanitizePinnedOnNodes(image.pinnedOn),
                },
            };
        }

        return { text };
    } catch {
        return { text: message };
    }
}

export function isLikePostMessage(message: string, likeEmoji: string) {
    const { text, image } = parsePostMessage(message);
    return text === likeEmoji && !image;
}

export function getDisplayAddress(address: string) {
    return `${address.slice(0, 7)}...${address.slice(-5)}`;
}

export function getDisplayAddressShort(address: string) {
    return `${address.slice(0, 5)}...${address.slice(-3)}`;
}

export function getDisplayDateTime(timestamp: number) {
    const datePost = new Date(timestamp * 1000);
    const dateToday = new Date();
    const dateYesterday = new Date(dateToday.getTime() - 24 * 60 * 60 * 1000);
    const postLocaleDateString = datePost.toLocaleDateString('en-GB');
    const displayDate = postLocaleDateString === dateToday.toLocaleDateString('en-GB') ? 'Today' : postLocaleDateString === dateYesterday.toLocaleDateString('en-GB') ? 'Yesterday' : postLocaleDateString;
    const postLocaleTimeString = datePost.toLocaleTimeString(['en-US'], { hour: '2-digit', minute: '2-digit'});
    const displayTime = postLocaleTimeString.replace(/^0+/, '');

    return { displayDate, displayTime };
}

export function getMessageLines(message: string, calculateViewMoreIndex = false, maxLines = 10) {
    const limit = 30;

    let messageLines = message.split(/\r\n/g, limit);
    if (messageLines.length === 1) {
        messageLines = message.split(/\n/g), limit;
    }

    if (!calculateViewMoreIndex) {
        return { messageLines };
    }

    const charsPerLine = 55;
    let accLines = 0;
    let index = 0;
    let textOverflows = false;
    let truncatedMessageLines: string[] = [];

    for (; index < messageLines.length; index++) {
        const messageLineItem = messageLines[index];
        const isLastIteration = index === messageLines.length - 1;
        const messagelineLength = messageLineItem.length;
        const addedLinesFloat = messagelineLength / charsPerLine;
        const addedLines = isLastIteration ? addedLinesFloat : Math.ceil(addedLinesFloat);

        accLines += addedLines;

        if (accLines >= maxLines) {
            const overflowChars = Math.floor((accLines - maxLines) * charsPerLine);
            truncatedMessageLines = messageLines.slice(0, index);

            const lastLineLength = messageLineItem.length - overflowChars;
            let lastLine = overflowChars === 0 ? messageLineItem : messageLineItem.slice(0, lastLineLength);
            
            if (
                overflowChars !== 0 &&
                messageLineItem.charAt(lastLineLength - 1) !== '.' &&
                messageLineItem.charAt(lastLineLength - 1) !== ' ' &&
                messageLineItem.charAt(lastLineLength) !== '.' &&
                messageLineItem.charAt(lastLineLength) !== ' '
            ) {
                lastLine += '...';
            }

            truncatedMessageLines.push(lastLine);
            textOverflows = true;
            break;
        }
    }

    return { messageLines, textOverflows, truncatedMessageLines };
}

export function calculateMaxFee(maxFeeResult: string, inputPostLength: number) {
    const perCharMaxFeeDivisor = 200;
    const totalMaxFeeMultiplier = 10;

    const maxFeeDecimal = new Decimal(maxFeeResult).div(new Decimal(dnaBase));
    const additionalPerCharFee = maxFeeDecimal.div(perCharMaxFeeDivisor).mul(inputPostLength);
    const maxFeeCalculated = maxFeeDecimal.add(additionalPerCharFee).mul(totalMaxFeeMultiplier);
    const maxFeeCalculatedDna = maxFeeCalculated.mul(new Decimal(dnaBase));

    return { maxFeeDecimal: maxFeeCalculated.toString(), maxFeeDna: maxFeeCalculatedDna.toString() };
}

export function dna2numStr(dna: string | number) {
    return (new Decimal(dna).div(new Decimal(dnaBase))).toString();
}

export function numStr2dnaStr(num: string) {
    return (new Decimal(num).mul(new Decimal(dnaBase))).toString();
}

export function hex2str(hex: string) {
    return new TextDecoder().decode(hexToUint8Array(hex));
}

export function sanitizeStr(str: string) {
    return new DOMParser().parseFromString(str, 'text/html').body.textContent || '';
}

export function rmZeros(str: string) {
    return str.replaceAll(/[.0]+$/g, '');
}

export function numToUint8Array(num: number, uint8ArrayLength: number) {
  let arr = new Uint8Array(uint8ArrayLength);

  for (let i = 0; i < 8; i++) {
    arr[i] = num % 256;
    num = Math.floor(num / 256);
  }

  return arr;
}

export function hexToDecimal(hex: string) {
    if (!hex) return hex;

    const uint8ArrayLength = hexToUint8Array(hex).length;
    let rmZerosHex = rmZeros(hex);
    let decimalVal;
    let index = 0;
    let testHex;

    do {
        if (index > uint8ArrayLength) return 'unrecognized';
        if (index !== 0) rmZerosHex += '0';

        decimalVal = Number(rmZerosHex);
        testHex = toHexString(numToUint8Array(decimalVal, uint8ArrayLength));

        index++;
    } while (testHex !== hex);

    return decimalVal.toString();
}

export function decimalToHex(dec: string, uint8ArrayLength: number) {
    return toHexString(numToUint8Array(Number(dec), uint8ArrayLength));
}

export function isObjectEmpty(obj: object) {
    // @ts-ignore
    for (const i in obj) return false;
    return true;
}

export function getDisplayTipAmount(amount: number) {
    const numStr = dna2numStr(amount);
    return (Number(Number(numStr).toFixed(2)) || '0.00').toString();
}

export function getShortDisplayTipAmount(amount: number) {
    const num = Number(dna2numStr(amount));

    let display;

    if (num < 1) {
        display = '<1';
    }
    if (num >= 1) {
        display = num.toFixed(0);
    }
    if (num >= 1000) {
        display = '1K+';
    }
    if (num >= 10000) {
        display = '10K+';
    }
    if (num >= 100000) {
        display = '100K+';
    }
    if (num >= 1000000) {
        display = '1M+';
    }

    return display;

}
