import React from 'react';
import { Box, Button, IconButton } from '@mui/material';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HistoryIcon from '@mui/icons-material/History';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const fmtDate = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 个人中心：VIP 状态卡 + 两个快捷入口（历史记录 / 支付记录）。
 * 支付记录抽到独立视图 Payments，点击按钮路由进入。
 */
export default function Profile({ membership, onBuy, onBack, onGoHistory, onGoPayments }) {
  const isVip = membership?.isVip;

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

      {/* VIP 状态卡：跟首页横条统一视觉语言 */}
      <Box sx={{
        p: 2.5, mb: 3,
        borderRadius: 'var(--r-lg)',
        border: '1px solid',
        borderColor: isVip ? 'rgba(176, 138, 62, 0.28)' : 'var(--line)',
        background: isVip
          ? 'linear-gradient(135deg, #fdf6e4 0%, #f7ecca 100%)'
          : 'var(--bg-elev)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, mb: 1.5 }}>
          <Box sx={{
            width: 42, height: 42, borderRadius: 'var(--r-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isVip ? 'rgba(176, 138, 62, 0.20)' : 'var(--bg-mute)',
            color: isVip ? 'var(--gold)' : 'var(--ink-3)',
            flexShrink: 0,
          }}>
            <WorkspacePremiumIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Box sx={{ fontSize: '1rem', fontWeight: 650, color: 'var(--ink)', lineHeight: 1.25 }}>
              {isVip ? 'VIP 会员' : '普通用户'}
            </Box>
            <Box sx={{ fontSize: '0.82rem', color: 'var(--ink-2)', mt: 0.4 }}>
              {isVip ? (
                <>有效期至 <span className="num">{fmtDate(membership.vipExpireAt)}</span></>
              ) : (
                '开通 VIP 解锁行业细分数据、高薪人群分析、全部岗位文档'
              )}
            </Box>
          </Box>
        </Box>
        <Button
          onClick={onBuy}
          disableElevation
          sx={{
            px: 2.25, py: 0.85,
            fontSize: '0.85rem', fontWeight: 600,
            borderRadius: 'var(--r-sm)',
            color: '#fff',
            background: 'var(--ink)',
            textTransform: 'none',
            transition: 'transform .12s ease, background .2s ease, box-shadow .2s ease',
            '&:hover': { background: '#000', boxShadow: '0 4px 12px rgba(15, 20, 25, 0.18)' },
            '&:active': { transform: 'scale(0.97)' },
          }}
        >
          {isVip ? '续费' : '立即开通'}
        </Button>
      </Box>

      {/* 快捷入口：历史记录 / 支付记录 */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 1.25,
        mb: 3,
      }}>
        <EntryButton
          icon={<HistoryIcon sx={{ fontSize: 20 }} />}
          label="历史记录"
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
