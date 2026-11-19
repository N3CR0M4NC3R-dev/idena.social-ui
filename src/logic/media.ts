// What a media file is, read from its first bytes. Also the MP4 boxes holding where a phone video was taken, renamed so
// that no player reads them before the file is posted.

export type MediaFormat = 'jpeg' | 'png' | 'gif' | 'webp' | 'animated-webp' | 'bmp' | 'avif' | 'heif' | 'mp4' | 'm4a' | 'webm' | 'ogg' | 'mp3' | 'unknown';

export type MediaKind = 'image' | 'video' | 'audio';

export const ERROR_LOADING_MEDIA_FILE_NAME = 'error-loading-media.png';

const at = (bytes: Uint8Array, offset: number, ...values: number[]) =>
    bytes.length >= offset + values.length && values.every((value, index) => bytes[offset + index] === value);

const ascii = (bytes: Uint8Array, offset: number, text: string) =>
    at(bytes, offset, ...Array.from(text, (char) => char.charCodeAt(0)));

const readAscii = (bytes: Uint8Array, offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));

const containsAscii = (bytes: Uint8Array, text: string, within: number) => {
    const last = Math.min(bytes.length, within) - text.length;

    for (let offset = 0; offset <= last; offset++) {
        if (ascii(bytes, offset, text)) return true;
    }

    return false;
};

// An ISO media file (an "ftyp" box first) by its major brand: AVIF and HEIF pictures, M4A sound, else MP4.
const isoBrand = (bytes: Uint8Array): MediaFormat => {
    const brand = bytes.length >= 12 ? readAscii(bytes, 8, 4) : '';

    if (['avif', 'avis'].includes(brand)) return 'avif';
    if (['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'heif';
    if (['M4A ', 'M4B '].includes(brand)) return 'm4a';

    return 'mp4';
};

export const sniffMediaFormat = (bytes: Uint8Array): MediaFormat => {
    if (at(bytes, 0, 0xff, 0xd8, 0xff)) return 'jpeg';
    if (at(bytes, 0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
    if (ascii(bytes, 0, 'GIF8')) return 'gif';
    // WebP: an extended header (VP8X) with its animation flag is a moving picture.
    if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) {
        return ascii(bytes, 12, 'VP8X') && bytes.length > 20 && (bytes[20] & 0x02) !== 0 ? 'animated-webp' : 'webp';
    }
    if (ascii(bytes, 0, 'BM')) return 'bmp';
    if (ascii(bytes, 4, 'ftyp')) return isoBrand(bytes);
    if (at(bytes, 0, 0x1a, 0x45, 0xdf, 0xa3)) return containsAscii(bytes, 'webm', 64) ? 'webm' : 'unknown';
    if (ascii(bytes, 0, 'OggS')) return 'ogg';
    if (ascii(bytes, 0, 'ID3')) return 'mp3';
    // An MPEG audio frame: 11 sync bits, then a layer that is not 0 (layer 0 is AAC's ADTS).
    if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && ((bytes[1] >> 1) & 0x03) !== 0) return 'mp3';

    return 'unknown';
};

// The type a video or sound file is posted and played as, by its format; null for a format that is neither. An MP4
// or WebM file may hold sound only, so it is a sound when [isAudio] (posted as one, or its post declares audio/*),
// else a video. MP3, M4A and Ogg files are always sounds.
const AV_MEDIA_TYPES: Partial<Record<MediaFormat, { audio: string, video: string }>> = {
    mp3: { audio: 'audio/mpeg', video: 'audio/mpeg' },
    m4a: { audio: 'audio/mp4', video: 'audio/mp4' },
    ogg: { audio: 'audio/ogg', video: 'audio/ogg' },
    mp4: { audio: 'audio/mp4', video: 'video/mp4' },
    webm: { audio: 'audio/webm', video: 'video/webm' },
};

export const getAvMediaType = (format: MediaFormat, isAudio: boolean) => AV_MEDIA_TYPES[format]?.[isAudio ? 'audio' : 'video'] ?? null;

export const getMediaKind = (type: string): MediaKind => {
    const lowerCaseType = type.toLowerCase();

    if (lowerCaseType.startsWith('video/')) return 'video';
    if (lowerCaseType.startsWith('audio/')) return 'audio';

    return 'image';
};

export const getMediaNoun = (type: string) => ({ image: 'image', video: 'video', audio: 'sound' })[getMediaKind(type)];

// What a file's details (the place a photo or video was taken, the camera, the date) are removed from before it is
// posted: an MP4 or M4A file's detail boxes, a picture's EXIF, XMP, IPTC and comments. Nothing else changes: the
// picture or the sound is not encoded again. A photo's EXIF Orientation is kept, so that it is not shown on its side.

const FREE = [0x66, 0x72, 0x65, 0x65]; // "free"

const readUint32 = (bytes: Uint8Array, offset: number) =>
    bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];

const readUint16 = (bytes: Uint8Array, offset: number) => (bytes[offset] << 8) | bytes[offset + 1];

const readUint32LittleEndian = (bytes: Uint8Array, offset: number) =>
    bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16) + bytes[offset + 3] * 0x1000000;

const concat = (parts: Uint8Array[]) => {
    const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;

    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }

    return result;
};

const asciiBytes = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0));

// ISO media boxes (MP4, M4A, AVIF): an ISO box is its size, its type, then its content.
type IsoBox = { type: string, offset: number, start: number, end: number };

// The boxes between [from] and [to]; null when a box does not fit.
const readBoxes = (bytes: Uint8Array, from: number, to: number): IsoBox[] | null => {
    const boxes: IsoBox[] = [];
    let offset = from;

    while (offset + 8 <= to) {
        let size = readUint32(bytes, offset);
        let header = 8;

        if (size === 0) {
            size = to - offset;
        } else if (size === 1) {
            if (offset + 16 > to) return null;
            size = readUint32(bytes, offset + 8) * 0x100000000 + readUint32(bytes, offset + 12);
            header = 16;
        }

        if (size < header || offset + size > to) return null;

        boxes.push({ type: readAscii(bytes, offset + 4, 4), offset, start: offset + header, end: offset + size });
        offset += size;
    }

    return boxes;
};

// The boxes of an MP4 that hold its details (place, camera, title; "uuid": XMP, where some cameras write the place),
// renamed "free", which every reader skips, and the boxes holding other boxes where details may sit.
const DETAIL_BOXES = ['udta', 'meta', 'uuid'];
const PARENT_BOXES = ['moov', 'trak'];

// Renames the detail boxes between [from] and [to] (and in their parent boxes); false when a box does not fit.
const renameDetailBoxes = (bytes: Uint8Array, from: number, to: number): boolean => {
    const boxes = readBoxes(bytes, from, to);

    return !!boxes && boxes.every((box) => {
        if (DETAIL_BOXES.includes(box.type)) {
            bytes.set(FREE, box.offset + 4);
            return true;
        }

        return !PARENT_BOXES.includes(box.type) || renameDetailBoxes(bytes, box.start, box.end);
    });
};

// [bytes] (an MP4 or M4A file) with its detail boxes renamed "free" at the top, in "moov" and in its tracks: where a
// phone writes the place a video was taken. Nothing moves, so every offset in the file stays right. A file that is not
// an MP4 comes back unchanged; null for an MP4 whose boxes do not add up (its details cannot be found, so it is not sent).
export const withoutMp4Details = <T extends Uint8Array>(bytes: T): T | null => {
    const format = sniffMediaFormat(bytes);

    if (format !== 'mp4' && format !== 'm4a') return bytes;

    const cleaned = bytes.slice() as T;

    return renameDetailBoxes(cleaned, 0, cleaned.length) ? cleaned : null;
};

// The EXIF Orientation (1-8) in TIFF data (EXIF's own format) between [start] and [end]; undefined when it has none.
export const readTiffOrientation = (bytes: Uint8Array, start: number, end: number): number | undefined => {
    if (end - start < 8) return;

    const littleEndian = ascii(bytes, start, 'II');

    if (!littleEndian && !ascii(bytes, start, 'MM')) return;

    const uint16 = (offset: number) => littleEndian ? bytes[offset] | (bytes[offset + 1] << 8) : readUint16(bytes, offset);
    const uint32 = (offset: number) => littleEndian ? readUint32LittleEndian(bytes, offset) : readUint32(bytes, offset);

    const ifd = start + uint32(start + 4);

    if (ifd + 2 > end) return;

    for (let index = 0; index < uint16(ifd); index++) {
        const entry = ifd + 2 + index * 12;

        if (entry + 12 > end) return;

        // Orientation (0x0112), a SHORT
        if (uint16(entry) === 0x0112 && uint16(entry + 2) === 3) {
            const orientation = uint16(entry + 8);
            return orientation >= 1 && orientation <= 8 ? orientation : undefined;
        }
    }
};

// TIFF data holding the Orientation only: the EXIF a photo keeps when it is turned.
const orientationTiff = (orientation: number) => new Uint8Array([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian, the first IFD at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // Orientation, one SHORT
    0x00, 0x00, 0x00, 0x00, // no next IFD
]);

const EXIF_HEADER = 'Exif\0\0';

// JPEG: the segments before and between its scans. Kept: APP0 (JFIF), APP2 holding a colour profile, APP14 (Adobe)
// and every segment of the picture itself. Removed: APP1 (EXIF, XMP), other APP2 (MPF, which points at pictures
// appended to the file), APP3 to APP13 (IPTC, camera makers' data), APP15 and comments. What follows the end of the
// picture goes too: a phone may append a video (motion photos) or more pictures, with details of their own.
const withoutJpegDetails = (bytes: Uint8Array): Uint8Array<ArrayBuffer> | null => {
    const kept: Uint8Array[] = [bytes.subarray(0, 2)];
    let orientation: number | undefined;
    let exifIndex = -1;
    let offset = 2;

    while (true) {
        if (offset + 1 >= bytes.length || bytes[offset] !== 0xff) return null;

        // Fill bytes may come before a marker.
        while (offset + 2 < bytes.length && bytes[offset + 1] === 0xff) offset++;

        const marker = bytes[offset + 1];

        if (marker === 0xd9) {
            kept.push(bytes.subarray(offset, offset + 2));
            break;
        }

        // Markers without a segment: TEM and restart markers.
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
            kept.push(bytes.subarray(offset, offset + 2));
            offset += 2;
            continue;
        }

        if (offset + 4 > bytes.length) return null;

        const end = offset + 2 + readUint16(bytes, offset + 2);

        if (end < offset + 4 || end > bytes.length) return null;

        const data = offset + 4;
        const isDetail = marker === 0xe1 || (marker === 0xe2 && !ascii(bytes, data, 'ICC_PROFILE\0')) ||
            (marker >= 0xe3 && marker <= 0xed) || marker === 0xef || marker === 0xfe;

        if (!isDetail) {
            kept.push(bytes.subarray(offset, end));
        } else if (marker === 0xe1 && exifIndex < 0 && ascii(bytes, data, EXIF_HEADER)) {
            orientation = readTiffOrientation(bytes, data + EXIF_HEADER.length, end);
            exifIndex = kept.length;
        }

        offset = end;

        // A scan's entropy-coded data, up to the next marker: in it, 0xff is followed by 0 or a restart marker.
        if (marker === 0xda) {
            const scanStart = offset;

            while (offset + 1 < bytes.length && !(bytes[offset] === 0xff && bytes[offset + 1] !== 0 && !(bytes[offset + 1] >= 0xd0 && bytes[offset + 1] <= 0xd7))) {
                offset++;
            }

            // A file cut short in its last scan still shows what it has.
            if (offset + 1 >= bytes.length) {
                kept.push(bytes.subarray(scanStart));
                break;
            }

            kept.push(bytes.subarray(scanStart, offset));
        }
    }

    if (orientation && orientation !== 1) {
        const exif = concat([asciiBytes(EXIF_HEADER), orientationTiff(orientation)]);
        const length = exif.length + 2;
        kept.splice(exifIndex, 0, concat([new Uint8Array([0xff, 0xe1, length >> 8, length & 0xff]), exif]));
    }

    return concat(kept);
};

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
    let crc = index;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    return crc >>> 0;
});

const crc32 = (data: Uint8Array) => {
    let crc = 0xffffffff;
    for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
};

// PNG (and APNG): its chunks holding details are removed: EXIF, text (XMP, comments, author...) and the time it was
// made. Anything after its end goes too.
const PNG_DETAIL_CHUNKS = ['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'];

const withoutPngDetails = (bytes: Uint8Array): Uint8Array<ArrayBuffer> | null => {
    const kept: Uint8Array[] = [bytes.subarray(0, 8)];
    let orientation: number | undefined;
    let exifIndex = -1;
    let offset = 8;

    while (true) {
        if (offset + 12 > bytes.length) return null;

        const length = readUint32(bytes, offset);
        const end = offset + 12 + length;

        if (end > bytes.length) return null;

        const type = readAscii(bytes, offset + 4, 4);

        if (!PNG_DETAIL_CHUNKS.includes(type)) {
            kept.push(bytes.subarray(offset, end));
        } else if (type === 'eXIf' && exifIndex < 0) {
            orientation = readTiffOrientation(bytes, offset + 8, offset + 8 + length);
            exifIndex = kept.length;
        }

        offset = end;

        if (type === 'IEND') break;
    }

    if (orientation && orientation !== 1) {
        const typeAndData = concat([asciiBytes('eXIf'), orientationTiff(orientation)]);
        const length = typeAndData.length - 4;
        const crc = crc32(typeAndData);
        kept.splice(exifIndex, 0, concat([
            new Uint8Array([length >>> 24, (length >>> 16) & 0xff, (length >>> 8) & 0xff, length & 0xff]),
            typeAndData,
            new Uint8Array([crc >>> 24, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff]),
        ]));
    }

    return concat(kept);
};

// WebP: its EXIF and XMP chunks are removed, and the extended header's flags for them cleared.
const WEBP_EXIF_FLAG = 0x08;
const WEBP_XMP_FLAG = 0x04;

const withoutWebpDetails = (bytes: Uint8Array): Uint8Array<ArrayBuffer> | null => {
    const kept: Uint8Array[] = [];
    let orientation: number | undefined;
    let exifIndex = -1;
    const riffEnd = Math.min(8 + readUint32LittleEndian(bytes, 4), bytes.length);
    let offset = 12;

    while (offset + 8 <= riffEnd) {
        const size = readUint32LittleEndian(bytes, offset + 4);
        // A chunk is padded to an even size.
        const end = Math.min(offset + 8 + size + (size & 1), riffEnd);

        if (offset + 8 + size > riffEnd) return null;

        const type = readAscii(bytes, offset, 4);

        if (type !== 'EXIF' && type !== 'XMP ') {
            // A copy: the extended header's flags change.
            kept.push(bytes.slice(offset, end));
        } else if (type === 'EXIF' && exifIndex < 0) {
            // Some writers start the EXIF chunk with JPEG's EXIF header.
            const tiffStart = offset + 8 + (ascii(bytes, offset + 8, EXIF_HEADER) ? EXIF_HEADER.length : 0);
            orientation = readTiffOrientation(bytes, tiffStart, offset + 8 + size);
            exifIndex = kept.length;
        }

        offset = end;
    }

    const keepsOrientation = !!orientation && orientation !== 1;

    if (keepsOrientation) {
        const tiff = orientationTiff(orientation!);
        kept.splice(exifIndex, 0, concat([asciiBytes('EXIF'), new Uint8Array([tiff.length, 0, 0, 0]), tiff]));
    }

    const extendedHeader = kept.find((chunk) => ascii(chunk, 0, 'VP8X'));

    if (extendedHeader) {
        extendedHeader[8] = (extendedHeader[8] & ~(WEBP_EXIF_FLAG | WEBP_XMP_FLAG)) | (keepsOrientation ? WEBP_EXIF_FLAG : 0);
    }

    const body = concat(kept);
    const riffSize = body.length + 4;

    return concat([asciiBytes('RIFF'), new Uint8Array([riffSize & 0xff, (riffSize >>> 8) & 0xff, (riffSize >>> 16) & 0xff, riffSize >>> 24]), asciiBytes('WEBP'), body]);
};

// AVIF: the content of its Exif items and XMP items (mime, application/rdf+xml) is overwritten with zeros, found
// through its item information (iinf) and locations (iloc). Nothing moves, so every offset stays right; its
// orientation is in boxes of its own (irot, imir), not in EXIF. Null when its boxes or item locations do not add up.
const withoutAvifDetails = <T extends Uint8Array>(bytes: T): T | null => {
    const cleaned = bytes.slice() as T;
    const topBoxes = readBoxes(cleaned, 0, cleaned.length);

    if (!topBoxes) return null;

    const meta = topBoxes.find((box) => box.type === 'meta');

    if (!meta) return cleaned;

    // meta, iinf, infe and iloc are full boxes: a version byte and three bytes of flags come first.
    const metaBoxes = readBoxes(cleaned, meta.start + 4, meta.end);

    if (!metaBoxes) return null;

    const iinf = metaBoxes.find((box) => box.type === 'iinf');
    const iloc = metaBoxes.find((box) => box.type === 'iloc');
    const idat = metaBoxes.find((box) => box.type === 'idat');

    if (!iinf) return cleaned;

    const readNullTerminated = (offset: number, end: number) => {
        let stop = offset;
        while (stop < end && cleaned[stop] !== 0) stop++;
        return { text: readAscii(cleaned, offset, stop - offset), next: stop + 1 };
    };

    const detailItems = new Set<number>();
    const infes = readBoxes(cleaned, iinf.start + 4 + (cleaned[iinf.start] === 0 ? 2 : 4), iinf.end);

    if (!infes) return null;

    for (const infe of infes) {
        const version = cleaned[infe.start];

        if (infe.type !== 'infe' || version < 2) continue;

        let offset = infe.start + 4;
        const itemId = version === 2 ? readUint16(cleaned, offset) : readUint32(cleaned, offset);
        offset += (version === 2 ? 2 : 4) + 2; // the item ID, then its protection index
        const itemType = readAscii(cleaned, offset, 4);

        if (itemType === 'Exif') {
            detailItems.add(itemId);
        } else if (itemType === 'mime') {
            const name = readNullTerminated(offset + 4, infe.end);
            if (readNullTerminated(name.next, infe.end).text === 'application/rdf+xml') detailItems.add(itemId);
        }
    }

    if (!detailItems.size) return cleaned;
    if (!iloc) return null;

    const version = cleaned[iloc.start];
    let offset = iloc.start + 4;
    const offsetSize = cleaned[offset] >> 4;
    const lengthSize = cleaned[offset] & 0x0f;
    const baseOffsetSize = cleaned[offset + 1] >> 4;
    const indexSize = version >= 1 ? cleaned[offset + 1] & 0x0f : 0;
    offset += 2;

    const read = (size: number) => {
        const value = size === 8 ? readUint32(cleaned, offset) * 0x100000000 + readUint32(cleaned, offset + 4) :
            size === 4 ? readUint32(cleaned, offset) : size === 2 ? readUint16(cleaned, offset) : 0;
        offset += size;
        return value;
    };

    const itemCount = read(version < 2 ? 2 : 4);

    for (let item = 0; item < itemCount; item++) {
        if (offset > iloc.end) return null;

        const itemId = read(version < 2 ? 2 : 4);
        const constructionMethod = version >= 1 ? read(2) & 0x0f : 0;
        read(2); // data reference index
        const baseOffset = read(baseOffsetSize);
        const extentCount = read(2);

        for (let extent = 0; extent < extentCount; extent++) {
            read(indexSize);
            const extentOffset = read(offsetSize);
            const extentLength = read(lengthSize);

            if (offset > iloc.end) return null;
            if (!detailItems.has(itemId)) continue;

            // Construction method 0: offsets in the file; 1: in the idat box. Another (data from other items) is
            // not where its details can be found.
            if (constructionMethod > 1 || (constructionMethod === 1 && !idat)) return null;

            const area = constructionMethod === 1 ? { start: idat!.start, end: idat!.end } : { start: 0, end: cleaned.length };
            const start = area.start + baseOffset + extentOffset;
            const end = extentLength ? start + extentLength : area.end;

            if (start > end || end > area.end) return null;

            cleaned.fill(0, start, end);
        }
    }

    return offset > iloc.end ? null : cleaned;
};

// [bytes] without the details it holds, by its format (see above); unchanged for a file with nowhere to hold them (GIF,
// SVG, MP3, Ogg, WebM). Null for a file whose structure does not add up: its details cannot be found, so it is not sent.
export const withoutMediaDetails = (bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> | null => {
    switch (sniffMediaFormat(bytes)) {
    case 'mp4':
    case 'm4a':
        return withoutMp4Details(bytes);
    case 'jpeg':
        return withoutJpegDetails(bytes);
    case 'png':
        return withoutPngDetails(bytes);
    case 'webp':
    case 'animated-webp':
        return withoutWebpDetails(bytes);
    case 'avif':
        return withoutAvifDetails(bytes);
    default:
        return bytes;
    }
};
