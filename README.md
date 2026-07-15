# detect-han

문자열 안에서 한국어·중국어·일본어 또는 특정 지역에만 배타적으로 쓰이는 한자를 찾는 TypeScript 패키지입니다. 분류 기준은 Unicode Unihan의 [`kUnihanCore2020`](https://www.unicode.org/reports/tr38/#kUnihanCore2020)입니다.

## 설치

```sh
npm install @quiple/detect-han
```

Node.js와 브라우저 번들러에서 같은 API를 사용할 수 있습니다. 런타임 의존성은 없습니다.

## 사용법

```ts
import { detectHanUsage } from "@quiple/detect-han";

detectHanUsage("漢字");
// [] — 두 글자 모두 여러 언어에서 함께 쓰임

detectHanUsage("简体中文");
// ["zh"] — 简은 중국어에서만 쓰임

detectHanUsage("日本の桜");
// ["ja"] — 桜은 일본어에서만 쓰임

detectHanUsage("한국의 硏究");
// ["ko"] — 硏은 한국어에서만 쓰임

detectHanUsage("简体中文、日本の桜、한국의 硏究");
// ["zh", "ja", "ko"]
```

결과는 중복 없이, 입력에서 처음 발견된 순서로 반환됩니다. 한글·가나·라틴 문자·숫자 등은 무시합니다.

### ISO 639-3

기본값은 ISO 639-1입니다. `standard`를 지정하면 ISO 639-3 코드로 받을 수 있습니다.

```ts
detectHanUsage("简体中文、日本の桜、한국의 硏究", {
  standard: "iso639-3",
});
// ["zho", "jpn", "kor"]
```

### 지역 코드 포함

`includeRegion: true`이면 값이 정확히 한 지역에만 속한 한자만 반환합니다.

```ts
detectHanUsage("简体中文、日本の桜", { includeRegion: true });
// ["zh-CN", "ja-JP"]

detectHanUsage("汉", { includeRegion: true });
// [] — 汉은 G·H에 속하므로 특정 지역 전용이 아님

detectHanUsage("한국의 硏究", { includeRegion: true });
// [] — 硏은 K·P에 속하므로 특정 지역 전용이 아님

detectHanUsage("简体中文、日本の桜", {
  standard: "iso639-3",
  includeRegion: true,
});
// ["zho-CN", "jpn-JP"]
```

| Unihan 값 | 지역 | ISO 639-1 | 지역 포함 | ISO 639-3 지역 포함 |
|---|---|---|---|---|
| `G` | 중국 본토·싱가포르 | `zh` | `zh-CN` | `zho-CN` |
| `H` | 홍콩 | `zh` | `zh-HK` | `zho-HK` |
| `M` | 마카오 | `zh` | `zh-MO` | `zho-MO` |
| `T` | 대만 | `zh` | `zh-TW` | `zho-TW` |
| `J` | 일본 | `ja` | `ja-JP` | `jpn-JP` |
| `K` | 대한민국 | `ko` | `ko-KR` | `kor-KR` |
| `P` | 북한 | `ko` | `ko-KP` | `kor-KP` |

현재 Unicode 17.0.0 데이터에는 값이 `M` 하나뿐인 글자가 없습니다. 따라서 현재 버전에서는 `zh-MO`/`zho-MO`가 실제 결과에 나타나지 않지만, 타입과 갱신기는 이후 Unicode 데이터에 대비해 이를 지원합니다.

## 판정 규칙

`kUnihanCore2020` 값의 각 글자를 위 표의 언어로 바꾼 뒤 다음처럼 판정합니다.

- 값의 모든 지역이 한 언어에 속하면 언어 모드에서 반환합니다. 예를 들어 `GH`는 `zh`, `KP`는 `ko`입니다.
- 값에 두 개 이상의 언어가 섞이면 그 한자는 반환하지 않습니다. 예를 들어 `GHJKMPT`인 `漢`은 제외됩니다.
- 지역 모드에서는 값이 정확히 한 글자인 경우에만 반환합니다. `G`는 `zh-CN`, `GH`는 제외입니다.
- 입력의 다른 글자나 문맥으로 문장 언어를 추측하지 않습니다.
- `kUnihanCore2020` 값이 없는 한자는 반환하지 않습니다.

## API

```ts
function detectHanUsage<
  Standard extends "iso639-1" | "iso639-3" = "iso639-1",
  IncludeRegion extends boolean = false,
>(
  text: string,
  options?: {
    standard?: Standard;
    includeRegion?: IncludeRegion;
  },
): DetectHanResult<Standard, IncludeRegion>;
```

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `standard` | `"iso639-1"` | `"iso639-1"` 또는 `"iso639-3"` |
| `includeRegion` | `false` | `true`이면 지역까지 배타적인 한자만 반환 |

`UNIHAN_VERSION`과 `UNIHAN_DATE`도 내보내므로 번들에 포함된 데이터 버전을 확인할 수 있습니다.

## 데이터 업데이트

저장소에서 다음 명령 하나를 실행합니다.

```sh
npm run update:unihan
```

이 명령은 다음 작업을 순서대로 수행합니다.

1. Unicode 공식 최신 [`Unihan.zip`](https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip)을 다운로드합니다.
2. 모든 `Unihan*.txt`에서 `kUnihanCore2020`을 찾아 형식과 중복을 검증합니다. Unicode가 속성의 파일 위치를 바꾸더라도 동작합니다.
3. 한 언어에만 속하는 레코드의 코드 포인트 간격과 지역 클래스를 비트 단위로 압축해 `src/generated/unihan-core.ts`를 다시 만듭니다.
4. 타입 검사, 테스트, ESM/CJS 빌드를 모두 실행합니다.

이미 받은 ZIP을 사용해 데이터 생성만 다시 하려면 다음 명령을 사용할 수 있습니다.

```sh
node scripts/update-unihan.mjs --file ./Unihan.zip
```

## 성능 설계

- 전체 Unihan 원본 대신 실제 판정에 필요한 한 언어 전용 레코드만 포함합니다.
- 연속 코드 포인트는 1비트, 나머지 간격은 Exp-Golomb 코드로 저장합니다.
- 지역 마스크는 출현 빈도순 단항 코드로 저장해 흔한 값일수록 적은 비트를 사용합니다.
- 여러 중국어 지역 조합과 K·P 조합은 판정에 필요한 배타성만 남기고 하나의 클래스로 정규화합니다.
- 간격과 지역 마스크를 별도 비트스트림으로 두어 gzip/Brotli 압축 효율도 높입니다.
- ASCII나 한자가 없는 입력에서는 데이터 테이블을 만들지 않습니다.
- 첫 한자 조회 시에만 코드 포인트당 4비트인 직접 조회표로 복원하고 이후에는 O(1)로 조회합니다.
- 복원 직후 압축 문자열 참조를 해제해 브라우저가 해당 힙 메모리를 회수할 수 있게 합니다.
- 문자열을 별도 배열로 펼치지 않고 UTF-16을 한 번 순회하므로 보조 평면 한자도 추가 할당 없이 처리합니다.

현재 포함된 데이터는 Unicode 17.0.0 기준 14,313개 레코드입니다. 압축 데이터는 8,039바이트이고, 복원된 직접 조회표는 46,059바이트입니다.
현재 ESM 빌드는 약 12.0KiB(최대 gzip 압축 시 약 8.1KiB), npm 패키지는 약 14.7KiB입니다. 데이터 갱신에 따라 크기는 조금 달라질 수 있습니다.

## 개발

```sh
npm test
npm run typecheck
npm run build
npm run benchmark
```

## npm 배포

`@quiple/detect-han`은 공개 scoped 패키지로 설정되어 있습니다. npm 계정 인증 후 다음 명령으로 배포할 수 있습니다.

```sh
npm publish
```

배포 직전에 타입 검사, 테스트, ESM/CJS 빌드가 자동으로 실행되며 하나라도 실패하면 배포가 중단됩니다.

패키지 코드는 MIT 라이선스이며, 생성된 Unihan 파생 데이터에는 [Unicode License v3](https://www.unicode.org/license.txt)가 적용됩니다. 자세한 고지는 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)에 있습니다.
