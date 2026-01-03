import { DatabaseSchema, Violation, ComplianceScore, AnalysisReport } from '../types/schema';
import { NormalizationRule, RuleResult } from '../rules/normalizationRule';

export class ComplianceCalculator {
  private rules: Map<string, NormalizationRule> = new Map();
  
  addRule(rule: NormalizationRule): void {
    this.rules.set(`${rule.normalForm}-${rule.name}`, rule);
  }
  
  calculateCompliance(schema: DatabaseSchema): AnalysisReport {
    const violations = this.evaluateAllRules(schema);
    
    const compliance1NF = this.calculateNormalFormCompliance('1NF', violations['1NF'], schema);
    const compliance2NF = this.calculateNormalFormCompliance('2NF', violations['2NF'], schema);
    const compliance3NF = this.calculateNormalFormCompliance('3NF', violations['3NF'], schema);
    
    const overallScore = this.calculateOverallScore(compliance1NF, compliance2NF, compliance3NF);
    
    const summary = this.generateSummary(violations);
    
    return {
      schema,
      compliance: {
        '1NF': compliance1NF,
        '2NF': compliance2NF,
        '3NF': compliance3NF
      },
      overallScore,
      summary
    };
  }
  
  private evaluateAllRules(schema: DatabaseSchema): {
    '1NF': Violation[];
    '2NF': Violation[];
    '3NF': Violation[];
  } {
    const result = {
      '1NF': [] as Violation[],
      '2NF': [] as Violation[],
      '3NF': [] as Violation[]
    };
    
    for (const rule of this.rules.values()) {
      try {
        const ruleResult: RuleResult = rule.evaluate(schema);
        result[rule.normalForm].push(...ruleResult.violations);
      } catch (error) {
        console.error(`Error in rule ${rule.name}:`, error);
      }
    }
    
    return result;
  }
  
  private calculateNormalFormCompliance(
    normalForm: '1NF' | '2NF' | '3NF',
    violations: Violation[],
    schema: DatabaseSchema
  ): ComplianceScore {
    const normalFormRules = Array.from(this.rules.values())
      .filter(rule => rule.normalForm === normalForm);
    
    const maxWeight = normalFormRules.reduce((sum, rule) => sum + rule.weight, 0);
    const weightedViolations = this.calculateWeightedViolations(violations, normalForm);
    
    const score = Math.max(0, Math.min(100, 
      ((maxWeight - weightedViolations) / maxWeight) * 100
    ));
    
    return {
      normalForm,
      score: Math.round(score * 100) / 100,
      totalRules: normalFormRules.length,
      passedRules: Math.max(0, normalFormRules.length - this.getUniqueRuleCount(violations, normalForm)),
      violations,
      maxWeight: Math.round(maxWeight * 100) / 100,
      violatedWeight: Math.round(weightedViolations * 100) / 100,
      rulesEvaluated: normalFormRules.length
    };
  }
  
  private calculateWeightedViolations(violations: Violation[], normalForm: '1NF' | '2NF' | '3NF'): number {
    // Calculate weight based on the specific rules violated
    let totalWeight = 0;
    
    for (const violation of violations) {
      if (violation.normalForm === normalForm) {
        // Find the rule that generated this violation
        const rule = this.findRuleByViolation(violation);
        if (rule) {
          totalWeight += rule.weight;
        }
      }
    }
    
    return totalWeight;
  }
  
  private findRuleByViolation(violation: Violation): NormalizationRule | undefined {
    for (const rule of this.rules.values()) {
      if (rule.normalForm === violation.normalForm) {
        // Match violations to rules based on message content
        if (this.matchesRule(violation, rule)) {
          return rule;
        }
      }
    }
    return undefined;
  }
  
  private matchesRule(violation: Violation, rule: NormalizationRule): boolean {
    const message = violation.message.toLowerCase();
    const ruleName = rule.name.toLowerCase();
    
    // 1NF rule matching
    if (rule.normalForm === '1NF') {
      if (ruleName === 'no repeating groups') {
        return message.includes('json') || message.includes('array');
      }
      if (ruleName === 'atomic values') {
        return message.includes('multi-value') || message.includes('atomic');
      }
      if (ruleName === 'primary key required') {
        return message.includes('no primary key') || message.includes('has no primary key');
      }
    }
    
    // 2NF rule matching
    if (rule.normalForm === '2NF') {
      if (ruleName === 'no partial dependencies') {
        return message.includes('partial dependency');
      }
      if (ruleName === 'full functional dependency') {
        return message.includes('full functional dependency');
      }
    }
    
    // 3NF rule matching
    if (rule.normalForm === '3NF') {
      if (ruleName === 'no transitive dependencies') {
        return message.includes('determinant') || message.includes('transitive');
      }
      if (ruleName === 'boyce-codd normal form check') {
        return message.includes('determinant') || message.includes('candidate key');
      }
    }
    
    return false;
  }
  
  private getUniqueRuleCount(violations: Violation[], normalForm: '1NF' | '2NF' | '3NF'): number {
    const ruleNames = new Set();
    for (const violation of violations) {
      if (violation.normalForm === normalForm) {
        const rule = this.findRuleByViolation(violation);
        if (rule) {
          ruleNames.add(rule.name);
        }
      }
    }
    return ruleNames.size;
  }
  
  private calculateOverallScore(
    compliance1NF: ComplianceScore,
    compliance2NF: ComplianceScore,
    compliance3NF: ComplianceScore
  ): number {
    const weights = {
      '1NF': 0.5,
      '2NF': 0.3,
      '3NF': 0.2
    };
    
    const overallScore = 
      (compliance1NF.score * weights['1NF']) +
      (compliance2NF.score * weights['2NF']) +
      (compliance3NF.score * weights['3NF']);
    
    return Math.round(overallScore * 100) / 100;
  }
  
  private generateSummary(violations: {
    '1NF': Violation[];
    '2NF': Violation[];
    '3NF': Violation[];
  }) {
    const allViolations = [
      ...violations['1NF'],
      ...violations['2NF'],
      ...violations['3NF']
    ];
    
    const criticalViolations = allViolations.filter(v => v.severity === 'ERROR').length;
    const warnings = allViolations.filter(v => v.severity === 'WARNING').length;
    
    return {
      totalViolations: allViolations.length,
      criticalViolations,
      warnings
    };
  }
  
  // Explainability methods
  getRuleExplanation(normalForm: '1NF' | '2NF' | '3NF', ruleName: string) {
    const rule = this.rules.get(`${normalForm}-${ruleName}`);
    return rule ? rule.getExplanation() : null;
  }
  
  getHighestWeightViolation(violations: Violation[]): Violation | null {
    if (violations.length === 0) return null;
    
    let highestWeightViolation = violations[0];
    let highestWeight = 0;
    
    for (const violation of violations) {
      const rule = this.findRuleByViolation(violation);
      if (rule && rule.weight > highestWeight) {
        highestWeight = rule.weight;
        highestWeightViolation = violation;
      }
    }
    
    return highestWeightViolation;
  }
  
  getFixRecommendations(violations: Violation[]): string[] {
    const recommendations: string[] = [];
    const processedRules = new Set();
    
    // Sort violations by weight (highest first)
    const sortedViolations = violations
      .map(v => ({ violation: v, rule: this.findRuleByViolation(v) }))
      .filter(item => item.rule !== undefined)
      .sort((a, b) => (b.rule?.weight || 0) - (a.rule?.weight || 0));
    
    for (const { violation, rule } of sortedViolations) {
      if (rule && !processedRules.has(rule.name)) {
        const explanation = rule.getExplanation();
        recommendations.push(explanation.whatToFixFirst);
        processedRules.add(rule.name);
      }
    }
    
    return recommendations;
  }
}
