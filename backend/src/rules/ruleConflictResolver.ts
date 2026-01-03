import { Violation } from '../types/schema';

export interface ColumnViolations {
  column: string;
  table: string;
  errors: Violation[];
  warnings: Violation[];
}

export class RuleConflictResolver {
  /**
   * Resolves rule conflicts according to Version-1 policy:
   * - ERROR suppresses WARNING for same column
   * - Multiple rules can penalize same column independently
   * - Confidence does not affect penalty
   */
  resolveConflicts(violations: Violation[]): Violation[] {
    // Group violations by column
    const columnGroups = this.groupByColumn(violations);
    
    const resolvedViolations: Violation[] = [];
    
    for (const group of columnGroups) {
      const resolved = this.resolveColumnConflicts(group);
      resolvedViolations.push(...resolved);
    }
    
    return resolvedViolations;
  }
  
  private groupByColumn(violations: Violation[]): ColumnViolations[] {
    const columnMap = new Map<string, ColumnViolations>();
    
    for (const violation of violations) {
      const key = `${violation.table}-${violation.column || 'table-level'}`;
      
      if (!columnMap.has(key)) {
        columnMap.set(key, {
          table: violation.table,
          column: violation.column || 'table-level',
          errors: [],
          warnings: []
        });
      }
      
      const group = columnMap.get(key)!;
      
      if (violation.severity === 'ERROR') {
        group.errors.push(violation);
      } else {
        group.warnings.push(violation);
      }
    }
    
    return Array.from(columnMap.values());
  }
  
  private resolveColumnConflicts(group: ColumnViolations): Violation[] {
    // Policy 1: ERROR suppresses WARNING for same column
    if (group.errors.length > 0) {
      return group.errors; // Only return ERROR violations
    }
    
    // Policy 2: Multiple rules can penalize same column independently
    // Return all WARNING violations (no suppression needed)
    return group.warnings;
  }
  
  /**
   * Applies rule conflict resolution and returns detailed analysis
   */
  analyzeConflicts(violations: Violation[]): {
    resolved: Violation[];
    suppressed: Violation[];
    analysis: {
      totalColumns: number;
      columnsWithErrors: number;
      columnsWithWarnings: number;
      suppressedWarnings: number;
    };
  } {
    const columnGroups = this.groupByColumn(violations);
    const resolved: Violation[] = [];
    const suppressed: Violation[] = [];
    
    let columnsWithErrors = 0;
    let columnsWithWarnings = 0;
    let suppressedWarnings = 0;
    
    for (const group of columnGroups) {
      if (group.errors.length > 0) {
        resolved.push(...group.errors);
        columnsWithErrors++;
        // All warnings for this column are suppressed
        suppressed.push(...group.warnings);
        suppressedWarnings += group.warnings.length;
      } else {
        resolved.push(...group.warnings);
        if (group.warnings.length > 0) {
          columnsWithWarnings++;
        }
      }
    }
    
    return {
      resolved,
      suppressed,
      analysis: {
        totalColumns: columnGroups.length,
        columnsWithErrors,
        columnsWithWarnings,
        suppressedWarnings
      }
    };
  }
  
  /**
   * Determines if a normal form passes based on resolved violations
   */
  calculateNormalFormStatus(resolvedViolations: Violation[]): {
    status: 'PASS' | 'WARNING' | 'FAIL';
    score: number;
    reason: string;
  } {
    const hasErrors = resolvedViolations.some(v => v.severity === 'ERROR');
    
    if (hasErrors) {
      return {
        status: 'FAIL',
        score: 0,
        reason: 'Contains ERROR severity violations'
      };
    }
    
    // If only warnings, calculate score based on rule weights
    // This would be handled by the compliance calculator
    const warningCount = resolvedViolations.length;
    
    if (warningCount === 0) {
      return {
        status: 'PASS',
        score: 100,
        reason: 'No violations detected'
      };
    }
    
    return {
      status: 'WARNING',
      score: 0, // Would be calculated by compliance calculator
      reason: `Contains ${warningCount} WARNING severity violation(s)`
    };
  }
}
