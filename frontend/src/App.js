import React, { useState } from 'react';
import { FileText, Upload, Database, AlertCircle, CheckCircle, BarChart3 } from 'lucide-react';
import './App.css';

function App() {
  const [sqlContent, setSqlContent] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
                <div className="score-circle" style={{ borderColor: getScoreColor(analysis.overallScore) }}>
                  <span className="score-value" style={{ color: getScoreColor(analysis.overallScore) }}>
                    {analysis.overallScore.toFixed(1)}%
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
                {['1NF', '2NF', '3NF'].map((nf) => (
                  <div key={nf} className="normal-form-card">
                    <div className="nf-header">
                      <h3>{nf} Compliance</h3>
                      <span className="nf-score" style={{ color: getScoreColor(analysis.compliance[nf].score) }}>
                        {analysis.compliance[nf].score.toFixed(1)}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${analysis.compliance[nf].score}%`,
                          backgroundColor: getScoreColor(analysis.compliance[nf].score)
                        }}
                      />
                    </div>
                    <div className="violations-list">
                      {analysis.compliance[nf].violations.map((violation, index) => (
                        <div key={index} className="violation-item">
                          <div className="violation-header">
                            {getSeverityIcon(violation.severity)}
                            <span className="violation-table">{violation.table}</span>
                            {violation.column && <span className="violation-column">.{violation.column}</span>}
                          </div>
                          <div className="violation-message">{violation.message}</div>
                          <div className="violation-suggestion">{violation.suggestion}</div>
                        </div>
                      ))}
                      {analysis.compliance[nf].violations.length === 0 && (
                        <div className="no-violations">
                          <CheckCircle size={16} color="#10b981" />
                          <span>No violations found</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
