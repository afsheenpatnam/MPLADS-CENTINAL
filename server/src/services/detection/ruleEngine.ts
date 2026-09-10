import { getRule } from "../rules/ruleLoader";
import { haversineDistanceMeters } from "../../utils/geo";
import { DetectionContext, DraftFinding, elapsedPercent } from "./types";

function pushIfEnabled(
  findings: DraftFinding[],
  ruleId: string,
  build: (rule: NonNullable<ReturnType<typeof getRule>>) => DraftFinding | DraftFinding[] | null
): void {
  const rule = getRule(ruleId);
  if (!rule || !rule.enabled) return;
  const result = build(rule);
  if (!result) return;
  findings.push(...(Array.isArray(result) ? result : [result]));
}

/**
 * The rule engine evaluates every enabled rule from rules.json against the current
 * project context. Thresholds, severity and enabled/disabled state are entirely
 * data-driven (see server/src/config/rules.json) — no project-specific logic is
 * hardcoded here, only the generic parameter extraction each ruleId needs.
 */
export function runRuleEngine(ctx: DetectionContext): DraftFinding[] {
  const findings: DraftFinding[] = [];
  const { project } = ctx;
  const elapsed = elapsedPercent(project.startDate, project.endDate);

  // PROGRESS_001 — Progress vs Time Elapsed
  pushIfEnabled(findings, "PROGRESS_001", (rule) => {
    const gap = elapsed - project.actualProgress;
    if (gap < rule.threshold) return null;
    return {
      category: rule.category,
      type: "PROGRESS_ANOMALY",
      classification: rule.classification,
      severity: rule.severity,
      confidence: 0.9,
      title: "Progress lagging far behind elapsed time",
      description: `${elapsed.toFixed(0)}% of the project timeline has elapsed but only ${project.actualProgress.toFixed(0)}% of physical work is reported complete.`,
      expectedValue: Number(elapsed.toFixed(1)),
      actualValue: project.actualProgress,
      deviation: Number(gap.toFixed(1)),
      ruleId: rule.ruleId,
      source: "RULE_ENGINE",
      evidenceIds: [],
      parametersUsed: { elapsedPercent: elapsed, actualProgress: project.actualProgress },
      recommendedAction: "Request a progress clarification and verify with a site visit.",
    };
  });

  // PROGRESS_002 — Milestone Slippage
  pushIfEnabled(findings, "PROGRESS_002", (rule) => {
    const now = new Date();
    const results: DraftFinding[] = [];
    for (const m of ctx.milestones) {
      if (m.status === "COMPLETED") continue;
      if (m.expectedDate > now) continue;
      const gap = m.expectedProgress - m.actualProgress;
      if (gap < rule.threshold) continue;
      results.push({
        category: rule.category,
        type: "MILESTONE_SLIPPAGE",
        classification: rule.classification,
        severity: rule.severity,
        confidence: 0.85,
        title: `Milestone "${m.name}" is behind schedule`,
        description: `Milestone due ${m.expectedDate.toDateString()} expected ${m.expectedProgress}% progress but only ${m.actualProgress}% is recorded.`,
        expectedValue: m.expectedProgress,
        actualValue: m.actualProgress,
        deviation: Number(gap.toFixed(1)),
        ruleId: rule.ruleId,
        source: "RULE_ENGINE",
        evidenceIds: [],
        parametersUsed: { milestoneId: m._id.toString() },
        recommendedAction: "Follow up with the contractor on the delayed milestone.",
      });
    }
    return results;
  });

  // FINANCIAL_001 — Cost-Progress Mismatch
  pushIfEnabled(findings, "FINANCIAL_001", (rule) => {
    const expenditurePercent = project.sanctionedAmount > 0 ? (project.spentAmount / project.sanctionedAmount) * 100 : 0;
    const gap = expenditurePercent - project.actualProgress;
    if (gap < rule.threshold) return null;
    return {
      category: rule.category,
      type: "COST_PROGRESS_MISMATCH",
      classification: rule.classification,
      severity: rule.severity,
      confidence: 0.92,
      title: "High expenditure with low physical progress",
      description: `${expenditurePercent.toFixed(0)}% of sanctioned funds spent against only ${project.actualProgress.toFixed(0)}% physical progress. Potential fraud risk indicator — requires verification.`,
      expectedValue: Number(project.actualProgress.toFixed(1)),
      actualValue: Number(expenditurePercent.toFixed(1)),
      deviation: Number(gap.toFixed(1)),
      ruleId: rule.ruleId,
      source: "RULE_ENGINE",
      evidenceIds: [],
      parametersUsed: { expenditurePercent, physicalProgress: project.actualProgress },
      recommendedAction: "Request expenditure clarification and cross-check invoices against completed work.",
    };
  });

  // FINANCIAL_002 — Budget Overrun Pace
  pushIfEnabled(findings, "FINANCIAL_002", (rule) => {
    const expenditurePercent = project.sanctionedAmount > 0 ? (project.spentAmount / project.sanctionedAmount) * 100 : 0;
    const gap = expenditurePercent - elapsed;
    if (gap < rule.threshold) return null;
    return {
      category: rule.category,
      type: "BUDGET_OVERRUN_PACE",
      classification: rule.classification,
      severity: rule.severity,
      confidence: 0.75,
      title: "Budget consumed faster than schedule",
      description: `Spend rate (${expenditurePercent.toFixed(0)}%) is well ahead of elapsed time (${elapsed.toFixed(0)}%).`,
      expectedValue: Number(elapsed.toFixed(1)),
      actualValue: Number(expenditurePercent.toFixed(1)),
      deviation: Number(gap.toFixed(1)),
      ruleId: rule.ruleId,
      source: "RULE_ENGINE",
      evidenceIds: [],
      parametersUsed: { expenditurePercent, elapsedPercent: elapsed },
      recommendedAction: "Review disbursement schedule against contractual milestones.",
    };
  });

  // FINANCIAL_003 — Expenditure Missing Justification
  pushIfEnabled(findings, "FINANCIAL_003", (rule) => {
    const results: DraftFinding[] = [];
    for (const exp of ctx.expenditures) {
      const missingJustification = !exp.justification || exp.justification.trim().length === 0;
      const missingDocs = !exp.documentIds || exp.documentIds.length === 0;
      if (exp.amount > rule.threshold && missingJustification && missingDocs) {
        results.push({
          category: rule.category,
          type: "EXPENDITURE_MISSING_JUSTIFICATION",
          classification: rule.classification,
          severity: rule.severity,
          confidence: 0.8,
          title: "Large expenditure without justification or supporting document",
          description: `An expenditure of ₹${exp.amount.toLocaleString("en-IN")} (${exp.category}) on ${exp.date.toDateString()} has no justification note or supporting document attached.`,
          expectedValue: "justification and/or document required",
          actualValue: "none provided",
          ruleId: rule.ruleId,
          source: "RULE_ENGINE",
          evidenceIds: [],
          parametersUsed: { expenditureId: exp._id.toString(), amount: exp.amount },
          recommendedAction: "Request supporting documentation for this expenditure via clarification.",
        });
      }
    }
    return results;
  });

  // FINANCIAL_004 — Duplicate / Inflated Invoice
  pushIfEnabled(findings, "FINANCIAL_004", (rule) => {
    const results: DraftFinding[] = [];
    const byInvoice = new Map<string, number>();
    const byHash = new Map<string, number>();
    for (const doc of ctx.documents) {
      if (doc.invoiceNumber) byInvoice.set(doc.invoiceNumber, (byInvoice.get(doc.invoiceNumber) ?? 0) + 1);
      byHash.set(doc.documentHash, (byHash.get(doc.documentHash) ?? 0) + 1);
    }
    // Invoice numbers also live directly on Expenditure entries (e.g. from CSV-imported daily
    // activity, which has no separate Document upload) — duplicates there are just as suspicious.
    for (const exp of ctx.expenditures) {
      if (exp.invoiceNumber) byInvoice.set(exp.invoiceNumber, (byInvoice.get(exp.invoiceNumber) ?? 0) + 1);
    }
    const dupeInvoices = [...byInvoice.entries()].filter(([, count]) => count > 1);
    const dupeHashes = [...byHash.entries()].filter(([, count]) => count > 1);
    if (dupeInvoices.length > 0 || dupeHashes.length > 0) {
      results.push({
        category: rule.category,
        type: "DUPLICATE_INVOICE",
        classification: rule.classification,
        severity: rule.severity,
        confidence: 0.88,
        title: "Duplicate invoice or document detected",
        description: `Found ${dupeInvoices.length} duplicate invoice number(s) and ${dupeHashes.length} identical document upload(s) in this project's documents.`,
        expectedValue: "unique invoice numbers/documents",
        actualValue: `${dupeInvoices.length + dupeHashes.length} duplicate(s)`,
        ruleId: rule.ruleId,
        source: "RULE_ENGINE",
        evidenceIds: [],
        parametersUsed: { dupeInvoices: dupeInvoices.map((d) => d[0]), dupeHashCount: dupeHashes.length },
        recommendedAction: "Verify invoice authenticity with the vendor and request originals.",
      });
    }
    return results;
  });

  // WORK_001 — Reported Work Without Evidence Corroboration
  pushIfEnabled(findings, "WORK_001", (rule) => {
    const results: DraftFinding[] = [];
    const sortedProgress = [...ctx.progress].sort((a, b) => a.date.getTime() - b.date.getTime());
    let previous = 0;
    for (const p of sortedProgress) {
      const delta = p.physicalProgress - previous;
      previous = p.physicalProgress;
      if (delta < rule.threshold) continue;
      const windowMs = 3 * 24 * 60 * 60 * 1000;
      const evidenceInWindow = ctx.evidence.filter((e) => {
        const t = (e.timestamp ?? e.createdAt).getTime();
        return Math.abs(t - p.date.getTime()) <= windowMs;
      });
      if (evidenceInWindow.length === 0) {
        results.push({
          category: rule.category,
          type: "WORK_EVIDENCE_MISMATCH",
          classification: rule.classification,
          severity: rule.severity,
          confidence: 0.7,
          title: "Progress jump reported without supporting evidence",
          description: `Progress jumped by ${delta.toFixed(0)} points on ${p.date.toDateString()} with no evidence uploaded in a ±3 day window.`,
          expectedValue: "evidence accompanying large progress updates",
          actualValue: "0 evidence items",
          deviation: delta,
          ruleId: rule.ruleId,
          source: "RULE_ENGINE",
          evidenceIds: [],
          parametersUsed: { progressId: p._id.toString(), delta },
          recommendedAction: "Request photographic/GPS evidence for this progress update.",
        });
      }
    }
    return results;
  });

  // WORK_002 — Location Mismatch
  pushIfEnabled(findings, "WORK_002", (rule) => {
    const results: DraftFinding[] = [];
    for (const e of ctx.evidence) {
      if (e.latitude === undefined || e.longitude === undefined) continue;
      const distance = haversineDistanceMeters(project.latitude, project.longitude, e.latitude, e.longitude);
      if (distance < rule.threshold) continue;
      results.push({
        category: rule.category,
        type: "LOCATION_MISMATCH",
        classification: rule.classification,
        severity: rule.severity,
        confidence: 0.85,
        title: "Evidence GPS location far from project site",
        description: `Evidence "${e.fileName}" was captured ${distance.toFixed(0)}m from the registered project location.`,
        expectedValue: `within ${rule.threshold}m`,
        actualValue: `${distance.toFixed(0)}m`,
        deviation: Number((distance - rule.threshold).toFixed(0)),
        ruleId: rule.ruleId,
        source: "RULE_ENGINE",
        evidenceIds: [e._id],
        parametersUsed: { evidenceId: e._id.toString(), distanceMeters: distance },
        recommendedAction: "Verify the evidence location with the contractor or via a physical site visit.",
      });
    }
    return results;
  });

  // WORK_003 — Implausible Evidence Timestamp
  pushIfEnabled(findings, "WORK_003", (rule) => {
    const results: DraftFinding[] = [];
    for (const e of ctx.evidence) {
      if (!e.timestamp) continue;
      const impossibleFuture = e.timestamp.getTime() > e.createdAt.getTime() + 60 * 60 * 1000;
      const beforeStart = e.timestamp.getTime() < project.startDate.getTime();
      if (!impossibleFuture && !beforeStart) continue;
      results.push({
        category: rule.category,
        type: "TIMESTAMP_ANOMALY",
        classification: rule.classification,
        severity: rule.severity,
        confidence: 0.65,
        title: "Evidence timestamp is inconsistent with project timeline",
        description: beforeStart
          ? `Evidence "${e.fileName}" is timestamped before the project start date.`
          : `Evidence "${e.fileName}" is timestamped after its own upload time.`,
        expectedValue: `between ${project.startDate.toDateString()} and submission time`,
        actualValue: e.timestamp.toDateString(),
        ruleId: rule.ruleId,
        source: "RULE_ENGINE",
        evidenceIds: [e._id],
        parametersUsed: { evidenceId: e._id.toString(), timestamp: e.timestamp.toISOString() },
        recommendedAction: "Ask the contractor to explain the evidence timestamp discrepancy.",
      });
    }
    return results;
  });

  // WORK_004 — Image Reuse / High Similarity (uses similarity results computed at upload time)
  pushIfEnabled(findings, "WORK_004", (rule) => {
    const results: DraftFinding[] = [];
    for (const e of ctx.evidence) {
      for (const sim of e.similarityResults) {
        if (sim.similarityScore < rule.threshold) continue;
        results.push({
          category: rule.category,
          type: "IMAGE_REUSE_OR_HIGH_SIMILARITY",
          classification: rule.classification,
          severity: rule.severity,
          confidence: 0.6,
          title: "Potential evidence reuse detected",
          description: `Evidence "${e.fileName}" is ${sim.similarityScore.toFixed(1)}% similar to previously uploaded evidence. This does not by itself confirm the image is fake.`,
          expectedValue: `<${rule.threshold}% similarity`,
          actualValue: `${sim.similarityScore.toFixed(1)}%`,
          deviation: Number((sim.similarityScore - rule.threshold).toFixed(1)),
          ruleId: rule.ruleId,
          source: "CV_ENGINE",
          evidenceIds: [e._id, sim.comparedEvidenceId],
          parametersUsed: { evidenceId: e._id.toString(), comparedEvidenceId: sim.comparedEvidenceId.toString() },
          recommendedAction: "Open the evidence viewer to visually compare both images side by side.",
        });
      }
    }
    return results;
  });

  // PLAN_001 — Plan vs Actual Construction Deviation (simple keyword-overlap heuristic)
  pushIfEnabled(findings, "PLAN_001", (rule) => {
    if (!project.approvedWork || ctx.progress.length === 0) return null;
    const approvedKeywords = new Set(
      project.approvedWork.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)
    );
    const latest = [...ctx.progress].sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    const reportedKeywords = new Set(
      latest.reportedWork.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)
    );
    const overlap = [...reportedKeywords].filter((w) => approvedKeywords.has(w));
    const overlapRatio = reportedKeywords.size > 0 ? overlap.length / reportedKeywords.size : 1;
    if (overlapRatio >= 0.2) return null; // reasonable overlap, no flag
    return {
      category: rule.category,
      type: "PLAN_ACTUAL_MISMATCH",
      classification: rule.classification,
      severity: rule.severity,
      confidence: 0.5,
      title: "Reported work does not clearly match approved work scope",
      description: `The most recent reported work description shares little in common with the sanctioned approved work scope. This is a heuristic keyword check, not a definitive finding.`,
      expectedValue: project.approvedWork,
      actualValue: latest.reportedWork,
      ruleId: rule.ruleId,
      source: "RULE_ENGINE",
      evidenceIds: [],
      parametersUsed: { overlapRatio: Number(overlapRatio.toFixed(2)) },
      recommendedAction: "Ask the contractor to clarify how reported work maps to the approved scope.",
    };
  });

  // QUALITY_001 — Quality Concern Flag
  pushIfEnabled(findings, "QUALITY_001", (rule) => {
    const flaggedEvidence = ctx.evidence.filter((e) => e.validationStatus === "INVALID" || e.validationStatus === "SUSPICIOUS");
    const flaggedVisits = ctx.siteVisits.filter((v) => /concern|issue|poor|defect|substandard/i.test(v.remarks ?? ""));
    const count = flaggedEvidence.length + flaggedVisits.length;
    if (count < rule.threshold) return null;
    return {
      category: rule.category,
      type: "QUALITY_CONCERN",
      classification: rule.classification,
      severity: rule.severity,
      confidence: 0.55,
      title: "Quality concerns flagged on this project",
      description: `${flaggedEvidence.length} evidence item(s) flagged as suspicious/invalid and ${flaggedVisits.length} site visit remark(s) mention quality concerns. Not an automated material-science quality test.`,
      expectedValue: 0,
      actualValue: count,
      ruleId: rule.ruleId,
      source: "RULE_ENGINE",
      evidenceIds: flaggedEvidence.map((e) => e._id),
      parametersUsed: { flaggedEvidenceCount: flaggedEvidence.length, flaggedVisitCount: flaggedVisits.length },
      recommendedAction: "Schedule a physical quality inspection.",
    };
  });

  // QUANTITY_001 — Quantity Deviation
  pushIfEnabled(findings, "QUANTITY_001", (rule) => {
    const latestWithQuantity = [...ctx.progress]
      .filter((p) => p.reportedQuantity !== undefined && p.reportedQuantity !== null)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    if (!latestWithQuantity || !project.approvedQuantity) return null;
    const deviationPct =
      (Math.abs((latestWithQuantity.reportedQuantity as number) - project.approvedQuantity) / project.approvedQuantity) * 100;
    if (deviationPct < rule.threshold) return null;
    return {
      category: rule.category,
      type: "QUANTITY_DEVIATION",
      classification: rule.classification,
      severity: rule.severity,
      confidence: 0.75,
      title: "Reported quantity deviates from approved quantity",
      description: `Approved quantity is ${project.approvedQuantity} but reported quantity is ${latestWithQuantity.reportedQuantity} (${deviationPct.toFixed(0)}% deviation).`,
      expectedValue: project.approvedQuantity,
      actualValue: latestWithQuantity.reportedQuantity,
      deviation: Number(deviationPct.toFixed(1)),
      ruleId: rule.ruleId,
      source: "RULE_ENGINE",
      evidenceIds: [],
      parametersUsed: { approvedQuantity: project.approvedQuantity, reportedQuantity: latestWithQuantity.reportedQuantity },
      recommendedAction: "Cross-check reported quantity against site measurement records.",
    };
  });

  // SANCTION_001 — Sanction Report Deviation
  pushIfEnabled(findings, "SANCTION_001", (rule) => {
    const results: DraftFinding[] = [];
    if (project.spentAmount > project.sanctionedAmount) {
      results.push({
        category: rule.category,
        type: "SANCTION_AMOUNT_EXCEEDED",
        classification: rule.classification,
        severity: rule.severity,
        confidence: 0.95,
        title: "Spending has exceeded the sanctioned amount",
        description: `Spent amount (₹${project.spentAmount.toLocaleString("en-IN")}) exceeds the sanctioned amount (₹${project.sanctionedAmount.toLocaleString("en-IN")}).`,
        expectedValue: project.sanctionedAmount,
        actualValue: project.spentAmount,
        deviation: Number((project.spentAmount - project.sanctionedAmount).toFixed(0)),
        ruleId: rule.ruleId,
        source: "RULE_ENGINE",
        evidenceIds: [],
        parametersUsed: { sanctionedAmount: project.sanctionedAmount, spentAmount: project.spentAmount },
        recommendedAction: "Escalate to financial review immediately.",
      });
    }
    const hasApprovedTimelineException = ctx.approvedExceptions.some((ex) => ex.ruleId === "SANCTION_001");
    if (new Date() > project.endDate && project.status !== "COMPLETED" && !hasApprovedTimelineException) {
      results.push({
        category: rule.category,
        type: "SANCTION_TIMELINE_EXCEEDED",
        classification: rule.classification,
        severity: "MEDIUM",
        confidence: 0.8,
        title: "Project has run past its sanctioned end date",
        description: `Sanctioned end date (${project.endDate.toDateString()}) has passed and no timeline exception has been approved.`,
        expectedValue: project.endDate.toDateString(),
        actualValue: new Date().toDateString(),
        ruleId: rule.ruleId,
        source: "RULE_ENGINE",
        evidenceIds: [],
        parametersUsed: {},
        recommendedAction: "Request a timeline exception or escalate for review.",
      });
    }
    return results;
  });

  // CONDITION_001 — generic evaluation of officer-defined Conditions
  pushIfEnabled(findings, "CONDITION_001", (rule) => {
    const results: DraftFinding[] = [];
    const resolveActual = (parameter: string): number | undefined => {
      const map: Record<string, number> = {
        actualProgress: project.actualProgress,
        spentAmount: project.spentAmount,
        releasedAmount: project.releasedAmount,
        sanctionedAmount: project.sanctionedAmount,
        elapsedPercent: elapsed,
      };
      return map[parameter];
    };
    const compare = (operator: string, actual: number, expected: number): boolean => {
      switch (operator) {
        case ">": return actual > expected;
        case "<": return actual < expected;
        case ">=": return actual >= expected;
        case "<=": return actual <= expected;
        case "==": return actual === expected;
        case "!=": return actual !== expected;
        default: return false;
      }
    };
    for (const condition of ctx.conditions) {
      if (!condition.enabled) continue;
      const actual = resolveActual(condition.parameter);
      if (actual === undefined || typeof condition.expectedValue !== "number") continue;
      const satisfied = compare(condition.operator, actual, condition.expectedValue);
      if (satisfied) continue;
      results.push({
        category: rule.category,
        type: "CONDITION_NOT_MET",
        classification: rule.classification,
        severity: condition.severity,
        confidence: 0.85,
        title: `Officer-defined condition not met: ${condition.parameter}`,
        description: `Expected ${condition.parameter} ${condition.operator} ${condition.expectedValue}, but actual value is ${actual}.`,
        expectedValue: condition.expectedValue,
        actualValue: actual,
        ruleId: rule.ruleId,
        source: "RULE_ENGINE",
        evidenceIds: [],
        parametersUsed: { conditionId: condition._id.toString(), parameter: condition.parameter },
        recommendedAction: "Review the condition with the contractor and determine compliance status.",
      });
    }
    return results;
  });

  // VISIT_001 — Site Visit Compliance Violation
  pushIfEnabled(findings, "VISIT_001", (rule) => {
    const requiredVisits = ctx.sanction?.requiredVisits ?? 4;
    const actualVisits = ctx.siteVisits.filter((v) => v.status === "COMPLETED").length;
    const approvedExceptionCount = ctx.approvedExceptions
      .filter((ex) => ex.ruleId === "VISIT_001")
      .reduce((sum, ex) => sum + ex.requestedAdjustment, 0);
    const effectiveRequirement = Math.max(0, requiredVisits - approvedExceptionCount);
    const shortfall = effectiveRequirement - actualVisits;
    if (shortfall < rule.threshold) return null;
    return {
      category: rule.category,
      type: "VISIT_COMPLIANCE_VIOLATION",
      classification: rule.classification,
      severity: rule.severity,
      confidence: 0.85,
      title: "Required site visits not completed",
      description: `${actualVisits} of ${effectiveRequirement} required site visits completed (${requiredVisits} required, ${approvedExceptionCount} approved exception(s)).`,
      expectedValue: effectiveRequirement,
      actualValue: actualVisits,
      deviation: shortfall,
      ruleId: rule.ruleId,
      source: "RULE_ENGINE",
      evidenceIds: [],
      parametersUsed: { requiredVisits, actualVisits, approvedExceptionCount, effectiveRequirement },
      recommendedAction: "Request an explanation or schedule the outstanding site visits.",
    };
  });

  // DOCUMENT_001 — Document/Expenditure Amount Inconsistency
  pushIfEnabled(findings, "DOCUMENT_001", (rule) => {
    const results: DraftFinding[] = [];
    const docsById = new Map(ctx.documents.map((d) => [d._id.toString(), d]));
    for (const exp of ctx.expenditures) {
      for (const docId of exp.documentIds) {
        const doc = docsById.get(docId.toString());
        if (!doc || doc.amount === undefined) continue;
        const diff = Math.abs(doc.amount - exp.amount);
        if (diff <= rule.threshold) continue;
        results.push({
          category: rule.category,
          type: "DOCUMENT_AMOUNT_MISMATCH",
          classification: rule.classification,
          severity: rule.severity,
          confidence: 0.7,
          title: "Document amount does not match linked expenditure",
          description: `Document "${doc.fileName}" records ₹${doc.amount.toLocaleString("en-IN")} but the linked expenditure entry records ₹${exp.amount.toLocaleString("en-IN")}.`,
          expectedValue: exp.amount,
          actualValue: doc.amount,
          deviation: Number(diff.toFixed(0)),
          ruleId: rule.ruleId,
          source: "RULE_ENGINE",
          evidenceIds: [],
          parametersUsed: { documentId: doc._id.toString(), expenditureId: exp._id.toString() },
          recommendedAction: "Reconcile the document and expenditure amounts with the contractor.",
        });
      }
    }
    return results;
  });

  // CONTRACTOR_001 — Repeated Contractor Anomaly Pattern
  pushIfEnabled(findings, "CONTRACTOR_001", (rule) => {
    const { contractorProjectCount, contractorAnomalyRate } = ctx.contractorStats;
    if (contractorProjectCount < 2 || contractorAnomalyRate < rule.threshold) return null;
    return {
      category: rule.category,
      type: "CONTRACTOR_PATTERN",
      classification: rule.classification,
      severity: rule.severity,
      confidence: 0.7,
      title: "Contractor shows a repeated anomaly pattern across projects",
      description: `${contractorAnomalyRate.toFixed(0)}% of this contractor's ${contractorProjectCount} projects are flagged HIGH or CRITICAL risk, suggesting a systemic pattern rather than an isolated incident.`,
      expectedValue: `<${rule.threshold}%`,
      actualValue: `${contractorAnomalyRate.toFixed(0)}%`,
      ruleId: rule.ruleId,
      source: "RULE_ENGINE",
      evidenceIds: [],
      parametersUsed: { contractorProjectCount, contractorAnomalyRate },
      recommendedAction: "Review this contractor's full project portfolio for systemic issues.",
    };
  });

  return findings;
}
