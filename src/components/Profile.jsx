import React from 'react';
import { Box, Button, IconButton } from '@mui/material';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HistoryIcon from '@mui/icons-material/History';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

const fmtDate = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const daysLeft = (ts) => {
  if (!ts) return 0;
  return Math.max(0, Math.ceil((ts - Date.now()) / 86400000));
};

/**
 * 个人中心：VIP 状态卡 + 两个快捷入口（历史记录 / 支付记录）。
 * 支付记录抽到独立视图 Payments，点击按钮路由进入。
 */
export default function Profile({ membership, onBuy, onBack, onGoHistory, onGoPayments }) {
  const isVip = membership?.isVip;
  const left = isVip ? daysLeft(membership.vipExpireAt) : 0;

  return (
    <Box sx={{ maxWidth: 540, mx: 'auto' }}>
      {/* 顶部返回 + 标题 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton size="small" onClick={onBack} sx={{
          color: 'var(--ink-3)', mr: 0.5,
          '&:hover': { color: 'var(--ink)', background: 'var(--bg-mute)' },
        }}>
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <h2 className="h-section" style={{ fontSize: '1.15rem' }}>个人中心</h2>
      </Box>

      {/* VIP 状态卡：VIP → 金色 hero；非 VIP → 青绿玻璃卡 + 金色 CTA */}
      {isVip ? (
        <Box className="vip-hero" sx={{ p: 2.5, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, mb: 2, position: 'relative', zIndex: 1 }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: 'var(--r-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(180deg, #d6b25c 0%, #a8802f 100%)',
              color: '#fff',
              boxShadow: '0 6px 16px rgba(168, 128, 47, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.28)',
              flexShrink: 0,
            }}>
              <WorkspacePremiumIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Box className="h-eyebrow" sx={{ color: 'var(--gold)', mb: 0.2 }}>vip 会员</Box>
              <Box sx={{ fontSize: '1.05rem', fontWeight: 750, color: 'var(--ink)', lineHeight: 1.2, letterSpacing: '-0.012em' }}>
                有效期至 <span className="num">{fmtDate(membership.vipExpireAt)}</span>
              </Box>
            </Box>
          </Box>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            position: 'relative', zIndex: 1,
            pt: 1.5,
            borderTop: '1px dashed rgba(176, 138, 62, 0.32)',
          }}>
            <Box>
              <Box className="num" sx={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--gold)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                {left}
              </Box>
              <Box sx={{ fontSize: '0.74rem', color: 'var(--ink-2)', mt: 0.4, letterSpacing: '0.02em' }}>
                天剩余
              </Box>
            </Box>
            <Button
              onClick={onBuy}
              disableElevation
              className="btn-gold"
              sx={{
                px: 2.5, py: 1,
                fontSize: '0.88rem', fontWeight: 700,
                borderRadius: 'var(--r-sm)',
                textTransform: 'none',
              }}
            >
              立即续费
            </Button>
          </Box>
        </Box>
      ) : (
        <Box className="glass-hero" sx={{ p: 2.5, mb: 3, position: 'relative', overflow: 'hidden' }}>
          <Box sx={{
            position: 'absolute',
            top: -32, right: -32,
            width: 160, height: 160,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(204, 251, 241, 0.5), transparent 65%)',
            pointerEvents: 'none',
          }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, mb: 1.5, position: 'relative', zIndex: 1 }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: 'var(--r-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-mute)',
              color: 'var(--ink-3)',
              flexShrink: 0,
            }}>
              <LockOutlinedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Box className="h-eyebrow" sx={{ mb: 0.2 }}>普通用户</Box>
              <Box sx={{ fontSize: '1.05rem', fontWeight: 750, color: 'var(--ink)', lineHeight: 1.2, letterSpacing: '-0.012em' }}>
                解锁 VIP · 看全量数据
              </Box>
            </Box>
          </Box>
          <Box sx={{ fontSize: '0.82rem', color: 'var(--ink-2)', lineHeight: 1.6, mb: 2, position: 'relative', zIndex: 1 }}>
            行业细分薪酬、高薪人群画像、全部岗位文档 — 一次开通全部解锁
          </Box>
          <Button
            onClick={onBuy}
            disableElevation
            fullWidth
            className="btn-gold"
            sx={{
              py: 1.25,
              fontSize: '0.92rem', fontWeight: 700,
              borderRadius: 'var(--r-sm)',
              textTransform: 'none',
              position: 'relative', zIndex: 1,
            }}
          >
            立即开通 VIP
          </Button>
        </Box>
      )}

      {/* 快捷入口：历史记录 / 支付记录 */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 1.25,
        mb: 3,
      }}>
        <EntryButton
          icon={<HistoryIcon sx={{ fontSize: 20 }} />}
          label="查询历史"
          onClick={onGoHistory}
        />
        <EntryButton
          icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 20 }} />}
          label="支付记录"
          onClick={onGoPayments}
        />
      </Box>
    </Box>
  );
}

function EntryButton({ icon, label, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        px: 1.75,
        py: 1.4,
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--line)',
        background: 'var(--bg-elev)',
        color: 'var(--ink)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        transition: 'border-color .18s ease, background .18s ease, transform .12s ease',
        '&:hover': {
          borderColor: 'rgba(15, 118, 110, 0.32)',
          background: 'var(--bg-mute)',
        },
        '&:active': { transform: 'scale(0.985)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.15, minWidth: 0 }}>
        <Box sx={{
          width: 32, height: 32,
          borderRadius: 'var(--r-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          flexShrink: 0,
        }}>
          {icon}
        </Box>
        <Box sx={{ fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.25 }}>
          {label}
        </Box>
      </Box>
      <ChevronRightIcon sx={{ fontSize: 18, color: 'var(--ink-4)', flexShrink: 0 }} />
    </Box>
  );
}
