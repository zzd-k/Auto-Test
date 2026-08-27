# Auto-Test 自动化测试平台

基于 **Python + FastAPI + Playwright** 的自动化测试管理平台，同时支持 HTTP 接口测试和浏览器 UI 自动化测试。免数据库，零配置，一条命令启动。

## 功能

- **接口测试（HTTP）**：增删改查用例、请求断言（状态码 / 响应包含 / 响应不包含 / 响应时间）、批量执行
- **浏览器 UI 测试（Playwright）**：可视化配置操作步骤（打开页面 / 点击 / 填写 / 等待元素 / 按键 / 截图），元素与页面断言
- **批量执行**：一键运行全部 / 启用 / 选中用例，实时日志
- **历史报告**：运行记录、通过率统计、逐条断言与操作步骤详情
- **仪表盘**：用例数、累计执行、通过率环形图

## 快速开始

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 安装 Playwright 浏览器内核（首次）
python -m playwright install chromium

# 3. 启动服务
python -m app.main
```

浏览器访问 http://localhost:3000

## 用例类型说明

### 接口测试用例
请求方法 + URL + Headers + Body + 断言

支持的断言：状态码、响应包含文本、响应不包含文本、响应时间

### 浏览器 UI 测试用例
起始 URL + 操作步骤 + 断言

支持的操作步骤：打开页面(goto)、点击(click)、填写(fill)、等待元素(wait_for)、按键(press)、截图(screenshot)

支持的断言：元素可见/不可见、页面包含文本、标题包含文本、URL包含文本

## 技术栈

- 后端：Python + FastAPI + Playwright + Requests
- 前端：原生 HTML / CSS / JavaScript
- 存储：本地 JSON 文件（`data/db.json`）

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/cases | 用例列表 |
| POST | /api/cases | 创建用例 |
| PUT | /api/cases/:id | 更新用例 |
| DELETE | /api/cases/:id | 删除用例 |
| POST | /api/run/:id | 执行单个用例 |
| POST | /api/run | 批量执行（可传 ids） |
| GET | /api/reports | 报告列表 |
| GET | /api/reports/:id | 报告详情 |
| GET | /api/stats | 仪表盘统计 |

## 目录结构

```
Auto-Test/
├── app/
│   ├── main.py          # FastAPI 服务入口
│   ├── engine.py        # 测试执行引擎（HTTP + Playwright）
│   └── store.py         # JSON 文件存储
├── public/              # 前端静态资源
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── screenshots/         # UI 测试截图（自动生成）
├── data/                # 运行时数据（自动生成）
└── requirements.txt
```
