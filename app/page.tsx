"use client";

import React, { useState, useMemo } from 'react';
import { Dropzone } from './components/Dropzone';
import { compressImageFile } from '@/utils/compressImage';
import { compressVideoFile } from '@/utils/ffmpeg';
import { Trash2, Download, Settings, PieChart } from 'lucide-react';
import JSZip from 'jszip';
import styles from './page.module.css';

type FileStatus = 'idle' | 'compressing' | 'done' | 'error';

interface ProcessedFile {
  id: string;
  originalFile: File;
  compressedFile?: File;
  status: FileStatus;
  progress: number;
  selected: boolean;
  imageQuality: number;
  videoResolution: string;
  previewUrl?: string;
}

export default function Home() {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [globalImageQuality, setGlobalImageQuality] = useState(0.8);
  const [globalVideoResolution, setGlobalVideoResolution] = useState('1280x720');

  const handleFilesSelected = (selectedFiles: File[]) => {
    const newFiles = selectedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      originalFile: file,
      status: 'idle' as FileStatus,
      progress: 0,
      selected: true, // Auto select new files
      imageQuality: globalImageQuality,
      videoResolution: globalVideoResolution,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (fileId: string) => setFiles(prev => prev.filter(f => f.id !== fileId));
  
  const updateFileSetting = (fileId: string, key: 'imageQuality' | 'videoResolution', value: any) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, [key]: value } : f));
  };

  const applyGlobalSettings = () => {
    setFiles(prev => prev.map(f => f.status === 'idle' ? { 
      ...f, 
      imageQuality: globalImageQuality, 
      videoResolution: globalVideoResolution 
    } : f));
  };

  const toggleSelection = (fileId: string) => setFiles(prev => prev.map(f => f.id === fileId ? { ...f, selected: !f.selected } : f));
  
  const toggleSelectAll = () => {
    const allSelected = files.length > 0 && files.every(f => f.selected);
    setFiles(prev => prev.map(f => ({ ...f, selected: !allSelected })));
  };

  const removeSelected = () => setFiles(prev => prev.filter(f => !f.selected));

  const handleDownloadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startCompression = async (fileObj: ProcessedFile) => {
    const fileId = fileObj.id;
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'compressing', progress: 0 } : f));

    try {
      const isVideo = fileObj.originalFile.type.startsWith('video');
      let compressedResult: File;

      const onProgress = (prog: number) => {
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress: Math.round(prog * 100) } : f));
      };

      if (isVideo) {
        compressedResult = await compressVideoFile(fileObj.originalFile, {
          resolution: fileObj.videoResolution,
          crf: 28,
        }, onProgress);
      } else {
        const maxSize = (fileObj.originalFile.size / 1024 / 1024) * fileObj.imageQuality;
        compressedResult = await compressImageFile(fileObj.originalFile, {
          maxSizeMB: Math.max(0.1, maxSize),
          useWebWorker: true,
        }, onProgress);
      }

      const previewUrl = URL.createObjectURL(compressedResult);

      setFiles(prev => prev.map(f => f.id === fileId ? { 
        ...f, status: 'done', compressedFile: compressedResult, progress: 100, previewUrl
      } : f));
    } catch (error) {
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'error' } : f));
    }
  };

  const compressSelected = async () => {
    // Snapshot the files to compress at the moment the button is clicked
    const selectedFilesToCompress = files.filter(f => f.selected && f.status === 'idle');
    const CONCURRENCY_LIMIT = 1; // Diturunkan ke 1 untuk mencegah Browser GPU/Canvas memory exhaustion (Gambar hitam)
    let index = 0;
    
    const executeNext = async (): Promise<void> => {
      if (index >= selectedFilesToCompress.length) return;
      const fileObj = selectedFilesToCompress[index++];
      await startCompression(fileObj);
      await executeNext();
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, selectedFilesToCompress.length) }, () => executeNext());
    await Promise.all(workers);
  };

  const downloadSelectedZip = async () => {
    const selectedCompleted = files.filter(f => f.selected && f.status === 'done' && f.compressedFile);
    if (selectedCompleted.length === 0) return;

    if (selectedCompleted.length === 1) {
      // Direct download if only one file
      const file = selectedCompleted[0].compressedFile!;
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const zip = new JSZip();
    selectedCompleted.forEach(f => {
      zip.file(f.compressedFile!.name, f.compressedFile!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MediaCompress_Results.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculations for Summary Dashboard
  const stats = useMemo(() => {
    const completed = files.filter(f => f.status === 'done' && f.compressedFile);
    const totalOriginalSize = completed.reduce((acc, f) => acc + f.originalFile.size, 0);
    const totalCompressedSize = completed.reduce((acc, f) => acc + f.compressedFile!.size, 0);
    const saved = totalOriginalSize - totalCompressedSize;
    const processing = files.filter(f => f.status === 'compressing').length;
    const idle = files.filter(f => f.status === 'idle').length;
    
    return {
      completedCount: completed.length,
      processingCount: processing,
      idleCount: idle,
      totalOriginalMB: (totalOriginalSize / 1024 / 1024).toFixed(2),
      totalCompressedMB: (totalCompressedSize / 1024 / 1024).toFixed(2),
      savedMB: (saved / 1024 / 1024).toFixed(2),
      savedPercent: totalOriginalSize > 0 ? Math.round((saved / totalOriginalSize) * 100) : 0
    };
  }, [files]);

  const isCompactMode = files.length > 5;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>MediaCompress Pro</h1>
        <p>Kompresi Media Massal Aman, Cepat, dan Privat</p>
      </header>

      <section className={styles.workspace}>
        <Dropzone onFilesSelected={handleFilesSelected} />

        {files.length > 0 && (
          <div className={styles.dashboardContainer}>
            {/* Global Settings Panel */}
            <div className={`glass-panel ${styles.dashboardPanel}`}>
              <div className={styles.panelHeader}>
                <Settings size={20} />
                <h3>Pengaturan Global</h3>
              </div>
              <div className={styles.globalSettingsGrid}>
                <div className={styles.settingGroupInline}>
                  <label>Kualitas Gambar Default</label>
                  <input 
                    type="range" min="0.1" max="1" step="0.1" 
                    value={globalImageQuality} 
                    onChange={(e) => setGlobalImageQuality(parseFloat(e.target.value))} 
                    className={styles.rangeInput}
                  />
                </div>
                <div className={styles.settingGroupInline}>
                  <label>Resolusi Video Default</label>
                  <select 
                    value={globalVideoResolution} 
                    onChange={(e) => setGlobalVideoResolution(e.target.value)}
                    className={styles.select}
                  >
                    <option value="1920x1080">1080p (FHD)</option>
                    <option value="1280x720">720p (HD)</option>
                    <option value="854x480">480p (SD)</option>
                  </select>
                </div>
                <button className={styles.btnSecondary} onClick={applyGlobalSettings}>
                  Terapkan ke Semua Antrean
                </button>
              </div>
            </div>

            {/* Summary Dashboard */}
            <div className={`glass-panel ${styles.dashboardPanel}`}>
              <div className={styles.panelHeader}>
                <PieChart size={20} />
                <h3>Ringkasan Penghematan</h3>
              </div>
              <div className={styles.statsGrid}>
                <div className={styles.statBox}>
                  <span>Status</span>
                  <strong>{stats.completedCount} Selesai | {stats.processingCount} Diproses | {stats.idleCount} Antre</strong>
                </div>
                <div className={styles.statBox}>
                  <span>Ukuran Asli</span>
                  <strong>{stats.totalOriginalMB} MB</strong>
                </div>
                <div className={styles.statBox}>
                  <span>Hasil Kompresi</span>
                  <strong style={{ color: 'var(--success)' }}>{stats.totalCompressedMB} MB</strong>
                </div>
                <div className={styles.statBoxHighlight}>
                  <span>Ruang Dihemat</span>
                  <strong>{stats.savedMB} MB ({stats.savedPercent}%)</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div className={styles.batchActions}>
            <div className={styles.checkboxWrapper}>
              <input 
                type="checkbox" 
                checked={files.length > 0 && files.every(f => f.selected)}
                onChange={toggleSelectAll}
                id="selectAll"
              />
              <label htmlFor="selectAll">Pilih Semua</label>
            </div>
            <div className={styles.batchButtons}>
              <button 
                className={styles.btnPrimary} 
                onClick={compressSelected}
                disabled={!files.some(f => f.selected && f.status === 'idle')}
              >
                Kompres Terpilih
              </button>
              <button 
                className={styles.btnDanger} 
                onClick={removeSelected}
                disabled={!files.some(f => f.selected)}
              >
                Hapus Terpilih
              </button>
              <button 
                className={styles.btnSuccess} 
                onClick={downloadSelectedZip}
                disabled={!files.some(f => f.selected && f.status === 'done')}
              >
                <Download size={18} style={{ marginRight: '8px' }} />
                Unduh ZIP
              </button>
            </div>
          </div>
        )}

        <div className={isCompactMode ? styles.fileListCompact : styles.fileList}>
          {files.map(file => {
            const isVideo = file.originalFile.type.startsWith('video');
            
            return (
              <div key={file.id} className={`glass-panel ${styles.fileItemWrapper}`}>
                <div className={isCompactMode ? styles.fileItemCompact : styles.fileItem}>
                  <div className={styles.fileInfoGroup}>
                    <input 
                      type="checkbox" 
                      checked={file.selected || false} 
                      onChange={() => toggleSelection(file.id)}
                      className={styles.fileCheckbox}
                    />
                    <div className={isCompactMode ? styles.fileInfoCompact : styles.fileInfo}>
                      {file.previewUrl && (
                        <div className={styles.previewContainer}>
                          {isVideo ? (
                            <video src={file.previewUrl} className={styles.imagePreview} muted loop playsInline />
                          ) : (
                            <img src={file.previewUrl} alt="preview" className={styles.imagePreview} />
                          )}
                        </div>
                      )}
                      <div className={styles.fileDetails}>
                        <h4 title={file.originalFile.name}>{file.originalFile.name}</h4>
                        <p>
                          Asli: {(file.originalFile.size / 1024 / 1024).toFixed(2)} MB
                          {file.status === 'done' && file.compressedFile && (
                            <span style={{ color: 'var(--success)', marginLeft: '12px' }}>
                              Hasil: {(file.compressedFile.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={styles.fileActions}>
                    {file.status === 'idle' && !isCompactMode && (
                      <button className={styles.btnPrimary} onClick={() => startCompression(file)}>
                        Kompres
                      </button>
                    )}
                    {file.status === 'compressing' && (
                      <div className={styles.progressContainer}>
                        <div className={styles.progressBar} style={{ width: `${file.progress}%` }}></div>
                        <span>{file.progress}%</span>
                      </div>
                    )}
                    {file.status === 'done' && (
                      <>
                        <span className={styles.badgeSuccess}>Selesai</span>
                        {file.compressedFile && (
                          <button 
                            className={styles.btnSuccess} 
                            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                            onClick={() => handleDownloadFile(file.compressedFile!)}
                            title="Download file ini"
                          >
                            <Download size={16} />
                          </button>
                        )}
                      </>
                    )}
                    {file.status === 'error' && (
                      <span className={styles.badgeError}>Gagal</span>
                    )}
                    <button 
                      className={styles.btnDangerCompact} 
                      onClick={() => removeFile(file.id)}
                      title="Hapus file"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Individual Settings (Only in normal mode, or always if idle) */}
                {file.status === 'idle' && !isCompactMode && (
                  <div className={styles.fileSettingsPanel}>
                    {!isVideo ? (
                      <div className={styles.settingGroupInline}>
                        <label>Kualitas Kompresi</label>
                        <input 
                          type="range" 
                          min="0.1" max="1" step="0.1" 
                          value={file.imageQuality} 
                          onChange={(e) => updateFileSetting(file.id, 'imageQuality', parseFloat(e.target.value))} 
                          className={styles.rangeInput}
                        />
                      </div>
                    ) : (
                      <div className={styles.settingGroupInline}>
                        <label>Resolusi Target</label>
                        <select 
                          value={file.videoResolution} 
                          onChange={(e) => updateFileSetting(file.id, 'videoResolution', e.target.value)}
                          className={styles.select}
                        >
                          <option value="1920x1080">1080p (FHD)</option>
                          <option value="1280x720">720p (HD)</option>
                          <option value="854x480">480p (SD)</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
