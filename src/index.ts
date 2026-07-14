import {
  ENCODED_DATA,
  MAX_CODE_POINT,
  MIN_CODE_POINT,
  RECORD_COUNT,
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

const LANGUAGE_CODES = [
  ["zh", "ja", "ko"],
  ["zho", "jpn", "kor"],
] as const;

const REGION_CODES = [
  ["zh-CN", "zh-HK", "zh-MO", "zh-TW", "ja-JP", "ko-KR", "ko-KP"],
  ["zho-CN", "zho-HK", "zho-MO", "zho-TW", "jpn-JP", "kor-KR", "kor-KP"],
] as const;

let records: Uint32Array | undefined;

// Data is decoded only after the first potentially relevant Han character is seen.
function getRecords(): Uint32Array {
  if (records) return records;

  const bytes = atob(ENCODED_DATA);
  const decoded = new Uint32Array(RECORD_COUNT);
  let byteIndex = 0;
  let codePoint = 0;

  for (let recordIndex = 0; recordIndex < decoded.length; recordIndex += 1) {
    let value = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = bytes.charCodeAt(byteIndex);
      byteIndex += 1;
      value += (byte & 0x7f) * 2 ** shift;
      shift += 7;
    } while (byte & 0x80);

    codePoint += Math.floor(value / 128);
    decoded[recordIndex] = codePoint * 128 + (value & REGION_MASK);
  }

  records = decoded;
  return decoded;
}

function findRegionMask(codePoint: number): number {
  const data = getRecords();
  let low = 0;
  let high = data.length - 1;

  while (low <= high) {
    const middle = (low + high) >>> 1;
    const record = data[middle]!;
    const candidate = Math.floor(record / 128);

    if (candidate < codePoint) low = middle + 1;
    else if (candidate > codePoint) high = middle - 1;
    else return record & REGION_MASK;
  }

  return 0;
}

function isPotentialHan(codePoint: number): boolean {
  if (codePoint < MIN_CODE_POINT || codePoint > MAX_CODE_POINT) return false;

  return (
    (codePoint >= 0x3400 && codePoint <= 0x9fff) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    codePoint >= 0x20000
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
