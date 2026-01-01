export interface FeatureStateRule {
  id: string;
  when: string; // boolean expression evaluated against integration payload
  state: string;
  details?: string;
}

export interface FeatureField {
  path: string;
  type: 'boolean' | 'enum' | 'number' | 'string' | 'object';
  values?: string[];
}

export interface FeatureMapping {
  slug: string;
  name: string;
  synonyms: string[];
  dashboard_path: string;
  description_rag_key: string;
  fields: FeatureField[];
  state_rules: FeatureStateRule[];
}

export interface FeatureMapMeta {
  version: string;
  updated_at: string;
}

export interface FeatureMap {
  _meta: FeatureMapMeta;
  features: FeatureMapping[];
}

export interface FeatureStateResult {
  success: boolean;
  feature?: {
    slug: string;
    name: string;
    dashboard_path: string;
  };
  state?: {
    state: string;
    details?: string;
    ruleId?: string | null;
    dataAgeSeconds?: number | null;
  } | null;
  description?: string | null;
  provenance?: {
    ontologyVersion?: string;
    ruleEngine: 'expression';
    matchedRule?: string | null;
  };
  error?: string;
  status?: 'unknown_feature';
  message?: string;
}
