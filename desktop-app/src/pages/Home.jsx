import React from 'react';
import { useAuth } from '../hooks/useAuth';
import DashboardPage from './DashboardPage';
import Login from './Login';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return user ? <DashboardPage /> : <Login />;
}
