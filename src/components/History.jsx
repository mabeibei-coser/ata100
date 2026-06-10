import React, { useState, useEffect } from 'react';
import { Box, Stack, CircularProgress, IconButton, Snackbar, Alert } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { fetchHistory, fetchSalaryDetail } from '../utils/api';

const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function History({ isVip = false, onBack }) {
  const [items, setItems] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'info' });

  useEffect(() => {
    fetchHistory()
      .then((d) => { setItems(d.items); })
      .catch(() => setItems([]));
  }, []);

  const openDetail = async (id) => {
    if (!isVip) {
      setSnack({ open: true, msg: '开通 VIP 后可查看历史报告完整内容', severity: 'warning' });
      return;
    }
    setDetailLoading(true);
    try {
      setDetail(await fetchSalaryDetail(id));
    } catch (err) {
      setDetail(null);
      if (err?.status === 403 || err?.data?.needVip) {
        setSnack({ open: true, msg: err?.data?.error || '开通 VIP 后可查看历史报告完整内容', severity: 'warning' });
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const closeSnack = () => setSnack((s) => ({ ...s, open: false }));

  if (detail) {
    const r = detail.report;
    return (
      <Box sx={{ maxWidth: 540, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton size="small" onClick={() => setDetail(null)} sx={{
            color: 'var(--ink-3)', mr: 0.5,
            '&:hover': { color: 'var(--ink)', background: 'var(--bg-mute)' },
          }}>
            <ArrowBackIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <h2 className="h-section" style={{ fontSize: '1.15rem' }}>查询详情</h2>
        </Box>
        <Box sx={{ pl: 4.5, mb: 2.5 }}>
          <Box sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)', mb: 0.5 }}>
            {detail.position} · {detail.company}
          </Box>
          <Box sx={{ fontSize: '0.82rem', color: 'var(--ink-2)' }}>
            {detail.city} · {detail.rankLabel} · {detail.education}
          </Box>
          <Box className="num" sx={{ fontSize: '0.74rem', color: 'var(--ink-3)', mt: 0.35 }}>
            {fmtTime(detail.createdAt)}
          </Box>
        </Box>

        {r && (
          <Stack spacing={1.25}>
            {r.monthlySalary && (
              <InfoCard label="月薪范围">
                <Box className="num" sx={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ink)' }}>
                  {r.monthlySalary.p25 || '—'} ~ {r.monthlySalary.p75 || '—'} 元/月
                </Box>
                {r.monthlySalary.p50 && (
                  <Box sx={{ fontSize: '0.82rem', color: 'var(--ink-2)', mt: 0.25 }}>
                    中位数 {r.monthlySalary.p50} 元/月
                  </Box>
                )}
              </InfoCard>
            )}
            {r.annualSalary && (
              <InfoCard label="年薪范围">
                <Box className="num" sx={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ink)' }}>
                  {r.annualSalary.p25 || '—'} ~ {r.annualSalary.p75 || '—'} 万/年
                </Box>
              </InfoCard>
            )}
            {r.marketAnalysis && (
              <InfoCard label="市场分析">
                <Box sx={{ fontSize: '0.82rem', color: 'var(--ink-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                  {typeof r.marketAnalysis === 'string' ? r.marketAnalysis : JSON.stringify(r.marketAnalysis, null, 2)}
                </Box>
              </InfoCard>
            )}
          </Stack>
        )}

        {!r && (
          <Box sx={{ py: 3, textAlign: 'center', color: 'var(--ink-3)', fontSize: '0.85rem' }}>
            报告数据加载失败
          </Box>
        )}
      </Box>
    );
  }

  const hasItems = items && items.length > 0;
  return (
    <Box sx={{ maxWidth: 540, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton size="small" onClick={onBack} sx={{
          color: 'var(--ink-3)', mr: 0.5,
          '&:hover': { color: 'var(--ink)', background: 'var(--bg-mute)' },
        }}>
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <h2 className="h-section" style={{ fontSize: '1.15rem' }}>我的查询历史</h2>
        {hasItems && (
          <Box className="num" sx={{ ml: 'auto', fontSize: '0.78rem', color: 'var(--ink-3)' }}>
            {items.length} 条
          </Box>
        )}
      </Box>

      {items === null ? (
        <Box sx={{ textAlign: 'center', py: 5 }}>
          <CircularProgress size={22} sx={{ color: 'var(--accent)' }} />
        </Box>
      ) : items.length === 0 ? (
        <Box sx={{
          py: 5, textAlign: 'center',
          borderRadius: 'var(--r-md)',
          background: 'var(--bg-mute)',
        }}>
          <SearchOffIcon sx={{ fontSize: 38, color: 'var(--ink-4)', mb: 1.25 }} />
          <Box sx={{ color: 'var(--ink-2)', fontSize: '0.875rem', lineHeight: 1.6, maxWidth: 280, mx: 'auto' }}>
            暂无查询记录
            <Box sx={{ color: 'var(--ink-3)', fontSize: '0.78rem', mt: 0.5 }}>
              去薪资查询输入条件开始分析
            </Box>
          </Box>
        </Box>
      ) : (
        <Stack spacing={1}>
          {items.map((it) => (
            <Box
              key={`${it.source}-${it.id}`}
              onClick={() => openDetail(it.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(it.id); } }}
              sx={{
                p: 1.75,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                borderRadius: 'var(--r-md)',
                background: 'var(--bg-elev)',
                border: '1px solid var(--line)',
                transition: 'all .18s cubic-bezier(0.2, 0.7, 0.2, 1)',
                '&:hover': {
                  borderColor: 'rgba(37, 99, 235, 0.32)',
                  background: '#fff',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)',
                  transform: 'translateX(2px)',
                  '& .chevron': { transform: 'translateX(2px)', color: 'var(--accent)' },
                },
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
                  {it.position} · {it.company}
                </Box>
                <Box sx={{ fontSize: '0.78rem', color: 'var(--ink-2)', mt: 0.25 }}>
                  {it.city} · {it.rankLabel}
                </Box>
                <Box className="num" sx={{ fontSize: '0.74rem', color: 'var(--ink-3)', mt: 0.35 }}>
                  {fmtTime(it.createdAt)}
                </Box>
              </Box>
              <ChevronRightIcon className="chevron" sx={{
                fontSize: 18,
                color: 'var(--ink-4)',
                flexShrink: 0,
                transition: 'transform .2s ease, color .2s ease',
              }} />
            </Box>
          ))}
        </Stack>
      )}

      {detailLoading && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <CircularProgress size={18} sx={{ color: 'var(--accent)' }} />
        </Box>
      )}

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={closeSnack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} variant="filled" onClose={closeSnack} sx={{ borderRadius: 'var(--r-sm)' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function InfoCard({ label, children }) {
  return (
    <Box sx={{
      p: 2,
      borderRadius: 'var(--r-md)',
      background: 'var(--bg-elev)',
      border: '1px solid var(--line)',
    }}>
      <Box sx={{
        display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink)',
        mb: 0.6, pb: 0.25, borderBottom: '2px solid var(--accent)',
      }}>
        {label}
      </Box>
      {children}
    </Box>
  );
}
