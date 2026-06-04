import React, { useState, useEffect, useRef } from 'react';
import { Box, TextField, Button, Alert } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { sendSmsCode, verifySmsCode } from '../utils/api';

const PHONE_RE = /^1\d{10}$/;
// 与全站设计语言 v2 同步：深青绿（见 src/styles/index.css 的 --accent）
const ACCENT = '#0f766e';
const ACCENT_DARK = '#134e4a';
const ACCENT_RGB = '15, 118, 110';

/**
 * 手机号 + 短信验证码登录卡片。
 * 流程：输手机号 → 获取验证码（60s 倒计时）→ 输 6 位码 → 登录。
 * 登录成功后回调 onLoggedIn({ userId, phone })，由父组件刷新页面状态。
 */
export default function LoginForm({ onLoggedIn }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const timerRef = useRef(null);

  const phoneValid = PHONE_RE.test(phone);
  const codeValid = /^\d{6}$/.test(code);
  const canSend = phoneValid && !sending && countdown === 0;
  const canSubmit = phoneValid && codeValid && !loading;

  useEffect(() => () => clearInterval(timerRef.current), []);

  const startCountdown = () => {
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    setInfo(null);
    try {
      const data = await sendSmsCode(phone);
      startCountdown();
      setInfo(
        data.dev
          ? '开发模式：验证码未真实发送，请使用主验证码登录'
          : '验证码已发送，请查收短信'
      );
    } catch (err) {
      setError(err.message || '验证码发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const data = await verifySmsCode(phone, code);
      onLoggedIn?.(data);
    } catch (err) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 输入框统一样式：聚焦时品牌色描边 + 柔和高亮环
  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2.5,
      backgroundColor: '#fff',
      transition: 'box-shadow .2s ease, border-color .2s ease',
      '& fieldset': { borderColor: 'rgba(15,23,42,0.12)' },
      '&:hover fieldset': { borderColor: 'rgba(15, 118, 110, 0.35)' },
      '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(15, 118, 110, 0.10)' },
      '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: '1.5px' },
    },
    '& input': { fontSize: '0.95rem' },
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        maxWidth: 400,
        mx: 'auto',
        px: { xs: 2.75, md: 3.25 },
        pt: { xs: 2.75, md: 3.25 },
        pb: { xs: 2.5, md: 2.75 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        background: 'rgba(255, 255, 255, 0.92)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid rgba(15, 118, 110, 0.10)',
        boxShadow: '0 14px 36px rgba(15, 118, 110, 0.10), 0 2px 6px rgba(15, 20, 25, 0.04)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <TextField
        label="手机号"
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
        disabled={loading}
        placeholder="请输入 11 位手机号"
        inputMode="numeric"
        autoComplete="tel"
        fullWidth
        sx={fieldSx}
        error={Boolean(phone) && !phoneValid}
        helperText={phone && !phoneValid ? '手机号格式不正确（应为 1 开头 11 位）' : undefined}
        FormHelperTextProps={{ sx: { mt: 0.5, ml: 0.5 } }}
      />

      {/* 验证码 + 获取按钮：flex stretch 让按钮与输入框严格等高对齐 */}
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'stretch' }}>
        <TextField
          label="验证码"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={loading}
          placeholder="6 位验证码"
          inputMode="numeric"
          autoComplete="one-time-code"
          sx={{ ...fieldSx, flex: 1 }}
        />
        <Button
          onClick={handleSend}
          disabled={!canSend}
          variant="outlined"
          disableElevation
          sx={{
            flexShrink: 0,
            minWidth: 116,
            px: 1.25,
            fontSize: '0.875rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            borderRadius: 2.5,
            fontVariantNumeric: 'tabular-nums',
            color: canSend ? ACCENT : '#94a3b8',
            borderColor: canSend ? 'rgba(15, 118, 110, 0.45)' : 'rgba(15,23,42,0.15)',
            background: '#fff',
            transition: 'all .2s ease',
            '&:hover': { borderColor: ACCENT, background: 'rgba(15, 118, 110, 0.04)' },
            '&:active': { transform: 'scale(0.97)' },
            '&.Mui-disabled': { color: '#a8b5c4', borderColor: 'rgba(15,23,42,0.12)', background: '#fff' },
          }}
        >
          {countdown > 0 ? `${countdown}s 后重发` : sending ? '发送中…' : '获取验证码'}
        </Button>
      </Box>

      {info && <Alert severity="info" sx={{ borderRadius: 2.5, py: 0.5, alignItems: 'center' }}>{info}</Alert>}
      {error && <Alert severity="error" sx={{ borderRadius: 2.5, py: 0.5, alignItems: 'center' }}>{error}</Alert>}

      <Button
        type="submit"
        variant="contained"
        disableElevation
        disabled={!canSubmit}
        startIcon={loading ? null : <LoginIcon sx={{ fontSize: 20 }} />}
        sx={{
          mt: 0.5,
          py: 1.4,
          fontSize: '0.98rem',
          fontWeight: 600,
          borderRadius: 2.5,
          letterSpacing: '0.02em',
          color: '#fff',
          background: `linear-gradient(180deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`,
          boxShadow: `0 4px 14px rgba(${ACCENT_RGB}, 0.28)`,
          transition: 'transform .15s ease, box-shadow .2s ease, background .2s ease',
          '&:hover': {
            background: `linear-gradient(180deg, #157d75 0%, ${ACCENT} 100%)`,
            boxShadow: `0 6px 18px rgba(${ACCENT_RGB}, 0.34)`,
          },
          '&:active': { transform: 'scale(0.985)' },
          '&.Mui-disabled': {
            color: '#aeb9c7',
            background: '#eef1f6',
            boxShadow: 'none',
          },
        }}
      >
        {loading ? '登录中…' : '登 录'}
      </Button>
    </Box>
  );
}
