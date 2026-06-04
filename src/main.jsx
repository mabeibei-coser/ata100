import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import App from './App.jsx'
import './styles/index.css'

// MUI theme：跟 src/styles/index.css 的 CSS var 保持同步（设计语言 v2 — 墨黑 + 深青绿 + 暖白纸感）
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0f766e', dark: '#0d6660', light: '#ccfbf1', contrastText: '#ffffff' },
    secondary: { main: '#525866' },
    background: { default: '#fafaf7', paper: '#ffffff' },
    text: { primary: '#0f1419', secondary: '#525866', disabled: '#9098a5' },
    divider: '#e6e6e1',
  },
  typography: {
    fontFamily: "'Inter Tight', 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif",
    h4: { fontWeight: 700, letterSpacing: '-0.025em' },
    h5: { fontWeight: 650, letterSpacing: '-0.018em' },
    h6: { fontWeight: 600, letterSpacing: '-0.012em' },
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8 }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6 }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700, fontSize: '0.875rem', color: '#1a1a2e' }
      }
    }
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
