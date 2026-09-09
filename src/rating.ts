export interface RatedScore {
  id: string;
  difficulty: string;
  constant: number;
  score: number;
}

export function playRating(score: number, constant: number): number {
  if (
    !Number.isFinite(score) ||
    score < 0 ||
    !Number.isFinite(constant) ||
    constant < 0
  ) {
    throw new RangeError(
      "Score and constant must be finite, non-negative numbers.",
    );
  }
  if (score >= 10_000_000) return constant + 2;
  if (score >= 9_800_000) return constant + 1 + (score - 9_800_000) / 200_000;
  return Math.max(0, constant + (score - 9_500_000) / 300_000);
}

export function getBest50<T extends RatedScore>(scores: readonly T[]) {
  const unique = new Map<string, T>();
  for (const score of scores) {
    playRating(score.score, score.constant);
    const key = `${score.id}:${score.difficulty}`;
    if (!unique.has(key) || unique.get(key)!.score < score.score)
      unique.set(key, score);
  }
  const best = [...unique.values()]
    .map((entry) => ({
      ...entry,
      playRating: playRating(entry.score, entry.constant),
    }))
    .sort((a, b) => b.playRating - a.playRating || b.score - a.score)
    .slice(0, 50);
  const sum50 = best.reduce((sum, entry) => sum + entry.playRating, 0);
  const sum10 = best
    .slice(0, 10)
    .reduce((sum, entry) => sum + entry.playRating, 0);
  return { best, b50: sum50 / 50, b10: sum10 / 10, max: (sum50 + sum10) / 60 };
}

export function formatRating(value: number, digits = 4): string {
  const factor = 10 ** digits;
  return (
    Math.floor((value + Number.EPSILON * Math.max(1, value)) * factor) / factor
  ).toFixed(digits);
}

export function potentialTier(value: number): number {
  const thresholds = [3.5, 7, 10, 11, 12, 12.5, 13];
  return thresholds.filter((threshold) => value >= threshold).length;
}

export function grade(score: number): string {
  if (score >= 9_900_000) return "EX+";
  if (score >= 9_800_000) return "EX";
  if (score >= 9_500_000) return "AA";
  if (score >= 9_200_000) return "A";
  if (score >= 8_900_000) return "B";
  if (score >= 8_600_000) return "C";
  return "D";
}
