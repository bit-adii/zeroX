import { useState, useCallback } from 'react';
import api from '../services/api';

export function useFiles() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listFiles();
      if (response.data.success) {
        setFiles(response.data.data.files);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch files');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteFile = async (fileId) => {
    try {
      await api.deleteFile(fileId);
      setFiles(files.filter(f => f.id !== fileId));
    } catch (err) {
      setError(err.message || 'Failed to delete file');
      throw err;
    }
  };

  return { files, loading, error, fetchFiles, deleteFile };
}
