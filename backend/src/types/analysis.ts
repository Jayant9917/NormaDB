export interface NormalizationViolation {
  normalForm: '1NF' | '2NF' | '3NF';
  table: string;
  column?: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  explanation: string;
  suggestion: string;
  confidence: number;
}

export interface SchemaAnalysisResult {
  schemaName: string;
  tableCount: number;
  normalization: {
    "1NF": {
      score: number;
      violatedTables: number;
      totalTables: number;
    };
    "2NF": {
      score: number;
      violatedTables: number;
      totalTables: number;
    };
    "3NF": {
      score: number;
      violatedTables: number;
      totalTables: number;
    };
  };
  violations: NormalizationViolation[];
  overallScore: number;
  status: "PERFECT" | "GOOD" | "NEEDS_ATTENTION" | "CRITICAL";
}

export interface DatabaseAnalysisResult {
  totalSchemas: number;
  totalTables: number;
  overallScore: number;
  schemas: SchemaAnalysisResult[];
}
