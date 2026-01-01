import { tool } from 'ai';
import { z } from 'zod';
import type { PaystackApiService } from '../../services/paystack-api.service';
import type { AuthenticatedUser } from '../types';
import type { FeatureStateResult } from '../types/feature';
import { featureMap } from '../knowledge/feature-map';
import { FeatureBM25Resolver } from '../search/feature-bm25';
import { evaluateRules } from '../logic/json-logic-runner';
import type { CacheService } from '../../services/cache.service';

const resolver = new FeatureBM25Resolver(featureMap.features);

function findFeature(query: string) {
  const normalized = query.trim().toLowerCase();

  const exact = featureMap.features.find(
    (feature) =>
      feature.slug === normalized || feature.name.toLowerCase() === normalized || feature.synonyms.includes(normalized),
  );
  if (exact) {
    return exact;
  }

  const result = resolver.resolve(query, { minScore: 0.1 });

  if (!result) {
    return undefined;
  }

  return featureMap.features.find((feature) => feature.slug === result.slug);
}

const fetchRagDescription = async (ragKey: string): Promise<string> => {
  // Placeholder: swap with real RAG client when available
  // Current stub keeps behavior explicit for tests and predictable responses.
  return Promise.resolve(`Description for ${ragKey} (stub).`);
};

export function createGetFeatureStateTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
  cacheService?: CacheService,
) {
  return tool({
    description:
      'Return what a dashboard feature is, its current state for a merchant (from /integration/:id), and where to configure it.',
    inputSchema: z.object({
      integrationId: z.string().describe('Integration ID for the merchant'),
      feature: z.string().describe('Feature name or synonym, e.g., "transfer approval"'),
      includeRag: z.boolean().optional().default(true).describe('Include descriptive text via RAG (default: true)'),
    }),
    execute: async ({ integrationId, feature, includeRag }) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return { success: false, error: 'Authentication token not available. Please ensure you are logged in.' };
      }

      const mapping = findFeature(feature);
      if (!mapping) {
        return { success: false, status: 'unknown_feature', error: 'Feature not recognized.' };
      }

      const cacheKey = `integration:${integrationId}`;
      let integration: Record<string, unknown> | null = null;
      let dataAgeSeconds: number | undefined;

      try {
        const cached =
          cacheService && (await cacheService.safeGet<{ data: Record<string, unknown>; fetchedAt: number }>(cacheKey));

        if (cached) {
          integration = cached.data;
          dataAgeSeconds = Math.floor((Date.now() - cached.fetchedAt) / 1000);
        } else {
          const response = await paystackService.get<Record<string, unknown>>(
            `/integration/${integrationId}`,
            jwtToken,
          );
          integration = response.data;
          dataAgeSeconds =
            typeof response.data?.['data_age_seconds'] === 'number' ? response.data?.['data_age_seconds'] : undefined;

          if (cacheService && integration) {
            await cacheService.safeSet(cacheKey, { data: integration, fetchedAt: Date.now() });
          }
        }
      } catch {
        integration = null;
      }

      let stateBlock: FeatureStateResult['state'] = null;
      if (integration) {
        const ruleResult = evaluateRules(mapping.state_rules, integration, dataAgeSeconds);
        stateBlock = {
          state: ruleResult.state,
          details: ruleResult.details,
          ruleId: ruleResult.id,
          dataAgeSeconds: ruleResult.dataAgeSeconds ?? null,
        };
      }

      const description = includeRag ? await fetchRagDescription(mapping.description_rag_key) : null;

      return {
        success: true,
        feature: {
          slug: mapping.slug,
          name: mapping.name,
          dashboard_path: mapping.dashboard_path,
        },
        state: stateBlock,
        description,
        provenance: {
          ontologyVersion: featureMap._meta.version,
          ruleEngine: 'expression',
          matchedRule: stateBlock?.ruleId ?? null,
        },
        ...(integration ? {} : { message: 'Live settings unavailable; showing description only.' }),
      };
    },
  });
}
