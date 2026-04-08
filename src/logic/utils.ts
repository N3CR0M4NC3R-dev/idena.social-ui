import Decimal from "decimal.js";
import { hexToUint8Array, toHexString } from "idena-sdk-js-lite";

export const dnaBase = 1e18;

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

export function getMessageLines(message?: string, calculateViewMoreIndex = false, maxLines = 10) {
    const limit = 30;

    if (!message) {
        return { messageLines: [''] };
    }

    let messageLines = message.split(/\r\n/g, limit);
    if (messageLines.length === 1) {
        messageLines = message.split(/\n/g), limit;
    }

    if (!calculateViewMoreIndex) {
        return { messageLines };
    }

    const charsPerLine = 65;
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
            
            if (overflowChars !== 0 && messageLineItem.charAt(lastLineLength - 1) !== ' ' && messageLineItem.charAt(lastLineLength) !== ' ') {
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
    const maxFeeResultMultiplier = 2;
    const totalMaxFeeMultiplier = 10;

    const maxFeeDecimal = new Decimal(maxFeeResult).mul(maxFeeResultMultiplier).div(new Decimal(dnaBase));
    const additionalPerCharFee = maxFeeDecimal.div(perCharMaxFeeDivisor).mul(inputPostLength);
    const maxFeeCalculated = maxFeeDecimal.add(additionalPerCharFee).mul(totalMaxFeeMultiplier);
    const maxFeeCalculatedDna = maxFeeCalculated.mul(new Decimal(dnaBase));

    return { maxFeeDecimal: maxFeeCalculated.toString(), maxFeeDna: maxFeeCalculatedDna.toString() };
}

export const calculateNonce = (savedNonce: number, nonce: number) => {
    return nonce === 0 ? 1 : nonce >= savedNonce ? nonce + 1 : savedNonce + 1;
};

export function dna2num(dna: string | number) {
    return Number((new Decimal(dna).div(new Decimal(dnaBase))).toString());
}

export function numStr2dnaStr(num: string) {
    return (new Decimal(num).mul(new Decimal(dnaBase))).toString();
}

export function hex2str(hex: string) {
    return new TextDecoder().decode(hexToUint8Array(hex));
}

export function str2bytes(str: string) {
    return new TextEncoder().encode(str);
}

export function sanitizeStr(str: string) {
    return new DOMParser().parseFromString(str, 'text/html').body.textContent || '';
}

export function numToUint8Array(num: number, uint8ArrayLength: number) {
    let arr = new Uint8Array(uint8ArrayLength);

    for (let i = 0; i < 8; i++) {
        arr[i] = num % 256;
        num = Math.floor(num / 256);
    }

    return arr;
}

function bytesToDecimalNum(bytes: Uint8Array) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const num = view.getUint32(0, true);

    return num;
}

export function hexToDecimal(hex: string) {
    if (!hex) return hex;

    const bytes = hexToUint8Array(hex);
    const decimalVal = bytesToDecimalNum(bytes);

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
    const num = dna2num(amount);
    return (Number(num.toFixed(2)) || '0.00').toString();
}

export function getShortDisplayTipAmount(amount: number) {
    const num = dna2num(amount);

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

export function getIdentityStatus(state: string) {
    return state === 'Undefined' ? 'Not validated' : state;
}

export function getBase64FromDataUrl(dataUrl: string) {
    const dataUrlSplit = dataUrl.split(',');
    const base64Media = dataUrlSplit[1];
    const base64MediaType = dataUrlSplit[0].split(';')[0].split(':')[1];

    return { base64Media, base64MediaType };
}
