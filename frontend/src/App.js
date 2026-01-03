import React, { useState, useEffect } from 'react';
import { FileText, Upload, Database, AlertCircle, CheckCircle, BarChart3, Moon, Sun } from 'lucide-react';
import './App.css';

function App() {
  const [sqlContent, setSqlContent] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [schemaAnalysis, setSchemaAnalysis] = useState(null);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkTheme(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      setIsDarkTheme(false);
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkTheme;
    setIsDarkTheme(newTheme);
    
    if (newTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  // Helper function to extract public tables from analysis
  const getPublicTablesData = (analysis) => {
    if (!analysis || !analysis.dumpParseResult) return null;
    
    // Extract public tables from the analysis
    const publicTables = analysis.dumpParseResult.tables
      .filter(table => table.startsWith('public.'))
      .map(table => table.replace('public.', ''))
      .filter(table => table !== 'AS,') // Remove parsing artifact
      .sort();
    
    // Extract violations for public tables only
    const publicViolations = [];
    ['1NF', '2NF', '3NF'].forEach(nf => {
      if (analysis.compliance[nf]) {
        analysis.compliance[nf].violations.forEach(v => {
          const cleanTable = v.table.replace('public.', '');
          if (publicTables.includes(cleanTable) || v.table.startsWith('public.')) {
            publicViolations.push({...v, table: cleanTable, normalForm: nf});
          }
        });
      }
    });
    
    // Calculate public schema scores
    const publicScores = {
      '1NF': 100,
      '2NF': 100, 
      '3NF': 100
    };
    
    // Adjust scores if there are violations
    publicViolations.forEach(v => {
      if (publicScores[v.normalForm] === 100) {
        publicScores[v.normalForm] = 0; // If any violation, score drops
      }
    });
    
    // Categorize tables dynamically
    const categories = {
      '🏛️ Military Structure': [],
      '🏆 Awards System': [],
      '👥 Administration': [],
      '📋 Other Tables': []
    };
    
    publicTables.forEach(table => {
      if (table.includes('corps') || table.includes('division') || table.includes('brigade') || 
          table.includes('unit') || table.includes('command') || table.includes('deployment') ||
          table.includes('arms_service')) {
        categories['🏛️ Military Structure'].push(table);
      } else if (table.includes('appreciation') || table.includes('citation') || table.includes('appre') || 
                 table.includes('award')) {
        categories['🏆 Awards System'].push(table);
      } else if (table.includes('user') || table.includes('role') || table.includes('parameter') || 
                 table.includes('signature') || table.includes('config') || table.includes('clarification') ||
                 table.includes('application')) {
        categories['👥 Administration'].push(table);
      } else {
        categories['📋 Other Tables'].push(table);
      }
    });
    
    return {
      publicTables,
      publicViolations,
      publicScores,
      categories,
      isPerfect: publicViolations.length === 0,
      totalPublicTables: publicTables.length,
      totalPublicViolations: publicViolations.length
    };
  };

  // Helper function to get other schemas data
  const getOtherSchemasData = (analysis) => {
    if (!analysis || !analysis.dumpParseResult) return null;
    
    const allTables = analysis.dumpParseResult.tables;
    const publicTables = allTables.filter(table => table.startsWith('public.'));
    const otherTables = allTables.filter(table => !table.startsWith('public.') && table !== 'AS,');
    
    // Count violations in other schemas
    const otherViolations = [];
    ['1NF', '2NF', '3NF'].forEach(nf => {
      if (analysis.compliance[nf]) {
        analysis.compliance[nf].violations.forEach(v => {
          if (!v.table.startsWith('public.') && v.table !== 'AS,') {
            otherViolations.push({...v, normalForm: nf});
          }
        });
      }
    });
    
    return {
      otherTables: otherTables.length,
      otherViolations: otherViolations.length,
      overallScore: analysis.overallScore
    };
  };
  const getHighestPriorityFixes = (analysis) => {
    const allViolations = [
      ...analysis.compliance['1NF'].violations,
      ...analysis.compliance['2NF'].violations,
      ...analysis.compliance['3NF'].violations
    ];
    
    // Sort by severity (ERROR first) then by normal form priority (1NF > 2NF > 3NF)
    const sortedViolations = allViolations.sort((a, b) => {
      if (a.severity === 'ERROR' && b.severity !== 'ERROR') return -1;
      if (a.severity !== 'ERROR' && b.severity === 'ERROR') return 1;
      if (a.normalForm !== b.normalForm) {
        const formOrder = { '1NF': 0, '2NF': 1, '3NF': 2 };
        return formOrder[a.normalForm] - formOrder[b.normalForm];
      }
      return 0;
    });
    
    return sortedViolations.map(violation => violation.suggestion);
  };

  const handleAnalyze = async () => {
    if (!sqlContent.trim()) {
      setError('Please enter SQL content to analyze');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sqlContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setAnalysis(data.report);
    } catch (err) {
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('sqlFile', file);

    setLoading(true);
    setError('');

    try {
      // Check if it's a dump file
      const isDumpFile = file.name.toLowerCase().endsWith('.dump') || 
                        file.name.toLowerCase().endsWith('.sqlc') ||
                        file.name.toLowerCase().includes('dump');

      let response;
      
      if (isDumpFile) {
        // Handle as dump file with multi-schema analysis
        const content = await file.text();
        const dumpResponse = await fetch('/api/analyze-dump-schemas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dumpContent: content }),
        });

        const dumpData = await dumpResponse.json();

        if (!dumpResponse.ok) {
          throw new Error(dumpData.error || 'Dump analysis failed');
        }

        setSchemaAnalysis(dumpData);
        setSqlContent(dumpData.schemas?.[0]?.violations?.[0]?.table || '');
        
        // Show dump file information
        console.log('Dump file analyzed:', dumpData.dumpInfo);
        
      } else {
        // Handle as regular SQL file with multi-schema analysis
        const content = await file.text();
        response = await fetch('/api/analyze-schemas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sqlContent: content }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Analysis failed');
        }

        setSchemaAnalysis(data);
        setSqlContent(content);
      }
      
    } catch (err) {
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.sql')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result;
        setSqlContent(content);
      };
      reader.readAsText(file);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 70) return '#f59e0b';
    return '#ef4444';
  };

  const getSeverityIcon = (severity) => {
    return severity === 'ERROR' ? 
      <AlertCircle size={16} color="#ef4444" /> : 
      <AlertCircle size={16} color="#f59e0b" />;
  };

  return (
    <div className="app">
      {/* Theme Toggle Button */}
      <button 
        className="theme-toggle" 
        onClick={toggleTheme}
        aria-label="Toggle theme"
        title={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
      >
        {isDarkTheme ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <header className="header">
        <div className="header-content">
          <Database size={32} color="white" />
          <h1>NormaDB</h1>
          <span className="subtitle">Database Normalization Analyzer</span>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <div className="input-section">
            <div className="upload-area" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
              <input
                type="file"
                accept=".sql,.dump,.sqlc"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <label htmlFor="file-upload" className="upload-label">
                <Upload size={24} color="#6b7280" />
                <span>Drop SQL or dump file here or click to browse</span>
                <span className="upload-hint">Supports .sql, .dump, .sqlc files</span>
              </label>
            </div>

            <div className="editor-section">
              <div className="editor-header">
                <FileText size={20} color="#6b7280" />
                <span>SQL Editor</span>
              </div>
              <textarea
                className="sql-editor"
                value={sqlContent}
                onChange={(e) => setSqlContent(e.target.value)}
                placeholder="Paste your PostgreSQL CREATE TABLE statements here..."
                spellCheck={false}
              />
            </div>

            <button 
              className="analyze-button" 
              onClick={handleAnalyze} 
              disabled={loading || !sqlContent.trim()}
            >
              {loading ? 'Analyzing...' : 'Analyze Schema'}
            </button>

            {error && (
              <div className="error-message">
                <AlertCircle size={20} color="#ef4444" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {analysis && (
            <div className="results-section">
              <div className="results-header">
                <BarChart3 size={24} color="white" />
                <h2>Analysis Results</h2>
              </div>

              {/* Dump File Information */}
              {analysis && analysis.dumpParseResult && (
                <div className="dump-info-section">
                  <div className="dump-info-header">
                    <h3>📄 Dump File Analysis</h3>
                  </div>
                  <div className="dump-info-content">
                    <div className="dump-info-item">
                      <span className="dump-info-label">Format:</span>
                      <span className="dump-info-value">{analysis.dumpParseResult.metadata.detectedFormat}</span>
                    </div>
                    <div className="dump-info-item">
                      <span className="dump-info-label">Original Size:</span>
                      <span className="dump-info-value">{(analysis.dumpParseResult.metadata.totalSize / 1024).toFixed(2)} KB</span>
                    </div>
                    <div className="dump-info-item">
                      <span className="dump-info-label">Extracted Size:</span>
                      <span className="dump-info-value">{(analysis.dumpParseResult.metadata.extractedSize / 1024).toFixed(2)} KB</span>
                    </div>
                    <div className="dump-info-item">
                      <span className="dump-info-label">Tables Extracted:</span>
                      <span className="dump-info-value">{analysis.dumpParseResult.tables.length}</span>
                    </div>
                    {analysis.dumpParseResult.errors.length > 0 && (
                      <div className="dump-info-item">
                        <span className="dump-info-label">Warnings:</span>
                        <span className="dump-info-value">{analysis.dumpParseResult.errors.length}</span>
                      </div>
                    )}
                  </div>
                  {analysis.analysisNotes && (
                    <div className="analysis-notes">
                      <h4>Analysis Notes:</h4>
                      {analysis.analysisNotes.map((note, index) => (
                        <div key={index} className="analysis-note">{note}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Public Tables Summary */}
              {analysis && analysis.dumpParseResult && (() => {
                const publicData = getPublicTablesData(analysis);
                if (!publicData || publicData.totalPublicTables === 0) return null;
                
                return (
                  <div className="public-tables-section">
                    <div className="public-tables-header">
                      <h3>🏢 Public Schema Tables</h3>
                      <span className="public-tables-badge">{publicData.totalPublicTables} Tables</span>
                    </div>
                    <div className="public-tables-content">
                      <div className="public-tables-stats">
                        <div className="public-tables-stat">
                          <span className="public-tables-stat-value">{publicData.isPerfect ? '✅' : '⚠️'}</span>
                          <span className="public-tables-stat-label">{publicData.isPerfect ? 'All Normalized' : 'Has Issues'}</span>
                        </div>
                        <div className="public-tables-stat">
                          <span className="public-tables-stat-value">{publicData.totalPublicViolations}</span>
                          <span className="public-tables-stat-label">Violations</span>
                        </div>
                        <div className="public-tables-stat">
                          <span className="public-tables-stat-value">{publicData.isPerfect ? '100%' : 'Needs Work'}</span>
                          <span className="public-tables-stat-label">Compliant</span>
                        </div>
                      </div>
                      <div className="public-tables-categories">
                        {Object.entries(publicData.categories).map(([category, tables]) => (
                          tables.length > 0 && (
                            <div key={category} className="public-tables-category">
                              <h4>{category}</h4>
                              <div className="public-tables-list">
                                {tables.slice(0, 6).map(table => (
                                  <span key={table} className="public-table-tag">{table}</span>
                                ))}
                                {tables.length > 6 && (
                                  <span className="public-table-tag">+{tables.length - 6} more</span>
                                )}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                      <div className="public-tables-message">
                        {publicData.isPerfect ? (
                          <>
                            <CheckCircle size={16} color="#10b981" />
                            <span>Excellent! All public schema tables follow normalization best practices and are ready for production use.</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={16} color="#f59e0b" />
                            <span>Found {publicData.totalPublicViolations} violations in public schema. Review the detailed analysis below.</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Public Section Violations Analysis */}
              {analysis && analysis.dumpParseResult && (() => {
                const publicData = getPublicTablesData(analysis);
                const otherData = getOtherSchemasData(analysis);
                if (!publicData || publicData.totalPublicTables === 0) return null;
                
                return (
                  <div className="public-violations-section">
                    <div className="public-violations-header">
                      <h3>🔍 Public Section Analysis</h3>
                      <span className="public-violations-badge">Detailed Report</span>
                    </div>
                    <div className="public-violations-content">
                      <div className="public-violations-summary">
                        <div className="public-violations-summary-item">
                          <span className="public-violations-label">Public Schema Status:</span>
                          <span className={`public-violations-value ${publicData.isPerfect ? 'success' : 'warning'}`}>
                            {publicData.isPerfect ? '✅ PERFECTLY NORMALIZED' : '⚠️ NEEDS ATTENTION'}
                          </span>
                        </div>
                        <div className="public-violations-summary-item">
                          <span className="public-violations-label">Total Public Tables:</span>
                          <span className="public-violations-value">{publicData.totalPublicTables}</span>
                        </div>
                        <div className="public-violations-summary-item">
                          <span className="public-violations-label">Public Violations:</span>
                          <span className={`public-violations-value ${publicData.isPerfect ? 'success' : 'warning'}`}>
                            {publicData.totalPublicViolations}
                          </span>
                        </div>
                        <div className="public-violations-summary-item">
                          <span className="public-violations-label">Compliance Level:</span>
                          <span className={`public-violations-value ${publicData.isPerfect ? 'success' : 'warning'}`}>
                            {publicData.isPerfect ? '100%' : 'Needs Work'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="public-violations-details">
                        <h4>📊 Public Schema Normalization Details</h4>
                        <div className="public-nf-breakdown">
                          {['1NF', '2NF', '3NF'].map((nf) => {
                            const score = publicData.publicScores[nf];
                            const violations = publicData.publicViolations.filter(v => v.normalForm === nf);
                            
                            return (
                              <div key={nf} className="public-nf-card">
                                <div className="public-nf-header">
                                  <h5>{nf} Compliance</h5>
                                  <span className={`public-nf-score ${score === 100 ? 'success' : 'warning'}`}>
                                    {score}%
                                  </span>
                                </div>
                                <div className="public-nf-progress">
                                  <div 
                                    className="public-nf-progress-fill" 
                                    style={{ 
                                      width: `${score}%`,
                                      backgroundColor: score === 100 ? '#10b981' : '#f59e0b'
                                    }}
                                  />
                                </div>
                                <div className="public-nf-status">
                                  {score === 100 ? (
                                    <>
                                      <CheckCircle size={14} color="#10b981" />
                                      <span>Perfect compliance - No violations found</span>
                                    </>
                                  ) : (
                                    <>
                                      <AlertCircle size={14} color="#f59e0b" />
                                      <span>{violations.length} violation(s) found</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {!publicData.isPerfect && publicData.publicViolations.length > 0 && (
                        <div className="public-violations-list">
                          <h4>⚠️ Public Schema Violations</h4>
                          {publicData.publicViolations.map((violation, index) => (
                            <div key={index} className="violation-item">
                              <div className="violation-header">
                                {getSeverityIcon(violation.severity)}
                                <span className="violation-table">{violation.table}</span>
                                {violation.column && <span className="violation-column">.{violation.column}</span>}
                                <span className="violation-confidence">Confidence: {(violation.confidence * 100).toFixed(0)}%</span>
                              </div>
                              <div className="violation-message">{violation.message}</div>
                              <div className="violation-explanation">{violation.explanation}</div>
                              <div className="violation-suggestion">{violation.suggestion}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="public-violations-insights">
                        <h4>🎯 Public Schema Insights</h4>
                        <div className="public-insights-list">
                          {publicData.isPerfect ? (
                            <>
                              <div className="public-insight-item">
                                <CheckCircle size={16} color="#10b981" />
                                <div>
                                  <strong>Excellent Design:</strong> All {publicData.totalPublicTables} public tables follow database normalization best practices
                                </div>
                              </div>
                              <div className="public-insight-item">
                                <CheckCircle size={16} color="#10b981" />
                                <div>
                                  <strong>Business Logic:</strong> Well-organized table structure with proper relationships
                                </div>
                              </div>
                              <div className="public-insight-item">
                                <CheckCircle size={16} color="#10b981" />
                                <div>
                                  <strong>Production Ready:</strong> No immediate changes required for public schema
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="public-insight-item">
                                <AlertCircle size={16} color="#f59e0b" />
                                <div>
                                  <strong>Needs Attention:</strong> Found {publicData.totalPublicViolations} violations in {publicData.totalPublicTables} public tables
                                </div>
                              </div>
                              <div className="public-insight-item">
                                <AlertCircle size={16} color="#f59e0b" />
                                <div>
                                  <strong>Priority Fixes:</strong> Focus on {publicData.publicViolations.filter(v => v.severity === 'ERROR').length} critical violations first
                                </div>
                              </div>
                              <div className="public-insight-item">
                                <AlertCircle size={16} color="#f59e0b" />
                                <div>
                                  <strong>Review Required:</strong> Address normalization issues before production deployment
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {otherData && (
                        <div className="public-violations-comparison">
                          <h4>📈 Public vs Other Schemas</h4>
                          <div className="schema-comparison">
                            <div className="schema-comparison-item public">
                              <div className="schema-name">🏢 Public Schema</div>
                              <div className="schema-stats">
                                <span className="schema-tables">{publicData.totalPublicTables} tables</span>
                                <span className={`schema-violations ${publicData.isPerfect ? 'success' : 'warning'}`}>
                                  {publicData.totalPublicViolations} violations
                                </span>
                                <span className={`schema-score ${publicData.isPerfect ? 'success' : 'warning'}`}>
                                  {publicData.isPerfect ? '100%' : 'Needs Work'}
                                </span>
                              </div>
                            </div>
                            <div className="schema-comparison-item other">
                              <div className="schema-name">🔧 Other Schemas</div>
                              <div className="schema-stats">
                                <span className="schema-tables">{otherData.otherTables} tables</span>
                                <span className="schema-violations warning">{otherData.otherViolations} violations</span>
                                <span className="schema-score warning">{otherData.overallScore.toFixed(0)}% compliant</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="overall-score">
                <div className="score-circle" style={{ borderColor: getScoreColor(analysis.overallScore || 0) }}>
                  <span className="score-value" style={{ color: getScoreColor(analysis.overallScore || 0) }}>
                    {(analysis.overallScore || 0).toFixed(1)}%
                  </span>
                </div>
                <div className="score-details">
                  <h3>Overall Compliance Score</h3>
                  <div className="summary-stats">
                    <div className="stat">
                      <span className="stat-value">{analysis.summary.totalViolations}</span>
                      <span className="stat-label">Total Issues</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{analysis.summary.criticalViolations}</span>
                      <span className="stat-label">Critical</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{analysis.summary.warnings}</span>
                      <span className="stat-label">Warnings</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="normal-forms">
                {['1NF', '2NF', '3NF'].map((nf) => {
                  const compliance = analysis.compliance[nf];
                  const score = compliance?.score || 0;
                  
                  return (
                    <div key={nf} className="normal-form-card">
                      <div className="nf-header">
                        <h3>{nf} Compliance</h3>
                        <div className="nf-score-info">
                          <span className="nf-score" style={{ color: getScoreColor(score) }}>
                            {score.toFixed(1)}%
                          </span>
                          <span className="nf-status">
                            {score >= 90 ? '✅ PASS' : score >= 70 ? '⚠️ WARNING' : '❌ FAIL'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Enhanced Scoring Details */}
                      <div className="scoring-details">
                        <div className="scoring-info">
                          <span className="scoring-label">Rules Evaluated:</span>
                          <span className="scoring-value">{compliance?.rulesEvaluated || 0}</span>
                        </div>
                        <div className="scoring-info">
                          <span className="scoring-label">Max Weight:</span>
                          <span className="scoring-value">{compliance?.maxWeight || 0}</span>
                        </div>
                        <div className="scoring-info">
                          <span className="scoring-label">Violated Weight:</span>
                          <span className="scoring-value">{compliance?.violatedWeight || 0}</span>
                        </div>
                        <div className="scoring-info">
                          <span className="scoring-label">Passed Rules:</span>
                          <span className="scoring-value">{compliance?.passedRules || 0}/{compliance?.totalRules || 0}</span>
                        </div>
                      </div>
                      
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ 
                            width: `${score}%`,
                            backgroundColor: getScoreColor(score)
                          }}
                        />
                      </div>
                      
                      {/* Enhanced Violations List */}
                      <div className="violations-list">
                        {(compliance?.violations || []).map((violation, index) => (
                          <div key={index} className="violation-item">
                            <div className="violation-header">
                              {getSeverityIcon(violation.severity)}
                              <span className="violation-table">{violation.table}</span>
                              {violation.column && <span className="violation-column">.{violation.column}</span>}
                              <span className="violation-confidence">Confidence: {(violation.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <div className="violation-message">{violation.message}</div>
                            <div className="violation-explanation">{violation.explanation}</div>
                            <div className="violation-suggestion">{violation.suggestion}</div>
                          </div>
                        ))}
                        {(!compliance?.violations || compliance.violations.length === 0) && (
                          <div className="no-violations">
                            <CheckCircle size={16} color="#10b981" />
                            <span>No violations found - Excellent {nf} compliance!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Enhanced Fix Recommendations */}
              {analysis.summary.totalViolations > 0 && (
                <div className="recommendations-section">
                  <div className="recommendations-header">
                    <h3>🔧 Fix Recommendations</h3>
                  </div>
                  <div className="recommendations-list">
                    {getHighestPriorityFixes(analysis).map((fix, index) => (
                      <div key={index} className="recommendation-item">
                        <div className="recommendation-priority">
                          Priority {index + 1}
                        </div>
                        <div className="recommendation-content">
                          {fix}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Multi-Schema Analysis Results */}
          {schemaAnalysis && (
            <div className="schema-results-section">
              <div className="schema-results-header">
                <Database size={24} color="white" />
                <h2>Multi-Schema Analysis</h2>
              </div>

              {/* Top-Level Summary Section */}
              <div className="schema-summary-section">
                <div className="schema-summary-header">
                  <h3>📊 Schema Summary</h3>
                </div>
                <div className="schema-summary-content">
                  <div className="schema-summary-item">
                    <span className="schema-summary-label">Schemas detected:</span>
                    <span className="schema-summary-value">{schemaAnalysis.summary.totalSchemas}</span>
                  </div>
                  <div className="schema-summary-item">
                    <span className="schema-summary-label">Total tables:</span>
                    <span className="schema-summary-value">{schemaAnalysis.summary.totalTables}</span>
                  </div>
                  <div className="schema-summary-item">
                    <span className="schema-summary-label">Overall score:</span>
                    <span className="schema-summary-value">{schemaAnalysis.summary.overallScore.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Explanatory Text */}
              <div className="schema-explanation">
                <p>Normalization rules are evaluated per table and aggregated per schema for clarity.</p>
              </div>

              {/* Schema Cards / List */}
              <div className="schema-cards-section">
                <div className="schema-cards-header">
                  <h3>🏗️ Schema Details</h3>
                </div>
                <div className="schema-cards-grid">
                  {schemaAnalysis.schemas.map((schema) => (
                    <div 
                      key={schema.schemaName} 
                      className={`schema-card ${selectedSchema === schema.schemaName ? 'selected' : ''}`}
                      onClick={() => setSelectedSchema(selectedSchema === schema.schemaName ? null : schema.schemaName)}
                    >
                      <div className="schema-card-header">
                        <h4>📦 {schema.schemaName}</h4>
                        <span className={`schema-status-badge ${schema.status.toLowerCase()}`}>
                          {schema.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="schema-card-content">
                        <div className="schema-card-item">
                          <span className="schema-card-label">Tables:</span>
                          <span className="schema-card-value">{schema.tableCount}</span>
                        </div>
                        <div className="schema-card-item">
                          <span className="schema-card-label">Score:</span>
                          <span className="schema-card-value">{schema.overallScore.toFixed(1)}%</span>
                        </div>
                        <div className="schema-card-item">
                          <span className="schema-card-label">Status:</span>
                          <span className="schema-card-value schema-status-text">
                            {schema.status === 'PERFECT' && '✅ Perfect'}
                            {schema.status === 'GOOD' && '👍 Good'}
                            {schema.status === 'NEEDS_ATTENTION' && '⚠️ Needs Attention'}
                            {schema.status === 'CRITICAL' && '🚨 Critical'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schema Drill Down */}
              {selectedSchema && (() => {
                const selectedSchemaData = schemaAnalysis.schemas.find(s => s.schemaName === selectedSchema);
                if (!selectedSchemaData) return null;

                return (
                  <div className="schema-drilldown-section">
                    <div className="schema-drilldown-header">
                      <h3>🔍 {selectedSchemaData.schemaName} Schema Details</h3>
                      <button 
                        className="close-drilldown" 
                        onClick={() => setSelectedSchema(null)}
                      >
                        ✕
                      </button>
                    </div>

                    {/* NF Breakdown */}
                    <div className="schema-nf-breakdown">
                      <h4>Normalization Forms</h4>
                      <div className="schema-nf-cards">
                        {['1NF', '2NF', '3NF'].map((nf) => {
                          const nfData = selectedSchemaData.normalization[nf];
                          return (
                            <div key={nf} className="schema-nf-card">
                              <div className="schema-nf-header">
                                <h5>{nf} Compliance</h5>
                                <span className={`schema-nf-score ${nfData.score === 100 ? 'perfect' : nfData.score >= 70 ? 'good' : 'poor'}`}>
                                  {nfData.score.toFixed(1)}%
                                </span>
                              </div>
                              <div className="schema-nf-details">
                                <div className="schema-nf-item">
                                  <span>Violated Tables:</span>
                                  <span>{nfData.violatedTables} / {nfData.totalTables}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Violations */}
                    {selectedSchemaData.violations.length > 0 && (
                      <div className="schema-violations-section">
                        <h4>Violations ({selectedSchemaData.violations.length})</h4>
                        <div className="schema-violations-list">
                          {selectedSchemaData.violations.map((violation, index) => (
                            <div key={index} className={`schema-violation-item ${violation.severity.toLowerCase()}`}>
                              <div className="schema-violation-header">
                                <span className="schema-violation-nf">{violation.normalForm}</span>
                                <span className="schema-violation-table">{violation.table}</span>
                                {violation.column && (
                                  <span className="schema-violation-column">{violation.column}</span>
                                )}
                              </div>
                              <div className="schema-violation-content">
                                <p className="schema-violation-message">{violation.message}</p>
                                <p className="schema-violation-explanation">{violation.explanation}</p>
                                {violation.suggestion && (
                                  <p className="schema-violation-suggestion">
                                    <strong>Suggestion:</strong> {violation.suggestion}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedSchemaData.violations.length === 0 && (
                      <div className="schema-perfect-section">
                        <div className="schema-perfect-content">
                          <CheckCircle size={48} color="#10b981" />
                          <h4>Perfect Normalization!</h4>
                          <p>All tables in the {selectedSchemaData.schemaName} schema follow normalization best practices.</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
