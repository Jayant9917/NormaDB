export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
  unique: boolean;
}

export interface Table {
  name: string;
  columns: Record<string, Column>;
  primaryKeys: string[];
  foreignKeys: Array<{
    column: string;
    referencesTable: string;
    referencesColumn: string;
  }>;
  uniqueConstraints: string[][];
}

export interface DatabaseSchema {
  tables: Record<string, Table>;
}

export interface Violation {
  normalForm: '1NF' | '2NF' | '3NF';
  table: string;
  column?: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  explanation: string;
  suggestion: string;
  confidence: number;
}

export interface ComplianceScore {
  normalForm: '1NF' | '2NF' | '3NF';
  score: number;
  totalRules: number;
  passedRules: number;
  violations: Violation[];
}

export interface AnalysisReport {
  schema: DatabaseSchema;
  compliance: {
    '1NF': ComplianceScore;
    '2NF': ComplianceScore;
    '3NF': ComplianceScore;
  };
  overallScore: number;
  summary: {
    totalViolations: number;
    criticalViolations: number;
    warnings: number;
  };
}
