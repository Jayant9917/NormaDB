import { DatabaseSchema, Violation, ComplianceScore, AnalysisReport } from '../types/schema';
import { RuleEngine } from '../rules/ruleEngine';

export class ComplianceCalculator {
  private ruleEngine: RuleEngine;
  
  constructor(ruleEngine: RuleEngine) {
    this.ruleEngine = ruleEngine;
  }
  
  calculateCompliance(schema: DatabaseSchema): AnalysisReport {
    const violations = this.ruleEngine.analyzeSchema(schema);
    
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
  
  private calculateNormalFormCompliance(
    normalForm: '1NF' | '2NF' | '3NF',
    violations: Violation[],
    schema: DatabaseSchema
  ): ComplianceScore {
    const totalRules = this.ruleEngine.getTotalRules(normalForm);
    const weightedViolations = this.calculateWeightedViolations(violations);
    const maxWeight = this.ruleEngine.getRulesByNormalForm(normalForm)
      .reduce((sum, rule) => sum + rule.weight, 0);
    
    const score = Math.max(0, Math.min(100, 
      ((maxWeight - weightedViolations) / maxWeight) * 100
    ));
    
    return {
      normalForm,
      score: Math.round(score * 100) / 100,
      totalRules,
      passedRules: Math.max(0, totalRules - violations.length),
      violations
    };
  }
  
  private calculateWeightedViolations(violations: Violation[]): number {
    return violations.reduce((total, violation) => {
      const weight = this.getViolationWeight(violation);
      return total + (weight * violation.confidence);
    }, 0);
  }
  
  private getViolationWeight(violation: Violation): number {
    if (violation.severity === 'ERROR') {
      return 1.0;
    } else if (violation.severity === 'WARNING') {
      return 0.5;
    }
    return 0.25;
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
  
  generateRecommendations(report: AnalysisReport): string[] {
    const recommendations: string[] = [];
    
    if (report.compliance['1NF'].score < 100) {
      const critical1NF = report.compliance['1NF'].violations.filter(v => v.severity === 'ERROR');
      if (critical1NF.length > 0) {
        recommendations.push('Address First Normal Form violations first - ensure all tables have primary keys and atomic values');
      }
    }
    
    if (report.compliance['2NF'].score < 90) {
      recommendations.push('Review Second Normal Form compliance - check for partial dependencies in tables with composite keys');
    }
    
    if (report.compliance['3NF'].score < 85) {
      recommendations.push('Consider Third Normal Form improvements - eliminate transitive dependencies by creating separate tables');
    }
    
    if (report.overallScore > 90) {
      recommendations.push('Schema is well-normalized. Consider maintaining current structure for future changes.');
    }
    
    return recommendations;
  }
}
