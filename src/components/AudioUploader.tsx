import React, { useCallback, useState, useRef, DragEvent } from 'react';
import { AudioFile } from '@/types/audio';
import { audioUtils } from '@/lib/audio/audioUtils';

interface AudioUploaderProps {
  onFileLoad: (audioFile: AudioFile) => void;
  onError: (error: string) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  className?: string;
  children?: React.ReactNode;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({
  onFileLoad,
  onError,
  accept = 'audio/*',
  multiple = false,
  maxSize = 100 * 1024 * 1024, // 100MB default
  className = '',
  children,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileLoad = useCallback(async (files: FileList) => {
    const file = files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      onError('Please select a valid audio file');
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      onError(`File size must be less than ${Math.round(maxSize / (1024 * 1024))}MB`);
      return;
    }

    setIsLoading(true);
    try {
      const audioFile = await audioUtils.loadAudioFile(file);
      onFileLoad(audioFile);
    } catch (error) {
      onError(`Failed to load audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [onFileLoad, onError, maxSize]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileLoad(files);
    }
  }, [handleFileLoad]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileLoad(files);
    }
  }, [handleFileLoad]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div
      className={`audio-uploader ${isDragging ? 'dragging' : ''} ${isLoading ? 'loading' : ''} ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openFileDialog}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />
      
      {children || (
        <div className="upload-content">
          {isLoading ? (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Loading audio file...</p>
            </div>
          ) : (
            <>
              <div className="upload-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </div>
              <h3>Upload Audio File</h3>
              <p>Drag and drop an audio file here, or click to browse</p>
              <small>Supported formats: MP3, WAV, FLAC, OGG (Max: {Math.round(maxSize / (1024 * 1024))}MB)</small>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioUploader;