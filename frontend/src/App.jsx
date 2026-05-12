import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import WorkspaceDetail from './pages/WorkspaceDetail.jsx';

export default function App() {
  const [authState, setAuthState] = useState('loading'); // loading | yes | no
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    api.me()
      .then((r) => setAuthState(r.authenticated ? 'yes' : 'no'))
      .catch(() => setAuthState('no'));
  }, [loc.pathname]);

  if (authState === 'loading') {
    return <div className="h-full flex items-center justify-center text-slate-400">Carregando…</div>;
  }

  if (authState === 'no' && loc.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login onSuccess={() => navigate('/')} />} />
      <Route path="/" element={<Dashboard />} />
      <Route path="/workspaces/:id" element={<WorkspaceDetail />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
