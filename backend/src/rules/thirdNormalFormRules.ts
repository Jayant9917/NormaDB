import { NormalizationRule } from './ruleEngine';
import { DatabaseSchema, Violation } from '../types/schema';

export class NoTransitiveDependencyRule extends NormalizationRule {
  readonly normalForm = '3NF' as const;
  readonly name = 'No Transitive Dependencies';
  readonly description = 'Non-key attributes must not depend on other non-key attributes';
  readonly weight = 1.0;
  
  check(schema: DatabaseSchema): Violation[] {
    const violations: Violation[] = [];
    
    for (const [tableName, table] of Object.entries(schema.tables)) {
      if (table.primaryKeys.length === 0) {
        continue;
      }
      
      const nonKeyColumns = this.getNonKeyColumns(schema, tableName);
      
      for (const column of nonKeyColumns) {
        const transitiveCandidates = this.findTransitiveDependencyCandidates(column, nonKeyColumns);
        
        for (const candidate of transitiveCandidates) {
          const confidence = this.assessTransitiveDependencyConfidence(column.name, candidate);
          
          if (confidence > 0.5) {
            violations.push(this.createViolation(
              tableName,
              column.name,
              `Column '${column.name}' may have transitive dependency on '${candidate}'`,
              'Third Normal Form requires that non-key attributes do not depend on other non-key attributes.',
              `Consider creating a separate table for '${candidate}' and related attributes`,
              'WARNING',
              confidence
            ));
          }
        }
      }
    }
    
    return violations;
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
  
  private assessTransitiveDependencyConfidence(columnName: string, candidateName: string): number {
    let confidence = 0.0;
    
    const column = columnName.toLowerCase();
    const candidate = candidateName.toLowerCase();
    
    if (column.includes(candidate.replace(/_id$/, '').replace(/_code$/, ''))) {
      confidence += 0.8;
    }
    
    if (this.isAttributeOfEntity(column, candidate)) {
      confidence += 0.6;
    }
    
    if (this.isCommonTransitivePair(column, candidate)) {
      confidence += 0.7;
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

export class BoyceCoddRule extends NormalizationRule {
  readonly normalForm = '3NF' as const;
  readonly name = 'Boyce-Codd Normal Form Check';
  readonly description = 'Every determinant must be a candidate key';
  readonly weight = 0.9;
  
  check(schema: DatabaseSchema): Violation[] {
    const violations: Violation[] = [];
    
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
        }
      }
    }
    
    return violations;
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
