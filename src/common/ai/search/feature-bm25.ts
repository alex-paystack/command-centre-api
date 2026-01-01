import type { FeatureMapping } from '../types/feature';

/**
 * Minimal BM25 resolver tailored to a tiny feature catalog.
 * - Indexes slug, name, synonyms, dashboard_path into a flat term list.
 * - Uses standard BM25 (k1=1.5, b=0.75) for scoring.
 * - Short-circuits on exact or startsWith slug matches to keep answers predictable.
 * This keeps a dependency-free, deterministic matcher suitable for 10–30 docs.
 */
interface BM25Doc {
  slug: string;
  terms: string[];
}

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

export class FeatureBM25Resolver {
  private docs: BM25Doc[];
  private averageDocLength: number;
  private documentFrequency: Map<string, number>;
  private readonly totalDocs: number;

  constructor(features: FeatureMapping[]) {
    this.docs = features.map((feature) => {
      const terms = tokenize(
        [feature.slug, feature.name, ...(feature.synonyms || []), feature.dashboard_path].join(' '),
      );
      return { slug: feature.slug, terms };
    });

    this.totalDocs = this.docs.length;
    this.averageDocLength = this.docs.reduce((sum, d) => sum + d.terms.length, 0) / Math.max(this.totalDocs, 1);
    this.documentFrequency = new Map();

    for (const doc of this.docs) {
      const seen = new Set<string>();
      for (const term of doc.terms) {
        if (!seen.has(term)) {
          this.documentFrequency.set(term, (this.documentFrequency.get(term) ?? 0) + 1);
          seen.add(term);
        }
      }
    }
  }

  /**
   * Resolve query to best feature slug using BM25 with guardrails.
   * Returns null if below minScore to allow the agent to ask for clarification.
   */
  resolve(query: string, { minScore = 0.1 }: { minScore?: number } = {}) {
    const tokens = tokenize(query);

    // exact/starts-with short-circuit
    const exact = this.docs.find((d) => d.slug === query.toLowerCase());
    if (exact) return { slug: exact.slug, score: 1 };

    const startsWith = this.docs.find((doc) => doc.slug.startsWith(query.toLowerCase()));
    if (startsWith) {
      return { slug: startsWith.slug, score: 0.95 };
    }

    const scores = new Map<string, number>();

    for (const token of tokens) {
      const documentFrequency = this.documentFrequency.get(token);
      if (!documentFrequency) {
        continue;
      }

      const documentFrequencyInverse = Math.log(
        (this.totalDocs - documentFrequency + 0.5) / (documentFrequency + 0.5) + 1,
      );

      for (const doc of this.docs) {
        const termFrequency = doc.terms.filter((term) => term === token).length;
        if (termFrequency === 0) {
          continue;
        }
        const k1Factor = 1.5;
        const bFactor = 0.75;
        const denom = termFrequency + k1Factor * (1 - bFactor + (bFactor * doc.terms.length) / this.averageDocLength);
        const score = documentFrequencyInverse * ((termFrequency * (k1Factor + 1)) / denom);
        scores.set(doc.slug, (scores.get(doc.slug) ?? 0) + score);
      }
    }

    if (scores.size === 0) {
      return null;
    }

    const [bestSlug, bestScore] = Array.from(scores.entries()).sort((a, b) => b[1] - a[1])[0];

    if (bestScore < minScore) return null;

    return { slug: bestSlug, score: bestScore };
  }
}
