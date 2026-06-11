import React, { useState, useEffect } from 'react';
import { Box, Stack, CircularProgress, IconButton, Snackbar, Alert, Button, Dialog } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import { fetchHistory } from '../utils/api';

const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function History({ onBack, isVip, onGoBilling, onGoSalaryReport }) {
  const [items, setItems] = useState(null);
  const [vipPromptOpen, setVipPromptOpen] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'info' });

  useEffect(() => {
    fetchHistory()
      .then((d) => { setItems(d.items); })
      .catch(() => setItems([]));
  }, []);

  const tryOpenDetail = (id) => {
    if (!isVip) { setVipPromptOpen(true); return; }
    onGoSalaryReport?.(id);
  };

  const closeSnack = () => setSnack((s) => ({ ...s, open: false }));

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
              onClick={() => tryOpenDetail(it.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tryOpenDetail(it.id); } }}
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
              {isVip ? (
                <ChevronRightIcon className="chevron" sx={{
                  fontSize: 18,
                  color: 'var(--ink-4)',
                  flexShrink: 0,
                  transition: 'transform .2s ease, color .2s ease',
                }} />
              ) : (
                <LockOutlinedIcon sx={{
                  fontSize: 16,
                  color: 'var(--ink-4)',
                  flexShrink: 0,
                }} />
              )}
            </Box>
          ))}
        </Stack>
      )}

      <Dialog
        open={vipPromptOpen}
        onClose={() => setVipPromptOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 'var(--r-lg)',
            maxWidth: 320,
            width: 'calc(100% - 48px)',
            m: 0,
            overflow: 'hidden',
          },
        }}
      >
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Box sx={{
            width: 56, height: 56,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(176,138,62,0.18) 0%, rgba(176,138,62,0.08) 100%)',
            color: 'var(--gold)',
            mx: 'auto', mb: 2,
          }}>
            <WorkspacePremiumIcon sx={{ fontSize: 30 }} />
          </Box>
          <Box sx={{
            fontSize: '1.05rem', fontWeight: 700, color: 'var(--ink)',
            lineHeight: 1.35, letterSpacing: '-0.012em', mb: 1,
          }}>
            查看历史报告需开通 VIP
          </Box>
          <Box sx={{
            fontSize: '0.85rem', color: 'var(--ink-2)',
            lineHeight: 1.6, mb: 2.5,
          }}>
            开通 VIP 后可查看全部历史查询的完整薪酬分析报告
          </Box>
          <Box sx={{ display: 'flex', gap: 1.25 }}>
            <Button
              onClick={() => setVipPromptOpen(false)}
              disableElevation
              fullWidth
              sx={{
                py: 1.1, fontSize: '0.88rem', fontWeight: 600,
                borderRadius: 'var(--r-sm)',
                color: 'var(--ink-2)',
                background: 'var(--bg-mute)',
                textTransform: 'none',
                '&:hover': { background: 'var(--line)' },
              }}
            >
              稍后
            </Button>
            <Button
              onClick={() => { setVipPromptOpen(false); onGoBilling?.(); }}
              disableElevation
              fullWidth
              className="btn-gold"
              sx={{
                py: 1.1, fontSize: '0.88rem', fontWeight: 700,
                borderRadius: 'var(--r-sm)',
                textTransform: 'none',
              }}
            >
              立即开通
            </Button>
          </Box>
        </Box>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={closeSnack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} variant="filled" onClose={closeSnack} sx={{ borderRadius: 'var(--r-sm)' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
