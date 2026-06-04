import React, { useState, useEffect } from 'react';
import { Box, Button, Alert, CircularProgress, IconButton, Stack } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { fetchPackages, createOrder, mockPaid, invokeWechatPay, queryOrder } from '../utils/api';

const yuan = (cents) => `¥${(cents / 100).toFixed(2)}`;

/**
 * 开通 VIP 页：展示套餐 → 选中 → 调起微信支付。
 * 微信内走真 JSAPI；非微信环境（本地/桌面）走 fake mode + mock-paid 联调。
 * 支付成功回调 onPaid() 让父组件刷新会员状态。
 */
export default function Billing({ onPaid, onBack }) {
  const [packages, setPackages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    fetchPackages()
      .then((d) => {
        setPackages(d.packages);
        const rec = d.packages.find((p) => p.id === 'pkg_12m') || d.packages[0];
        setSelected(rec?.id || null);
      })
      .catch((e) => setError(e.message));
  }, []);

  const handlePay = async () => {
    if (!selected || loading) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const order = await createOrder(selected, '/billing');
      try {
        await invokeWechatPay(order.jsapi); // 微信内：真调起
        await pollUntilPaid(order.outTradeNo);
      } catch (wxErr) {
        if (order.fakeMode || wxErr.message === 'NOT_IN_WECHAT') {
          setInfo('当前为开发模式，模拟支付成功…');
          await mockPaid(order.outTradeNo);
        } else {
          throw wxErr;
        }
      }
      onPaid?.();
    } catch (err) {
      if (err.status === 401 && err.data?.needOauth) {
        window.location.href = `${import.meta.env.BASE_URL.replace(/\/$/, '')}${err.data.redirectTo}`;
        return;
      }
      setError(err.message || '支付失败');
    } finally {
      setLoading(false);
    }
  };

  const pollUntilPaid = async (outTradeNo) => {
    for (let i = 0; i < 10; i++) {
      const r = await queryOrder(outTradeNo);
      if (r.status === 'paid') return;
      await new Promise((res) => setTimeout(res, 1000));
    }
  };

  return (
    <Box sx={{ maxWidth: 540, mx: 'auto' }}>
      {/* 顶部返回 + 标题 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={onBack} disabled={loading} sx={{
          color: 'var(--ink-3)', mr: 0.5,
          '&:hover': { color: 'var(--ink)', background: 'var(--bg-mute)' },
        }}>
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <h2 className="h-section" style={{ fontSize: '1.15rem' }}>开通 VIP 会员</h2>
      </Box>
      <Box sx={{ fontSize: '0.875rem', color: 'var(--ink-2)', mb: 3, pl: 4.5, lineHeight: 1.6 }}>
        VIP 可查看行业细分数据、高薪人群分析、下载全部岗位文档
      </Box>

      {/* 套餐选择 */}
      <Stack spacing={1.25} sx={{ mb: 2.5 }}>
        {packages.map((p) => {
          const active = selected === p.id;
          return (
            <Box
              key={p.id}
              onClick={() => setSelected(p.id)}
              role="radio"
              aria-checked={active}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(p.id); } }}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                borderRadius: 'var(--r-md)',
                background: active ? 'var(--accent-soft)' : 'var(--bg-elev)',
                border: '1.5px solid',
                borderColor: active ? 'var(--accent)' : 'var(--line)',
                boxShadow: active ? '0 6px 18px rgba(15, 118, 110, 0.14)' : 'none',
                transition: 'all .18s cubic-bezier(0.2, 0.7, 0.2, 1)',
                '&:hover': {
                  borderColor: active ? 'var(--accent)' : 'var(--line-strong)',
                  background: active ? 'var(--accent-soft)' : 'var(--bg-mute)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CheckCircleIcon sx={{
                  color: active ? 'var(--accent)' : 'var(--ink-4)',
                  fontSize: 22,
                  transition: 'color .18s ease',
                }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ fontSize: '0.95rem', fontWeight: 600, color: active ? 'var(--accent-ink)' : 'var(--ink)', lineHeight: 1.3 }}>
                    {p.label}
                  </Box>
                  {p.badge && (
                    <Box sx={{
                      px: 0.85, py: 0.15,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      borderRadius: 'var(--r-xs)',
                      background: 'var(--gold-soft)',
                      color: 'var(--gold)',
                      border: '1px solid rgba(176, 138, 62, 0.30)',
                    }}>
                      {p.badge}
                    </Box>
                  )}
                </Box>
              </Box>
              <Box className="num" sx={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: active ? 'var(--accent-ink)' : 'var(--ink)',
                letterSpacing: '-0.01em',
              }}>
                {yuan(p.amountCents)}
              </Box>
            </Box>
          );
        })}
      </Stack>

      {info && <Alert severity="info" sx={{ mb: 2, borderRadius: 'var(--r-sm)' }}>{info}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 'var(--r-sm)' }}>{error}</Alert>}

      {/* 立即支付：墨黑主按钮，跟首页 VIP 横条按钮一致 */}
      <Button
        fullWidth
        onClick={handlePay}
        disabled={!selected || loading}
        disableElevation
        startIcon={loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
        sx={{
          py: 1.4,
          fontSize: '0.95rem',
          fontWeight: 600,
          borderRadius: 'var(--r-sm)',
          textTransform: 'none',
          letterSpacing: '0.01em',
          color: '#fff',
          background: 'var(--ink)',
          boxShadow: '0 4px 14px rgba(15, 20, 25, 0.18)',
          transition: 'transform .12s ease, background .2s ease, box-shadow .2s ease',
          '&:hover': { background: '#000', boxShadow: '0 6px 18px rgba(15, 20, 25, 0.24)' },
          '&:active': { transform: 'scale(0.985)' },
          '&.Mui-disabled': {
            color: '#aeb9c7',
            background: 'var(--bg-mute)',
            boxShadow: 'none',
          },
        }}
      >
        {loading ? '处理中…' : '立即支付'}
      </Button>

      <Box sx={{ textAlign: 'center', mt: 1.5, fontSize: '0.74rem', color: 'var(--ink-3)' }}>
        微信内将自动调起支付，桌面环境为开发模式
      </Box>
    </Box>
  );
}
