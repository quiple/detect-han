import { describe, expect, expectTypeOf, it } from "vitest";
import {
  detectHanUsage,
  UNIHAN_DATE,
  UNIHAN_VERSION,
  type DetectHanOptions,
  type Iso6391Language,
  type Iso6391Region,
  type Iso6393Language,
  type Iso6393Region,
} from "../src/index.js";

describe("detectHanUsage", () => {
  it("ignores Han characters shared by two or more languages", () => {
    expect(detectHanUsage("漢")).toEqual([]);
    expect(detectHanUsage("期間曾經存在過的一個官職")).toEqual([]);
    expect(detectHanUsage("期間456曾經ㅋㅋㅋ 一個 AND 官職")).toEqual([]);
  });

  it("returns unique language codes in first-match order", () => {
    expect(detectHanUsage("亐漢亜亐")).toEqual(["ko", "ja"]);
    expect(detectHanUsage("㑇亜亐")).toEqual(["zh", "ja", "ko"]);
  });

  it("treats multiple regions in one language as language-exclusive", () => {
    expect(detectHanUsage("㑊乫")).toEqual(["zh", "ko"]);
    expect(detectHanUsage("㑊乫", { includeRegion: true })).toEqual([]);
  });

  it("returns only region-exclusive matches when regions are requested", () => {
    expect(detectHanUsage("㑇㐵䲳亜亐堗", { includeRegion: true })).toEqual([
      "zh-CN",
      "zh-HK",
      "zh-TW",
      "ja-JP",
      "ko-KR",
      "ko-KP",
    ]);
  });

  it("supports ISO 639-3 codes with and without regions", () => {
    expect(detectHanUsage("㑇亜亐", { standard: "iso639-3" })).toEqual([
      "zho",
      "jpn",
      "kor",
    ]);
    expect(
      detectHanUsage("㑇亜亐", { standard: "iso639-3", includeRegion: true }),
    ).toEqual(["zho-CN", "jpn-JP", "kor-KR"]);
  });

  it("handles supplementary-plane Han characters without splitting surrogates", () => {
    const extensionECharacter = String.fromCodePoint(0x2cdd5);
    expect(detectHanUsage(`abc${extensionECharacter}한글`)).toEqual(["zh"]);
    expect(detectHanUsage(extensionECharacter, { includeRegion: true })).toEqual(["zh-CN"]);
  });

  it("does not initialize a false match from non-Han text", () => {
    expect(detectHanUsage("")).toEqual([]);
    expect(detectHanUsage("abc 123 안녕하세요 カタカナ")).toEqual([]);
  });

  it("rejects non-string input at runtime", () => {
    expect(() => detectHanUsage(null as unknown as string)).toThrow(TypeError);
  });

  it("exposes precise result types", () => {
    const anyOptions: DetectHanOptions = {
      standard: "iso639-3",
      includeRegion: true,
    };
    expect(anyOptions).toBeDefined();
    expectTypeOf(detectHanUsage("亐")).toEqualTypeOf<Iso6391Language[]>();
    expectTypeOf(detectHanUsage("亐", { standard: "iso639-3" })).toEqualTypeOf<
      Iso6393Language[]
    >();
    expectTypeOf(detectHanUsage("亐", { includeRegion: true })).toEqualTypeOf<
      Iso6391Region[]
    >();
    expectTypeOf(
      detectHanUsage("亐", { standard: "iso639-3", includeRegion: true }),
    ).toEqualTypeOf<Iso6393Region[]>();
  });
});

describe("Unihan metadata", () => {
  it("identifies the generated Unicode source", () => {
    expect(UNIHAN_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(UNIHAN_DATE).toContain("GMT");
  });
});
