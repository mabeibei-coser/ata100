import { useState, useEffect } from 'react'
import { Box, Container, CircularProgress, IconButton, Tooltip } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined'
import { fetchLegal } from '../utils/api'

const fmtDate = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 服务使用协议 / 隐私政策 查看页（无需登录，登录页勾选项新标签打开）。
// 正文由后台「系统设置」录入，可含图片（data URL 内联）。内容为内部超管可信录入，
// 故用 dangerouslySetInnerHTML 直接渲染。
export default function LegalView({ type }) {
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchLegal(type)
      .then((d) => { if (!cancelled) { setDoc(d); setError(null) } })
      .catch((e) => { if (!cancelled) setError(e.message || '加载失败') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [type])

  return (
    <Box className="login-page" sx={{ minHeight: '100dvh', py: { xs: 3, md: 5 }, px: 2 }}>
      <Container maxWidth="sm" disableGutters sx={{ px: 0 }}>
        {/* 顶部：品牌 + 关闭（新标签打开，关闭即回到登录页）*/}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box className="brand-mark"><PaidOutlinedIcon sx={{ fontSize: 18 }} /></Box>
            <Box sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--ink)' }}>薪酬域 · 会员中心</Box>
          </Box>
          <Tooltip title="关闭">
            <IconButton size="small" onClick={() => window.close()} sx={{ color: 'var(--ink-3)' }}>
              <ArrowBackIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{
          background: 'var(--bg-elev, #fff)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--line)', boxShadow: 'var(--shadow-sm)',
          p: { xs: 2.5, md: 3.5 },
        }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={26} sx={{ color: 'var(--accent)' }} />
            </Box>
          ) : error ? (
            <Box sx={{ color: 'var(--ink-2)', textAlign: 'center', py: 5 }}>加载失败：{error}</Box>
          ) : (
            <>
              <Box component="h1" sx={{ fontSize: '1.25rem', fontWeight: 750, color: 'var(--ink)', mb: 0.5 }}>
                {doc?.title}
              </Box>
              {doc?.updatedAt
                ? <Box sx={{ fontSize: '0.74rem', color: 'var(--ink-3)', mb: 2 }}>更新于 {fmtDate(doc.updatedAt)}</Box>
                : <Box sx={{ mb: 2 }} />}
              {doc?.content ? (
                <Box
                  className="legal-content"
                  sx={{
                    fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.75, wordBreak: 'break-word',
                    '& img': { maxWidth: '100%', height: 'auto', borderRadius: 8, my: 1, display: 'block' },
                    '& p': { my: 1 },
                    '& h1, & h2, & h3': { fontWeight: 700, mt: 2, mb: 1 },
                    '& ul, & ol': { pl: 3, my: 1 },
                    '& a': { color: 'var(--accent)' },
                  }}
                  dangerouslySetInnerHTML={{ __html: doc.content }}
                />
              ) : (
                <Box sx={{ color: 'var(--ink-3)', textAlign: 'center', py: 5 }}>
                  内容尚未配置，请稍后再来查看。
                </Box>
              )}
            </>
          )}
        </Box>
      </Container>
    </Box>
  )
}
