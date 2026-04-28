import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import FileList from './FileList';
import FileUpload from './FileUpload';
import Logs from './Logs';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('files');

  return (
    <div className="dashboard">
      <header>
        <div className="header-brand">
          <div className="brand-icon">ZT</div>
          <h2>
            Zero-Trust &nbsp;&mdash;&nbsp; <span className="username">{user?.username}</span>
          </h2>
        </div>

        <div className="header-right">
          <div className="user-badge">
            <span className="dot" />
            Secure Session
          </div>
          <button className="btn-logout" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <nav>
        <button className={activeTab === 'files'  ? 'active' : ''} onClick={() => setActiveTab('files')}>My Files</button>
        <button className={activeTab === 'upload' ? 'active' : ''} onClick={() => setActiveTab('upload')}>Upload File</button>
        <button className={activeTab === 'logs'   ? 'active' : ''} onClick={() => setActiveTab('logs')}>Audit Logs</button>
      </nav>

      <main>
        {activeTab === 'files'  && <FileList />}
        {activeTab === 'upload' && <FileUpload onUploadSuccess={() => setActiveTab('files')} />}
        {activeTab === 'logs'   && <Logs />}
      </main>
    </div>
  );
}
