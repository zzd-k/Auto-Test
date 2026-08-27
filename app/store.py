# store.py - 基于本地 JSON 文件的数据存储（免数据库依赖）
import json
import os
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_FILE = os.path.join(DATA_DIR, "db.json")

DEFAULT_DATA = {
    "cases": [
        {
            "id": "case-0001",
            "name": "示例：百度首页可用性检查",
            "desc": "验证 baidu.com 首页 HTTP 状态码为 200",
            "type": "http",
            "method": "GET",
            "url": "https://www.baidu.com",
            "headers": {},
            "body": "",
            "assertions": [{"type": "status_code", "expected": "200"}],
            "timeout": 10000,
            "enabled": True,
            "createdAt": "",
            "updatedAt": "",
        },
        {
            "id": "case-0002",
            "name": "示例：响应时间低于 3 秒",
            "desc": "检查请求耗时在可接受范围内",
            "type": "http",
            "method": "GET",
            "url": "https://www.qq.com",
            "headers": {},
            "body": "",
            "assertions": [{"type": "response_time", "expected": "3000"}],
            "timeout": 10000,
            "enabled": True,
            "createdAt": "",
            "updatedAt": "",
        },
        {
            "id": "case-0003",
            "name": "示例：example.com 页面标题验证",
            "desc": "用 Playwright 打开 example.com，验证页面标题包含 Example Domain",
            "type": "ui",
            "method": "UI",
            "url": "https://example.com",
            "steps": [
                {"action": "goto", "selector": "", "value": "https://example.com"},
                {"action": "wait_for", "selector": "h1", "value": "10000"},
            ],
            "assertions": [
                {"type": "title_contains", "expected": "Example Domain"},
            ],
            "timeout": 30000,
            "enabled": True,
            "createdAt": "",
            "updatedAt": "",
        },
    ],
    "reports": [],
}


def _ensure_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _now():
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime())


def read_db():
    _ensure_dir()
    if not os.path.exists(DB_FILE):
        write_db(DEFAULT_DATA)
        return json.loads(json.dumps(DEFAULT_DATA))
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            db = json.load(f)
        db.setdefault("cases", [])
        db.setdefault("reports", [])
        return db
    except (json.JSONDecodeError, OSError):
        write_db(DEFAULT_DATA)
        return json.loads(json.dumps(DEFAULT_DATA))


def write_db(db):
    _ensure_dir()
    tmp = DB_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DB_FILE)


# ---------- 用例 ----------

def get_cases():
    return read_db()["cases"]


def get_case(case_id):
    return next((c for c in read_db()["cases"] if c["id"] == case_id), None)


def create_case(data: dict) -> dict:
    db = read_db()
    ts = _now()
    new_case = {
        "id": "case-" + str(int(time.time() * 1000))[-8:],
        "name": data.get("name") or "未命名用例",
        "desc": data.get("desc") or "",
        "type": data.get("type") or "http",
        "method": (data.get("method") or "GET").upper(),
        "url": data.get("url") or "",
        "headers": data.get("headers") or {},
        "body": data.get("body") or "",
        "steps": data.get("steps") or [],
        "assertions": data.get("assertions") or [],
        "timeout": int(data.get("timeout") or 10000),
        "enabled": data.get("enabled") is not False,
        "createdAt": ts,
        "updatedAt": ts,
    }
    db["cases"].append(new_case)
    write_db(db)
    return new_case


def update_case(case_id, data: dict) -> dict | None:
    db = read_db()
    for i, c in enumerate(db["cases"]):
        if c["id"] == case_id:
            for key in ("name", "desc", "type", "method", "url", "headers", "body", "steps", "assertions", "timeout", "enabled"):
                if key in data:
                    db["cases"][i][key] = data[key]
            db["cases"][i]["method"] = (db["cases"][i].get("method") or "GET").upper()
            db["cases"][i]["updatedAt"] = _now()
            write_db(db)
            return db["cases"][i]
    return None


def delete_case(case_id) -> bool:
    db = read_db()
    before = len(db["cases"])
    db["cases"] = [c for c in db["cases"] if c["id"] != case_id]
    if len(db["cases"]) == before:
        return False
    write_db(db)
    return True


# ---------- 报告 ----------

def add_report(report: dict) -> dict:
    db = read_db()
    db["reports"].insert(0, report)
    db["reports"] = db["reports"][:100]
    write_db(db)
    return report


def get_reports():
    return read_db()["reports"]


def get_report(report_id):
    return next((r for r in read_db()["reports"] if r["id"] == report_id), None)
