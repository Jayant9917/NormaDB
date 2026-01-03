import React, { useState, useEffect } from 'react';
import { FileText, Upload, Database, AlertCircle, CheckCircle, BarChart3, Moon, Sun } from 'lucide-react';
import './App.css';

function App() {
  const [sqlContent, setSqlContent] = useState('');
  const [analysis, setAnalysis] = useState(null);
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

  // Helper function to get highest priority fixes
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

    if (!file.name.endsWith('.sql')) {
      setError('Please upload a .sql file');
      return;
    }

    const formData = new FormData();
    formData.append('sqlFile', file);

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/analyze-file', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setAnalysis(data.report);
      const content = await file.text();
      setSqlContent(content);
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
                accept=".sql"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <label htmlFor="file-upload" className="upload-label">
                <Upload size={24} color="#6b7280" />
                <span>Drop SQL file here or click to browse</span>
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
        </div>
      </main>
    </div>
  );
  
  export default App;
