import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { Icon } from '../components/Icon.jsx';

export default function NotFound() {
  return (
    <Layout>
      <div className="card text-center py-16 max-w-md mx-auto animate-fade-in-scale">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-brand mb-4 animate-float">
          <Icon.Search width={32} height={32} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-1">404</h1>
        <p className="text-sm mb-6" style={{ color: 'rgb(var(--text-muted))' }}>
          Esta página não existe ou foi movida
        </p>
        <Link to="/" className="btn btn-primary">
          <Icon.Home width={14} height={14} /> Voltar ao dashboard
        </Link>
      </div>
    </Layout>
  );
}
