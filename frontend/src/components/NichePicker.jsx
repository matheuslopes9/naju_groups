/**
 * Dropdown de nichos pré-cadastrados.
 * Quando o usuário escolhe um nicho, aplica via API (preenche keywords + audience).
 */
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { Icon } from './Icon.jsx';

export default function NichePicker({ ws, reload }) {
  const [niches, setNiches] = useState([]);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    api.availableNiches().then(setNiches).catch(() => {});
  }, []);

  async function apply(nicheId) {
    if (!nicheId) return;
    if (ws.keywords && ws.keywords.length > 0 &&
        !confirm('Aplicar este nicho vai SOBRESCREVER suas keywords atuais. Continuar?')) {
      return;
    }
    setApplying(true);
    try {
      await api.applyNiche(ws.id, nicheId);
      toast.success('Nicho aplicado — keywords atualizadas');
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setApplying(false); }
  }

  const current = niches.find((n) => n.id === ws.nichePreset);

  return (
    <div className="space-y-2">
      <select
        value={ws.nichePreset ?? ''}
        onChange={(e) => apply(e.target.value)}
        disabled={applying}
        className="input"
      >
        <option value="" disabled>Escolha um nicho…</option>
        {niches.map((n) => (
          <option key={n.id} value={n.id}>
            {n.label} ({n.audience === 'female' ? 'Feminino' : n.audience === 'male' ? 'Masculino' : 'Unissex'})
          </option>
        ))}
      </select>
      {current && (
        <div className="text-xs px-3 py-2 rounded-lg flex items-start gap-2"
             style={{ background: 'rgba(99,102,241,0.08)', color: 'rgb(129,140,248)' }}>
          <Icon.Check width={14} height={14} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">{current.label}</div>
            <div className="text-[10px] opacity-70 mt-0.5 line-clamp-2">
              {current.keywords.slice(0, 200) || '(sem keywords — aceita tudo)'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
