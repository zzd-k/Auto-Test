# Auto-Test 自动化测试平台

一个轻量级的 HTTP 接口自动化测试管理平台。无需数据库，零配置，一条命令启动。

## 功能

- 测试用例管理：增删改查、启停、搜索筛选
- 断言校验：状态码、响应包含/不包含文本、响应时间
- 批量执行：一键运行全部/启用/选中用例
- 历史报告：运行记录、通过率统计、逐条断言详情
- 仪表盘：用例数、累计执行、通过率环形图

## 快速开始

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

浏览器访问 http://localhost:3000

## 技术栈

- 后端：Node.js + Express
- 前端：原生 HTML / CSS / JavaScript（无构建步骤）
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
├── server.js          # Express 服务入口
├── src/
│   ├── engine.js      # 测试执行引擎（HTTP 请求 + 断言）
│   └── store.js       # JSON 文件存储
├── public/            # 前端静态资源
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
└── data/              # 运行时数据（自动生成）
```
