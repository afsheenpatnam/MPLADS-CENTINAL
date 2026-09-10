import { IsolationForest } from "./isolationForest";

describe("IsolationForest", () => {
  it("scores an obvious outlier higher than points from the training cluster", () => {
    const normalCluster: number[][] = Array.from({ length: 200 }, () => [
      50 + (Math.random() - 0.5) * 10,
      50 + (Math.random() - 0.5) * 10,
    ]);

    const forest = new IsolationForest({ numTrees: 100, sampleSize: 128 });
    forest.fit(normalCluster);

    const normalPoint: [number, number] = [50, 50];
    const outlierPoint: [number, number] = [500, 500];

    const normalScore = forest.score(normalPoint);
    const outlierScore = forest.score(outlierPoint);

    expect(outlierScore).toBeGreaterThan(normalScore);
  });

  it("returns scores in [0, 1]", () => {
    const data = Array.from({ length: 50 }, () => [Math.random() * 100]);
    const forest = new IsolationForest({ numTrees: 50, sampleSize: 32 });
    forest.fit(data);
    for (const point of data) {
      const score = forest.score(point);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});
