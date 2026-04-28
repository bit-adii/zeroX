import React, { useState } from 'react';
import api from '../services/api';
import encryptionService from '../services/encryption';

export default function FileUpload({ onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleSelect = async () => {
    setError(null);
    try {
      if (window.electronAPI && window.electronAPI.selectFile) {
        const result = await window.electronAPI.selectFile();
        if (!result.canceled && result.success) {
          setSelectedFile(result);
        } else if (result.error) {
          setError(result.error);
        }
      } else {
        // Fallback: use HTML file input
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              setSelectedFile({
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                fileContent: Array.from(new Uint8Array(ev.target.result)),
                success: true,
              });
            };
            reader.readAsArrayBuffer(file);
          }
        };
        input.click();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);

    try {
      // Generate ephemeral key for file encryption
      const keyHex = encryptionService.generateKey();
      
      // Encrypt file
      const { encryptedData, iv } = await encryptionService.encryptFile(
        new Uint8Array(selectedFile.fileContent),
        keyHex
      );

      // Upload to API
      await api.uploadFile(
        selectedFile.fileName,
        encryptedData,
        iv,
        selectedFile.mimeType,
        selectedFile.fileSize
      );

      setSelectedFile(null);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h3>Upload File</h3>
        <p>Files are encrypted client-side before transmission. The server never sees plaintext.</p>
      </div>

      {error && <div className="error" style={{marginBottom: '16px'}}>{error}</div>}

      <div className="file-upload-card">
        <button
          className="file-drop-zone"
          style={{width: '100%', border: 'none', padding: 0}}
          onClick={handleSelect}
          disabled={uploading}
        >
          <div className="file-drop-zone">
            <div className="drop-icon">+</div>
            <p className="drop-title">Click to select a file</p>
            <p className="drop-hint">All files are AES-256-GCM encrypted before upload</p>
          </div>
        </button>

        {selectedFile && (
          <div className="selected-file-card">
            <div className="selected-file-info">
              <div className="file-name">{selectedFile.fileName}</div>
              <div className="file-size">{(selectedFile.fileSize / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <button className="btn-upload" onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Encrypting and Uploading...' : 'Encrypt and Upload'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

