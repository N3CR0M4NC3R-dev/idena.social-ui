import Decimal from "decimal.js";
import { hexToUint8Array, stripHexPrefix } from "idena-sdk-js-lite";

const dnaBase = 1e18;

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

function hexToBytes(str: string) {
    const hex = stripHexPrefix(str);
    if (hex.length % 2 !== 0) throw new Error('hex characters not even length');

    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }

    return bytes;
};

export function hexToDecimal(hex: string) {
    if (!hex) return hex;

    const bytes = hexToBytes(hex);
    const decimalVal = bytesToDecimalNum(bytes);

    return decimalVal.toString();
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
