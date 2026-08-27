/* Auto-Test 自动化测试平台 - 前端逻辑（支持 HTTP 接口测试 + Playwright UI 测试） */
(function () {
  'use strict';

  // ---------- 工具 ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  async function api(url, opts = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || '请求失败');
    return data;
  }

  let toastTimer = null;
  function toast(msg, isErr = false) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function fmtTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString('zh-CN', { hour12: false });
  }

  function fmtDuration(ms) {
    if (ms == null) return '-';
    if (ms < 1000) return ms + 'ms';
    return (ms / 1000).toFixed(1) + 's';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ---------- 状态 ----------
  let cases = [];
  let selectedIds = new Set();

  // ---------- 路由 ----------
  function switchView(name) {
    $$('.view').forEach((v) => v.classList.remove('active'));
    $('#view-' + name).classList.add('active');
    $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === name));
    if (name === 'dashboard') loadDashboard();
    if (name === 'cases') loadCases();
    if (name === 'reports') loadReports();
  }

  // ---------- 仪表盘 ----------
  async function loadDashboard() {
    try {
      const s = await api('/api/stats');
      $('#stat-cases').textContent = s.caseCount;
      $('#stat-passed').textContent = s.totalPassed;
      $('#stat-executed').textContent = s.totalExecuted;
      $('#stat-runs').textContent = s.totalRuns;

      const rate = s.overallPassRate;
      const ring = $('#rate-ring');
      ring.style.setProperty('--ring-pct', rate + '%');
      ring.style.setProperty('--ring-color', rate >= 80 ? 'var(--green)' : rate >= 50 ? 'var(--orange)' : 'var(--red)');
      $('#rate-num').textContent = rate + '%';
      const tag = $('#rate-tag');
      tag.textContent = rate >= 80 ? '优秀' : rate >= 50 ? '一般' : '偏低';
      tag.style.background = rate >= 80 ? 'rgba(45,212,167,0.15)' : rate >= 50 ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)';
      tag.style.color = rate >= 80 ? 'var(--green)' : rate >= 50 ? 'var(--orange)' : 'var(--red)';

      const reports = await api('/api/reports');
      const list = $('#recent-list');
      if (!reports.length) {
        list.innerHTML = '<div class="empty">暂无运行记录</div>';
      } else {
        list.innerHTML = reports.slice(0, 5).map((r) => {
          const pass = r.passRate >= 60;
          return `
            <div class="recent-item" data-report="${r.id}">
              <div class="ri-icon ${pass ? 'pass' : 'fail'}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">${pass ? '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 15l-5-5 1.4-1.4L10 14.2l7.6-7.6L19 8l-9 9z"/>' : '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>'}</svg>
              </div>
              <div class="ri-main">
                <div class="ri-name">${esc(r.name)}</div>
                <div class="ri-meta">${fmtTime(r.createdAt)} · ${r.total} 用例 · ${fmtDuration(r.duration)}</div>
              </div>
              <div class="ri-rate ${pass ? 'green' : 'red'}">${r.passRate}%</div>
            </div>`;
        }).join('');
      }
    } catch (e) {
      toast(e.message, true);
    }
  }

  // ---------- 用例管理 ----------
  function renderCases() {
    const kw = $('#case-search').value.trim().toLowerCase();
    const filter = $('#case-filter').value;
    const list = cases.filter((c) => {
      if (filter === 'enabled' && c.enabled === false) return false;
      if (filter === 'disabled' && c.enabled !== false) return false;
      if (kw && !(c.name + ' ' + c.url + ' ' + (c.desc || '')).toLowerCase().includes(kw)) return false;
      return true;
    });

    const body = $('#case-table-body');
    if (!list.length) {
      body.innerHTML = '';
      $('#case-empty').classList.remove('hidden');
      return;
    }
    $('#case-empty').classList.add('hidden');

    body.innerHTML = list.map((c) => {
      const checked = selectedIds.has(c.id);
      const typeTag = c.type === 'ui'
        ? '<span class="type-tag ui">浏览器</span>'
        : '<span class="type-tag http">接口</span>';
      const methodHtml = c.type === 'ui'
        ? '<span class="method-tag method-UI">UI</span>'
        : `<span class="method-tag method-${c.method}">${c.method}</span>`;
      return `
        <tr data-id="${c.id}">
          <td><input type="checkbox" class="row-check" ${checked ? 'checked' : ''}></td>
          <td>
            <div class="case-name">${typeTag} ${esc(c.name)}</div>
            ${c.desc ? `<div class="case-desc">${esc(c.desc)}</div>` : ''}
          </td>
          <td>${methodHtml}</td>
          <td><div class="url-cell" title="${esc(c.url)}">${esc(c.url)}</div></td>
          <td><span class="status-badge ${c.enabled ? 'on' : 'off'}">${c.enabled ? '启用' : '停用'}</span></td>
          <td>
            <div class="op-btns">
              <button class="op-btn act-run" title="执行">运行</button>
              <button class="op-btn act-edit" title="编辑">编辑</button>
              <button class="op-btn act-toggle" title="启停">${c.enabled ? '停用' : '启用'}</button>
              <button class="op-btn del act-del" title="删除">删除</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  async function loadCases() {
    try {
      cases = await api('/api/cases');
      renderCases();
    } catch (e) {
      toast(e.message, true);
    }
  }

  // ---------- 用例弹窗 ----------
  function setCaseType(type) {
    const isUi = type === 'ui';
    $('#f-type').value = type;
    $('#http-fields').classList.toggle('hidden', isUi);
    $('#ui-fields').classList.toggle('hidden', !isUi);
  }

  function openCaseModal(c = null) {
    $('#modal-title').textContent = c ? '编辑用例' : '新建用例';
    $('#f-id').value = c ? c.id : '';
    $('#f-name').value = c ? c.name : '';
    $('#f-desc').value = c ? (c.desc || '') : '';
    const type = c ? (c.type || 'http') : 'http';
    setCaseType(type);
    $('#f-method').value = c && c.type !== 'ui' ? c.method : 'GET';
    $('#f-url').value = c && c.type !== 'ui' ? c.url : '';
    $('#f-url-ui').value = c && c.type === 'ui' ? c.url : '';
    $('#f-headers').value = c && c.headers && Object.keys(c.headers).length ? JSON.stringify(c.headers, null, 2) : '';
    $('#f-body').value = c ? (c.body || '') : '';
    $('#f-timeout').value = c ? c.timeout : 30000;
    $('#f-enabled').checked = c ? c.enabled !== false : true;

    // HTTP 断言
    const aList = $('#assert-list');
    aList.innerHTML = '';
    const asserts = c && c.type !== 'ui' && c.assertions && c.assertions.length
      ? c.assertions
      : [{ type: 'status_code', expected: '200' }];
    asserts.forEach((a) => addAssertRow(a.type, a.expected, false));

    // UI 断言
    const uaList = $('#ui-assert-list');
    uaList.innerHTML = '';
    const uiAsserts = c && c.type === 'ui' && c.assertions && c.assertions.length
      ? c.assertions
      : [{ type: 'element_visible', expected: '' }];
    uiAsserts.forEach((a) => addAssertRow(a.type, a.expected, true));

    // UI 步骤
    const sList = $('#step-list');
    sList.innerHTML = '';
    const steps = c && c.type === 'ui' && c.steps && c.steps.length
      ? c.steps
      : [{ action: 'goto', selector: '', value: '' }];
    steps.forEach((s) => addStepRow(s.action, s.selector, s.value));

    $('#case-modal').classList.remove('hidden');
  }

  const HTTP_ASSERT_OPTS = [
    ['status_code', '状态码'],
    ['body_contains', '响应包含文本'],
    ['body_not_contains', '响应不包含文本'],
    ['response_time', '响应时间(ms)']
  ];
  const UI_ASSERT_OPTS = [
    ['element_visible', '元素可见'],
    ['element_hidden', '元素不可见'],
    ['text_contains', '页面包含文本'],
    ['title_contains', '标题包含文本'],
    ['url_contains', 'URL包含文本']
  ];
  const STEP_ACTIONS = [
    ['goto', '打开页面'],
    ['click', '点击元素'],
    ['fill', '填写输入框'],
    ['wait_for', '等待元素'],
    ['press', '按键'],
    ['screenshot', '截图']
  ];

  function addAssertRow(type = 'status_code', expected = '200', isUi = false) {
    const list = isUi ? $('#ui-assert-list') : $('#assert-list');
    const opts = isUi ? UI_ASSERT_OPTS : HTTP_ASSERT_OPTS;
    const row = document.createElement('div');
    row.className = 'assert-item';
    row.innerHTML = `
      <select class="a-type">${opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      <input class="a-expected" placeholder="期望值">
      <button class="rm-assert" title="删除">×</button>`;
    row.querySelector('.a-type').value = type;
    row.querySelector('.a-expected').value = expected;
    row.querySelector('.rm-assert').addEventListener('click', () => row.remove());
    list.appendChild(row);
  }

  function addStepRow(action = 'goto', selector = '', value = '') {
    const list = $('#step-list');
    const row = document.createElement('div');
    row.className = 'step-item';
    row.innerHTML = `
      <select class="s-action">${STEP_ACTIONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      <input class="s-selector" placeholder="CSS 选择器（goto/截图可不填）">
      <input class="s-value" placeholder="值 / URL / 等待ms">
      <button class="rm-assert" title="删除">×</button>`;
    row.querySelector('.s-action').value = action;
    row.querySelector('.s-selector').value = selector;
    row.querySelector('.s-value').value = value;
    row.querySelector('.rm-assert').addEventListener('click', () => row.remove());
    list.appendChild(row);
  }

  function syncTypeFields() {
    const isUi = $('#f-type').value === 'ui';
    $('#http-fields').classList.toggle('hidden', isUi);
    $('#ui-fields').classList.toggle('hidden', !isUi);
  }

  async function saveCase() {
    const id = $('#f-id').value;
    const name = $('#f-name').value.trim();
    const type = $('#f-type').value;
    const isUi = type === 'ui';
    const url = (isUi ? $('#f-url-ui').value : $('#f-url').value).trim();
    if (!name) return toast('请填写用例名称', true);
    if (!url) return toast('请填写请求 URL', true);

    let headers = {};
    if (!isUi) {
      const hStr = $('#f-headers').value.trim();
      if (hStr) {
        try {
          headers = JSON.parse(hStr);
        } catch (e) {
          return toast('Headers 不是合法 JSON', true);
        }
      }
    }

    const assertions = $$('.assert-item').map((r) => ({
      type: r.querySelector('.a-type').value,
      expected: r.querySelector('.a-expected').value.trim()
    })).filter((a) => a.expected);

    let steps = [];
    if (isUi) {
      steps = $$('.step-item').map((r) => ({
        action: r.querySelector('.s-action').value,
        selector: r.querySelector('.s-selector').value.trim(),
        value: r.querySelector('.s-value').value.trim()
      })).filter((s) => s.action === 'goto' ? !!(s.value) : !!(s.selector || s.value));
    }

    const payload = {
      name,
      desc: $('#f-desc').value.trim(),
      type,
      method: isUi ? 'UI' : $('#f-method').value,
      url,
      headers,
      body: isUi ? '' : $('#f-body').value,
      steps,
      assertions,
      timeout: Number($('#f-timeout').value) || 30000,
      enabled: $('#f-enabled').checked
    };

    try {
      if (id) {
        await api('/api/cases/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        toast('用例已更新');
      } else {
        await api('/api/cases', { method: 'POST', body: JSON.stringify(payload) });
        toast('用例已创建');
      }
      $('#case-modal').classList.add('hidden');
      await loadCases();
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function toggleCase(id) {
    const c = cases.find((x) => x.id === id);
    if (!c) return;
    try {
      await api('/api/cases/' + id, { method: 'PUT', body: JSON.stringify({ enabled: c.enabled === false }) });
      await loadCases();
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function deleteCase(id) {
    if (!confirm('确定删除该用例？')) return;
    try {
      await api('/api/cases/' + id, { method: 'DELETE' });
      toast('用例已删除');
      await loadCases();
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function runSingleCase(id) {
    const c = cases.find((x) => x.id === id);
    try {
      const r = await api('/api/run/' + id, { method: 'POST' });
      if (r.passed) toast('「' + r.caseName + '」测试通过');
      else if (r.status === 'error') toast('「' + r.caseName + '」执行出错: ' + (r.error || ''), true);
      else toast('「' + r.caseName + '」测试失败', true);
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function toggleAll() {
    const anyOff = cases.some((c) => c.enabled === false);
    try {
      for (const c of cases) {
        await api('/api/cases/' + c.id, { method: 'PUT', body: JSON.stringify({ enabled: anyOff }) });
      }
      toast(anyOff ? '已全部启用' : '已全部停用');
      await loadCases();
    } catch (e) {
      toast(e.message, true);
    }
  }

  // ---------- 运行中心 ----------
  function addLog(html) {
    const log = $('#run-log');
    log.classList.add('show');
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = html;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function setRunStatus(cls, text) {
    const el = $('#run-status');
    el.className = 'run-status ' + cls;
    el.textContent = text;
  }

  async function runSuite() {
    const btn = $('#btn-run-suite');
    const scope = $('#run-scope').value;
    const name = $('#run-suite-name').value.trim();
    const log = $('#run-log');
    log.innerHTML = '';
    btn.disabled = true;
    setRunStatus('running', '测试执行中，请稍候...');

    let ids = null;
    if (scope === 'selected') {
      ids = cases.filter((c) => selectedIds.has(c.id)).map((c) => c.id);
      if (!ids.length) {
        btn.disabled = false;
        setRunStatus('failed', '请先在用例管理中勾选要执行的用例');
        return;
      }
    }

    try {
      const report = await api('/api/run', {
        method: 'POST',
        body: JSON.stringify({ ids, name: name || undefined })
      });

      report.results.forEach((r) => {
        let statusHtml;
        if (r.status === 'passed') statusHtml = '<span class="ll-status ll-pass">PASS</span>';
        else if (r.status === 'failed') statusHtml = '<span class="ll-status ll-fail">FAIL</span>';
        else statusHtml = '<span class="ll-status ll-error">ERROR</span>';
        const typeTag = r.type === 'ui' ? '[浏览器] ' : '[接口] ';
        const stepsDetail = r.steps && r.steps.length
          ? ' <span class="ll-time">' + r.steps.map((s) => s.action + (s.detail ? ':' + s.detail : '')).join(' | ') + '</span>'
          : '';
        addLog(`<span class="ll-time">${fmtTime(r.startedAt)}</span>${statusHtml}${typeTag}${esc(r.caseName)} <span class="ll-time">[${r.statusCode || '-'}] ${fmtDuration(r.time)}</span>${stepsDetail}${r.error ? ' · ' + esc(r.error) : ''}`);
      });

      addLog(`<span class="ll-status ll-pass">DONE</span> 共 ${report.total} 条，通过 ${report.passed}，失败 ${report.failed}，异常 ${report.errors}，通过率 ${report.passRate}%，耗时 ${fmtDuration(report.duration)}`);

      const ok = report.failed === 0 && report.errors === 0;
      setRunStatus(ok ? 'done' : 'failed', ok ? '全部用例通过' : '存在失败用例，详情见下方日志');
    } catch (e) {
      setRunStatus('failed', '执行失败: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- 报告 ----------
  async function loadReports() {
    try {
      const reports = await api('/api/reports');
      const body = $('#report-table-body');
      if (!reports.length) {
        body.innerHTML = '';
        $('#report-empty').classList.remove('hidden');
        return;
      }
      $('#report-empty').classList.add('hidden');
      body.innerHTML = reports.map((r) => {
        const color = r.passRate >= 80 ? 'var(--green)' : r.passRate >= 50 ? 'var(--orange)' : 'var(--red)';
        return `
          <tr data-id="${r.id}">
            <td><div class="case-name">${esc(r.name)}</div></td>
            <td style="color:var(--text-dim)">${fmtTime(r.createdAt)}</td>
            <td>${r.total}</td>
            <td style="color:${color};font-weight:700">${r.passRate}%</td>
            <td style="color:var(--text-dim)">${fmtDuration(r.duration)}</td>
            <td><button class="op-btn act-detail">查看详情</button></td>
          </tr>`;
      }).join('');
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function showReportDetail(id) {
    try {
      const r = await api('/api/reports/' + id);
      const st = (x) => x === 'passed' ? 'pass' : x === 'failed' ? 'fail' : 'error';
      const stLabel = { pass: '通过', fail: '失败', error: '异常' };
      const sumHtml = `
        <div class="detail-summary">
          <div class="ds-box blue"><div class="ds-num">${r.total}</div><div class="ds-label">用例总数</div></div>
          <div class="ds-box green"><div class="ds-num">${r.passed}</div><div class="ds-label">通过</div></div>
          <div class="ds-box red"><div class="ds-num">${r.failed}</div><div class="ds-label">失败</div></div>
          <div class="ds-box orange"><div class="ds-num">${r.errors}</div><div class="ds-label">异常</div></div>
        </div>
        <div style="margin-bottom:14px;color:var(--text-dim);font-size:12px">
          ${esc(r.name)} · ${fmtTime(r.createdAt)} · 耗时 ${fmtDuration(r.duration)} · 通过率 ${r.passRate}%
        </div>`;

      const itemsHtml = r.results.map((x) => {
        const s = st(x.status);
        const typeTag = x.type === 'ui' ? '<span class="type-tag ui">浏览器</span>' : '<span class="type-tag http">接口</span>';
        const assertHtml = x.assertions && x.assertions.length
          ? '<div class="di-section">断言结果</div><pre>' + esc(JSON.stringify(x.assertions, null, 2)) + '</pre>'
          : '';
        const stepsHtml = x.steps && x.steps.length
          ? '<div class="di-section">操作步骤</div><pre>' + esc(JSON.stringify(x.steps, null, 2)) + '</pre>'
          : '';
        const errHtml = x.error ? '<div class="di-section">错误信息</div><pre>' + esc(x.error) + '</pre>' : '';
        return `
          <div class="detail-item">
            <div class="di-head">
              <span class="di-status ${s}">${stLabel[s]}</span>
              <span class="di-name">${typeTag} ${esc(x.caseName)}</span>
              <span class="di-meta">${x.method} · ${x.statusCode || '-'} · ${fmtDuration(x.time)}</span>
            </div>
            <div class="di-body">
              <div class="di-section">目标</div><pre>${esc(x.url)}</pre>
              ${stepsHtml}
              ${assertHtml}
              ${errHtml}
            </div>
          </div>`;
      }).join('');

      $('#report-detail').innerHTML = sumHtml + itemsHtml;
      $$('.detail-item .di-head').forEach((h) => h.addEventListener('click', () => {
        h.nextElementSibling.classList.toggle('open');
      }));
      $('#report-modal').classList.remove('hidden');
    } catch (e) {
      toast(e.message, true);
    }
  }

  // ---------- 事件绑定 ----------
  function bindEvents() {
    // 导航
    $$('.nav-item').forEach((n) => n.addEventListener('click', () => switchView(n.dataset.view)));
    $$('[data-goto]').forEach((el) => el.addEventListener('click', () => switchView(el.dataset.goto)));

    // 仪表盘
    $('#btn-quick-run').addEventListener('click', () => {
      switchView('run');
      setTimeout(() => $('#btn-run-suite').click(), 200);
    });

    // 用例
    $('#btn-new-case').addEventListener('click', () => openCaseModal());
    $('#btn-toggle-all').addEventListener('click', toggleAll);
    $('#f-type').addEventListener('change', syncTypeFields);
    $('#btn-add-assert').addEventListener('click', () => addAssertRow('status_code', '200', false));
    $('#btn-add-ui-assert').addEventListener('click', () => addAssertRow('element_visible', '', true));
    $('#btn-add-step').addEventListener('click', () => addStepRow());
    $('#modal-close').addEventListener('click', () => $('#case-modal').classList.add('hidden'));
    $('#btn-cancel').addEventListener('click', () => $('#case-modal').classList.add('hidden'));
    $('#btn-save').addEventListener('click', saveCase);
    $('#case-search').addEventListener('input', renderCases);
    $('#case-filter').addEventListener('change', renderCases);

    $('#check-all').addEventListener('change', (e) => {
      const rows = $$('#case-table-body .row-check');
      rows.forEach((cb) => { cb.checked = e.target.checked; });
      selectedIds.clear();
      if (e.target.checked) {
        cases.forEach((c) => {
          if ($(`#case-table-body tr[data-id="${c.id}"]`)) selectedIds.add(c.id);
        });
      }
    });

    $('#case-table-body').addEventListener('change', (e) => {
      if (!e.target.classList.contains('row-check')) return;
      const id = e.target.closest('tr').dataset.id;
      if (e.target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      const allChecked = $$('#case-table-body .row-check').length > 0 && $$('#case-table-body .row-check').every((cb) => cb.checked);
      $('#check-all').checked = allChecked;
    });

    $('#case-table-body').addEventListener('click', (e) => {
      const btn = e.target.closest('.op-btn');
      if (!btn) return;
      const id = e.target.closest('tr').dataset.id;
      if (btn.classList.contains('act-run')) runSingleCase(id);
      if (btn.classList.contains('act-edit')) openCaseModal(cases.find((c) => c.id === id));
      if (btn.classList.contains('act-toggle')) toggleCase(id);
      if (btn.classList.contains('act-del')) deleteCase(id);
    });

    // 运行
    $('#btn-run-suite').addEventListener('click', runSuite);

    // 报告
    $('#btn-refresh-reports').addEventListener('click', loadReports);
    $('#report-table-body').addEventListener('click', (e) => {
      const btn = e.target.closest('.act-detail');
      if (btn) showReportDetail(e.target.closest('tr').dataset.id);
    });
    $('#report-close').addEventListener('click', () => $('#report-modal').classList.add('hidden'));

    // 最近运行
    $('#recent-list').addEventListener('click', (e) => {
      const item = e.target.closest('.recent-item');
      if (item) showReportDetail(item.dataset.report);
    });

    // 弹窗遮罩点击关闭
    $$('.modal-mask').forEach((m) => m.addEventListener('click', (e) => {
      if (e.target === m) m.classList.add('hidden');
    }));
  }

  // ---------- 启动 ----------
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    switchView('dashboard');
  });
})();
