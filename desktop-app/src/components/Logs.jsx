import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const response = await api.client.get('/audit/logs');
        if (response.data.success) {
          setLogs(response.data.data);
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setError('Audit log endpoint not implemented in backend yet.');
        } else {
          setError(err.message || 'Failed to fetch logs');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  if (loading) return <div>Loading logs...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="logs-container">
      <h3>Security Audit Logs</h3>
      {logs.length === 0 ? (
        <p>No activity logs found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Resource</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, index) => (
              <tr key={index}>
                <td>{new Date(log.created_at).toLocaleString()}</td>
                <td>{log.action}</td>
                <td>{log.resource_type}:{log.resource_id}</td>
                <td>{log.ip_address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
