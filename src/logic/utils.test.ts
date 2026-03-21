import { describe, expect, it } from 'vitest';
import { encodePostMessage, parsePostMessage } from './utils';

describe('parsePostMessage', () => {
    it('parses a standard ipfs image payload', () => {
        const encoded = encodePostMessage('nice', {
            cid: 'bafkreifdo4clqq7vtm6qimcw3r5peofrreg76dnfmfare5dnfookrt2pbm',
            mimeType: 'image/jpeg',
            size: 10169,
            pinnedOn: ['http://127.0.0.1:9009'],
        });

        const parsed = parsePostMessage(encoded);
        expect(parsed.text).toBe('nice');
        expect(parsed.image?.kind).toBe('ipfs');
        if (parsed.image?.kind === 'ipfs') {
            expect(parsed.image.cid).toBe('bafkreifdo4clqq7vtm6qimcw3r5peofrreg76dnfmfare5dnfookrt2pbm');
            expect(parsed.image.mimeType).toBe('image/jpeg');
            expect(parsed.image.size).toBe(10169);
        }
    });

    it('parses payload even with one extra trailing brace', () => {
        const encoded = encodePostMessage('nice', {
            cid: 'bafkreifdo4clqq7vtm6qimcw3r5peofrreg76dnfmfare5dnfookrt2pbm',
            mimeType: 'image/jpeg',
            size: 10169,
            pinnedOn: ['http://127.0.0.1:9009'],
        });

        const malformed = `${encoded}}`;
        const parsed = parsePostMessage(malformed);

        expect(parsed.text).toBe('nice');
        expect(parsed.image?.kind).toBe('ipfs');
    });

    it('parses payload with leading null bytes or spaces', () => {
        const encoded = encodePostMessage('hello', {
            cid: 'bafkreifdo4clqq7vtm6qimcw3r5peofrreg76dnfmfare5dnfookrt2pbm',
            mimeType: 'image/png',
            size: 5000,
            pinnedOn: [],
        });

        const noisy = `\u0000 \n${encoded}\u0000`;
        const parsed = parsePostMessage(noisy);

        expect(parsed.text).toBe('hello');
        expect(parsed.image?.kind).toBe('ipfs');
    });

    it('keeps plain text untouched', () => {
        const plain = 'hello world';
        const parsed = parsePostMessage(plain);
        expect(parsed).toEqual({ text: plain });
    });
});
