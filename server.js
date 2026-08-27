// server.js - Express 服务入口：静态资源 + RESTful API
const express = require('express');
const path = require('path');
const store = require('./src/store');
const { runCase, runSuite } = require('./src/engine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- 用例 CRUD ----------

// 用例列表
app.get('/api/cases', (req, res) => {
  res.json(store.getCases());
});

// 单个用例
app.get('/api/cases/:id', (req, res) => {
  const c = store.getCaseById(req.params.id);
  if (!c) return res.status(404).json({ error: '用例不存在' });
  res.json(c);
});

// 创建用例
app.post('/api/cases', (req, res) => {
  try {
    const c = store.createCase(req.body || {});
    res.status(201).json(c);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 更新用例
app.put('/api/cases/:id', (req, res) => {
  const c = store.updateCase(req.params.id, req.body || {});
  if (!c) return res.status(404).json({ error: '用例不存在' });
  res.json(c);
});

// 删除用例
app.delete('/api/cases/:id', (req, res) => {
  const ok = store.deleteCase(req.params.id);
  if (!ok) return res.status(404).json({ error: '用例不存在' });
  res.json({ ok: true });
});

// ---------- 测试执行 ----------

// 执行单个用例
app.post('/api/run/:id', async (req, res) => {
  const c = store.getCaseById(req.params.id);
  if (!c) return res.status(404).json({ error: '用例不存在' });
  try {
    const result = await runCase(c);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 批量执行（默认所有启用用例，可传 ids）
app.post('/api/run', async (req, res) => {
  try {
    const all = store.getCases();
    const ids = req.body && Array.isArray(req.body.ids) ? req.body.ids : null;
    const target = ids
      ? all.filter((c) => ids.includes(c.id))
      : all.filter((c) => c.enabled !== false);

    if (target.length === 0) {
      return res.status(400).json({ error: '没有可执行的用例' });
    }

    const suiteName = (req.body && req.body.name) || '自动化测试套件 ' + new Date().toLocaleString('zh-CN');
    const report = await runSuite(target, suiteName);
    store.addReport(report);
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- 报告 ----------

// 报告列表
app.get('/api/reports', (req, res) => {
  const reports = store.getReports().map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.createdAt,
    duration: r.duration,
    total: r.total,
    passed: r.passed,
    failed: r.failed,
    errors: r.errors,
    passRate: r.passRate
  }));
  res.json(reports);
});

// 报告详情
app.get('/api/reports/:id', (req, res) => {
  const r = store.getReportById(req.params.id);
  if (!r) return res.status(404).json({ error: '报告不存在' });
  res.json(r);
});

// ---------- 统计 ----------

app.get('/api/stats', (req, res) => {
  const cases = store.getCases();
  const reports = store.getReports();
  const enabled = cases.filter((c) => c.enabled !== false).length;

  const lastReport = reports[0];
  const totalRuns = reports.length;

  let totalExecuted = 0;
  let totalPassed = 0;
  reports.forEach((r) => {
    totalExecuted += r.total;
    totalPassed += r.passed;
  });

  res.json({
    caseCount: cases.length,
    enabledCount: enabled,
    totalRuns,
    totalExecuted,
    totalPassed,
    overallPassRate: totalExecuted ? Math.round((totalPassed / totalExecuted) * 100) : 0,
    lastReport: lastReport
      ? {
          id: lastReport.id,
          name: lastReport.name,
          passRate: lastReport.passRate,
          createdAt: lastReport.createdAt
        }
      : null
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// SPA 兜底
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('');
  console.log('  Auto-Test 自动化测试平台已启动');
  console.log('  访问地址: http://localhost:' + PORT);
  console.log('');
});
