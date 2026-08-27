// store.js - 基于本地 JSON 文件的数据存储（免数据库依赖，开箱即用）
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const defaultData = {
  cases: [
    {
      id: 'case-0001',
      name: '示例：百度首页可用性检查',
      desc: '验证 baidu.com 首页 HTTP 状态码为 200',
      method: 'GET',
      url: 'https://www.baidu.com',
      headers: {},
      body: '',
      assertions: [{ type: 'status_code', expected: '200' }],
      timeout: 10000,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'case-0002',
      name: '示例：响应时间低于 3 秒',
      desc: '检查请求耗时在可接受范围内',
      method: 'GET',
      url: 'https://www.qq.com',
      headers: {},
      body: '',
      assertions: [{ type: 'response_time', expected: '3000' }],
      timeout: 10000,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  reports: []
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readDB() {
  ensureDir();
  const file = path.join(DATA_DIR, 'db.json');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2), 'utf-8');
    return JSON.parse(JSON.stringify(defaultData));
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    // 保证结构完整
    if (!parsed.cases) parsed.cases = [];
    if (!parsed.reports) parsed.reports = [];
    return parsed;
  } catch (e) {
    console.error('[store] db.json 损坏，重置为默认数据', e.message);
    return JSON.parse(JSON.stringify(defaultData));
  }
}

function writeDB(db) {
  ensureDir();
  const file = path.join(DATA_DIR, 'db.json');
  fs.writeFileSync(file, JSON.stringify(db, null, 2), 'utf-8');
}

function getCases() {
  return readDB().cases;
}

function getCaseById(id) {
  return readDB().cases.find((c) => c.id === id) || null;
}

function createCase(caseData) {
  const db = readDB();
  const now = new Date().toISOString();
  const newCase = {
    id: 'case-' + String(Date.now()).slice(-6) + Math.floor(Math.random() * 90 + 10),
    name: caseData.name || '未命名用例',
    desc: caseData.desc || '',
    method: (caseData.method || 'GET').toUpperCase(),
    url: caseData.url || '',
    headers: caseData.headers || {},
    body: caseData.body || '',
    assertions: Array.isArray(caseData.assertions) ? caseData.assertions : [],
    timeout: Number(caseData.timeout) || 10000,
    enabled: caseData.enabled !== false,
    createdAt: now,
    updatedAt: now
  };
  db.cases.push(newCase);
  writeDB(db);
  return newCase;
}

function updateCase(id, caseData) {
  const db = readDB();
  const idx = db.cases.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const merged = { ...db.cases[idx], ...caseData, id, updatedAt: new Date().toISOString() };
  merged.method = (merged.method || 'GET').toUpperCase();
  merged.timeout = Number(merged.timeout) || 10000;
  db.cases[idx] = merged;
  writeDB(db);
  return merged;
}

function deleteCase(id) {
  const db = readDB();
  const before = db.cases.length;
  db.cases = db.cases.filter((c) => c.id !== id);
  if (db.cases.length === before) return false;
  writeDB(db);
  return true;
}

function addReport(report) {
  const db = readDB();
  db.reports.unshift(report);
  // 最多保留 100 条历史
  if (db.reports.length > 100) db.reports = db.reports.slice(0, 100);
  writeDB(db);
  return report;
}

function getReports() {
  return readDB().reports;
}

function getReportById(id) {
  return readDB().reports.find((r) => r.id === id) || null;
}

module.exports = {
  getCases,
  getCaseById,
  createCase,
  updateCase,
  deleteCase,
  addReport,
  getReports,
  getReportById
};
