import { performance } from "node:perf_hooks";
import { detectHanUsage } from "../dist/index.js";

const targetLength = 1_000_000;
const iterations = 20;
const samples = [
  ["mostly non-Han", "abc456한글カタカナ AND "],
  ["shared Han", "期間曾經存在過的一個官職"],
  ["exclusive Han", "㑇"],
];

for (const [label, seed] of samples) {
  const input = seed.repeat(Math.ceil(targetLength / seed.length)).slice(0, targetLength);
  detectHanUsage(input);

  const startedAt = performance.now();
  let resultCount = 0;
  for (let index = 0; index < iterations; index += 1) {
    resultCount += detectHanUsage(input).length;
  }
  const elapsed = performance.now() - startedAt;
  const millionsPerSecond = (input.length * iterations) / elapsed / 1_000;

  console.log(
    `${label.padEnd(16)} ${millionsPerSecond.toFixed(1).padStart(7)} million UTF-16 units/s`,
  );
  if (resultCount < 0) process.exitCode = 1;
}
