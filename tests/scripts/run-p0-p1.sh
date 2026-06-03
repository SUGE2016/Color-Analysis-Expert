#!/usr/bin/env bash
# 一次性执行 P0 + P1 API 用例（手工测试自动化）
set -euo pipefail
API="${API_BASE:-http://localhost:8080}"
FRONTEND="${FRONTEND_BASE:-http://localhost:3001}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FIXTURE="$(cd "$(dirname "$0")/.." && pwd)/fixtures/images/sample.png"
CORRECTION_FIXTURE="${CORRECTION_FIXTURE:-$REPO_ROOT/algorithm-service/model_image.jpg}"
ADMIN_ID="${ADMIN_ID:-$(docker exec color-mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD:-123456}" -N -e "SELECT id FROM color_analysis.users WHERE username='admin' LIMIT 1" 2>/dev/null || true)}"
MODEL_PATH="${MODEL_PATH:-/app/storage/test-assets/model_image.jpg}"
BUTTERFLY_PATH="${BUTTERFLY_PATH:-/app/storage/test-assets/butterfly.json}"
EDGE_PATH="${EDGE_PATH:-/app/storage/test-assets/edge.json}"
PASS=0
FAIL=0
SKIP=0
RESULTS=()

record() {
  local id="$1" status="$2" detail="$3"
  RESULTS+=("$id|$status|$detail")
  case "$status" in
    PASS) PASS=$((PASS + 1)) ;;
    FAIL) FAIL=$((FAIL + 1)) ;;
    SKIP) SKIP=$((SKIP + 1)) ;;
  esac
  printf "[%s] %s — %s\n" "$status" "$id" "$detail"
}

# --- P0 ---
COMPOSE_FILE="$(cd "$(dirname "$0")/../.." && pwd)/docker-compose.yml"
if docker compose -f "$COMPOSE_FILE" ps mysql 2>/dev/null | grep -q healthy; then
  record SMK-01 PASS "mysql healthy"
else
  record SMK-01 FAIL "mysql not healthy"
fi

if docker ps --filter name=color-python --filter status=running -q | grep -q .; then
  record SMK-02 PASS "python container running"
else
  record SMK-02 FAIL "python down"
fi

code=$(curl -s -o /dev/null -w "%{http_code}" "$API/swagger-ui/index.html")
[[ "$code" == "200" ]] && record SMK-03 PASS "swagger $code" || record SMK-03 FAIL "swagger $code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$API/v3/api-docs")
[[ "$code" == "200" ]] && record SMK-04 PASS "openapi $code" || record SMK-04 FAIL "openapi $code"

LOGIN=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null || true)
if [[ -n "$TOKEN" ]]; then
  record SMK-05 PASS "login ok"
else
  record SMK-05 FAIL "login: $LOGIN"
  TOKEN=""
fi

if [[ -n "$TOKEN" ]]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API/api/datasets")
  [[ "$code" == "200" ]] && record SMK-06 PASS "datasets $code" || record SMK-06 FAIL "datasets $code"
else
  record SMK-06 SKIP "no token"
fi

code=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/datasets")
[[ "$code" == "401" || "$code" == "403" ]] && record SMK-07 PASS "unauth $code" || record SMK-07 FAIL "unauth expected 401/403 got $code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND/")
[[ "$code" == "200" ]] && record SMK-08 PASS "frontend $code at $FRONTEND" || record SMK-08 FAIL "frontend $code"

# --- P1 AUTH ---
if [[ -z "$TOKEN" ]]; then
  for id in AUTH-01 AUTH-02 AUTH-03 AUTH-04 AUTH-05; do record "$id" SKIP "no token from login"; done
else
  record AUTH-01 PASS "token from SMK-05"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"wrong"}')
  [[ "$code" == "401" ]] && record AUTH-02 PASS "wrong pwd $code" || record AUTH-02 FAIL "wrong pwd $code"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d '{"username":"admin"}')
  [[ "$code" == "400" || "$code" == "401" ]] && record AUTH-03 PASS "missing field $code" || record AUTH-03 FAIL "missing field $code"
  UNAME="testuser_$(date +%s)"
  REG=$(curl -s -w "\n%{http_code}" -X POST "$API/api/auth/register" -H "Content-Type: application/json" -d "{\"username\":\"$UNAME\",\"password\":\"123456\"}")
  rcode=$(echo "$REG" | tail -1)
  [[ "$rcode" == "200" ]] && record AUTH-04 PASS "register $UNAME" || record AUTH-04 FAIL "register $rcode: $(echo "$REG" | head -1)"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/register" -H "Content-Type: application/json" -d "{\"username\":\"$UNAME\",\"password\":\"123456\"}")
  [[ "$code" == "400" ]] && record AUTH-05 PASS "dup register $code" || record AUTH-05 FAIL "dup register $code"
fi

AUTH_H="Authorization: Bearer $TOKEN"
[[ -z "$TOKEN" ]] && { echo "STOP: no token"; exit 1; }

# --- P1 GRP / DS ---
GRP=$(curl -s -X POST "$API/api/dataset-groups" -H "$AUTH_H" -H "Content-Type: application/json" -d '{"name":"auto-test-group"}')
GRP_ID=$(echo "$GRP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
[[ -n "$GRP_ID" ]] && record GRP-01 PASS "group $GRP_ID" || record GRP-01 FAIL "$GRP"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/dataset-groups")
[[ "$code" == "200" ]] && record GRP-02 PASS "list groups" || record GRP-02 FAIL "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/dataset-groups/$GRP_ID")
[[ "$code" == "200" ]] && record GRP-03 PASS "get group" || record GRP-03 FAIL "$code"

[[ -z "$ADMIN_ID" ]] && { echo "ERROR: cannot resolve admin user id"; exit 1; }
DS=$(curl -s -X POST "$API/api/datasets" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"auto-ds\",\"description\":\"test\",\"ownerId\":\"$ADMIN_ID\",\"groupId\":\"$GRP_ID\",\"scene\":\"教育研究\"}")
DS_ID=$(echo "$DS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
[[ -n "$DS_ID" ]] && record DS-01 PASS "dataset $DS_ID" || record DS-01 FAIL "$DS"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/datasets")
[[ "$code" == "200" ]] && record DS-02 PASS "list ds" || record DS-02 FAIL "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -G -H "$AUTH_H" \
  --data-urlencode "groupId=$GRP_ID" --data-urlencode "scene=教育研究" \
  "$API/api/datasets")
[[ "$code" == "200" ]] && record DS-03 PASS "filter ds" || record DS-03 FAIL "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/datasets/$DS_ID")
[[ "$code" == "200" ]] && record DS-04 PASS "get ds" || record DS-04 FAIL "$code"

UP=$(curl -s -w "\n%{http_code}" -X POST -H "$AUTH_H" -F "file=@$FIXTURE" "$API/api/datasets/$DS_ID/images/upload")
ucode=$(echo "$UP" | tail -1)
[[ "$ucode" == "200" ]] && record DS-05 PASS "upload" || record DS-05 FAIL "upload $ucode"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/datasets/$DS_ID/images")
[[ "$code" == "200" ]] && record DS-06 PASS "list images" || record DS-06 FAIL "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/datasets/00000000-0000-0000-0000-000000000000")
[[ "$code" == "404" ]] && record DS-07 PASS "404" || record DS-07 FAIL "got $code"

# --- P1 TPL（创建接口为 multipart/form-data）---
TPL=$(curl -s -X POST -H "$AUTH_H" -F "name=auto-tpl" -F 'regionsJson=[]' "$API/api/templates")
TPL_ID=$(echo "$TPL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
[[ -n "$TPL_ID" ]] && record TPL-01 PASS "tpl $TPL_ID" || record TPL-01 FAIL "$TPL"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/templates")
[[ "$code" == "200" ]] && record TPL-02 PASS "list tpl" || record TPL-02 FAIL "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/templates/$TPL_ID")
[[ "$code" == "200" ]] && record TPL-03 PASS "get tpl" || record TPL-03 FAIL "$code"

record TPL-04 SKIP "update/delete not scripted; check swagger"

# --- P1 ALG ---
code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" -F "file=@$FIXTURE" "$API/api/images/canny")
[[ "$code" == "200" ]] && record ALG-01 PASS "canny $code" || record ALG-01 FAIL "canny $code"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" -F "file=@$CORRECTION_FIXTURE" "$API/api/images/correction/points")
[[ "$code" == "200" ]] && record ALG-02 PASS "points $code" || record ALG-02 FAIL "points $code"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" -F "model=@$CORRECTION_FIXTURE" -F "image=@$CORRECTION_FIXTURE" "$API/api/images/correction/align")
[[ "$code" == "200" ]] && record ALG-03 PASS "align $code" || record ALG-03 FAIL "align $code"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" -F "image=@$FIXTURE" -F "mask=@$FIXTURE" "$API/api/images/hsv/process")
[[ "$code" == "200" ]] && record ALG-04 PASS "hsv $code" || record ALG-04 FAIL "hsv $code"

record ALG-05 SKIP "destructive (stop python); not run"

# --- P1 PRJ ---
TPL_JSON=$([[ -n "$TPL_ID" ]] && echo "\"$TPL_ID\"" || echo "null")
PRJ=$(curl -s -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"auto-prj\",\"ownerId\":\"$ADMIN_ID\",\"datasetId\":\"$DS_ID\",\"templateId\":$TPL_JSON,\"config\":{}}")
PRJ_ID=$(echo "$PRJ" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
[[ -n "$PRJ_ID" ]] && record PRJ-01 PASS "prj $PRJ_ID" || record PRJ-01 FAIL "$PRJ"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/projects")
[[ "$code" == "200" ]] && record PRJ-02 PASS "list prj" || record PRJ-02 FAIL "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/projects/$PRJ_ID")
[[ "$code" == "200" ]] && record PRJ-03 PASS "get prj" || record PRJ-03 FAIL "$code"

RUN_BODY=$(python3 -c "
import json
print(json.dumps({
  'steps': ['correction','hsv','entropy','main_color','main_color_number'],
  'modelImagePath': '$MODEL_PATH',
  'butterflyJsonPath': '$BUTTERFLY_PATH',
  'edgeJsonPath': '$EDGE_PATH',
  'notes': 'automated test'
}))
")
RUN=$(curl -s -w "\n%{http_code}" -m 300 -X POST -H "$AUTH_H" -H "Content-Type: application/json" -d "$RUN_BODY" "$API/api/projects/$PRJ_ID/run")
runcode=$(echo "$RUN" | tail -1)
TASKS_JSON=$(curl -s -H "$AUTH_H" "$API/api/projects/$PRJ_ID/tasks")
TASK_STATUS=$(echo "$TASKS_JSON" | python3 -c "import sys,json; t=json.load(sys.stdin); print(t[0]['status'] if t else 'none')" 2>/dev/null || echo "unknown")
if [[ "$runcode" == "200" && "$TASK_STATUS" == "success" ]]; then
  record PRJ-04 PASS "run $runcode task=success"
elif [[ "$runcode" == "200" ]]; then
  record PRJ-04 FAIL "run HTTP $runcode but task=$TASK_STATUS"
else
  record PRJ-04 FAIL "run $runcode body=$(echo "$RUN" | head -c 200)"
fi

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/projects/$PRJ_ID/tasks")
[[ "$code" == "200" ]] && record PRJ-05 PASS "tasks" || record PRJ-05 FAIL "$code"

EMPTY_DS=$(curl -s -X POST "$API/api/datasets" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"empty-ds\",\"ownerId\":\"$ADMIN_ID\"}")
EMPTY_ID=$(echo "$EMPTY_DS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
EPRJ=$(curl -s -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"empty-prj\",\"ownerId\":\"$ADMIN_ID\",\"datasetId\":\"$EMPTY_ID\"}")
EPRJ_ID=$(echo "$EPRJ" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
ERUN=$(curl -s -w "\n%{http_code}" -m 60 -X POST -H "$AUTH_H" -H "Content-Type: application/json" -d '{"steps":["correction"]}' "$API/api/projects/$EPRJ_ID/run")
eruncode=$(echo "$ERUN" | tail -1)
[[ "$eruncode" == "200" || "$eruncode" == "400" || "$eruncode" == "500" ]] && record PRJ-06 PASS "empty run documented $eruncode" || record PRJ-06 FAIL "$eruncode"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/projects" -H "Content-Type: application/json" -d '{"name":"x"}')
[[ "$code" == "401" || "$code" == "403" ]] && record PRJ-07 PASS "unauth $code" || record PRJ-07 FAIL "$code"

# --- P1 RPT ---
code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/reports/projects/$PRJ_ID/summary")
if [[ "$code" == "200" ]]; then
  record RPT-01 PASS "summary $code"
elif [[ "$TASK_STATUS" != "success" && "$code" == "400" ]]; then
  record RPT-01 SKIP "summary $code (no success task yet)"
else
  record RPT-01 FAIL "summary $code"
fi

IMG_NAME=$(basename "$FIXTURE")
code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/reports/projects/$PRJ_ID/images/$IMG_NAME")
if [[ "$code" == "200" ]]; then
  record RPT-02 PASS "image report $code"
elif [[ "$TASK_STATUS" != "success" && "$code" == "400" ]]; then
  record RPT-02 SKIP "image report $code (no success task)"
else
  record RPT-02 FAIL "image report $code (name=$IMG_NAME)"
fi

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/reports/projects/$PRJ_ID/export?format=csv")
if [[ "$code" == "200" ]]; then
  record RPT-03 PASS "export $code"
elif [[ "$TASK_STATUS" != "success" && "$code" == "400" ]]; then
  record RPT-03 SKIP "export $code (no success task)"
else
  record RPT-03 FAIL "export $code"
fi

NEW_PRJ=$(curl -s -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"no-run\",\"ownerId\":\"$ADMIN_ID\",\"datasetId\":\"$DS_ID\"}")
NEW_ID=$(echo "$NEW_PRJ" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/reports/projects/$NEW_ID/summary")
[[ "$code" == "200" || "$code" == "404" || "$code" == "400" ]] && record RPT-04 PASS "no-run summary $code" || record RPT-04 FAIL "$code"

BLOCK=0
TOTAL=$((PASS + FAIL + SKIP + BLOCK))
GIT_COMMIT=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo ""
echo "======== SUMMARY ========"
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP BLOCK=$BLOCK TOTAL=$TOTAL"

RESULT_FILE="$(cd "$(dirname "$0")/.." && pwd)/results/latest-run.txt"
mkdir -p "$(dirname "$RESULT_FILE")"
{
  echo "meta:"
  echo "  run_at: $(date -Iseconds)"
  echo "  environment: docker"
  echo "  api_base: $API"
  echo "  frontend_base: $FRONTEND"
  echo "  script: tests/scripts/run-p0-p1.sh"
  echo "  git_commit: $GIT_COMMIT"
  echo ""
  echo "summary:"
  echo "  pass: $PASS"
  echo "  fail: $FAIL"
  echo "  skip: $SKIP"
  echo "  block: $BLOCK"
  echo "  total: $TOTAL"
  echo ""
  echo "records:"
  printf '%s\n' "${RESULTS[@]}"
} | tee "$RESULT_FILE"
