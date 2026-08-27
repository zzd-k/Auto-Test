// engine.js - 测试执行引擎：发送 HTTP 请求并执行断言校验
const http = require('http');
const https = require('https');
const { URL } = require('url');

const assertTypes = {
  status_code: {
    label: '状态码',
    run: (actual, expected) => ({
      pass: String(actual.status) === String(expected).trim(),
      actual: String(actual.status),
      expected: String(expected)
    })
  },
  body_contains: {
    label: '响应包含文本',
    run: (actual, expected) => ({
      pass: (actual.body || '').includes(String(expected)),
      actual: actual.body ? actual.body.slice(0, 200) : '',
      expected: String(expected)
    })
  },
  body_not_contains: {
    label: '响应不包含文本',
    run: (actual, expected) => ({
      pass: !(actual.body || '').includes(String(expected)),
      actual: actual.body ? actual.body.slice(0, 200) : '',
      expected: String(expected)
    })
  },
  response_time: {
    label: '响应时间(ms)',
    run: (actual, expected) => ({
      pass: actual.time <= Number(expected),
      actual: actual.time + 'ms',
      expected: '≤' + expected + 'ms'
    })
  }
};

// 发起请求，返回 { status, headers, body, time }
function sendRequest(c) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(c.url);
    } catch (e) {
      return reject(new Error('URL 格式不正确: ' + c.url));
    }
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const headers = { ...(c.headers || {}) };
    const start = Date.now();

    const bodyStr = c.body || '';
    if ((c.method === 'POST' || c.method === 'PUT' || c.method === 'PATCH') && bodyStr && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: c.method,
      headers,
      timeout: Number(c.timeout) || 10000
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          time: Date.now() - start
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('请求超时（' + options.timeout + 'ms）'));
    });
    req.on('error', (err) => {
      reject(new Error('请求失败: ' + err.message));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// 执行单个用例，返回完整结果
async function runCase(c) {
  const result = {
    caseId: c.id,
    caseName: c.name,
    method: c.method,
    url: c.url,
    status: 'running',
    time: 0,
    statusCode: null,
    assertions: [],
    passed: false,
    error: null,
    startedAt: new Date().toISOString()
  };

  try {
    const res = await sendRequest(c);
    result.time = res.time;
    result.statusCode = res.status;

    const checks = c.assertions && c.assertions.length > 0 ? c.assertions : [];
    if (checks.length === 0) {
      result.assertions.push({
        type: 'status_code',
        label: assertTypes.status_code.label,
        pass: res.status >= 200 && res.status < 300,
        actual: String(res.status),
        expected: '2xx'
      });
    } else {
      for (const a of checks) {
        const fn = assertTypes[a.type];
        if (!fn) {
          result.assertions.push({ type: a.type, label: a.type, pass: false, actual: '不支持', expected: a.expected });
          continue;
        }
        const r = fn.run(res, a.expected);
        result.assertions.push({ type: a.type, label: fn.label, pass: r.pass, actual: r.actual, expected: r.expected });
      }
    }

    result.passed = result.assertions.every((x) => x.pass);
    result.status = result.passed ? 'passed' : 'failed';
  } catch (e) {
    result.status = 'error';
    result.error = e.message;
    result.passed = false;
  }
  return result;
}

// 批量执行用例，返回汇总报告
async function runSuite(cases, suiteName) {
  const suiteId = 'run-' + Date.now() + '-' + Math.floor(Math.random() * 900 + 100);
  const results = [];
  let passedCount = 0;
  let failedCount = 0;
  let errorCount = 0;
  const suiteStart = Date.now();

  for (const c of cases) {
    const r = await runCase(c);
    results.push(r);
    if (r.status === 'passed') passedCount++;
    else if (r.status === 'failed') failedCount++;
    else errorCount++;
  }

  return {
    id: suiteId,
    name: suiteName || '自动化测试套件',
    createdAt: new Date().toISOString(),
    duration: Date.now() - suiteStart,
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    errors: errorCount,
    passRate: results.length ? Math.round((passedCount / results.length) * 100) : 0,
    results
  };
}

module.exports = { runCase, runSuite, assertTypes };
