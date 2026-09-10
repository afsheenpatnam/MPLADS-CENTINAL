import rulesConfig from "../../config/rules.json";

export type RuleOperator = ">" | "<" | ">=" | "<=" | "==" | "!=" | "expectedVsActual";
export type RuleClassification = "ANOMALY" | "FRAUD_RISK_INDICATOR" | "INEFFICIENCY";
export type RuleSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RuleDefinition {
  ruleId: string;
  name: string;
  category: string;
  classification: RuleClassification;
  description: string;
  parameters: string[];
  metric: string;
  operator: RuleOperator;
  threshold: number;
  unit: string;
  severity: RuleSeverity;
  enabled: boolean;
  source: string;
  configurable: boolean;
  thresholdNote: string;
}

interface RulesFile {
  version: string;
  sourceDocument: string;
  note: string;
  rules: RuleDefinition[];
}

const typedRules = rulesConfig as RulesFile;

// In-memory override store so an admin can retune configurable thresholds at runtime
// without redeploying. Not persisted across restarts in this prototype.
const overrides = new Map<string, Partial<Pick<RuleDefinition, "threshold" | "enabled" | "severity">>>();

export function getAllRules(): RuleDefinition[] {
  return typedRules.rules.map((rule) => ({ ...rule, ...overrides.get(rule.ruleId) }));
}

export function getEnabledRules(): RuleDefinition[] {
  return getAllRules().filter((r) => r.enabled);
}

export function getRule(ruleId: string): RuleDefinition | undefined {
  return getAllRules().find((r) => r.ruleId === ruleId);
}

export function getRulesByCategory(category: string): RuleDefinition[] {
  return getEnabledRules().filter((r) => r.category === category);
}

export function setRuleOverride(
  ruleId: string,
  patch: Partial<Pick<RuleDefinition, "threshold" | "enabled" | "severity">>
): RuleDefinition {
  const rule = typedRules.rules.find((r) => r.ruleId === ruleId);
  if (!rule) throw new Error(`Unknown ruleId: ${ruleId}`);
  if (!rule.configurable && (patch.threshold !== undefined)) {
    throw new Error(`Rule ${ruleId} threshold is not configurable`);
  }
  overrides.set(ruleId, { ...overrides.get(ruleId), ...patch });
  return getRule(ruleId)!;
}

export const rulesMeta = { version: typedRules.version, sourceDocument: typedRules.sourceDocument, note: typedRules.note };
