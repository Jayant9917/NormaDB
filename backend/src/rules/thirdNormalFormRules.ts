import { BaseNormalizationRule, RuleResult } from './normalizationRule';
import { DatabaseSchema, Violation } from '../types/schema';

export class NoTransitiveDependencyRule extends BaseNormalizationRule {
  readonly normalForm = '3NF' as const;
  readonly name = 'No Transitive Dependencies';
  readonly description = 'Non-key attributes must not depend on other non-key attributes';
  readonly weight = 0.5;
  
  evaluate(schema: DatabaseSchema): RuleResult {
    const violations: Violation[] = [];
    let hasViolations = false;
    
    for (const [tableName, table] of Object.entries(schema.tables)) {
      if (table.primaryKeys.length === 0) {
        continue;
      }
      
      const nonKeyColumns = this.getNonKeyColumns(schema, tableName);
      
      for (const column of nonKeyColumns) {
        const confidence = this.assessTransitiveDependencyConfidence(column, table);
        
        if (confidence > 0.6) {
          violations.push(this.createViolation(
            tableName,
            column.name,
            `Column '${column.name}' appears to be a determinant but not a candidate key`,
            'Third Normal Form requires that non-key attributes do not depend on other non-key attributes.',
            `Consider moving '${column.name}' to a separate table to eliminate transitive dependency`,
            'WARNING',
            confidence
          ));
          hasViolations = true;
        }
      }
    }
    
    return {
      scoreContribution: hasViolations ? 0 : 1,
      violations,
      confidence: 0.7, // This is a heuristic rule
      explanation: hasViolations 
        ? 'Some columns may have transitive dependencies on other non-key attributes'
        : 'No transitive dependencies detected'
    };
  }
  
  getExplanation() {
    return {
      whyThisFails: 'Some non-key attributes may depend on other non-key attributes rather than directly on the primary key.',
      whatToFixFirst: 'Move transitive dependencies to separate tables to eliminate the dependency chain.',
      exampleFixSQL: `-- Instead of:
CREATE TABLE users (id SERIAL PRIMARY KEY, department_id INTEGER, department_name TEXT);
-- Use:
CREATE TABLE users (id SERIAL PRIMARY KEY, department_id INTEGER);
CREATE TABLE departments (id SERIAL PRIMARY KEY, name TEXT);`,
      impact: 'Medium (50%)'
    };
  }
  
  private findTransitiveDependencyCandidates(column: any, nonKeyColumns: any[]): string[] {
    const candidates: string[] = [];
    const columnName = column.name.toLowerCase();
    
    for (const otherColumn of nonKeyColumns) {
      if (otherColumn.name === column.name) continue;
      
      const otherName = otherColumn.name.toLowerCase();
      
      if (this.isCandidateKey(otherName) || this.isCommonReference(otherName)) {
        candidates.push(otherColumn.name);
      }
    }
    
    return candidates;
  }
  
  private isCandidateKey(columnName: string): boolean {
    const keyPatterns = [
      /_id$/,
      /_code$/,
      /_type$/,
      /_status$/,
      /category$/i,
      /type$/i,
      /status$/i
    ];
    
    return keyPatterns.some(pattern => pattern.test(columnName));
  }
  
  private isCommonReference(columnName: string): boolean {
    const referencePatterns = [
      /country$/i,
      /state$/i,
      /city$/i,
      /department$/i,
      /location$/i,
      /region$/i
    ];
    
    return referencePatterns.some(pattern => pattern.test(columnName));
  }
  
  private assessTransitiveDependencyConfidence(column: any, table: any): number {
    let confidence = 0.0;
    
    const columnName = column.name.toLowerCase();
    const nonKeyColumns = this.getNonKeyColumns({ tables: { [table.name]: table } }, table.name);
    
    const candidates = this.findTransitiveDependencyCandidates(column, nonKeyColumns);
    
    for (const candidate of candidates) {
      const candidateConfidence = this.assessTransitiveDependencyConfidence(columnName, candidate);
      confidence = Math.max(confidence, candidateConfidence);
    }
    
    return Math.min(confidence, 1.0);
  }
  
  private isAttributeOfEntity(column: string, candidate: string): boolean {
    const entityAttributes: Record<string, string[]> = {
      'country': ['country_code', 'country_name', 'currency', 'continent'],
      'state': ['state_code', 'state_name', 'region'],
      'city': ['city_name', 'zipcode', 'population'],
      'department': ['dept_name', 'manager', 'budget'],
      'category': ['category_name', 'description', 'parent_id']
    };
    
    const attributes = entityAttributes[candidate] || [];
    return attributes.includes(column);
  }
  
  private isCommonTransitivePair(column: string, candidate: string): boolean {
    const transitivePairs = [
      ['country', 'currency'],
      ['country', 'continent'],
      ['state', 'country'],
      ['city', 'state'],
      ['city', 'country'],
      ['department', 'manager'],
      ['category', 'description']
    ];
    
    return transitivePairs.some(([cand, attr]) => 
      (candidate.includes(cand) && column.includes(attr)) ||
      (candidate.includes(attr) && column.includes(cand))
    );
  }
}

export class BoyceCoddRule extends BaseNormalizationRule {
  readonly normalForm = '3NF' as const;
  readonly name = 'Boyce-Codd Normal Form Check';
  readonly description = 'Every determinant must be a candidate key';
  readonly weight = 0.5;
  
  evaluate(schema: DatabaseSchema): RuleResult {
    const violations: Violation[] = [];
    let hasViolations = false;
    
    for (const [tableName, table] of Object.entries(schema.tables)) {
      const candidateKeys = this.identifyCandidateKeys(table);
      
      for (const column of Object.values(table.columns)) {
        if (this.isLikelyDeterminant(column.name) && !this.isCandidateKey(column.name, candidateKeys)) {
          violations.push(this.createViolation(
            tableName,
            column.name,
            `Column '${column.name}' appears to be a determinant but not a candidate key`,
            'Boyce-Codd Normal Form requires that every determinant (attribute that determines another) be a candidate key.',
            `Consider making '${column.name}' a candidate key or normalizing the table structure`,
            'WARNING',
            0.7
          ));
          hasViolations = true;
        }
      }
    }
    
    return {
      scoreContribution: hasViolations ? 0 : 1,
      violations,
      confidence: 0.7, // This is a heuristic rule
      explanation: hasViolations 
        ? 'Some columns appear to be determinants but are not candidate keys'
        : 'All determinants appear to be candidate keys'
    };
  }
  
  getExplanation() {
    return {
      whyThisFails: 'Some columns appear to be determinants (attributes that determine others) but are not candidate keys.',
      whatToFixFirst: 'Make determinant columns candidate keys or normalize the table structure.',
      exampleFixSQL: `-- Add unique constraint to make email a candidate key:
CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE);
-- Or normalize into separate tables if appropriate`,
      impact: 'Medium (50%)'
    };
  }
  
  private identifyCandidateKeys(table: any): string[] {
    const candidateKeys = [...table.primaryKeys];
    
    for (const [columnName, column] of Object.entries(table.columns)) {
      if ((column as any).unique && !candidateKeys.includes(columnName)) {
        candidateKeys.push(columnName);
      }
    }
    
    for (const constraint of table.uniqueConstraints) {
      if (constraint.length === 1) {
        const columnName = constraint[0];
        if (!candidateKeys.includes(columnName)) {
          candidateKeys.push(columnName);
        }
      }
    }
    
    return candidateKeys;
  }
  
  private isCandidateKey(columnName: string, candidateKeys: string[]): boolean {
    return candidateKeys.includes(columnName);
  }
  
  private isLikelyDeterminant(columnName: string): boolean {
    const determinantPatterns = [
      /_id$/,
      /_code$/,
      /_type$/,
      /email$/i,
      /username$/i,
      /ssn$/i,
      /tax_id$/i
    ];
    
    return determinantPatterns.some(pattern => pattern.test(columnName));
  }
}
