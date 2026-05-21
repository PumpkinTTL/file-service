/**
 * Toast & Modal 通知组件 — Bento Grid 苹果风
 *
 * 用法:
 *   Toast.success('操作成功')
 *   Toast.error('删除失败')
 *   Toast.warning('请注意')
 *   Toast.info('提示信息')
 *   Toast.confirm('确认删除？', () => { ... })
 */

;(function () {
  'use strict'

  /* ============================================================
     样式注入（一次性）
     ============================================================ */
  const CSS = `
    ._toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      max-width: 420px;
      width: calc(100% - 40px);
    }

    ._toast {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 18px;
      background: #FFFFFF;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
      pointer-events: auto;
      animation: _toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
      border: none;
    }

    ._toast.hiding {
      animation: _toastOut 0.25s ease forwards;
    }

    @keyframes _toastIn {
      from { opacity: 0; transform: translateX(40px) scale(0.96); }
      to   { opacity: 1; transform: translateX(0) scale(1); }
    }

    @keyframes _toastOut {
      from { opacity: 1; transform: translateX(0) scale(1); }
      to   { opacity: 0; transform: translateX(40px) scale(0.96); }
    }

    ._toast-icon {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }

    ._toast-icon svg { width: 14px; height: 14px; }

    ._toast.success ._toast-icon { background: rgba(22,163,74,0.1); color: #16A34A; }
    ._toast.error   ._toast-icon { background: rgba(220,38,38,0.1); color: #DC2626; }
    ._toast.warning ._toast-icon { background: rgba(217,119,6,0.1); color: #D97706; }
    ._toast.info    ._toast-icon { background: rgba(37,99,235,0.1); color: #2563EB; }
    ._toast.loading ._toast-icon { background: rgba(37,99,235,0.1); color: #2563EB; }

    ._toast.loading ._toast-icon svg {
      animation: _toastSpin 0.9s linear infinite;
    }

    @keyframes _toastSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    ._toast-body { flex: 1; min-width: 0; }

    ._toast-msg {
      font-size: 14px;
      font-weight: 500;
      color: #1D1D1F;
      line-height: 1.5;
    }

    ._toast-sub {
      font-size: 12px;
      color: #86868B;
      margin-top: 2px;
      line-height: 1.4;
    }

    ._toast-close {
      width: 24px;
      height: 24px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: #86868B;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s ease-out, color 0.15s ease-out;
      padding: 0;
      margin: -2px -4px -2px 0;
    }

    ._toast-close:hover {
      background: #F5F5F7;
      color: #1D1D1F;
    }

    ._toast-close svg { width: 14px; height: 14px; }

    ._toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
      border-radius: 0 0 12px 12px;
      animation: _toastProgress linear forwards;
    }

    ._toast.success ._toast-progress { background: rgba(22,163,74,0.3); }
    ._toast.error   ._toast-progress { background: rgba(220,38,38,0.3); }
    ._toast.warning ._toast-progress { background: rgba(217,119,6,0.3); }
    ._toast.info    ._toast-progress { background: rgba(37,99,235,0.3); }
    ._toast.loading ._toast-progress { display: none; }

    @keyframes _toastProgress {
      from { width: 100%; }
      to   { width: 0%; }
    }

    /* ============================================================
       Confirm Modal
       ============================================================ */
    ._confirm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.3);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
      animation: _confirmFadeIn 0.2s ease;
    }

    @keyframes _confirmFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    ._confirm {
      background: #FFFFFF;
      border-radius: 16px;
      padding: 28px;
      width: 400px;
      max-width: 90vw;
      box-shadow: 0 8px 40px rgba(0,0,0,0.12);
      animation: _confirmSlide 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes _confirmSlide {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    ._confirm-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(220,38,38,0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #DC2626;
      margin-bottom: 16px;
    }

    ._confirm-icon svg { width: 22px; height: 22px; }

    ._confirm-title {
      font-size: 16px;
      font-weight: 700;
      color: #1D1D1F;
      margin-bottom: 6px;
    }

    ._confirm-msg {
      font-size: 14px;
      color: #86868B;
      line-height: 1.5;
      margin-bottom: 24px;
    }

    ._confirm-actions {
      display: flex;
      gap: 10px;
    }

    ._confirm-actions button {
      flex: 1;
      padding: 10px 16px;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s ease-out, transform 0.1s ease-out;
    }

    ._confirm-actions button:active { transform: scale(0.97); }

    ._confirm-cancel {
      background: #F5F5F7;
      color: #1D1D1F;
    }

    ._confirm-cancel:hover { background: #E5E5E5; }

    ._confirm-ok {
      background: #DC2626;
      color: #FFFFFF;
    }

    ._confirm-ok:hover { background: #B91C1C; }

    @media (max-width: 480px) {
      ._toast-container {
        top: auto;
        bottom: 16px;
        right: 16px;
        left: 16px;
        max-width: none;
        width: auto;
      }
      ._toast { border-radius: 10px; }
      ._confirm { border-radius: 12px; padding: 20px; }
      ._confirm-actions { flex-direction: column; }
    }
  `

  const styleEl = document.createElement('style')
  styleEl.textContent = CSS
  document.head.appendChild(styleEl)

  /* ============================================================
     SVG 图标
     ============================================================ */
  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    close:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    danger:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    loading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>'
  }

  /* ============================================================
     Toast Container
     ============================================================ */
  let container = null

  function getContainer() {
    if (!container) {
      container = document.createElement('div')
      container.className = '_toast-container'
      document.body.appendChild(container)
    }
    return container
  }

  /* ============================================================
     Toast
     ============================================================ */
  function showToast(type, message, options) {
    options = options || {}
    var duration = options.duration === 0 ? 0 : (options.duration || 3000)
    var sub = options.sub || ''

    var el = document.createElement('div')
    el.className = '_toast ' + type

    el.innerHTML =
      '<div class="_toast-icon">' + ICONS[type] + '</div>' +
      '<div class="_toast-body">' +
        '<div class="_toast-msg">' + escapeHtml(message) + '</div>' +
        (sub ? '<div class="_toast-sub">' + escapeHtml(sub) + '</div>' : '') +
      '</div>' +
      '<button class="_toast-close">' + ICONS.close + '</button>' +
      (duration > 0 ? '<div class="_toast-progress" style="animation-duration:' + duration + 'ms"></div>' : '')

    var closeBtn = el.querySelector('._toast-close')
    var timer = null
    var dismissed = false

    function dismiss() {
      if (dismissed) return
      dismissed = true
      clearTimeout(timer)
      el.classList.add('hiding')
      setTimeout(function () { el.remove() }, 250)
    }

    closeBtn.addEventListener('click', dismiss)
    if (duration > 0) timer = setTimeout(dismiss, duration)

    getContainer().appendChild(el)
    return { dismiss: dismiss }
  }

  /* ============================================================
     Confirm
     ============================================================ */
  function showConfirm(message, onOk, options) {
    options = options || {}
    var title = options.title || '确认操作'
    var okText = options.okText || '确认'
    var cancelText = options.cancelText || '取消'

    var overlay = document.createElement('div')
    overlay.className = '_confirm-overlay'

    overlay.innerHTML =
      '<div class="_confirm">' +
        '<div class="_confirm-icon">' + ICONS.danger + '</div>' +
        '<div class="_confirm-title">' + escapeHtml(title) + '</div>' +
        '<div class="_confirm-msg">' + escapeHtml(message) + '</div>' +
        '<div class="_confirm-actions">' +
          '<button class="_confirm-cancel">' + escapeHtml(cancelText) + '</button>' +
          '<button class="_confirm-ok">' + escapeHtml(okText) + '</button>' +
        '</div>' +
      '</div>'

    function close() {
      overlay.remove()
    }

    overlay.querySelector('._confirm-cancel').addEventListener('click', close)
    overlay.querySelector('._confirm-ok').addEventListener('click', function () {
      close()
      if (onOk) onOk()
    })
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close()
    })

    document.body.appendChild(overlay)
    return { close: close }
  }

  /* ============================================================
     Helpers
     ============================================================ */
  function escapeHtml(str) {
    var div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

  /* ============================================================
     Export
     ============================================================ */
  window.Toast = {
    success: function (msg, opts) { return showToast('success', msg, opts) },
    error:   function (msg, opts) { return showToast('error', msg, opts) },
    warning: function (msg, opts) { return showToast('warning', msg, opts) },
    info:    function (msg, opts) { return showToast('info', msg, opts) },
    loading: function (msg, opts) { return showToast('loading', msg, Object.assign({ duration: 0 }, opts || {})) },
    confirm: showConfirm
  }
})()
