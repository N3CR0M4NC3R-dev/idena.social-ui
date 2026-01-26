import Decimal from "decimal.js";
import { hexToUint8Array, toHexString } from "idena-sdk-js-lite";

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

export function getMessageLines(message: string) {
    const limit = 20;

    let messageLines = message.split(/\r\n/g, limit);
    if (messageLines.length === 1) {
        messageLines = message.split(/\n/g), limit;
    }
    return messageLines;
}

export function calculateMaxFee(maxFeeResult: string, inputPostLength: number) {
    const perCharMaxFeeDivisor = 200;
    const totalMaxFeeMultiplier = 10;
    const dnaBase = 1e18;

    const maxFeeDecimal = new Decimal(maxFeeResult).div(new Decimal(dnaBase));
    const additionalPerCharFee = maxFeeDecimal.div(perCharMaxFeeDivisor).mul(inputPostLength);
    const maxFeeCalculated = maxFeeDecimal.add(additionalPerCharFee).mul(totalMaxFeeMultiplier);
    const maxFeeCalculatedDna = maxFeeCalculated.mul(new Decimal(dnaBase));

    return { maxFeeDecimal: maxFeeCalculated.toString(), maxFeeDna: maxFeeCalculatedDna.toString() };
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
