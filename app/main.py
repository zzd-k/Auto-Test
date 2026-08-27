# main.py - FastAPI 服务入口
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from . import store
from .engine import run_case, run_suite

BASE_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = BASE_DIR / "public"

app = FastAPI(title="Auto-Test 自动化测试平台", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- 用例 ----------

class CaseIn(BaseModel):
    name: str = ""
    desc: str = ""
    type: str = "http"          # http | ui
    method: str = "GET"
    url: str = ""
    headers: dict = {}
    body: str = ""
    steps: list = []
    assertions: list = []
    timeout: int = 10000
    enabled: bool = True


@app.get("/api/cases")
def list_cases():
    return store.get_cases()


@app.get("/api/cases/{case_id}")
def get_case(case_id: str):
    c = store.get_case(case_id)
    if not c:
        raise HTTPException(404, "用例不存在")
    return c


@app.post("/api/cases")
def create_case(data: CaseIn):
    return store.create_case(data.model_dump())


@app.put("/api/cases/{case_id}")
def update_case(case_id: str, data: CaseIn):
    c = store.update_case(case_id, data.model_dump())
    if not c:
        raise HTTPException(404, "用例不存在")
    return c


@app.delete("/api/cases/{case_id}")
def delete_case(case_id: str):
    if not store.delete_case(case_id):
        raise HTTPException(404, "用例不存在")
    return {"ok": True}


# ---------- 执行 ----------

@app.post("/api/run/{case_id}")
def run_single(case_id: str):
    c = store.get_case(case_id)
    if not c:
        raise HTTPException(404, "用例不存在")
    return run_case(c)


class RunIn(BaseModel):
    ids: list = None
    name: str = ""


@app.post("/api/run")
def run_all(data: RunIn):
    all_cases = store.get_cases()
    if data.ids:
        target = [c for c in all_cases if c["id"] in data.ids]
    else:
        target = [c for c in all_cases if c.get("enabled", True)]
    if not target:
        raise HTTPException(400, "没有可执行的用例")
    import time
    name = data.name or "自动化测试套件 " + time.strftime("%m-%d %H:%M")
    report = run_suite(target, name)
    store.add_report(report)
    return report


# ---------- 报告 ----------

@app.get("/api/reports")
def list_reports():
    return [
        {k: r[k] for k in ("id", "name", "createdAt", "duration", "total", "passed", "failed", "errors", "passRate")}
        for r in store.get_reports()
    ]


@app.get("/api/reports/{report_id}")
def get_report(report_id: str):
    r = store.get_report(report_id)
    if not r:
        raise HTTPException(404, "报告不存在")
    return r


# ---------- 统计 ----------

@app.get("/api/stats")
def stats():
    cases = store.get_cases()
    reports = store.get_reports()
    total_executed = sum(r["total"] for r in reports)
    total_passed = sum(r["passed"] for r in reports)
    return {
        "caseCount": len(cases),
        "enabledCount": sum(1 for c in cases if c.get("enabled", True)),
        "totalRuns": len(reports),
        "totalExecuted": total_executed,
        "totalPassed": total_passed,
        "overallPassRate": round(total_passed / total_executed * 100) if total_executed else 0,
        "lastReport": ({"id": reports[0]["id"], "name": reports[0]["name"],
                        "passRate": reports[0]["passRate"], "createdAt": reports[0]["createdAt"]}
                       if reports else None),
    }


@app.get("/api/health")
def health():
    return {"ok": True}


# ---------- 静态资源 ----------

app.mount("/css", StaticFiles(directory=str(PUBLIC_DIR / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(PUBLIC_DIR / "js")), name="js")

# screenshots 目录自动创建
SHOT_DIR = BASE_DIR / "screenshots"
SHOT_DIR.mkdir(exist_ok=True)
app.mount("/screenshots", StaticFiles(directory=str(SHOT_DIR)), name="screenshots")


@app.get("/")
def index():
    return FileResponse(str(PUBLIC_DIR / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=3000, reload=False)
