/* Auto-Test 自动化测试平台 - 前端逻辑 */
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
    if (!res.ok) throw new Error(data.error || '请求失败');
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
    return d.toLocaleString('zh-CN', { hour12: false });
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
      return `
        <tr data-id="${c.id}">
          <td><input type="checkbox" class="row-check" ${checked ? 'checked' : ''}></td>
          <td>
            <div class="case-name">${esc(c.name)}</div>
            ${c.desc ? `<div class="case-desc">${esc(c.desc)}</div>` : ''}
          </td>
          <td><span class="method-tag method-${c.method}">${c.method}</span></td>
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
  function openCaseModal(c = null) {
    $('#modal-title').textContent = c ? '编辑用例' : '新建用例';
    $('#f-id').value = c ? c.id : '';
    $('#f-name').value = c ? c.name : '';
    $('#f-desc').value = c ? (c.desc || '') : '';
    $('#f-method').value = c ? c.method : 'GET';
    $('#f-url').value = c ? c.url : '';
    $('#f-headers').value = c && c.headers && Object.keys(c.headers).length ? JSON.stringify(c.headers, null, 2) : '';
    $('#f-body').value = c ? (c.body || '') : '';
    $('#f-timeout').value = c ? c.timeout : 10000;
    $('#f-enabled').checked = c ? c.enabled !== false : true;

    // 断言
    const list = $('#assert-list');
    list.innerHTML = '';
    const asserts = c && c.assertions && c.assertions.length ? c.assertions : [{ type: 'status_code', expected: '200' }];
    asserts.forEach((a) => addAssertRow(a.type, a.expected));
    $('#case-modal').classList.remove('hidden');
  }

  function addAssertRow(type = 'status_code', expected = '200') {
    const list = $('#assert-list');
    const row = document.createElement('div');
    row.className = 'assert-item';
    row.innerHTML = `
      <select class="a-type">
        <option value="status_code">状态码</option>
        <option value="body_contains">响应包含</option>
        <option value="body_not_contains">响应不包含</option>
        <option value="response_time">响应时间</option>
      </select>
      <input class="a-expected" placeholder="期望值，如 200 或 登录成功">
      <button class="rm-assert" title="删除">×</button>`;
    row.querySelector('.a-type').value = type;
    row.querySelector('.a-expected').value = expected;
    row.querySelector('.rm-assert').addEventListener('click', () => row.remove());
    list.appendChild(row);
  }

  async function saveCase() {
    const id = $('#f-id').value;
    const name = $('#f-name').value.trim();
    const url = $('#f-url').value.trim();
    if (!name) return toast('请填写用例名称', true);
    if (!url) return toast('请填写请求 URL', true);

    let headers = {};
    const hStr = $('#f-headers').value.trim();
    if (hStr) {
      try {
        headers = JSON.parse(hStr);
      } catch (e) {
        return toast('Headers 不是合法 JSON', true);
      }
    }

    const assertions = $$('.assert-item').map((r) => ({
      type: r.querySelector('.a-type').value,
      expected: r.querySelector('.a-expected').value.trim()
    })).filter((a) => a.expected);

    const payload = {
      name,
      desc: $('#f-desc').value.trim(),
      method: $('#f-method').value,
      url,
      headers,
      body: $('#f-body').value,
      assertions,
      timeout: Number($('#f-timeout').value) || 10000,
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
        addLog(`<span class="ll-time">${fmtTime(r.startedAt)}</span>${statusHtml}${esc(r.caseName)} <span class="ll-time">[${r.statusCode || '-'}] ${fmtDuration(r.time)}</span>${r.error ? ' · ' + esc(r.error) : ''}`);
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
        const assertHtml = x.assertions && x.assertions.length
          ? '<div class="di-section">断言结果</div><pre>' + esc(JSON.stringify(x.assertions, null, 2)) + '</pre>'
          : '';
        const errHtml = x.error ? '<div class="di-section">错误信息</div><pre>' + esc(x.error) + '</pre>' : '';
        return `
          <div class="detail-item">
            <div class="di-head">
              <span class="di-status ${s}">${stLabel[s]}</span>
              <span class="di-name">${esc(x.caseName)}</span>
              <span class="di-meta">${x.method} · ${x.statusCode || '-'} · ${fmtDuration(x.time)}</span>
            </div>
            <div class="di-body">
              <div class="di-section">请求</div><pre>${esc(x.method)} ${esc(x.url)}</pre>
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
    $('#btn-add-assert').addEventListener('click', () => addAssertRow());
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
