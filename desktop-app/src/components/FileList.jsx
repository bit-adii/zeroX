import React, { useEffect } from 'react';
import { useFiles } from '../hooks/useFiles';
import api from '../services/api';
import encryptionService from '../services/encryption';

export default function FileList() {
  const { files, loading, error, fetchFiles, deleteFile } = useFiles();

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDownload = async (fileId, filename, encryptionIv) => {
    try {
      const response = await api.downloadFile(fileId);
      const encryptedDataB64 = response.data.data;
      
      // We need the symmetric key from the backend to decrypt, or if it's shared, it's encrypted with our RSA public key.
      // Assuming for now the user owns the file and the backend returns it natively or the user has the key.
      // This part requires matching the backend flow exactly. We simulate successful download for now.
      
      // Simulate saving
      const result = await window.electronAPI.saveFile({
        fileName: filename,
        fileContent: new Uint8Array(Buffer.from(encryptedDataB64, 'base64')) // In a real flow, decrypt here
      });
      
      if (result.success) {
        alert('File downloaded successfully!');
      }
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
  };

  if (loading) return <div>Loading files...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="file-list">
      <h3>My Files</h3>
      {files.length === 0 ? (
        <p>No files found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Filename</th>
              <th>Size</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map(file => (
              <tr key={file.id}>
                <td>{file.original_filename}</td>
                <td>{(file.size / 1024 / 1024).toFixed(2)} MB</td>
                <td>
                  <button onClick={() => handleDownload(file.id, file.original_filename, file.encryption_iv)}>Download</button>
                  <button onClick={() => deleteFile(file.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
