import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { DatabaseAnalyzer } from './analyzer/databaseAnalyzer';
import { DumpParser } from './parser/dumpParser';

const app = express();
const port = process.env.PORT || 3001;
const analyzer = new DatabaseAnalyzer();
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend', 'build');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(frontendPath));

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.sql')) {
      cb(null, true);
    } else {
      cb(new Error('Only .sql files are allowed'));
    }
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/features', (req, res) => {
  try {
    const features = analyzer.getSupportedFeatures();
    res.json(features);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get features',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/debug/scoring', (req, res) => {
  try {
    const { sqlContent } = req.query;
    
    if (!sqlContent || typeof sqlContent !== 'string') {
      return res.status(400).json({ 
        error: 'SQL content query parameter is required' 
      });
    }
    
    const report = analyzer.analyzeSQL(sqlContent);
    
    // Debug scoring breakdown
    const debugInfo = {
      scoringModel: 'rule-relative',
      normalForms: {
        '1NF': {
          maxWeight: report.compliance['1NF'].maxWeight,
          violatedWeight: report.compliance['1NF'].violatedWeight,
          rulesEvaluated: report.compliance['1NF'].rulesEvaluated,
          score: report.compliance['1NF'].score,
          calculation: `((${report.compliance['1NF'].maxWeight} - ${report.compliance['1NF'].violatedWeight}) / ${report.compliance['1NF'].maxWeight}) * 100`
        },
        '2NF': {
          maxWeight: report.compliance['2NF'].maxWeight,
          violatedWeight: report.compliance['2NF'].violatedWeight,
          rulesEvaluated: report.compliance['2NF'].rulesEvaluated,
          score: report.compliance['2NF'].score,
          calculation: `((${report.compliance['2NF'].maxWeight} - ${report.compliance['2NF'].violatedWeight}) / ${report.compliance['2NF'].maxWeight}) * 100`
        },
        '3NF': {
          maxWeight: report.compliance['3NF'].maxWeight,
          violatedWeight: report.compliance['3NF'].violatedWeight,
          rulesEvaluated: report.compliance['3NF'].rulesEvaluated,
          score: report.compliance['3NF'].score,
          calculation: `((${report.compliance['3NF'].maxWeight} - ${report.compliance['3NF'].violatedWeight}) / ${report.compliance['3NF'].maxWeight}) * 100`
        }
      },
      overall: {
        calculation: `(${report.compliance['1NF'].score} * 0.5) + (${report.compliance['2NF'].score} * 0.3) + (${report.compliance['3NF'].score} * 0.2)`,
        result: report.overallScore
      }
    };
    
    res.json(debugInfo);
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Debug analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/analyze', (req, res) => {
  try {
    const { sqlContent } = req.body;
    
    if (!sqlContent || typeof sqlContent !== 'string') {
      return res.status(400).json({ 
        error: 'SQL content is required and must be a string' 
      });
    }
    
    const validation = analyzer.validateSQL(sqlContent);
    
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid SQL',
        details: validation.errors
      });
    }
    
    const report = analyzer.analyzeSQL(sqlContent);
    
    // Add rule-relative scoring context
    const enhancedReport = {
      ...report,
      scoringModel: {
        type: 'rule-relative',
        description: 'Scores are calculated relative to implemented rules, not absolute percentages',
        version: '1.0'
      }
    };
    
    res.json({
      success: true,
      report: enhancedReport,
      warnings: validation.warnings
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/analyze-file', upload.single('sqlFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded' 
      });
    }
    
    const sqlContent = req.file.buffer.toString('utf-8');
    
    const validation = analyzer.validateSQL(sqlContent);
    
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid SQL',
        details: validation.errors
      });
    }
    
    const report = analyzer.analyzeSQL(sqlContent);
    
    res.json({
      success: true,
      report,
      warnings: validation.warnings,
      fileName: req.file.originalname
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// New endpoint for dump file analysis
app.post('/api/analyze-dump', (req, res) => {
  try {
    const { dumpContent } = req.body;
    
    if (!dumpContent || typeof dumpContent !== 'string') {
      return res.status(400).json({ 
        error: 'Dump content is required and must be a string' 
      });
    }
    
    // Analyze the dump file
    const report = analyzer.analyzeDumpFile(dumpContent);
    
    res.json({
      success: true,
      report: {
        ...report,
        dumpParseResult: report.dumpParseResult,
        analysisNotes: report.analysisNotes
      },
      dumpInfo: {
        format: report.dumpParseResult.metadata.detectedFormat,
        originalSize: report.dumpParseResult.metadata.totalSize,
        extractedSize: report.dumpParseResult.metadata.extractedSize,
        tablesExtracted: report.dumpParseResult.tables.length,
        errors: report.dumpParseResult.errors
      }
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Dump analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// New multi-schema analysis endpoints
app.post('/api/analyze-schemas', (req, res) => {
  try {
    const { sqlContent } = req.body;
    
    if (!sqlContent || typeof sqlContent !== 'string') {
      return res.status(400).json({ 
        error: 'SQL content is required and must be a string' 
      });
    }
    
    const validation = analyzer.validateSQL(sqlContent);
    
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid SQL',
        details: validation.errors
      });
    }
    
    const report = analyzer.analyzeSQLWithSchemas(sqlContent);
    
    res.json({
      success: true,
      summary: {
        totalSchemas: report.totalSchemas,
        totalTables: report.totalTables,
        overallScore: report.overallScore
      },
      schemas: report.schemas,
      warnings: validation.warnings
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Multi-schema analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/analyze-dump-schemas', (req, res) => {
  try {
    const { dumpContent } = req.body;
    
    if (!dumpContent || typeof dumpContent !== 'string') {
      return res.status(400).json({ 
        error: 'Dump content is required and must be a string' 
      });
    }
    
    // API decides the parser, NOT the analyzer
    const dumpResult = DumpParser.parseDumpFile(dumpContent);
    
    if (!dumpResult.success) {
      throw new Error(`Failed to parse dump file: ${dumpResult.errors.join(', ')}`);
    }
    
    // Create analysis input - CLEAN ARCHITECTURE
    const analysisInput = {
      tables: dumpResult.tables,
      metadata: {
        dialect: 'postgres' as const,
        sourceType: 'dump' as const
      }
    };
    
    // SINGLE ENTRY POINT - no guessing, no fallback
    const report = analyzer.analyze(analysisInput);
    
    res.json({
      success: true,
      summary: {
        totalSchemas: report.totalSchemas,
        totalTables: report.totalTables,
        overallScore: report.overallScore
      },
      schemas: report.schemas,
      dumpInfo: {
        format: dumpResult.metadata.detectedFormat,
        originalSize: dumpResult.metadata.totalSize,
        extractedSize: dumpResult.metadata.extractedSize,
        tablesExtracted: dumpResult.tables.length,
        errors: dumpResult.errors
      },
      analysisNotes: [
        `Analyzed PostgreSQL dump file (${dumpResult.metadata.detectedFormat} format)`,
        `Extracted ${dumpResult.tables.length} tables from dump`,
        `Dump size: ${(dumpResult.metadata.totalSize / 1024).toFixed(2)}KB, Extracted: ${(dumpResult.metadata.extractedSize / 1024).toFixed(2)}KB`,
        ...(dumpResult.errors.length > 0 ? [`Warnings: ${dumpResult.errors.join(', ')}`] : [])
      ]
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Multi-schema dump analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/validate', (req, res) => {
  try {
    const { sqlContent } = req.body;
    
    if (!sqlContent || typeof sqlContent !== 'string') {
      return res.status(400).json({ 
        error: 'SQL content is required and must be a string' 
      });
    }
    
    const validation = analyzer.validateSQL(sqlContent);
    
    res.json(validation);
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
    }
  }
  
  if (error.message === 'Only .sql files are allowed') {
    return res.status(400).json({ error: error.message });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message || 'Unknown error occurred'
  });
});

app.listen(port, () => {
  console.log(`Database Normalization Analyzer API running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/api/health`);
});
