import { Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Toaster } from './toast.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import WorkspaceDetail from './pages/WorkspaceDetail.jsx';
import Audit from './pages/Audit.jsx';
import NotFound from './pages/NotFound.jsx';

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
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-fade-in flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-current border-t-transparent animate-spin"
               style={{ color: 'rgb(var(--accent))' }} />
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Carregando…</p>
        </div>
      </div>
    );
  }

  if (authState === 'no' && loc.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login onSuccess={() => navigate('/')} />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/workspaces/:id" element={<WorkspaceDetail />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </>
  );
}
