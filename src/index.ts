import {
  GAP_BYTE_LENGTH,
  MAX_CODE_POINT,
  MASKS_BY_FREQUENCY,
  MIN_CODE_POINT,
  RECORD_COUNT,
  takeEncodedData,
} from "./generated/unihan-core.js";

export { UNIHAN_DATE, UNIHAN_VERSION } from "./generated/unihan-core.js";

export type CodeStandard = "iso639-1" | "iso639-3";
export type Iso6391Language = "zh" | "ja" | "ko";
export type Iso6393Language = "zho" | "jpn" | "kor";
export type Iso6391Region =
  | "zh-CN"
  | "zh-HK"
  | "zh-MO"
  | "zh-TW"
  | "ja-JP"
  | "ko-KR"
  | "ko-KP";
export type Iso6393Region =
  | "zho-CN"
  | "zho-HK"
  | "zho-MO"
  | "zho-TW"
  | "jpn-JP"
  | "kor-KR"
  | "kor-KP";

export interface DetectHanOptions<
  Standard extends CodeStandard = CodeStandard,
  IncludeRegion extends boolean = boolean,
> {
  standard?: Standard;
  includeRegion?: IncludeRegion;
}

export type DetectHanResult<
  Standard extends CodeStandard = "iso639-1",
  IncludeRegion extends boolean = false,
> = IncludeRegion extends true
  ? Standard extends "iso639-3"
    ? Iso6393Region[]
    : Iso6391Region[]
  : Standard extends "iso639-3"
    ? Iso6393Language[]
    : Iso6391Language[];

const REGION_MASK = 0x7f;
const JAPAN_MASK = 1 << 4;
const CJK_START = 0x3400;
const CJK_END = 0x9fff;
const COMPATIBILITY_START = 0xf900;
const COMPATIBILITY_END = 0xfaff;
const ASTRAL_START = 0x20000;

const LANGUAGE_CODES = [
  ["zh", "ja", "ko"],
  ["zho", "jpn", "kor"],
] as const;

const REGION_CODES = [
  ["zh-CN", "zh-HK", "zh-MO", "zh-TW", "ja-JP", "ko-KR", "ko-KP"],
  ["zho-CN", "zho-HK", "zho-MO", "zho-TW", "jpn-JP", "kor-KR", "kor-KP"],
] as const;

type LookupTables = readonly [Uint8Array, Uint8Array, Uint8Array];

let lookupTables: LookupTables | undefined;

function createBitReader(bytes: string, byteOffset = 0): () => number {
  let bitIndex = byteOffset * 8;

  return () => {
    const bit = (bytes.charCodeAt(bitIndex >>> 3) >>> (7 - (bitIndex & 7))) & 1;
    bitIndex += 1;
    return bit;
  };
}

// Each byte stores two four-bit class IDs for constant-time lookup.
function getLookupTables(): LookupTables {
  if (lookupTables) return lookupTables;

  const bytes = atob(takeEncodedData());
  const cjk = new Uint8Array((CJK_END - CJK_START + 1) >>> 1);
  const compatibility = new Uint8Array(
    (COMPATIBILITY_END - COMPATIBILITY_START + 1) >>> 1,
  );
  const astral = new Uint8Array(Math.ceil((MAX_CODE_POINT - ASTRAL_START + 1) / 2));
  let codePoint = 0;
  const readGapBit = createBitReader(bytes);
  const readMaskBit = createBitReader(bytes, GAP_BYTE_LENGTH);

  for (let recordIndex = 0; recordIndex < RECORD_COUNT; recordIndex += 1) {
    let gap = 1;
    if (readGapBit() === 1) {
      let leadingZeros = 0;
      while (readGapBit() === 0) leadingZeros += 1;

      let value = 1;
      for (let index = 0; index < leadingZeros; index += 1) {
        value = value * 2 + readGapBit();
      }
      gap = value + 1;
    }

    codePoint += gap;
    let maskRank = 0;
    while (readMaskBit() === 1) maskRank += 1;

    let table: Uint8Array;
    let offset: number;
    if (codePoint <= CJK_END) {
      table = cjk;
      offset = codePoint - CJK_START;
    } else if (codePoint <= COMPATIBILITY_END) {
      table = compatibility;
      offset = codePoint - COMPATIBILITY_START;
    } else {
      table = astral;
      offset = codePoint - ASTRAL_START;
    }
    table[offset >>> 1]! |= (maskRank + 1) << ((offset & 1) * 4);
  }

  lookupTables = [cjk, compatibility, astral];
  return lookupTables;
}

function findRegionMask(codePoint: number): number {
  const tables = getLookupTables();
  let table: Uint8Array;
  let offset: number;

  if (codePoint <= CJK_END) {
    table = tables[0];
    offset = codePoint - CJK_START;
  } else if (codePoint <= COMPATIBILITY_END) {
    table = tables[1];
    offset = codePoint - COMPATIBILITY_START;
  } else {
    table = tables[2];
    offset = codePoint - ASTRAL_START;
  }

  const maskRank = ((table[offset >>> 1]! >>> ((offset & 1) * 4)) & 0xf) - 1;
  return maskRank < 0 ? 0 : MASKS_BY_FREQUENCY[maskRank]!;
}

function isPotentialHan(codePoint: number): boolean {
  if (codePoint < MIN_CODE_POINT || codePoint > MAX_CODE_POINT) return false;

  return (
    (codePoint >= CJK_START && codePoint <= CJK_END) ||
    (codePoint >= COMPATIBILITY_START && codePoint <= COMPATIBILITY_END) ||
    codePoint >= ASTRAL_START
  );
}

/**
 * Finds Han characters that belong exclusively to one supported language or region.
 * Results are unique and keep the order of their first matching character.
 */
export function detectHanUsage<
  Standard extends CodeStandard = "iso639-1",
  IncludeRegion extends boolean = false,
>(
  text: string,
  options: DetectHanOptions<Standard, IncludeRegion> = {},
): DetectHanResult<Standard, IncludeRegion> {
  if (typeof text !== "string") {
    throw new TypeError("detectHanUsage() expects a string");
  }

  const useIso6393 = options.standard === "iso639-3" ? 1 : 0;
  const includeRegion = options.includeRegion === true;
  const result: string[] = [];
  let seen = 0;

  for (let index = 0; index < text.length; index += 1) {
    const codePoint = text.codePointAt(index)!;
    if (codePoint > 0xffff) index += 1;
    if (!isPotentialHan(codePoint)) continue;

    const regionMask = findRegionMask(codePoint);
    if (regionMask === 0) continue;

    let outputIndex: number;
    if (includeRegion) {
      // More than one region bit means that this character is not region-exclusive.
      if (regionMask & (regionMask - 1)) continue;
      outputIndex = 31 - Math.clz32(regionMask);
    } else {
      outputIndex = regionMask < JAPAN_MASK ? 0 : regionMask === JAPAN_MASK ? 1 : 2;
    }

    const outputBit = 1 << outputIndex;
    if (seen & outputBit) continue;

    seen |= outputBit;
    result.push(
      includeRegion
        ? REGION_CODES[useIso6393][outputIndex]!
        : LANGUAGE_CODES[useIso6393][outputIndex]!,
    );

    if ((!includeRegion && seen === 0b111) || (includeRegion && seen === 0b1111111)) {
      break;
    }
  }

  return result as DetectHanResult<Standard, IncludeRegion>;
}
