/**
 * Toast & Modal — Apple 灵动岛风格
 *
 * 灵感：iPhone Dynamic Island
 * 特征：顶部居中暗色胶囊 / 弹性展开收缩 / 极简
 *
 * 用法:
 *   Toast.success('操作成功')
 *   Toast.error('删除失败')
 *   Toast.warning('请注意')
 *   Toast.info('提示信息')
 *   Toast.loading('加载中...')
 *   Toast.confirm('确认删除？', () => { ... })
 */

;(function () {
  'use strict'

  var CSS = `
    /* ============================================================
       灵动岛 Toast
       ============================================================ */
    ._island-wrap {
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, "Noto Sans SC", sans-serif;
    }

    /* 亮色胶囊 — 只用 transform + opacity 驱动动画 */
    ._island {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #fff;
      border: 1px solid #E2E8F0;
      color: #1E293B;
      border-radius: 22px;
      pointer-events: auto;
      position: relative;
      overflow: hidden;
      max-width: 360px;
      will-change: transform, opacity;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      transform: scaleX(.3) scaleY(.6);
      opacity: 0;
    }

    /* ---- 内部元素初始态 ---- */
    ._island-icon,
    ._island-body,
    ._island-close {
      opacity: 0;
      transform: translateY(4px) scale(.85);
      transition: opacity .25s ease, transform .3s cubic-bezier(.34,1.56,.64,1);
    }

    /* 入场：第1层 — 壳展开 */
    ._island.show {
      transform: scaleX(1) scaleY(1);
      opacity: 1;
      transition:
        transform .5s cubic-bezier(.34,1.56,.64,1),
        opacity .2s ease;
    }

    /* 入场：第2层 — 内部元素依次弹入 */
    ._island.show ._island-icon {
      opacity: 1; transform: translateY(0) scale(1);
      transition-delay: .12s;
    }
    ._island.show ._island-body {
      opacity: 1; transform: translateY(0) scale(1);
      transition-delay: .18s;
    }
    ._island.show ._island-close {
      opacity: 1; transform: translateY(0) scale(1);
      transition-delay: .22s;
    }

    ._island.show:hover {
      box-shadow: 0 4px 16px rgba(0,0,0,.1);
      border-color: #CBD5E1;
      transition: box-shadow .2s ease, border-color .2s ease;
    }

    /* 退场 — 入场的倒放：close先走 → body → icon → 壳缩 */
    ._island.hide ._island-close {
      opacity: 0; transform: translateY(4px) scale(.85);
      transition-delay: 0s; transition-duration: .12s;
    }
    ._island.hide ._island-body {
      opacity: 0; transform: translateY(4px) scale(.85);
      transition-delay: .04s; transition-duration: .12s;
    }
    ._island.hide ._island-icon {
      opacity: 0; transform: translateY(4px) scale(.85);
      transition-delay: .08s; transition-duration: .12s;
    }
    ._island.hide {
      transform: scaleX(.3) scaleY(.6);
      opacity: 0;
      transition:
        transform .22s cubic-bezier(.55,.06,.68,.19),
        opacity .12s ease;
      transition-delay: .12s;
    }

    /* ========== 图标 ========== */
    ._island-icon {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    ._island-icon svg { width: 11px; height: 11px; display: block; }

    ._island.success ._island-icon { background: #ECFDF5; color: #16A34A; }
    ._island.error   ._island-icon { background: #FEF2F2; color: #EF4444; }
    ._island.warning ._island-icon { background: #FFFBEB; color: #F59E0B; }
    ._island.info    ._island-icon { background: #EFF6FF; color: #3B82F6; }
    ._island.loading ._island-icon { background: #EFF6FF; color: #3B82F6; }

    /* Success 画线 */
    ._island.success ._check-path {
      stroke-dasharray: 20; stroke-dashoffset: 20;
      transition: stroke-dashoffset .4s ease .22s;
    }
    ._island.show ._check-path { stroke-dashoffset: 0; }

    /* Loading */
    ._island.loading ._island-icon svg { animation: _islandSpin .7s linear infinite; }
    @keyframes _islandSpin { to { transform: rotate(360deg); } }

    /* ========== 文字 ========== */
    ._island-body { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; }
    ._island-msg { font-size: 13px; font-weight: 500; color: #1E293B; line-height: 1.4; }
    ._island-sub { font-size: 11px; color: #94A3B8; margin-top: 1px; line-height: 1.3; }

    /* ========== 关闭 ========== */
    ._island-close {
      width: 18px; height: 18px; border-radius: 50%; border: none;
      background: #F1F5F9; color: #94A3B8;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; padding: 0; margin: 0;
      transition: background .12s ease, color .12s ease;
    }
    ._island-close:hover { background: #E2E8F0; color: #64748B; }
    ._island-close svg { width: 9px; height: 9px; display: block; }

    /* ========== 进度条 ========== */
    ._island-progress {
      position: absolute; bottom: 3px; left: 16px; right: 16px;
      height: 1.5px; border-radius: 1px; pointer-events: none; opacity: .3;
      animation: _islandProg linear forwards;
    }
    ._island.success ._island-progress { background: #16A34A; }
    ._island.error   ._island-progress { background: #EF4444; }
    ._island.warning ._island-progress { background: #F59E0B; }
    ._island.info    ._island-progress { background: #3B82F6; }
    ._island.loading ._island-progress { display: none; }
    @keyframes _islandProg { from { transform: scaleX(1); } to { transform: scaleX(0); } }

    /* ============================================================
       灵动岛 Confirm — 展开大胶囊
       ============================================================ */
    ._confirm-overlay {
      position: fixed; inset: 0; z-index: 10000;
      display: flex; justify-content: center; align-items: flex-start; padding-top: 12px;
      background: rgba(0,0,0,0);
      transition: background .2s ease;
      pointer-events: none;
    }
    ._confirm-overlay.active { background: rgba(0,0,0,.15); pointer-events: auto; }
    ._confirm-overlay.closing { background: rgba(0,0,0,0); transition: background .15s ease; }

    ._confirm {
      background: #fff;
      border: 1px solid #E2E8F0;
      color: #1E293B;
      border-radius: 24px;
      width: max-content; max-width: 340px; min-width: 240px;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
      transform: scaleX(.3) scaleY(.6);
      opacity: 0; overflow: hidden;
      transition: transform .5s cubic-bezier(.34,1.56,.64,1), opacity .2s ease;
    }

    /* ---- Confirm 内部元素分层 ---- */
    ._confirm-inner {
      padding: 20px 24px 16px; text-align: center;
      opacity: 0; transform: translateY(6px) scale(.9);
      transition: opacity .25s ease, transform .35s cubic-bezier(.34,1.56,.64,1);
    }
    ._confirm-actions {
      display: flex; border-top: 1px solid #F1F5F9;
      opacity: 0; transform: translateY(4px);
      transition: opacity .2s ease, transform .25s ease;
    }

    /* 入场：壳先展开 */
    ._confirm-overlay.active ._confirm { transform: scaleX(1) scaleY(1); opacity: 1; }
    /* 然后内部弹入 */
    ._confirm-overlay.active ._confirm-inner {
      opacity: 1; transform: translateY(0) scale(1);
      transition-delay: .15s;
    }
    ._confirm-overlay.active ._confirm-actions {
      opacity: 1; transform: translateY(0);
      transition-delay: .25s;
    }

    /* 退场 — 入场倒放 */
    ._confirm-overlay.closing ._confirm-actions {
      opacity: 0; transform: translateY(4px);
      transition-delay: 0s; transition-duration: .1s;
    }
    ._confirm-overlay.closing ._confirm-inner {
      opacity: 0; transform: translateY(6px) scale(.9);
      transition-delay: .06s; transition-duration: .12s;
    }
    ._confirm-overlay.closing ._confirm {
      transform: scaleX(.3) scaleY(.6); opacity: 0;
      transition: transform .22s cubic-bezier(.55,.06,.68,.19), opacity .12s ease;
      transition-delay: .12s;
    }

    ._confirm-icon {
      width: 36px; height: 36px; border-radius: 50%;
      background: #FEF2F2; color: #EF4444;
      display: inline-flex; align-items: center; justify-content: center;
      margin-bottom: 10px;
      transform: scale(0);
      transition: transform .35s cubic-bezier(.175,.885,.32,1.275) .12s;
    }
    ._confirm-overlay.active ._confirm-icon { transform: scale(1); }
    ._confirm-icon svg { width: 18px; height: 18px; display: block; }

    ._confirm-title { font-size: 14px; font-weight: 600; color: #1E293B; margin-bottom: 4px; }
    ._confirm-msg { font-size: 12.5px; color: #64748B; line-height: 1.5; margin-bottom: 16px; }

    ._confirm-actions button {
      flex: 1; padding: 12px 16px; border: none; background: transparent;
      font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      transition: background .12s ease;
    }
    ._confirm-actions button svg { width: 14px; height: 14px; display: block; flex-shrink: 0; }
    ._confirm-cancel { color: #64748B; border-right: 1px solid #F1F5F9; }
    ._confirm-cancel:hover { background: #F8FAFC; }
    ._confirm-ok { color: #EF4444; }
    ._confirm-ok:hover { background: #FEF2F2; }

    /* ========== 移动端 ========== */
    @media (max-width: 480px) {
      ._island-wrap { top: 8px; width: calc(100% - 24px); }
      ._island { max-width: none; width: 100% !important; }
      ._island-body { white-space: normal; }
      ._confirm { max-width: calc(100vw - 32px); min-width: 0; }
    }

    /* ========== 减少动效 ========== */
    @media (prefers-reduced-motion: reduce) {
      ._island, ._island.show, ._island.hide,
      ._confirm, ._confirm-overlay.active ._confirm, ._confirm-overlay.closing ._confirm,
      ._confirm-overlay, ._confirm-overlay.active, ._confirm-overlay.closing,
      ._confirm-icon {
        animation: none !important; transition-duration: 0ms !important; transform: none !important;
      }
      ._island.show { opacity: 1 !important; }
      ._island.show ._check-path { stroke-dashoffset: 0 !important; }
      ._confirm-overlay.active { opacity: 1 !important; }
      ._confirm-overlay.active ._confirm { opacity: 1 !important; }
      ._confirm-overlay.active ._confirm-icon { transform: scale(1) !important; }
    }
  `

  var styleEl = document.createElement('style')
  styleEl.textContent = CSS
  document.head.appendChild(styleEl)

  /* ============================================================
     SVG 图标
     ============================================================ */
  var ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline class="_check-path" points="20 6 9 17 4 12"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    close:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    danger:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    loading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>',
    cancel:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="M6 6 18 18"/></svg>',
    ok:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
  }

  /* ============================================================
     工具
     ============================================================ */
  function nextFrame(fn) {
    requestAnimationFrame(function () { requestAnimationFrame(fn) })
  }

  function escapeHtml(str) {
    var div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

  /* ============================================================
     容器
     ============================================================ */
  var wrap = null

  function getWrap() {
    if (!wrap) {
      wrap = document.createElement('div')
      wrap.className = '_island-wrap'
      document.body.appendChild(wrap)
    }
    return wrap
  }

  /* ============================================================
     Toast
     ============================================================ */
  function showToast(type, message, options) {
    options = options || {}
    var duration = options.duration === 0 ? 0 : (options.duration || 3000)
    var sub = options.sub || ''

    var el = document.createElement('div')
    el.className = '_island ' + type
    el.innerHTML =
      '<div class="_island-icon">' + ICONS[type] + '</div>' +
      '<div class="_island-body">' +
        '<div class="_island-msg">' + escapeHtml(message) + '</div>' +
        (sub ? '<div class="_island-sub">' + escapeHtml(sub) + '</div>' : '') +
      '</div>' +
      '<button class="_island-close">' + ICONS.close + '</button>' +
      (duration > 0 ? '<div class="_island-progress" style="animation-duration:' + duration + 'ms"></div>' : '')

    var closeBtn = el.querySelector('._island-close')
    var timer = null
    var dismissed = false

    function dismiss() {
      if (dismissed) return
      dismissed = true
      clearTimeout(timer)
      el.classList.remove('show')
      el.classList.add('hide')
      setTimeout(function () { el.remove() }, 380)
    }

    closeBtn.addEventListener('click', dismiss)
    if (duration > 0) timer = setTimeout(dismiss, duration)

    getWrap().appendChild(el)
    nextFrame(function () { el.classList.add('show') })

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
        '<div class="_confirm-inner">' +
          '<div class="_confirm-icon">' + ICONS.danger + '</div>' +
          '<div class="_confirm-title">' + escapeHtml(title) + '</div>' +
          '<div class="_confirm-msg">' + escapeHtml(message) + '</div>' +
        '</div>' +
        '<div class="_confirm-actions">' +
          '<button class="_confirm-cancel">' + ICONS.cancel + escapeHtml(cancelText) + '</button>' +
          '<button class="_confirm-ok">' + ICONS.ok + escapeHtml(okText) + '</button>' +
        '</div>' +
      '</div>'

    function close() {
      document.removeEventListener('keydown', onKey)
      overlay.classList.remove('active')
      overlay.classList.add('closing')
      setTimeout(function () { overlay.remove() }, 380)
    }

    function onKey(e) { if (e.key === 'Escape') close() }

    overlay.querySelector('._confirm-cancel').addEventListener('click', close)
    overlay.querySelector('._confirm-ok').addEventListener('click', function () {
      close()
      if (onOk) onOk()
    })
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close()
    })
    document.addEventListener('keydown', onKey)

    document.body.appendChild(overlay)
    nextFrame(function () { overlay.classList.add('active') })

    return { close: close }
  }

  /* ============================================================
     导出
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
