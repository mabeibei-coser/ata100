import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Alert, CircularProgress, IconButton, Stack } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import { fetchPackages, createOrder, mockPaid, invokeWechatPay, queryOrder } from '../utils/api';

const yuan = (cents) => `¥${(cents / 100).toFixed(2)}`;
// 计算月均价格，给用户直观感
const perMonth = (cents, days) => {
  const months = Math.max(1, days / 30);
  return `¥${(cents / 100 / months).toFixed(0)}/月`;
};

const BENEFITS = [
  { icon: <TrendingUpIcon sx={{ fontSize: 18 }} />, title: '行业细分薪酬数据', desc: '按行业/城市/学历/职级拆解，覆盖 80+ 细分赛道' },
  { icon: <LibraryBooksOutlinedIcon sx={{ fontSize: 18 }} />, title: '全部岗位文档无限下载', desc: '薪酬调研、行业报告、HR 模板、岗位分析' },
  { icon: <AutoAwesomeOutlinedIcon sx={{ fontSize: 18 }} />, title: '高薪人群画像与背景分析', desc: 'P75/P90 分位、流向公司、跳槽节奏' },
  { icon: <BoltOutlinedIcon sx={{ fontSize: 18 }} />, title: '优先 AI 报告生成', desc: '高峰期不排队，新数据源优先开通' },
];

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

  // OAuth 回跳后由 ?autoPay=<id> 续触发支付；用 ref 避免 React 严格模式 effect 重复执行而重发单。
  const autoPayFiredRef = useRef(false);

  useEffect(() => {
    fetchPackages()
      .then((d) => {
        setPackages(d.packages);
        // OAuth 回跳带 ?autoPay=<id>：选中对应套餐并立即续起支付（避免用户点第二次）
        const params = new URLSearchParams(window.location.search);
        const autoPayId = params.get('autoPay');
        const matched = autoPayId && d.packages.find((p) => p.id === autoPayId);
        if (matched && !autoPayFiredRef.current) {
          autoPayFiredRef.current = true;
          setSelected(matched.id);
          // 清掉 URL 上的 autoPay，防止刷新页面又触发一次
          params.delete('autoPay');
          const search = params.toString();
          window.history.replaceState(null, '', window.location.pathname + (search ? `?${search}` : ''));
          handlePayFor(matched.id);
        } else {
          const rec = d.packages.find((p) => p.id === 'pkg_12m') || d.packages[0];
          setSelected(rec?.id || null);
        }
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 真正发起支付的核心逻辑；接受 packageId 入参，让 OAuth 回跳后能用 URL 上的 id 直接续起来。
  const handlePayFor = async (packageId) => {
    if (!packageId || loading) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const order = await createOrder(packageId, '/billing');
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
        // 跳 OAuth 前把 packageId 写进 from，回跳后挂载时自动续支付，免用户再点一次
        const base = import.meta.env.BASE_URL.replace(/\/$/, '');
        const from = encodeURIComponent(`/billing?autoPay=${encodeURIComponent(packageId)}`);
        window.location.href = `${base}/api/wechat/oauth/init?from=${from}`;
        return;
      }
      setError(err.message || '支付失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = () => handlePayFor(selected);

  const pollUntilPaid = async (outTradeNo) => {
    for (let i = 0; i < 10; i++) {
      const r = await queryOrder(outTradeNo);
      if (r.status === 'paid') return;
      await new Promise((res) => setTimeout(res, 1000));
    }
  };

  const selectedPkg = packages.find((p) => p.id === selected);

  return (
    <Box sx={{ maxWidth: 540, mx: 'auto' }}>
      {/* 顶部返回 */}
      <Box sx={{ mb: 2 }}>
        <IconButton size="small" onClick={onBack} disabled={loading} sx={{
          color: 'var(--ink-3)',
          '&:hover': { color: 'var(--ink)', background: 'var(--bg-mute)' },
        }}>
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* VIP Hero：金色光晕 + 大标题 + 权益清单 */}
      <Box className="vip-hero" sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, position: 'relative', zIndex: 1 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 'var(--r-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(180deg, #d6b25c 0%, #a8802f 100%)',
            color: '#fff',
            boxShadow: '0 6px 16px rgba(168, 128, 47, 0.32), inset 0 1px 0 rgba(255,255,255,0.28)',
            flexShrink: 0,
          }}>
            <WorkspacePremiumIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Box className="h-eyebrow" sx={{ color: 'var(--gold)', mb: 0.4 }}>
              ata100 vip
            </Box>
            <Box className="h-display" sx={{ fontSize: '1.45rem', lineHeight: 1.15 }}>
              解锁全量薪酬数据
            </Box>
          </Box>
        </Box>
        <Box sx={{
          fontSize: '0.86rem', color: 'var(--ink-2)',
          lineHeight: 1.55, mb: 2.25,
          position: 'relative', zIndex: 1,
        }}>
          一次开通，行业细分数据、高薪人群分析、全部岗位文档全部解锁
        </Box>

        {/* 权益 2×2 网格 */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1.25,
          position: 'relative', zIndex: 1,
        }}>
          {BENEFITS.map((b) => (
            <Box key={b.title} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.15 }}>
              <Box sx={{
                width: 28, height: 28, borderRadius: 'var(--r-xs)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(176, 138, 62, 0.18)',
                color: 'var(--gold)',
                flexShrink: 0,
                mt: 0.15,
              }}>
                {b.icon}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ fontSize: '0.84rem', fontWeight: 650, color: 'var(--ink)', lineHeight: 1.3 }}>
                  {b.title}
                </Box>
                <Box sx={{ fontSize: '0.74rem', color: 'var(--ink-2)', lineHeight: 1.45, mt: 0.2 }}>
                  {b.desc}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* 套餐选择标题 */}
      <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Box sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.012em' }}>
          选择套餐
        </Box>
        <Box className="h-eyebrow">step 1 / 2</Box>
      </Box>

      {/* 套餐选择：选中态金色光晕，"推荐"badge 更醒目 */}
      <Stack spacing={1.25} sx={{ mb: 2.5 }}>
        {packages.map((p) => {
          const active = selected === p.id;
          const isRecommended = p.badge && /推荐|划算|最|超值/.test(p.badge);
          return (
            <Box
              key={p.id}
              onClick={() => setSelected(p.id)}
              role="radio"
              aria-checked={active}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(p.id); } }}
              sx={{
                position: 'relative',
                p: 2,
                pl: 2.25,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                borderRadius: 'var(--r-md)',
                background: active
                  ? 'linear-gradient(180deg, #fff7e3 0%, #fdf2d4 100%)'
                  : 'var(--bg-elev)',
                border: '1.5px solid',
                borderColor: active ? 'var(--gold)' : 'var(--line)',
                boxShadow: active
                  ? '0 8px 22px rgba(176, 138, 62, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
                  : 'var(--shadow-sm)',
                transition: 'all .2s cubic-bezier(0.2, 0.7, 0.2, 1)',
                '&:hover': {
                  borderColor: active ? 'var(--gold)' : 'rgba(176, 138, 62, 0.40)',
                  transform: active ? 'none' : 'translateY(-1px)',
                  boxShadow: active
                    ? '0 8px 22px rgba(176, 138, 62, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
                    : '0 6px 14px rgba(15, 118, 110, 0.08)',
                },
              }}
            >
              {/* 推荐 ribbon */}
              {isRecommended && (
                <Box sx={{
                  position: 'absolute',
                  top: -10,
                  right: 14,
                  px: 0.85, py: 0.25,
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  borderRadius: 'var(--r-xs)',
                  background: 'linear-gradient(180deg, #c9a050 0%, #a8802f 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 10px rgba(168, 128, 47, 0.30)',
                }}>
                  {p.badge}
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                <CheckCircleIcon sx={{
                  color: active ? 'var(--gold)' : 'var(--ink-4)',
                  fontSize: 22,
                  flexShrink: 0,
                  transition: 'color .18s ease',
                }} />
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
                      {p.label}
                    </Box>
                    {p.badge && !isRecommended && (
                      <Box sx={{
                        px: 0.7, py: 0.15,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        borderRadius: 'var(--r-xs)',
                        background: 'var(--gold-soft)',
                        color: 'var(--gold)',
                        border: '1px solid rgba(176, 138, 62, 0.28)',
                      }}>
                        {p.badge}
                      </Box>
                    )}
                  </Box>
                  {p.durationDays > 30 && (
                    <Box className="num" sx={{
                      fontSize: '0.72rem',
                      color: active ? 'var(--gold)' : 'var(--ink-3)',
                      mt: 0.25, fontWeight: 600,
                    }}>
                      {perMonth(p.amountCents, p.durationDays)}
                    </Box>
                  )}
                </Box>
              </Box>
              <Box className="num" sx={{
                fontSize: '1.18rem',
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
                flexShrink: 0,
              }}>
                {yuan(p.amountCents)}
              </Box>
            </Box>
          );
        })}
      </Stack>

      {info && <Alert severity="info" sx={{ mb: 2, borderRadius: 'var(--r-sm)' }}>{info}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 'var(--r-sm)' }}>{error}</Alert>}

      {/* CTA：金色付费按钮 */}
      <Button
        fullWidth
        onClick={handlePay}
        disabled={!selected || loading}
        disableElevation
        className="btn-gold"
        startIcon={loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
        sx={{
          py: 1.5,
          fontSize: '1rem',
          fontWeight: 700,
          borderRadius: 'var(--r-sm)',
          textTransform: 'none',
        }}
      >
        {loading
          ? '处理中…'
          : selectedPkg
          ? `立即支付 ${yuan(selectedPkg.amountCents)} · 开通 VIP`
          : '立即支付'}
      </Button>

      {/* 信任元素：微信支付 + 加密 + 即时生效 */}
      <Box sx={{
        mt: 2,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: { xs: 1.5, sm: 2.5 },
        rowGap: 1,
      }}>
        <Trust icon={<LockOutlinedIcon sx={{ fontSize: 14 }} />} text="微信支付加密" />
        <Trust icon={<BoltOutlinedIcon sx={{ fontSize: 14 }} />} text="支付后立即生效" />
        <Trust icon={<VerifiedOutlinedIcon sx={{ fontSize: 14 }} />} text="谨世智能官方" />
      </Box>
    </Box>
  );
}

function Trust({ icon, text }) {
  return (
    <Box sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      fontSize: '0.72rem',
      color: 'var(--ink-3)',
      letterSpacing: '0.01em',
    }}>
      <Box sx={{ display: 'inline-flex', color: 'var(--ink-3)' }}>{icon}</Box>
      {text}
    </Box>
  );
}
