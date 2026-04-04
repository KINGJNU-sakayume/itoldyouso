import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { ArtistSnapshot, Claim } from '../../types';

interface Props {
  claim: Claim;
}

interface ChartPoint {
  date: string;
  views: number | null;
  likes: number | null;
  vibeIndex: number;
  followers: number;
  popularity: number;
  isEntry?: boolean;
}

type YouTubeMetric = 'views' | 'likes' | 'vibeIndex';
type LegacyMetric = 'followers' | 'popularity';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

const CustomTooltip = ({
  active,
  payload,
  label,
  isYoutube,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  isYoutube?: boolean;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-3 shadow-lg text-xs">
      <p className="font-semibold text-[var(--color-text)] mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[var(--color-text-2)]">{p.name}:</span>
          <span className="font-medium text-[var(--color-text)]">
            {isYoutube ? formatCount(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function ClaimChart({ claim }: Props) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [ytMetric, setYtMetric] = useState<YouTubeMetric>('views');
  const [legacyMetric, setLegacyMetric] = useState<LegacyMetric>('followers');
  const { t } = useTranslation();

  const hasYoutube = claim.entry_youtube_view_count != null;

  useEffect(() => {
    const fetchSnapshots = async () => {
      const { data: snapshots } = await supabase
        .from('artist_snapshots')
        .select('*')
        .eq('claim_id', claim.id)
        .order('snapshot_date', { ascending: true });

      if (!snapshots?.length) {
        setData([{
          date: formatDate(claim.created_at),
          views: claim.entry_youtube_view_count ?? null,
          likes: claim.entry_youtube_like_count ?? null,
          vibeIndex: 0,
          followers: claim.entry_followers,
          popularity: claim.entry_popularity,
          isEntry: true,
        }]);
        return;
      }

      const points = snapshots.map((s: ArtistSnapshot, i: number) => ({
        date: formatDate(s.snapshot_date),
        views: (s as ArtistSnapshot & { youtube_view_count?: number }).youtube_view_count ?? null,
        likes: (s as ArtistSnapshot & { youtube_like_count?: number }).youtube_like_count ?? null,
        vibeIndex: s.vibe_index,
        followers: s.followers,
        popularity: s.popularity,
        isEntry: i === 0,
      }));
      setData(points);
    };

    fetchSnapshots();
  }, [claim.id]);

  const entryPoint = data.find(d => d.isEntry);
  const lastPoint = data[data.length - 1];

  const currentVal = hasYoutube
    ? (lastPoint?.[ytMetric] ?? 0)
    : (lastPoint?.[legacyMetric] ?? 0);

  const entryVal = hasYoutube
    ? (entryPoint?.[ytMetric] ?? 0)
    : (entryPoint?.[legacyMetric] ?? 0);

  const growth = (typeof entryVal === 'number' && entryVal > 0)
    ? ((Number(currentVal) - Number(entryVal)) / Number(entryVal) * 100).toFixed(0)
    : '0';
  const isPositive = Number(growth) >= 0;

  const dataKey: string = hasYoutube ? ytMetric : legacyMetric;
  const numericVals = data.map(d => Number((d as Record<string, unknown>)[dataKey]) || 0).filter(v => v != null);
  const minVal = Math.min(...numericVals);
  const maxVal = Math.max(...numericVals);
  const yPadding = (maxVal - minVal) * 0.1 || 5;

  const ytLabels: Record<YouTubeMetric, string> = {
    views: t('vault.views'),
    likes: t('vault.likes'),
    vibeIndex: t('vault.vibeIndex'),
  };

  const legacyLabels: Record<LegacyMetric, string> = {
    followers: t('claimChart.followers'),
    popularity: t('claimChart.popularity'),
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {hasYoutube ? (
          <>
            {(['views', 'likes', 'vibeIndex'] as YouTubeMetric[]).map(m => (
              <button
                key={m}
                onClick={() => setYtMetric(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  ytMetric === m
                    ? 'bg-[var(--color-text)] text-white'
                    : 'text-[var(--color-text-3)] hover:bg-[var(--color-surface-2)]'
                }`}
              >
                {ytLabels[m]}
              </button>
            ))}
          </>
        ) : (
          <>
            {(['followers', 'popularity'] as LegacyMetric[]).map(m => (
              <button
                key={m}
                onClick={() => setLegacyMetric(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  legacyMetric === m
                    ? 'bg-[var(--color-text)] text-white'
                    : 'text-[var(--color-text-3)] hover:bg-[var(--color-surface-2)]'
                }`}
              >
                {legacyLabels[m]}
              </button>
            ))}
          </>
        )}
        <span className={`ml-auto text-sm font-bold ${isPositive ? 'text-[var(--color-validated)]' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{growth}%
        </span>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${claim.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--color-text-3)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minVal - yPadding, maxVal + yPadding]}
            tick={false}
            axisLine={false}
            tickLine={false}
            width={0}
          />
          <Tooltip content={<CustomTooltip isYoutube={hasYoutube && ytMetric !== 'vibeIndex'} />} />
          <Area
            type="monotoneX"
            dataKey={dataKey}
            name={hasYoutube ? ytLabels[ytMetric] : legacyLabels[legacyMetric]}
            stroke="var(--color-accent)"
            strokeWidth={2}
            fill={`url(#grad-${claim.id})`}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-accent)', strokeWidth: 0 }}
          />
          {entryPoint && (
            <ReferenceDot
              x={entryPoint.date}
              y={Number((entryPoint as Record<string, unknown>)[dataKey]) || 0}
              r={5}
              fill="var(--color-primary)"
              stroke="white"
              strokeWidth={2}
              label={{ value: t('claimChart.entry'), position: 'top', fontSize: 9, fill: 'var(--color-primary)' }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
