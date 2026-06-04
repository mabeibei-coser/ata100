import React, { useState, useEffect } from 'react';
import { Box, Stack, CircularProgress, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { fetchLedger } from '../utils/api';

const fmtDate = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const yuan = (cents) => `¥${(cents / 100).toFixed(2)}`;
const LEDGER_LABEL = { activate: '开通会员', renew: '续费会员', admin_adjust: '后台调整' };

/**
 * 支付记录：用户的 VIP 开通/续费台账。
 * 从个人中心点击"支付记录"按钮进入，独立视图。
 */
export default function Payments({ onBack }) {
  const [ledger, setLedger] = useState(null);

  useEffect(() => {
    fetchLedger().then((d) => setLedger(d.ledger)).catch(() => setLedger([]));
  }, []);

  return (
    <Box sx={{ maxWidth: 540, mx: 'auto' }}>
      {/* 顶部返回 + 标题 + 笔数 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton size="small" onClick={onBack} sx={{
          color: 'var(--ink-3)', mr: 0.5,
          '&:hover': { color: 'var(--ink)', background: 'var(--bg-mute)' },
        }}>
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <h2 className="h-section" style={{ fontSize: '1.15rem' }}>支付记录</h2>
        {ledger && ledger.length > 0 && (
          <Box className="num" sx={{ ml: 'auto', fontSize: '0.78rem', color: 'var(--ink-3)' }}>
            {ledger.length} 笔
          </Box>
        )}
      </Box>

      {ledger === null ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress size={22} sx={{ color: 'var(--accent)' }} />
        </Box>
      ) : ledger.length === 0 ? (
        <Box sx={{
          py: 6, textAlign: 'center',
          borderRadius: 'var(--r-md)',
          background: 'var(--bg-mute)',
          color: 'var(--ink-3)',
          fontSize: '0.9rem',
        }}>
          暂无支付记录
        </Box>
      ) : (
        <Box sx={{
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--line)',
          background: 'var(--bg-elev)',
          boxShadow: 'var(--shadow-sm)',
          px: 2,
        }}>
          <Stack divider={<Box sx={{ height: '1px', background: 'var(--line)' }} />}>
            {ledger.map((l) => (
              <Box key={l.id} sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                py: 1.75,
              }}>
                <Box>
                  <Box sx={{ fontSize: '0.9rem', fontWeight: 550, color: 'var(--ink)', lineHeight: 1.3 }}>
                    {LEDGER_LABEL[l.type] || l.type}
                    {l.duration_days > 0 && (
                      <Box component="span" sx={{ color: 'var(--ink-3)', fontWeight: 400 }}> · {l.duration_days} 天</Box>
                    )}
                  </Box>
                  <Box className="num" sx={{ fontSize: '0.76rem', color: 'var(--ink-3)', mt: 0.4 }}>
                    {fmtDate(l.created_at)}
                  </Box>
                </Box>
                <Box className="num" sx={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--ink)' }}>
                  {yuan(l.amount_cents)}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
