# Normalization Scoring Model (Version-1)

## Overview

Scores are calculated relative to the total weight of implemented rules for that normal form.

This means:
- Scores are NOT absolute percentages of 100
- Scores represent compliance against known rules
- Adding new rules will change max possible score

## Formula

```
score = ((maxWeight - violationWeight) / maxWeight) * 100
```

Where:
- `maxWeight` = Sum of all implemented rule weights for the normal form
- `violationWeight` = Sum of weights for rules that were violated

## Rule Weights (Version-1)

### 1NF Rules
- Primary Key Required: 0.40 (40%)
- No JSON/JSONB Columns: 0.25 (25%)
- No ARRAY Columns: 0.25 (25%)
- No Multi-valued Naming: 0.10 (10%)
- **Total Max Weight: 0.75**

### 2NF Rules
- No Partial Dependencies: 0.60 (60%)
- Full Functional Dependency: 0.40 (40%)
- **Total Max Weight: 1.00**

### 3NF Rules
- No Transitive Dependencies: 0.50 (50%)
- Boyce-Codd Normal Form: 0.50 (50%)
- **Total Max Weight: 1.00**

## Overall Score Calculation

Overall score is weighted across normal forms:
- 1NF: 50% weight
- 2NF: 30% weight
- 3NF: 20% weight

```
overallScore = (1NF_score * 0.5) + (2NF_score * 0.3) + (3NF_score * 0.2)
```

## Deterministic Scoring Policy (Version-1)

### PASS/FAIL Thresholds

- **PASS**: score ≥ 90%
- **WARNING**: 70% ≤ score < 90%
- **FAIL**: score < 70%

### Violation Impact Rules

1. **ERROR violations always fail**: Any ERROR severity violation causes the normal form to FAIL
2. **WARNING-only evaluation**: If only WARNING violations exist, score can still PASS if ≥ 90%
3. **Confidence does not reduce penalty**: All violations deduct full rule weight regardless of confidence
4. **Multiple violations per column**: Multiple rules can penalize the same column independently
5. **ERROR suppresses WARNING**: If a column has both ERROR and WARNING violations, only ERROR is counted

### Rule Conflict Handling

```typescript
// Rule conflict resolution logic
if (hasErrorViolation(column)) {
  suppressWarnings(column); // Only count ERROR violations
}

// Multiple rules can penalize same column
if (violatesArrayRule(column) && violatesNamingRule(column)) {
  totalPenalty += arrayRule.weight + namingRule.weight;
}
```

## Example Calculation

For a table with JSON violation (1NF):
- maxWeight = 0.75
- violationWeight = 0.25 (WARNING from No JSON rule)
- score = ((0.75 - 0.25) / 0.75) * 100 = 66.67%
- **Result: FAIL** (below 70% threshold)

## Important Notes

1. **Rule-relative scoring**: Scores represent compliance against implemented rules only
2. **Extensibility**: Adding new rules changes max weight and therefore scores
3. **Binary violations**: Rules either pass or fail their full weight (confidence is for UI display only)
4. **Heuristic rules**: Low confidence rules are marked as WARNING but still fail their full weight
5. **Deterministic**: Same input always produces same score and violations

## Version-1 Contract

- ✅ Scoring logic is frozen
- ✅ Rule weights are final
- ✅ Formula is documented
- ✅ Behavior is deterministic and explainable
- ✅ PASS/FAIL thresholds are locked

Changes to this model require a version increment.

## Why This Schema Failed

When someone questions results, answer with this exact process:

1. **Check rule weights**: Sum weights of implemented rules for the normal form
2. **Identify violations**: List which rules failed and their weights
3. **Apply formula**: `((maxWeight - violationWeight) / maxWeight) * 100`
4. **Check threshold**: Compare result against PASS/FAIL thresholds
5. **Explain conflicts**: Note any rule conflicts or suppressions

Example:
> "Your schema scored 66.67% on 1NF because:
> - Max weight: 0.75 (3 rules)
> - Violations: JSON column (0.25 weight)
> - Calculation: ((0.75 - 0.25) / 0.75) × 100 = 66.67%
> - Result: FAIL (below 70% threshold)"
