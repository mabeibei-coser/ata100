import { useState, useEffect, useCallback } from 'react'
import {
  Container, Box, Button, CircularProgress, IconButton,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined'
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined'
import HistoryIcon from '@mui/icons-material/History'
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import './styles/index.css'
import homeHeroDesktop from './assets/home-ata-hero-desktop.png'
import homeHeroMobile from './assets/home-ata-hero-mobile.png'
import LoginForm from './components/LoginForm'
import LegalView from './components/LegalView'
import Billing from './components/Billing'
import Profile from './components/Profile'
import History from './components/History'
import Payments from './components/Payments'
import { fetchMe, fetchMembership, logout } from './utils/api'

const fmtDate = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const daysLeft = (ts) => {
  if (!ts) return 0
  return Math.max(0, Math.ceil((ts - Date.now()) / 86400000))
}

// 手机号中间 4 位打码：18621933756 → 186****3756
const maskPhone = (p) => (p ? String(p).replace(/(\d{3})\d{6}(\d{2})/, '$1******$2') : p)

// 数据更新标签：始终显示当前真实年月（如「2026年6月」），随系统时间自动走
const currentMonthLabel = () => {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

// 岗位全景文档入口：A800 文档库（一库管两域，部署在 /a800/），按 category=人才ATA 过滤出薪酬域文档
const DOC_LIB_ATA_URL = '/a800/?category=' + encodeURIComponent('人才ATA')

// ata100 = 薪酬域会员中心
function App() {
  const [me, setMe] = useState(null)
  const [meReady, setMeReady] = useState(false)
  const [membership, setMembership] = useState(null)
  // 平台首页对所有人可见、不强制登录；点功能按钮时才校验。
  // 受保护视图（billing/profile/history）未登录会落到登录界面，登录后就地展开。
  // OAuth 回跳会落到 /ata100/billing：登录态已在，直接展开开通页，付款一气呵成。
  // 跨产品跳过来时带 ?view=history|profile|billing，直接展开对应页。
  const [view, setView] = useState(() => {
    if (typeof window === 'undefined') return 'home'
    if (window.location.pathname.replace(/\/+$/, '').endsWith('/billing')) return 'billing'
    const q = new URLSearchParams(window.location.search).get('view')
    if (q && ['history', 'profile', 'billing', 'payments'].includes(q)) return q
    return 'home'
  })
  // 跨产品按钮（薪资查询 /a500/、文档库）未登录时记下目标，登录后再跳
  const [pendingNav, setPendingNav] = useState(null)

  const refreshMembership = useCallback(() => {
    fetchMembership().then(setMembership).catch(() => setMembership(null))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then((data) => {
        if (cancelled) return
        setMe(data)
        if (data) refreshMembership()
      })
      .catch(() => { if (!cancelled) setMe(null) })
      .finally(() => { if (!cancelled) setMeReady(true) })
    return () => { cancelled = true }
  }, [refreshMembership])

  const handleLoggedIn = (data) => {
    setMe(data)
    refreshMembership()
    // 登录后回到用户原本想去的地方
    if (pendingNav) { const url = pendingNav; setPendingNav(null); window.location.href = url; return }
    // 主动点"登录"进来的回首页；进受保护视图（billing/profile/history）的就地展开，不动 view
    if (view === 'login') setView('home')
  }

  const handleLogout = async () => {
    try { await logout() } catch { /* ignore */ }
    setMe(null)
    setMembership(null)
    setView('home')
  }

  const handlePaid = () => {
    refreshMembership()
    setView('profile')
  }

  // 跳转到同域其它产品：已登录直接去；未登录先登录，登录后再去
  const goProduct = (url) => {
    if (me) { window.location.href = url }
    else { setPendingNav(url); setView('login') }
  }

  if (!meReady) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} sx={{ color: 'var(--accent)' }} />
      </Box>
    )
  }

  const GATED_VIEWS = ['billing', 'profile', 'history', 'payments']
  // 登录界面：主动点"登录"(view==='login')，或未登录却进了受保护视图 → 拦在这里登录
  const showLogin = view === 'login' || (GATED_VIEWS.includes(view) && !me)

  // 登录界面：顶对齐 + 纸感背景，与首页同款品牌底；左上角可返回首页
  if (showLogin) {
    return (
      <Box className="login-page" sx={{
        minHeight: '100dvh',
        display: 'flex', flexDirection: 'column',
        pt: { xs: '6vh', md: '8vh' }, pb: { xs: 4, md: 6 }, px: 2,
      }}>
        <Container maxWidth="xs" disableGutters sx={{ px: 0 }}>
          <Box sx={{ mb: 0.5 }}>
            <IconButton size="small" onClick={() => { setPendingNav(null); setView('home') }} sx={{
              color: 'var(--ink-3)',
              '&:hover': { color: 'var(--ink)', background: 'var(--bg-mute)' },
            }}>
              <ArrowBackIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            {/* logo + 柔光晕：品牌方块浮在一圈青绿微光上，更有质感 */}
            <Box sx={{ position: 'relative', width: 'fit-content', mx: 'auto', mb: 2.25 }}>
              <Box aria-hidden sx={{
                position: 'absolute', inset: -12, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(15,118,110,0.20), transparent 70%)',
                filter: 'blur(10px)', zIndex: 0,
              }} />
              <Box className="brand-mark brand-mark-lg" sx={{ position: 'relative', zIndex: 1 }}>
                <PaidOutlinedIcon sx={{ fontSize: 28 }} />
              </Box>
            </Box>
            <div className="h-eyebrow" style={{ marginBottom: 10 }}>登录ATA · 薪酬域</div>
            <h1 className="h-display" style={{ fontSize: '1.62rem', lineHeight: 1.14, marginBottom: 10 }}>
              查薪酬 · 看全景
            </h1>
            <p style={{ color: 'var(--ink-2)', fontSize: '0.86rem', lineHeight: 1.5, margin: '0 auto' }}>
              全行业薪资数据 · 岗位智能分析
            </p>
            {/* 数据新鲜度药丸：呼吸绿点 + 当前年月，传达「每月更新」的可信感 */}
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.7,
              mt: 1.6, px: 1.3, py: 0.5, borderRadius: 999,
              background: 'var(--accent-soft)', border: '1px solid rgba(15,118,110,0.18)',
              color: 'var(--accent-ink)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.01em',
            }}>
              <Box aria-hidden className="pulse-dot" sx={{
                width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
              }} />
              数据更新至 {currentMonthLabel()}
            </Box>
          </Box>
          <LoginForm onLoggedIn={handleLoggedIn} />
        </Container>
      </Box>
    )
  }

  const isVip = membership?.isVip
  const left = isVip ? daysLeft(membership.vipExpireAt) : 0

  if (view === 'home') {
    return (
      <HomeLanding
        onGoIdentify={() => goProduct('/a500/')}
        onGoResources={() => goProduct(DOC_LIB_ATA_URL)}
        onGoHistory={() => setView('history')}
        onGoProfile={() => setView('profile')}
      />
    )
  }

  return (
    <Box className="inner-page" sx={{ pb: { xs: 11, md: 12 } }}>
      {/* ═══ 玻璃浮顶 nav：左 brand mark + 标题；右 手机号 + 退出 ═══ */}
      <Box component="nav" className="top-nav-glass">
        <Container maxWidth="md" disableGutters sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box className="brand-mark">
              <PaidOutlinedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <Box sx={{ fontSize: '0.95rem', fontWeight: 750, color: 'var(--ink)', letterSpacing: '-0.012em' }}>
                薪酬域 · 会员中心
              </Box>
              <Box sx={{ fontSize: '0.66rem', fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase', mt: 0.25 }}>
                ata · membership
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            {me ? (
              <Box
                component="button"
                type="button"
                onClick={handleLogout}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  background: 'none', border: 0, padding: '4px 0',
                  cursor: 'pointer', fontFamily: 'inherit',
                  color: 'var(--ink-3)', transition: 'color .2s ease',
                  '&:hover': { color: 'var(--ink-2)' },
                }}
              >
                <Box className="num" sx={{ fontSize: '0.78rem', letterSpacing: '0.01em' }}>{maskPhone(me.phone)}</Box>
                <LogoutOutlinedIcon sx={{ fontSize: 15 }} />
              </Box>
            ) : (
              <Button onClick={() => setView('login')} disableElevation sx={{
                px: 1.75, py: 0.6, fontSize: '0.82rem', fontWeight: 600,
                borderRadius: 'var(--r-sm)', color: '#fff', background: 'var(--ink)',
                textTransform: 'none', letterSpacing: '0.01em',
                '&:hover': { background: '#000' },
              }}>
                登录
              </Button>
            )}
          </Box>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ pt: { xs: 3, md: 4 } }}>

        {view === 'home' && (
          <>
            {/* ═══ 欢迎区：左对齐，破对称 ═══ */}
            <Box className="rise rise-1" component="header" sx={{ mb: { xs: 4, md: 5 } }}>
              <div className="h-eyebrow" style={{ marginBottom: 10 }}>welcome back</div>
              <h1 className="h-display" style={{ marginBottom: 12 }}>
                查薪酬 · 看全景
              </h1>
              <p style={{ color: 'var(--ink-2)', fontSize: '0.95rem', lineHeight: 1.65, maxWidth: 560 }}>
                登录态在 ata100 全域通用，点击下方功能直接进入对应产品，无需重登。
              </p>
            </Box>

            {/* ═══ 主角：两张功能卡 ═══ */}
            <Box className="rise rise-2" component="section" sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: { xs: 2, md: 3 },
              mb: { xs: 3, md: 4 },
            }}>
              <FeatureCard
                icon={<PaidOutlinedIcon sx={{ fontSize: 26 }} />}
                eyebrow="A500"
                title="薪资查询"
                desc="输入岗位、公司、城市等条件，AI 生成薪酬分析报告。VIP 可查看行业细分与高薪人群数据。"
                href="/a500/"
                onActivate={() => goProduct('/a500/')}
              />
              <FeatureCard
                icon={<LibraryBooksOutlinedIcon sx={{ fontSize: 26 }} />}
                eyebrow="文档库"
                title="岗位全景文档"
                desc="薪酬调研 / 行业报告 / 岗位分析 / HR 模板，按主题检索。VIP 可下载全部文档。"
                href={DOC_LIB_ATA_URL}
                onActivate={() => goProduct(DOC_LIB_ATA_URL)}
              />
            </Box>

            {/* ═══ VIP 横条（次要）═══ */}
            <Box className="rise rise-3" component="section" sx={{
              p: { xs: 2, md: 2.25 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              mb: { xs: 4, md: 5 },
              borderRadius: 'var(--r-lg)',
              border: '1px solid',
              borderColor: isVip ? 'rgba(176, 138, 62, 0.28)' : 'var(--line)',
              background: isVip
                ? 'linear-gradient(135deg, #fdf6e4 0%, #f7ecca 100%)'
                : 'var(--bg-elev)',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, minWidth: 0 }}>
                <Box sx={{
                  width: 38, height: 38, borderRadius: 'var(--r-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isVip ? 'rgba(176, 138, 62, 0.18)' : 'var(--bg-mute)',
                  color: isVip ? 'var(--gold)' : 'var(--ink-3)',
                  flexShrink: 0,
                }}>
                  <WorkspacePremiumIcon sx={{ fontSize: 21 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>
                    {isVip ? 'VIP 会员' : '普通用户'}
                  </Box>
                  <Box sx={{ fontSize: '0.8rem', color: 'var(--ink-2)', mt: 0.4, lineHeight: 1.45 }}>
                    {isVip ? (
                      <>剩余 <span className="num" style={{ color: 'var(--ink)', fontWeight: 600 }}>{left}</span> 天 · 到期 <span className="num">{fmtDate(membership.vipExpireAt)}</span></>
                    ) : (
                      '尚未开通 · 升级后可查看行业细分数据与全部岗位文档'
                    )}
                  </Box>
                </Box>
              </Box>
              <Button
                onClick={() => setView('billing')}
                disableElevation
                sx={{
                  px: 2.25, py: 0.95,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: 'var(--r-sm)',
                  color: '#fff',
                  background: 'var(--ink)',
                  flexShrink: 0,
                  textTransform: 'none',
                  letterSpacing: '0.01em',
                  transition: 'transform .12s ease, background .2s ease, box-shadow .2s ease',
                  '&:hover': { background: '#000', boxShadow: '0 4px 12px rgba(15, 20, 25, 0.18)' },
                  '&:active': { transform: 'scale(0.97)' },
                }}
              >
                {isVip ? '续费' : '开通 VIP'}
              </Button>
            </Box>

            {/* ═══ 管理项：文字链组 ═══ */}
            <Box className="rise rise-4" component="nav" sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: { xs: 1.5, md: 2.5 },
              alignItems: 'center',
              justifyContent: 'center',
              mb: 5,
            }}>
              <TextLink onClick={() => setView('history')} icon={<HistoryIcon sx={{ fontSize: 14 }} />}>
                我的查询历史
              </TextLink>
              <Dot />
              <TextLink onClick={() => setView('profile')}>个人中心 · 购买记录</TextLink>
            </Box>
          </>
        )}

        {view !== 'home' && (
          <Box className="surface rise" component="section" sx={{ p: { xs: 2.5, md: 3.5 } }}>
            {view === 'billing' && <Billing onPaid={handlePaid} onBack={() => setView('home')} />}
            {view === 'profile' && <Profile membership={membership} onBuy={() => setView('billing')} onBack={() => setView('home')} onGoHistory={() => setView('history')} onGoPayments={() => setView('payments')} />}
            {view === 'history' && <History onBack={() => setView('home')} isVip={isVip} onGoBilling={() => setView('billing')} onGoSalaryReport={(id) => goProduct(`/a500/?historyId=${id}`)} />}
            {view === 'payments' && <Payments onBack={() => setView('profile')} />}
          </Box>
        )}

        <Box sx={{ mt: 5, pb: 3 }} />
      </Container>
      <BottomNav
        active={view === 'history' ? 'records' : view === 'home' ? 'home' : 'mine'}
        onGoHome={() => setView('home')}
        onGoHistory={() => setView('history')}
        onGoProfile={() => setView('profile')}
      />
    </Box>
  )
}

function HomeLanding({ onGoIdentify, onGoResources, onGoHistory, onGoProfile }) {
  const currentYear = new Date().getFullYear()
  return (
    <Box className="home-page">
      <main className="home-shell rise">
        <header className="home-title-wrap">
          <div className="home-data-version" aria-label="数据更新月份">
            <span className="home-data-version-dot" aria-hidden />
            大数据库版本 {currentMonthLabel()}
          </div>
          <h1 className="home-title">
            <span className="home-title-main">岗位薪资查询平台</span>
            <span className="home-title-version"><em>5.0</em><span className="home-title-badge">专业版</span></span>
          </h1>
        </header>

        <section className="home-visual-stage" aria-label="薪酬查询与岗位全景">
          <HomeHeroArt />
          <section className="home-actions" aria-label="主要功能">
            <HomeActionCard
              icon={<SalarySearchIcon />}
              label="薪资查询"
              onClick={onGoIdentify}
            />
            <HomeActionCard
              icon={<DocsFolderIcon />}
              label="岗位全景"
              onClick={onGoResources}
            />
          </section>
        </section>

        <footer className="home-footer-line">
          ATA大数据中心 2013-{currentYear} · 沪ICP备2023040758号-1
        </footer>

        <BottomNav active="home" onGoHome={() => {}} onGoHistory={onGoHistory} onGoProfile={onGoProfile} />
      </main>
    </Box>
  )
}

function HomeHeroArt() {
  return (
    <section className="home-hero-art" aria-hidden="true">
      <picture>
        <source media="(min-width: 768px)" srcSet={homeHeroDesktop} />
        <img className="home-hero-image" src={homeHeroMobile} alt="" draggable="false" />
      </picture>
    </section>
  )
}

function BottomNav({ active, onGoHome, onGoHistory, onGoProfile }) {
  return (
    <nav className="home-bottom-nav" aria-label="底部导航">
      <button
        className={`home-nav-item${active === 'home' ? ' is-active' : ''}`}
        type="button"
        onClick={onGoHome}
      >
        <HomeRoundedIcon />
        <span>首页</span>
      </button>
      <button
        className={`home-nav-item${active === 'records' ? ' is-active' : ''}`}
        type="button"
        onClick={onGoHistory}
      >
        <HistoryIcon />
        <span>记录</span>
      </button>
      <button
        className={`home-nav-item${active === 'mine' ? ' is-active' : ''}`}
        type="button"
        onClick={onGoProfile}
      >
        <PersonOutlineOutlinedIcon />
        <span>我的</span>
      </button>
    </nav>
  )
}

function SalarySearchIcon() {
  return (
    <svg className="home-custom-icon" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="salaryIconGradient" x1="22" y1="18" x2="74" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#17a79d" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <circle cx="42" cy="42" r="20" fill="none" stroke="url(#salaryIconGradient)" strokeWidth="4" />
      <line x1="56" y1="56" x2="74" y2="74" stroke="url(#salaryIconGradient)" strokeWidth="5" strokeLinecap="round" />
      <text x="42" y="48" textAnchor="middle" fill="url(#salaryIconGradient)" fontSize="22" fontWeight="700">¥</text>
    </svg>
  )
}

function DocsFolderIcon() {
  return (
    <svg className="home-custom-icon docs-folder-icon" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="docsFolderIconGradient" x1="22" y1="26" x2="78" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#24aaa0" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <path className="doc-sheet" d="M41 15h21l13 13v31H41Z" />
      <path className="doc-fold" d="M62 15v14h13" />
      <path className="doc-line" d="M48 37h19" />
      <path className="doc-line" d="M48 48h22" />
      <path className="folder-back" d="M18 38h22l7 8h31a6 6 0 0 1 6 6v5H18Z" />
      <path className="folder-front" d="M14 50h68c4 0 7 4 6 8l-5 22a7 7 0 0 1-7 5H21a7 7 0 0 1-7-7Z" />
    </svg>
  )
}

function HomeActionCard({ icon, label, onClick }) {
  return (
    <button className="home-action-card" type="button" onClick={onClick}>
      <span className="home-action-icon">{icon}</span>
      <span className="home-action-label">{label}</span>
    </button>
  )
}

// 主角功能卡：icon 左上 / eyebrow 右上 / 标题 + 描述 / CTA + 箭头
function FeatureCard({ icon, eyebrow, title, desc, href, onActivate }) {
  return (
    <Box
      component="a"
      href={href}
      onClick={(e) => { e.preventDefault(); onActivate?.() }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: { xs: 2.5, md: 2.75 },
        borderRadius: 'var(--r-lg)',
        background: 'var(--bg-elev)',
        border: '1px solid var(--line)',
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform .25s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow .25s ease, border-color .2s ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at top right, rgba(15, 118, 110, 0.07) 0%, transparent 55%)',
          opacity: 0,
          transition: 'opacity .3s ease',
          pointerEvents: 'none',
        },
        '&:hover': {
          borderColor: 'rgba(15, 118, 110, 0.32)',
          boxShadow: '0 14px 30px rgba(15, 118, 110, 0.13), 0 2px 6px rgba(15, 20, 25, 0.04)',
          transform: 'translateY(-2px)',
          '& .feature-arrow': { transform: 'translate(3px, -3px)' },
          '&::before': { opacity: 1 },
        },
        '&:active': { transform: 'translateY(0)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <Box sx={{
          width: 42, height: 42, borderRadius: 'var(--r-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          flexShrink: 0,
        }}>
          {icon}
        </Box>
        <Box className="h-eyebrow num" sx={{ mt: 0.7 }}>{eyebrow}</Box>
      </Box>
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <h2 className="h-section" style={{ marginBottom: 6, fontSize: '1.18rem', fontWeight: 700, letterSpacing: '-0.018em' }}>
          {title}
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--ink-2)', lineHeight: 1.6, textWrap: 'pretty' }}>
          {desc}
        </p>
      </Box>
      <Box sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.6,
        mt: 'auto',
        pt: 0.5,
        fontSize: '0.85rem',
        fontWeight: 600,
        color: 'var(--accent)',
        position: 'relative',
        zIndex: 1,
      }}>
        进入功能
        <ArrowOutwardIcon className="feature-arrow" sx={{ fontSize: 16, transition: 'transform .25s cubic-bezier(0.2, 0.7, 0.2, 1)' }} />
      </Box>
    </Box>
  )
}

function TextLink({ children, icon, onClick }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        background: 'none',
        border: 0,
        padding: '4px 2px',
        cursor: 'pointer',
        fontSize: '0.88rem',
        color: 'var(--ink-2)',
        fontFamily: 'inherit',
        transition: 'color .2s ease',
        '&:hover': { color: 'var(--accent)' },
      }}
    >
      {icon}
      {children}
    </Box>
  )
}

function Dot() {
  return <Box sx={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-4)' }} />
}

// ?legal=terms|privacy → 独立的协议/隐私查看页（无需登录，登录页勾选项新标签打开）
function getLegalType() {
  if (typeof window === 'undefined') return null
  const t = new URLSearchParams(window.location.search).get('legal')
  return t === 'terms' || t === 'privacy' ? t : null
}

function Root() {
  const legalType = getLegalType()
  if (legalType) return <LegalView type={legalType} />
  return <App />
}

export default Root
