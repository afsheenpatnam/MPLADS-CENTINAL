/**
 * A from-scratch Isolation Forest (Liu, Ting & Zhou, 2008).
 *
 * Anomalies are "few and different", so they are isolated closer to the root of a
 * randomly-partitioned binary tree than normal points. We build an ensemble of
 * random trees over sub-samples of the training data, then score a point by how
 * short its average path length is across the ensemble (short path = anomalous).
 *
 * This is a real, general-purpose statistical anomaly detector — it has no
 * knowledge of MPLAD-specific rules and only sees numeric feature vectors.
 */

interface TreeNode {
  splitFeature?: number;
  splitValue?: number;
  left?: TreeNode;
  right?: TreeNode;
  size: number; // number of points that reached this node during training
  isLeaf: boolean;
}

function averagePathLengthForSize(n: number): number {
  if (n <= 1) return 0;
  const harmonic = Math.log(n - 1) + 0.5772156649; // Euler-Mascheroni constant
  return 2 * harmonic - (2 * (n - 1)) / n;
}

function buildTree(data: number[][], currentDepth: number, maxDepth: number): TreeNode {
  if (currentDepth >= maxDepth || data.length <= 1) {
    return { size: data.length, isLeaf: true };
  }

  const numFeatures = data[0].length;
  // Pick a feature that actually varies in this subset; bail out to a leaf if none do.
  const candidateFeatures = Array.from({ length: numFeatures }, (_, i) => i).sort(
    () => Math.random() - 0.5
  );

  for (const feature of candidateFeatures) {
    const values = data.map((row) => row[feature]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) continue;

    const splitValue = min + Math.random() * (max - min);
    const left = data.filter((row) => row[feature] < splitValue);
    const right = data.filter((row) => row[feature] >= splitValue);
    if (left.length === 0 || right.length === 0) continue;

    return {
      splitFeature: feature,
      splitValue,
      left: buildTree(left, currentDepth + 1, maxDepth),
      right: buildTree(right, currentDepth + 1, maxDepth),
      size: data.length,
      isLeaf: false,
    };
  }

  return { size: data.length, isLeaf: true };
}

function pathLength(node: TreeNode, point: number[], currentDepth: number): number {
  if (node.isLeaf || node.splitFeature === undefined) {
    return currentDepth + averagePathLengthForSize(node.size);
  }
  const goLeft = point[node.splitFeature] < (node.splitValue as number);
  return pathLength(goLeft ? node.left! : node.right!, point, currentDepth + 1);
}

export class IsolationForest {
  private trees: TreeNode[] = [];
  private sampleSize: number;
  private numTrees: number;
  private cFactor: number;

  constructor(options: { numTrees?: number; sampleSize?: number } = {}) {
    this.numTrees = options.numTrees ?? 100;
    this.sampleSize = options.sampleSize ?? 256;
    this.cFactor = 1;
  }

  fit(data: number[][]): void {
    if (data.length === 0) throw new Error("Cannot fit IsolationForest on empty data");
    const effectiveSampleSize = Math.min(this.sampleSize, data.length);
    const maxDepth = Math.ceil(Math.log2(Math.max(effectiveSampleSize, 2)));
    this.cFactor = averagePathLengthForSize(effectiveSampleSize);

    this.trees = [];
    for (let t = 0; t < this.numTrees; t++) {
      const sample = sampleWithoutReplacement(data, effectiveSampleSize);
      this.trees.push(buildTree(sample, 0, maxDepth));
    }
  }

  /** Returns an anomaly score in [0, 1]. Values close to 1 are more anomalous. */
  score(point: number[]): number {
    if (this.trees.length === 0) return 0;
    const avgPathLength =
      this.trees.reduce((sum, tree) => sum + pathLength(tree, point, 0), 0) / this.trees.length;
    return Math.pow(2, -avgPathLength / (this.cFactor || 1));
  }

  scoreBatch(points: number[][]): number[] {
    return points.map((p) => this.score(p));
  }
}

function sampleWithoutReplacement<T>(data: T[], size: number): T[] {
  const copy = [...data];
  const result: T[] = [];
  for (let i = 0; i < size && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return result;
}
