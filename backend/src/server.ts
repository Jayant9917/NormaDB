import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { DatabaseAnalyzer } from './analyzer/databaseAnalyzer';

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
    
    res.json({
      success: true,
      report,
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
