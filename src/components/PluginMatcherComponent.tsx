import React, { useState, useCallback, useEffect } from 'react';
import { AudioFile, PluginMatch, AudioPlugin, MLAudioFeatures } from '@/types/audio';
import { PluginMatcher, MLAudioAnalyzer } from '@/lib/audio/mlAudioAnalysis';
import '@/styles/PluginMatcherComponent.css';

interface PluginMatcherComponentProps {
  audioFile: AudioFile | null;
  onPluginSelect?: (plugin: AudioPlugin, match: PluginMatch) => void;
  className?: string;
}

export const PluginMatcherComponent: React.FC<PluginMatcherComponentProps> = ({
  audioFile,
  onPluginSelect,
  className = '',
}) => {
  const [matches, setMatches] = useState<PluginMatch[]>([]);
  const [features, setFeatures] = useState<MLAudioFeatures | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<PluginMatch | null>(null);
  const [availablePlugins, setAvailablePlugins] = useState<AudioPlugin[]>([]);

  // Load available plugins
  useEffect(() => {
    const plugins = PluginMatcher.getAvailablePlugins();
    setAvailablePlugins(plugins);
  }, []);

  // Analyze audio and find matches
  const analyzeAndMatch = useCallback(async () => {
    if (!audioFile) return;

    setIsAnalyzing(true);
    try {
      // Extract audio features
      const audioFeatures = MLAudioAnalyzer.extractFeatures(audioFile);
      setFeatures(audioFeatures);

      // Find plugin matches
      const pluginMatches = await PluginMatcher.findMatches(audioFile);
      setMatches(pluginMatches.slice(0, 5)); // Show top 5 matches
    } catch (error) {
      console.error('Error analyzing audio:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [audioFile]);

  // Analyze when audio file changes
  useEffect(() => {
    if (audioFile) {
      analyzeAndMatch();
    } else {
      setMatches([]);
      setFeatures(null);
      setSelectedMatch(null);
    }
  }, [audioFile, analyzeAndMatch]);

  const handleMatchSelect = useCallback((match: PluginMatch) => {
    const plugin = PluginMatcher.getPlugin(match.pluginId);
    if (plugin) {
      setSelectedMatch(match);
      onPluginSelect?.(plugin, match);
    }
  }, [onPluginSelect]);

  const formatFeatureValue = (value: number, precision: number = 2): string => {
    return value.toFixed(precision);
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSimilarityColor = (similarity: number): string => {
    if (similarity >= 0.8) return 'bg-green-500';
    if (similarity >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (!audioFile) {
    return (
      <div className={`plugin-matcher-empty ${className}`}>
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
          <h3>No Audio File Loaded</h3>
          <p>Upload an audio file to get AI-powered plugin recommendations</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`plugin-matcher ${className}`}>
      {/* Audio Features Display */}
      {features && (
        <div className="features-section">
          <h3>Audio Analysis</h3>
          <div className="features-grid">
            <div className="feature-group">
              <h4>Spectral Features</h4>
              <div className="feature-items">
                <div className="feature-item">
                  <span className="feature-label">Centroid:</span>
                  <span className="feature-value">{formatFeatureValue(features.spectralFeatures.centroid)} Hz</span>
                </div>
                <div className="feature-item">
                  <span className="feature-label">Bandwidth:</span>
                  <span className="feature-value">{formatFeatureValue(features.spectralFeatures.bandwidth)} Hz</span>
                </div>
                <div className="feature-item">
                  <span className="feature-label">Rolloff:</span>
                  <span className="feature-value">{formatFeatureValue(features.spectralFeatures.rolloff)} Hz</span>
                </div>
                <div className="feature-item">
                  <span className="feature-label">Flatness:</span>
                  <span className="feature-value">{formatFeatureValue(features.spectralFeatures.flatness)}</span>
                </div>
              </div>
            </div>

            <div className="feature-group">
              <h4>Temporal Features</h4>
              <div className="feature-items">
                <div className="feature-item">
                  <span className="feature-label">ZCR:</span>
                  <span className="feature-value">{formatFeatureValue(features.temporalFeatures.zcr)} Hz</span>
                </div>
                <div className="feature-item">
                  <span className="feature-label">Energy:</span>
                  <span className="feature-value">{formatFeatureValue(features.temporalFeatures.energy)}</span>
                </div>
                <div className="feature-item">
                  <span className="feature-label">RMS:</span>
                  <span className="feature-value">{formatFeatureValue(features.temporalFeatures.rms)}</span>
                </div>
              </div>
            </div>

            <div className="feature-group">
              <h4>Harmonic Features</h4>
              <div className="feature-items">
                <div className="feature-item">
                  <span className="feature-label">Pitch:</span>
                  <span className="feature-value">{formatFeatureValue(features.harmonicFeatures.pitch)} Hz</span>
                </div>
                <div className="feature-item">
                  <span className="feature-label">Harmonicity:</span>
                  <span className="feature-value">{formatFeatureValue(features.harmonicFeatures.harmonicity)}</span>
                </div>
                <div className="feature-item">
                  <span className="feature-label">Inharmonicity:</span>
                  <span className="feature-value">{formatFeatureValue(features.harmonicFeatures.inharmonicity)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plugin Recommendations */}
      <div className="recommendations-section">
        <h3>AI Plugin Recommendations</h3>
        
        {isAnalyzing ? (
          <div className="analyzing-state">
            <div className="loading-spinner"></div>
            <p>Analyzing audio and finding best plugin matches...</p>
          </div>
        ) : matches.length > 0 ? (
          <div className="matches-list">
            {matches.map((match, index) => {
              const plugin = availablePlugins.find(p => p.id === match.pluginId);
              if (!plugin) return null;

              return (
                <div
                  key={match.pluginId}
                  className={`match-card ${selectedMatch?.pluginId === match.pluginId ? 'selected' : ''}`}
                  onClick={() => handleMatchSelect(match)}
                >
                  <div className="match-header">
                    <div className="match-info">
                      <div className="match-rank">#{index + 1}</div>
                      <div className="plugin-details">
                        <h4>{plugin.name}</h4>
                        <p className="manufacturer">{plugin.manufacturer}</p>
                        <span className="category-badge">{plugin.category}</span>
                      </div>
                    </div>
                    <div className="match-scores">
                      <div className="similarity-score">
                        <div className="score-label">Similarity</div>
                        <div className="score-bar">
                          <div 
                            className={`score-fill ${getSimilarityColor(match.similarity)}`}
                            style={{ width: `${match.similarity * 100}%` }}
                          ></div>
                        </div>
                        <div className="score-value">{(match.similarity * 100).toFixed(1)}%</div>
                      </div>
                      <div className={`confidence-score ${getConfidenceColor(match.confidence)}`}>
                        Confidence: {(match.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="match-description">
                    <p>{match.description}</p>
                  </div>

                  <div className="suggested-parameters">
                    <h5>Suggested Settings:</h5>
                    <div className="parameter-grid">
                      {Object.entries(match.suggestedParameters).map(([paramId, value]) => {
                        const param = plugin.parameters.find(p => p.id === paramId);
                        if (!param) return null;

                        return (
                          <div key={paramId} className="parameter-suggestion">
                            <span className="param-name">{param.name}:</span>
                            <span className="param-value">
                              {value.toFixed(1)}{param.unit || ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-matches">
            <p>No suitable plugin matches found for this audio.</p>
          </div>
        )}
      </div>

      {/* Detailed Plugin Info */}
      {selectedMatch && (
        <div className="selected-plugin-details">
          <h3>Selected Plugin Details</h3>
          {(() => {
            const plugin = availablePlugins.find(p => p.id === selectedMatch.pluginId);
            if (!plugin) return null;

            return (
              <div className="plugin-details-card">
                <div className="plugin-header">
                  <h4>{plugin.name}</h4>
                  <p>{plugin.manufacturer} • {plugin.category}</p>
                </div>

                <div className="plugin-parameters">
                  <h5>All Parameters:</h5>
                  <div className="parameters-list">
                    {plugin.parameters.map((param) => (
                      <div key={param.id} className="parameter-control">
                        <label>{param.name}</label>
                        <div className="parameter-info">
                          <span>Range: {param.min} - {param.max} {param.unit || ''}</span>
                          <span>Suggested: {selectedMatch.suggestedParameters[param.id]?.toFixed(1) || param.default} {param.unit || ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {plugin.presets.length > 0 && (
                  <div className="plugin-presets">
                    <h5>Available Presets:</h5>
                    <div className="presets-list">
                      {plugin.presets.map((preset) => (
                        <div key={preset.id} className="preset-item">
                          <h6>{preset.name}</h6>
                          <div className="preset-tags">
                            {preset.tags.map((tag) => (
                              <span key={tag} className="preset-tag">{tag}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default PluginMatcherComponent;