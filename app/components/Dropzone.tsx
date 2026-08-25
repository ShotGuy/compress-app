import React, { useCallback, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import styles from './Dropzone.module.css';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFilesSelected }) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const filesArray = Array.from(e.dataTransfer.files);
      onFilesSelected(filesArray);
    }
  }, [onFilesSelected]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const filesArray = Array.from(e.target.files);
      onFilesSelected(filesArray);
    }
  };

  return (
    <div 
      className={`${styles.dropzone} ${isDragActive ? styles.active : ''} glass-panel`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input 
        type="file" 
        id="file-upload" 
        multiple 
        // @ts-ignore - webkitdirectory is a valid attribute but React types sometimes complain
        webkitdirectory=""
        accept="image/*,video/*"
        onChange={handleChange}
        className={styles.input}
      />
      <label htmlFor="file-upload" className={styles.label}>
        <div className={styles.iconContainer}>
          <UploadCloud size={48} className={isDragActive ? 'gradient-text' : ''} />
        </div>
        <h3 className={styles.title}>
          <span className="gradient-text">Klik untuk upload</span> file atau folder
        </h3>
        <p className={styles.subtitle}>Atau seret file/folder ke sini. Mendukung JPG, PNG, WebP, MP4, WebM (Maks 2GB)</p>
      </label>
    </div>
  );
};
