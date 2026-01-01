import { z } from 'zod';
import type { FeatureMap } from '../types/feature';

const FeatureFieldSchema = z.object({
  path: z.string(),
  type: z.enum(['boolean', 'enum', 'number', 'string', 'object']),
  values: z.array(z.string()).optional(),
});

const FeatureStateRuleSchema = z.object({
  id: z.string(),
  when: z.string(),
  state: z.string(),
  details: z.string().optional(),
});

const FeatureMappingSchema = z.object({
  slug: z.string(),
  name: z.string(),
  synonyms: z.array(z.string()).default([]),
  dashboard_path: z.string(),
  description_rag_key: z.string(),
  fields: z.array(FeatureFieldSchema),
  state_rules: z.array(FeatureStateRuleSchema),
});

const FeatureMapSchema = z.object({
  _meta: z.object({
    version: z.string(),
    updated_at: z.string(),
  }),
  features: z.array(FeatureMappingSchema),
});

// Minimal seed map; extend as you onboard more features.
export const featureMap: FeatureMap = FeatureMapSchema.parse({
  _meta: {
    version: '0.1.0',
    updated_at: '2025-12-26',
  },
  features: [
    {
      slug: 'transfer-approval',
      name: 'Transfer Approval',
      synonyms: ['approval flow', 'payout approvals', 'dual approval', 'two-step approval'],
      dashboard_path: '/dashboard/transfers/approvals',
      description_rag_key: 'support:transfer-approval',
      fields: [
        { path: 'transfer_approval.enabled', type: 'boolean' },
        { path: 'transfer_approval.level', type: 'enum', values: ['single', 'dual'] },
        { path: 'transfer_approval.min_amount', type: 'number' },
      ],
      state_rules: [
        {
          id: 'dual-on',
          when: 'transfer_approval?.enabled === true && transfer_approval?.level === "dual"',
          state: 'enabled',
          details: 'Dual approval required for transfers; min amount {{transfer_approval.min_amount ?? "not set"}}.',
        },
        {
          id: 'single-on',
          when: 'transfer_approval?.enabled === true',
          state: 'enabled',
          details: 'Single-approver flow is on.',
        },
        {
          id: 'off',
          when: 'true',
          state: 'disabled',
          details: 'Approvals are off.',
        },
      ],
    },
    {
      slug: 'settlement-schedule',
      name: 'Settlement Schedule',
      synonyms: ['payout schedule', 'settlement timing', 'payout frequency'],
      dashboard_path: '/dashboard/settlements',
      description_rag_key: 'support:settlement-schedule',
      fields: [{ path: 'settlement.schedule', type: 'enum', values: ['daily', 'weekly', 'monthly', 'manual'] }],
      state_rules: [
        {
          id: 'manual',
          when: 'settlement?.schedule === "manual"',
          state: 'manual',
          details: 'Settlements are manual. Trigger payouts from the dashboard.',
        },
        {
          id: 'scheduled',
          when: '["daily", "weekly", "monthly"].includes(settlement?.schedule)',
          state: 'scheduled',
          details: 'Settlements run on a {{settlement.schedule}} cadence.',
        },
        {
          id: 'unknown',
          when: 'true',
          state: 'unknown',
          details: 'Settlement schedule not set.',
        },
      ],
    },
  ],
});

export type FeatureMapType = typeof featureMap;
