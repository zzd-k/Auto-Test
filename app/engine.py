# engine.py - 测试执行引擎：HTTP 接口测试 + Playwright 浏览器 UI 测试
import time
from concurrent.futures import ThreadPoolExecutor

import requests
from playwright.sync_api import sync_playwright

HTTP_ASSERTS = {
    "status_code": "状态码",
    "body_contains": "响应包含文本",
    "body_not_contains": "响应不包含文本",
    "response_time": "响应时间(ms)",
}

UI_ASSERTS = {
    "element_visible": "元素可见",
    "element_hidden": "元素不可见",
    "text_contains": "页面包含文本",
    "title_contains": "标题包含文本",
    "url_contains": "URL包含文本",
}


def _now():
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime())


# ---------- HTTP 接口测试 ----------

def run_http(case: dict) -> dict:
    result = {
        "caseId": case["id"],
        "caseName": case["name"],
        "type": "http",
        "method": case["method"],
        "url": case["url"],
        "status": "running",
        "time": 0,
        "statusCode": None,
        "assertions": [],
        "steps": [],
        "passed": False,
        "error": None,
        "startedAt": _now(),
    }
    try:
        start = time.time()
        headers = case.get("headers") or {}
        resp = requests.request(
            case["method"],
            case["url"],
            headers=headers,
            data=case.get("body") or None,
            timeout=(case.get("timeout") or 10000) / 1000,
            verify=False,
        )
        elapsed_ms = int((time.time() - start) * 1000)
        result["time"] = elapsed_ms
        result["statusCode"] = resp.status_code

        checks = case.get("assertions") or []
        if not checks:
            ok = 200 <= resp.status_code < 300
            result["assertions"].append({
                "type": "status_code", "label": "状态码",
                "pass": ok, "actual": str(resp.status_code), "expected": "2xx",
            })
        else:
            for a in checks:
                t = a.get("type")
                exp = str(a.get("expected") or "")
                if t == "status_code":
                    ok = str(resp.status_code) == exp.strip()
                    result["assertions"].append({
                        "type": t, "label": HTTP_ASSERTS.get(t, t),
                        "pass": ok, "actual": str(resp.status_code), "expected": exp,
                    })
                elif t == "body_contains":
                    ok = exp in resp.text
                    result["assertions"].append({
                        "type": t, "label": HTTP_ASSERTS[t],
                        "pass": ok, "actual": resp.text[:200], "expected": exp,
                    })
                elif t == "body_not_contains":
                    ok = exp not in resp.text
                    result["assertions"].append({
                        "type": t, "label": HTTP_ASSERTS[t],
                        "pass": ok, "actual": resp.text[:200], "expected": exp,
                    })
                elif t == "response_time":
                    ok = elapsed_ms <= int(exp)
                    result["assertions"].append({
                        "type": t, "label": HTTP_ASSERTS[t],
                        "pass": ok, "actual": f"{elapsed_ms}ms", "expected": f"≤{exp}ms",
                    })
                else:
                    result["assertions"].append({
                        "type": t, "label": t, "pass": False, "actual": "不支持", "expected": exp,
                    })

        result["passed"] = all(x["pass"] for x in result["assertions"])
        result["status"] = "passed" if result["passed"] else "failed"
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        result["passed"] = False
    return result


# ---------- Playwright 浏览器 UI 测试 ----------

# 支持的动作
UI_ACTIONS = ("goto", "click", "fill", "wait_for", "screenshot", "press")


def run_ui(case: dict) -> dict:
    result = {
        "caseId": case["id"],
        "caseName": case["name"],
        "type": "ui",
        "method": "UI",
        "url": case["url"],
        "status": "running",
        "time": 0,
        "statusCode": None,
        "assertions": [],
        "steps": [],
        "passed": False,
        "error": None,
        "startedAt": _now(),
    }
    start = time.time()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1366, "height": 768})
            timeout = case.get("timeout") or 30000

            steps = case.get("steps") or []
            for s in steps:
                action = s.get("action")
                sel = s.get("selector") or ""
                val = s.get("value") or ""
                if action == "goto":
                    page.goto(val or case["url"], timeout=timeout, wait_until="domcontentloaded")
                    result["steps"].append({"action": "goto", "pass": True, "detail": f"打开 {val or case['url']}"})
                elif action == "click":
                    page.click(sel, timeout=timeout)
                    result["steps"].append({"action": "click", "pass": True, "detail": f"点击 {sel}"})
                elif action == "fill":
                    page.fill(sel, val, timeout=timeout)
                    result["steps"].append({"action": "fill", "pass": True, "detail": f"填写 {sel} = {val}"})
                elif action == "wait_for":
                    page.wait_for_selector(sel, timeout=timeout, state="visible")
                    result["steps"].append({"action": "wait_for", "pass": True, "detail": f"等待元素 {sel} 可见"})
                elif action == "press":
                    page.press(sel or "body", val)
                    result["steps"].append({"action": "press", "pass": True, "detail": f"按键 {val}"})
                elif action == "screenshot":
                    import os
                    shot_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "screenshots")
                    os.makedirs(shot_dir, exist_ok=True)
                    fname = f"{case['id']}-{int(time.time())}.png"
                    path = os.path.join(shot_dir, fname)
                    page.screenshot(path=path)
                    result["steps"].append({"action": "screenshot", "pass": True, "detail": f"截图已保存 {fname}"})
                else:
                    result["steps"].append({"action": action, "pass": False, "detail": f"不支持的动作: {action}"})

            # 断言
            checks = case.get("assertions") or []
            for a in checks:
                t = a.get("type")
                exp = str(a.get("expected") or "")
                if t == "element_visible":
                    visible = page.is_visible(exp, timeout=3000)
                    result["assertions"].append({
                        "type": t, "label": UI_ASSERTS[t],
                        "pass": visible, "actual": "可见" if visible else "不可见", "expected": exp,
                    })
                elif t == "element_hidden":
                    hidden = page.is_hidden(exp, timeout=3000)
                    result["assertions"].append({
                        "type": t, "label": UI_ASSERTS[t],
                        "pass": hidden, "actual": "已隐藏" if hidden else "可见", "expected": exp,
                    })
                elif t == "text_contains":
                    body = page.content()
                    ok = exp in body
                    result["assertions"].append({
                        "type": t, "label": UI_ASSERTS[t],
                        "pass": ok, "actual": "包含" if ok else "未包含", "expected": exp,
                    })
                elif t == "title_contains":
                    title = page.title()
                    ok = exp in title
                    result["assertions"].append({
                        "type": t, "label": UI_ASSERTS[t],
                        "pass": ok, "actual": title, "expected": exp,
                    })
                elif t == "url_contains":
                    cur = page.url
                    ok = exp in cur
                    result["assertions"].append({
                        "type": t, "label": UI_ASSERTS[t],
                        "pass": ok, "actual": cur, "expected": exp,
                    })
                else:
                    result["assertions"].append({
                        "type": t, "label": t, "pass": False, "actual": "不支持", "expected": exp,
                    })

            browser.close()
        result["time"] = int((time.time() - start) * 1000)
        result["passed"] = all(x["pass"] for x in result["assertions"]) and all(x["pass"] for x in result["steps"])
        result["status"] = "passed" if result["passed"] else "failed"
    except Exception as e:
        result["time"] = int((time.time() - start) * 1000)
        result["status"] = "error"
        result["error"] = str(e)
        result["passed"] = False
    return result


def run_case(case: dict) -> dict:
    if case.get("type") == "ui":
        return run_ui(case)
    return run_http(case)


# 批量执行
def run_suite(cases, suite_name="自动化测试套件"):
    suite_id = "run-" + str(int(time.time() * 1000)) + "-" + str(int(time.time()) % 1000)
    start = time.time()
    results = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(run_case, c) for c in cases]
        for f in futures:
            results.append(f.result())

    passed = sum(1 for r in results if r["status"] == "passed")
    failed = sum(1 for r in results if r["status"] == "failed")
    errors = sum(1 for r in results if r["status"] == "error")
    duration = int((time.time() - start) * 1000)
    return {
        "id": suite_id,
        "name": suite_name,
        "createdAt": _now(),
        "duration": duration,
        "total": len(results),
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "passRate": round(passed / len(results) * 100) if results else 0,
        "results": results,
    }
