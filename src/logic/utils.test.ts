import { describe, expect, it } from "vitest";
import {
    calculateMaxFee,
    getBase64FromDataUrl,
    getDisplayAddress,
    getDisplayAddressShort,
    getMessageLines,
} from "./utils";

describe("logic utils", () => {
    it("formats full and short display addresses", () => {
        const address = "0x1234567890abcdef1234567890abcdef12345678";

        expect(getDisplayAddress(address)).toBe("0x12345...45678");
        expect(getDisplayAddressShort(address)).toBe("0x123...678");
    });

    it("splits messages on unix and windows line endings", () => {
        expect(getMessageLines("first\nsecond").messageLines).toEqual(["first", "second"]);
        expect(getMessageLines("first\r\nsecond").messageLines).toEqual(["first", "second"]);
    });

    it("truncates long messages when view-more calculation is requested", () => {
        const message = "a".repeat(200);
        const result = getMessageLines(message, true, 2);

        expect(result.textOverflows).toBe(true);
        expect(result.truncatedMessageLines?.[0]).toHaveLength(133);
        expect(result.truncatedMessageLines?.[0].endsWith("...")).toBe(true);
    });

    it("extracts media payload and type from data URLs", () => {
        expect(getBase64FromDataUrl("data:image/png;base64,Zm9v")).toEqual({
            base64Media: "Zm9v",
            base64MediaType: "image/png",
        });
    });

    it("calculates max fee in dna units", () => {
        expect(calculateMaxFee("1000000000000000000", 20)).toEqual({
            maxFeeDecimal: "22",
            maxFeeDna: "22000000000000000000",
        });
    });
});
