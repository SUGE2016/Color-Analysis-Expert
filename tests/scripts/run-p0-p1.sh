#!/usr/bin/env bash
# 一次性执行 P0 + P1 API 用例（手工测试自动化）
set -euo pipefail
API="${API_BASE:-http://localhost:8080}"
FRONTEND="${FRONTEND_BASE:-http://localhost:3000}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FIXTURE="$(cd "$(dirname "$0")/.." && pwd)/fixtures/images/02_01_00.jpg"
CORRECTION_FIXTURE="${CORRECTION_FIXTURE:-$REPO_ROOT/algorithm-service/model_image.jpg}"
ADMIN_ID="${ADMIN_ID:-$(docker exec color-mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD:-123456}" -N -e "SELECT id FROM color_analysis.users WHERE username='admin' LIMIT 1" 2>/dev/null || true)}"
MODEL_PATH="${MODEL_PATH:-/app/storage/test-assets/model_image.jpg}"
BUTTERFLY_PATH="${BUTTERFLY_PATH:-/app/storage/test-assets/butterfly.json}"
EDGE_PATH="${EDGE_PATH:-/app/storage/test-assets/edge.json}"
RUN_SUFFIX="$(date +%s)"
if docker exec color-python python --version >/dev/null 2>&1; then
  run_python() { docker exec -i color-python python "$@"; }
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN=python3
  run_python() { "$PYTHON_BIN" "$@"; }
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN=python
  run_python() { "$PYTHON_BIN" "$@"; }
else
  echo "ERROR: a Python interpreter is required"
  exit 1
fi
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
TOKEN=$(echo "$LOGIN" | run_python -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null || true)
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
  for id in AUTH-01 AUTH-02 AUTH-03 AUTH-04 AUTH-05 AUTH-06 AUTH-07 AUTH-08 AUTH-09 AUTH-10; do record "$id" SKIP "no token from login"; done
else
  record AUTH-01 PASS "token from SMK-05"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"wrong"}')
  [[ "$code" == "401" ]] && record AUTH-02 PASS "wrong pwd $code" || record AUTH-02 FAIL "wrong pwd $code"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d '{"username":"admin"}')
  [[ "$code" == "400" || "$code" == "401" ]] && record AUTH-03 PASS "missing field $code" || record AUTH-03 FAIL "missing field $code"
  UNAME="testuser_$RUN_SUFFIX"
  REG=$(curl -s -w "\n%{http_code}" -X POST "$API/api/auth/register" -H "Content-Type: application/json" -d "{\"username\":\"$UNAME\",\"password\":\"123456\"}")
  rcode=$(echo "$REG" | tail -1)
  [[ "$rcode" == "200" ]] && record AUTH-04 PASS "register $UNAME" || record AUTH-04 FAIL "register $rcode: $(echo "$REG" | head -1)"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/register" -H "Content-Type: application/json" -d "{\"username\":\"$UNAME\",\"password\":\"123456\"}")
  [[ "$code" == "400" ]] && record AUTH-05 PASS "dup register $code" || record AUTH-05 FAIL "dup register $code"
  ME=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$API/api/auth/me")
  mecode=$(echo "$ME" | tail -1)
  ME_ID=$(echo "$ME" | head -1 | run_python -c "import sys,json; print(json.load(sys.stdin).get('userId',''))" 2>/dev/null || true)
  [[ "$mecode" == "200" && -n "$ME_ID" ]] && record AUTH-06 PASS "me $mecode userId=$ME_ID" || record AUTH-06 FAIL "me $mecode missing userId"
  code=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/auth/me")
  [[ "$code" == "401" || "$code" == "403" ]] && record AUTH-07 PASS "unauth me $code" || record AUTH-07 FAIL "unauth me expected 401/403 got $code"
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API/api/logs/backend")
  [[ "$code" == "200" ]] && record AUTH-08 PASS "admin logs $code" || record AUTH-08 FAIL "admin logs $code"
  code=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/logs/backend")
  [[ "$code" == "401" || "$code" == "403" ]] && record AUTH-09 PASS "unauth logs $code" || record AUTH-09 FAIL "unauth logs expected 401/403 got $code"
  USER_LOGIN=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"$UNAME\",\"password\":\"123456\"}")
  USER_TOKEN=$(echo "$USER_LOGIN" | run_python -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || true)
  if [[ -n "$USER_TOKEN" ]]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $USER_TOKEN" "$API/api/logs/backend")
    [[ "$code" == "403" ]] && record AUTH-10 PASS "non-admin logs $code" || record AUTH-10 FAIL "non-admin logs expected 403 got $code"
  else
    record AUTH-10 FAIL "registered user login did not return token"
  fi
fi

AUTH_H="Authorization: Bearer $TOKEN"
[[ -z "$TOKEN" ]] && { echo "STOP: no token"; exit 1; }

# --- P1 GRP / DS ---
GRP=$(curl -s -X POST "$API/api/dataset-groups" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"auto-test-group-$RUN_SUFFIX\"}")
GRP_ID=$(echo "$GRP" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
[[ -n "$GRP_ID" ]] && record GRP-01 PASS "group $GRP_ID" || record GRP-01 FAIL "$GRP"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/dataset-groups")
[[ "$code" == "200" ]] && record GRP-02 PASS "list groups" || record GRP-02 FAIL "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/dataset-groups/$GRP_ID")
[[ "$code" == "200" ]] && record GRP-03 PASS "get group" || record GRP-03 FAIL "$code"

[[ -z "$ADMIN_ID" ]] && { echo "ERROR: cannot resolve admin user id"; exit 1; }
DS=$(curl -s -X POST "$API/api/datasets" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"auto-ds-$RUN_SUFFIX\",\"description\":\"test\",\"ownerId\":\"$ADMIN_ID\",\"groupId\":\"$GRP_ID\",\"scene\":\"\\u6559\\u80b2\\u7814\\u7a76\"}")
DS_ID=$(echo "$DS" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
[[ -n "$DS_ID" ]] && record DS-01 PASS "dataset $DS_ID" || record DS-01 FAIL "$DS"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/datasets")
[[ "$code" == "200" ]] && record DS-02 PASS "list ds" || record DS-02 FAIL "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" \
  "$API/api/datasets?groupId=$GRP_ID&scene=%E6%95%99%E8%82%B2%E7%A0%94%E7%A9%B6")
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
TPL=$(curl -s -X POST -H "$AUTH_H" -F "name=auto-tpl-$RUN_SUFFIX" \
  -F "regionsJson=<$REPO_ROOT/algorithm-service/butterfly.json" \
  -F "imageFile=@$CORRECTION_FIXTURE" "$API/api/templates")
TPL_ID=$(echo "$TPL" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
TPL_CREATE_OK=$(echo "$TPL" | run_python -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('id') and d.get('name')=='auto-tpl-$RUN_SUFFIX' and d.get('regionsJson') and d.get('imageAvailable') is True else 'no')" 2>/dev/null || echo no)
[[ -n "$TPL_ID" && "$TPL_CREATE_OK" == "yes" ]] && record TPL-01 PASS "created $TPL_ID with regions and image" || record TPL-01 FAIL "$TPL"

TPL_LIST=$(curl -s -H "$AUTH_H" "$API/api/templates")
TPL_LIST_OK=$(echo "$TPL_LIST" | run_python -c "import sys,json; xs=json.load(sys.stdin); t=next((x for x in xs if x.get('id')=='$TPL_ID'),{}); print('yes' if t.get('name')=='auto-tpl-$RUN_SUFFIX' and t.get('imageAvailable') is True else 'no')" 2>/dev/null || echo no)
[[ "$TPL_LIST_OK" == "yes" ]] && record TPL-02 PASS "list contains created template" || record TPL-02 FAIL "$TPL_LIST"

TPL_DETAIL=$(curl -s -w "\n%{http_code}" -H "$AUTH_H" "$API/api/templates/$TPL_ID")
TPL_DETAIL_CODE=$(echo "$TPL_DETAIL" | tail -1)
TPL_DETAIL_OK=$(echo "$TPL_DETAIL" | head -1 | run_python -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('id')=='$TPL_ID' and d.get('name')=='auto-tpl-$RUN_SUFFIX' and d.get('regionsJson') and d.get('imageAvailable') is True else 'no')" 2>/dev/null || echo no)
TPL_IMAGE_META=$(curl -s -o /dev/null -w "%{http_code}|%{content_type}" -H "$AUTH_H" "$API/api/templates/$TPL_ID/image")
TPL_IMAGE_FILE_META=$(curl -s -o /dev/null -w "%{http_code}|%{content_type}" -H "$AUTH_H" "$API/api/templates/$TPL_ID/image/file")
[[ "$TPL_DETAIL_CODE" == "200" && "$TPL_DETAIL_OK" == "yes" && "$TPL_IMAGE_META" == 200\|image/* && "$TPL_IMAGE_FILE_META" == 200\|image/* ]] \
  && record TPL-03 PASS "detail fields and both image endpoints verified" \
  || record TPL-03 FAIL "detail=$TPL_DETAIL_CODE/$TPL_DETAIL_OK image=$TPL_IMAGE_META imageFile=$TPL_IMAGE_FILE_META"

TPL_TMP=$(curl -s -X POST -H "$AUTH_H" -F "name=auto-tpl-disposable-$RUN_SUFFIX" "$API/api/templates")
TPL_TMP_ID=$(echo "$TPL_TMP" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
TPL_UPDATE=$(curl -s -w "\n%{http_code}" -X PUT -H "$AUTH_H" \
  -F "name=auto-tpl-updated-$RUN_SUFFIX" -F 'regionsJson=[]' \
  -F "imageFile=@$CORRECTION_FIXTURE" "$API/api/templates/$TPL_TMP_ID")
TPL_UPDATE_CODE=$(echo "$TPL_UPDATE" | tail -1)
TPL_UPDATE_OK=$(echo "$TPL_UPDATE" | head -1 | run_python -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('id')=='$TPL_TMP_ID' and d.get('name')=='auto-tpl-updated-$RUN_SUFFIX' and d.get('regionsJson')=='[]' and d.get('imageAvailable') is True else 'no')" 2>/dev/null || echo no)
TPL_DELETE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "$AUTH_H" "$API/api/templates/$TPL_TMP_ID")
TPL_DELETED_GET_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/templates/$TPL_TMP_ID")
[[ -n "$TPL_TMP_ID" && "$TPL_UPDATE_CODE" == "200" && "$TPL_UPDATE_OK" == "yes" && "$TPL_DELETE_CODE" == "204" && "$TPL_DELETED_GET_CODE" == "404" ]] \
  && record TPL-04 PASS "update persisted; delete 204; subsequent get 404" \
  || record TPL-04 FAIL "id=$TPL_TMP_ID update=$TPL_UPDATE_CODE/$TPL_UPDATE_OK delete=$TPL_DELETE_CODE get=$TPL_DELETED_GET_CODE"

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

code=$(curl -s -o /dev/null -w "%{http_code}" -F "file=@$FIXTURE" "$API/api/images/canny")
[[ "$code" == "401" || "$code" == "403" ]] && record ALG-06 PASS "unauth canny $code" || record ALG-06 FAIL "unauth canny expected 401/403 got $code"

# Seed shared storage for PRJ-04 full pipeline run
if docker ps --filter name=color-api --filter status=running -q | grep -q .; then
  MODEL_SOURCE="$(cygpath -w "$REPO_ROOT/algorithm-service/model_image.jpg" 2>/dev/null || echo "$REPO_ROOT/algorithm-service/model_image.jpg")"
  BUTTERFLY_SOURCE="$(cygpath -w "$REPO_ROOT/algorithm-service/butterfly.json" 2>/dev/null || echo "$REPO_ROOT/algorithm-service/butterfly.json")"
  EDGE_SOURCE="$(cygpath -w "$REPO_ROOT/algorithm-service/edge.json" 2>/dev/null || echo "$REPO_ROOT/algorithm-service/edge.json")"
  MSYS_NO_PATHCONV=1 docker exec color-api mkdir -p /app/storage/test-assets
  MSYS_NO_PATHCONV=1 docker cp "$MODEL_SOURCE" color-api:/app/storage/test-assets/model_image.jpg
  MSYS_NO_PATHCONV=1 docker cp "$BUTTERFLY_SOURCE" color-api:/app/storage/test-assets/butterfly.json
  MSYS_NO_PATHCONV=1 docker cp "$EDGE_SOURCE" color-api:/app/storage/test-assets/edge.json
fi

# --- P1 PRJ ---
DS2=$(curl -s -X POST "$API/api/datasets" -H "$AUTH_H" -H "Content-Type: application/json" \
  -d "{\"name\":\"auto-ds2-$RUN_SUFFIX\",\"ownerId\":\"$ADMIN_ID\"}")
DS2_ID=$(echo "$DS2" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
curl -s -o /dev/null -X POST -H "$AUTH_H" -F "file=@$FIXTURE" "$API/api/datasets/$DS2_ID/images/upload"

PRJ_BODY=$(run_python -c "import json; print(json.dumps({'name':'auto-prj-$RUN_SUFFIX','datasetIds':['$DS_ID','$DS2_ID'],'templateId':'$TPL_ID','config':{'currentStep':0,'edgeAnalysisEnabled':False}}))")
PRJ=$(curl -s -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "$PRJ_BODY")
PRJ_ID=$(echo "$PRJ" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
PRJ_OK=$(echo "$PRJ" | run_python -c "import sys,json; p=json.load(sys.stdin); print('yes' if p.get('status')=='draft' and len(p.get('datasetIds',[]))==2 and p.get('templateId') else 'no')" 2>/dev/null || echo no)
[[ -n "$PRJ_ID" && "$PRJ_OK" == "yes" ]] && record PRJ-01 PASS "draft $PRJ_ID with 2 datasets" || record PRJ-01 FAIL "$PRJ"

PRJ_LIST=$(curl -s -H "$AUTH_H" "$API/api/projects")
LIST_OK=$(echo "$PRJ_LIST" | run_python -c "import sys,json; ps=json.load(sys.stdin); p=next((x for x in ps if x.get('id')=='$PRJ_ID'),{}); print('yes' if p.get('createdAt') and p.get('updatedAt') else 'no')" 2>/dev/null || echo no)
[[ "$LIST_OK" == "yes" ]] && record PRJ-02 PASS "owner list includes timestamps" || record PRJ-02 FAIL "missing project or timestamps"

DETAIL=$(curl -s -H "$AUTH_H" "$API/api/projects/$PRJ_ID")
SNAPSHOT_OK=$(echo "$DETAIL" | run_python -c "import sys,json; p=json.load(sys.stdin); s=json.loads(p.get('templateSnapshot') or '{}'); print('yes' if s.get('id')=='$TPL_ID' and s.get('regions') else 'no')" 2>/dev/null || echo no)
SNAPSHOT_BEFORE=$(echo "$DETAIL" | run_python -c "import sys,json; print(json.load(sys.stdin).get('templateSnapshot',''))" 2>/dev/null || true)
curl -s -o /dev/null -X PUT -H "$AUTH_H" -F 'regionsJson=[]' "$API/api/templates/$TPL_ID"
SNAPSHOT_AFTER=$(curl -s -H "$AUTH_H" "$API/api/projects/$PRJ_ID" | run_python -c "import sys,json; print(json.load(sys.stdin).get('templateSnapshot',''))" 2>/dev/null || true)
curl -s -o /dev/null -X PUT -H "$AUTH_H" -F "regionsJson=<$REPO_ROOT/algorithm-service/butterfly.json" "$API/api/templates/$TPL_ID"
[[ "$SNAPSHOT_OK" == "yes" && "$SNAPSHOT_BEFORE" == "$SNAPSHOT_AFTER" ]] && record PRJ-03 PASS "template snapshot remains unchanged after template update" || record PRJ-03 FAIL "snapshot changed with source template"

curl -s -o /dev/null -X PUT "$API/api/projects/$PRJ_ID" -H "$AUTH_H" -H "Content-Type: application/json" \
  -d '{"config":{"currentStep":1,"regions":[],"imageAnalysisConfig":{},"edgeAnalysisEnabled":false}}'
PUT=$(curl -s -w "\n%{http_code}" -X PUT "$API/api/projects/$PRJ_ID" -H "$AUTH_H" -H "Content-Type: application/json" \
  -d "{\"config\":{\"currentStep\":3,\"regions\":[{\"id\":\"r1\"}],\"imageAnalysisConfig\":{\"x\":{\"methods\":[\"color_distribution\"]}},\"edgeAnalysisEnabled\":false}}")
putcode=$(echo "$PUT" | tail -1)
PUT_OK=$(echo "$PUT" | head -1 | run_python -c "import sys,json; p=json.load(sys.stdin); c=json.loads(p.get('config') or '{}'); print('yes' if c.get('currentStep')==3 and c.get('regions') else 'no')" 2>/dev/null || echo no)
[[ "$putcode" == "200" && "$PUT_OK" == "yes" ]] && record PRJ-11 PASS "draft config persisted" || record PRJ-11 FAIL "PUT $putcode"

PATH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$AUTH_H" -H "Content-Type: application/json" \
  -d '{"modelImagePath":"/etc/passwd"}' "$API/api/projects/$PRJ_ID/run")
[[ "$PATH_CODE" == "400" ]] && record PRJ-19 PASS "client server path rejected" || record PRJ-19 FAIL "expected 400 got $PATH_CODE"

RUN=$(curl -s -w "\n%{http_code}" -X POST -H "$AUTH_H" -H "Content-Type: application/json" -d '{"steps":[]}' "$API/api/projects/$PRJ_ID/run")
runcode=$(echo "$RUN" | tail -1)
TASK_ID=$(echo "$RUN" | head -1 | run_python -c "import sys,json; d=json.load(sys.stdin); print(d.get('taskId') or d.get('id',''))" 2>/dev/null || true)
DUP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$AUTH_H" -H "Content-Type: application/json" -d '{"steps":[]}' "$API/api/projects/$PRJ_ID/run")
DUP_TASK_COUNT=$(curl -s -H "$AUTH_H" "$API/api/projects/$PRJ_ID/tasks" | run_python -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo -1)
[[ "$DUP_CODE" == "409" && "$DUP_TASK_COUNT" == "1" ]] && record PRJ-12 PASS "duplicate run rejected without second task" || record PRJ-12 FAIL "code=$DUP_CODE tasks=$DUP_TASK_COUNT"

TASK_STATUS="unknown"
TASK_JSON="{}"
LAST_PROGRESS=0
MONOTONIC=yes
OBSERVED_RUNNING=no
for _ in $(seq 1 120); do
  TASK_JSON=$(curl -s -H "$AUTH_H" "$API/api/tasks/$TASK_ID")
  TASK_STATUS=$(echo "$TASK_JSON" | run_python -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo unknown)
  TASK_PROGRESS=$(echo "$TASK_JSON" | run_python -c "import sys,json; print(json.load(sys.stdin).get('progress',0) or 0)" 2>/dev/null || echo 0)
  [[ "$TASK_PROGRESS" -lt "$LAST_PROGRESS" ]] && MONOTONIC=no
  LAST_PROGRESS="$TASK_PROGRESS"
  [[ "$TASK_STATUS" == "running" ]] && OBSERVED_RUNNING=yes
  [[ "$TASK_STATUS" == "success" || "$TASK_STATUS" == "failed" || "$TASK_STATUS" == "cancelled" ]] && break
  sleep 1
done
PROJECT_STATUS=$(curl -s -H "$AUTH_H" "$API/api/projects/$PRJ_ID" | run_python -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)
if [[ "$runcode" == "202" && -n "$TASK_ID" && "$TASK_STATUS" == "success" && "$PROJECT_STATUS" == "completed" ]]; then
  record PRJ-04 PASS "202 task=$TASK_ID success, project completed"
else
  record PRJ-04 FAIL "run=$runcode task=$TASK_STATUS project=$PROJECT_STATUS"
fi

TASK_META_OK=$(echo "$TASK_JSON" | run_python -c "import sys,json; t=json.load(sys.stdin); print('yes' if t.get('progress')==100 and t.get('startedAt') and t.get('finishedAt') and t.get('result') else 'no')" 2>/dev/null || echo no)
[[ "$TASK_META_OK" == "yes" && "$MONOTONIC" == "yes" && "$OBSERVED_RUNNING" == "yes" ]] && record PRJ-05 PASS "queued/running/success observed; progress monotonic" || record PRJ-05 FAIL "meta=$TASK_META_OK monotonic=$MONOTONIC running=$OBSERVED_RUNNING"

RESULT_JSON=$(echo "$TASK_JSON" | run_python -c "import sys,json; t=json.load(sys.stdin); print(t.get('result') or '{}')" 2>/dev/null || echo '{}')
BASE_FILES_OK=$(echo "$RESULT_JSON" | run_python -c "import sys,json; f=json.load(sys.stdin).get('files',{}); print('yes' if all(f.get(k) for k in ('mainColorCsv','mainColorNumberCsv','entropyCsv')) and not f.get('edgeColorCsv') else 'no')" 2>/dev/null || echo no)

MAIN_CSV=$(echo "$RESULT_JSON" | run_python -c "import sys,json; print(json.load(sys.stdin).get('files',{}).get('mainColorCsv',''))" 2>/dev/null || true)
if [[ -n "$MAIN_CSV" ]] && docker exec color-api sh -c "grep -q '$DS_ID' '$MAIN_CSV' && grep -q '$DS2_ID' '$MAIN_CSV'"; then
  record PRJ-15 PASS "result covers both dataset IDs"
else
  record PRJ-15 FAIL "multi-dataset identifiers missing from output"
fi

EDGE_PRJ=$(curl -s -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" \
  -d "{\"name\":\"edge-prj-$RUN_SUFFIX\",\"datasetIds\":[\"$DS_ID\"],\"templateId\":\"$TPL_ID\",\"config\":{\"edgeAnalysisEnabled\":true}}")
EDGE_ID=$(echo "$EDGE_PRJ" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
EDGE_RUN=$(curl -s -X POST -H "$AUTH_H" -H "Content-Type: application/json" -d '{"steps":["edge_hsv","edge_color"]}' "$API/api/projects/$EDGE_ID/run")
EDGE_TASK=$(echo "$EDGE_RUN" | run_python -c "import sys,json; d=json.load(sys.stdin); print(d.get('taskId') or d.get('id',''))" 2>/dev/null || true)
EDGE_STATUS="unknown"
for _ in $(seq 1 120); do
  EDGE_TASK_JSON=$(curl -s -H "$AUTH_H" "$API/api/tasks/$EDGE_TASK")
  EDGE_STATUS=$(echo "$EDGE_TASK_JSON" | run_python -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)
  [[ "$EDGE_STATUS" == "success" || "$EDGE_STATUS" == "failed" ]] && break
  sleep 1
done
EDGE_FILES_OK=$(echo "$EDGE_TASK_JSON" | run_python -c "import sys,json; t=json.load(sys.stdin); r=json.loads(t.get('result') or '{}'); f=r.get('files',{}); print('yes' if f.get('edgeColorCsv') and all(f.get(k) for k in ('mainColorCsv','mainColorNumberCsv','entropyCsv')) else 'no')" 2>/dev/null || echo no)
[[ "$BASE_FILES_OK" == "yes" && "$EDGE_STATUS" == "success" && "$EDGE_FILES_OK" == "yes" ]] && record PRJ-16 PASS "base outputs always present; edge output conditional" || record PRJ-16 FAIL "base=$BASE_FILES_OK edgeStatus=$EDGE_STATUS edgeFiles=$EDGE_FILES_OK"

EMPTY_DS=$(curl -s -X POST "$API/api/datasets" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"empty-ds-$RUN_SUFFIX\",\"ownerId\":\"$ADMIN_ID\"}")
EMPTY_ID=$(echo "$EMPTY_DS" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
EPRJ=$(curl -s -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"empty-prj-$RUN_SUFFIX\",\"datasetIds\":[\"$EMPTY_ID\"],\"templateId\":\"$TPL_ID\"}")
EPRJ_ID=$(echo "$EPRJ" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
BEFORE_COUNT=$(curl -s -H "$AUTH_H" "$API/api/projects/$EPRJ_ID/tasks" | run_python -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo -1)
ERUN=$(curl -s -w "\n%{http_code}" -X POST -H "$AUTH_H" -H "Content-Type: application/json" -d '{"steps":[]}' "$API/api/projects/$EPRJ_ID/run")
eruncode=$(echo "$ERUN" | tail -1)
AFTER_COUNT=$(curl -s -H "$AUTH_H" "$API/api/projects/$EPRJ_ID/tasks" | run_python -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo -2)
[[ "$eruncode" == "422" && "$BEFORE_COUNT" == "$AFTER_COUNT" ]] && record PRJ-06 PASS "empty dataset 422 and no task" || record PRJ-06 FAIL "code=$eruncode before=$BEFORE_COUNT after=$AFTER_COUNT"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/projects" -H "Content-Type: application/json" -d '{"name":"x"}')
[[ "$code" == "401" || "$code" == "403" ]] && record PRJ-07 PASS "unauth $code" || record PRJ-07 FAIL "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/tasks/$TASK_ID")
[[ "$code" == "401" || "$code" == "403" ]] && record PRJ-08 PASS "unauth task $code" || record PRJ-08 FAIL "unauth task expected 401/403 got $code"

MISSING_TPL=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"missing-tpl-$RUN_SUFFIX\",\"datasetIds\":[\"$DS_ID\"]}")
BAD_TPL=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"bad-tpl-$RUN_SUFFIX\",\"datasetIds\":[\"$DS_ID\"],\"templateId\":\"00000000-0000-0000-0000-000000000000\"}")
NO_IMAGE_TPL=$(curl -s -X POST -H "$AUTH_H" -F "name=no-image-$RUN_SUFFIX" -F 'regionsJson=[]' "$API/api/templates")
NO_IMAGE_TPL_ID=$(echo "$NO_IMAGE_TPL" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
NO_IMAGE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"no-image-prj-$RUN_SUFFIX\",\"datasetIds\":[\"$DS_ID\"],\"templateId\":\"$NO_IMAGE_TPL_ID\"}")
BAD_REG_TPL=$(curl -s -X POST -H "$AUTH_H" -F "name=bad-reg-$RUN_SUFFIX" -F 'regionsJson={bad' -F "imageFile=@$CORRECTION_FIXTURE" "$API/api/templates")
BAD_REG_TPL_ID=$(echo "$BAD_REG_TPL" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
BAD_REG_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"bad-reg-prj-$RUN_SUFFIX\",\"datasetIds\":[\"$DS_ID\"],\"templateId\":\"$BAD_REG_TPL_ID\"}")
[[ "$MISSING_TPL" == "422" && "$BAD_TPL" == "422" && "$NO_IMAGE_CODE" == "422" && "$BAD_REG_CODE" == "422" ]] && record PRJ-09 PASS "required, missing-image and invalid-regions templates rejected" || record PRJ-09 FAIL "missing=$MISSING_TPL invalid=$BAD_TPL noImage=$NO_IMAGE_CODE badRegions=$BAD_REG_CODE"

NO_DS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"no-ds-$RUN_SUFFIX\",\"datasetIds\":[],\"templateId\":\"$TPL_ID\"}")
BAD_DS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"bad-ds-$RUN_SUFFIX\",\"datasetIds\":[\"00000000-0000-0000-0000-000000000000\"],\"templateId\":\"$TPL_ID\"}")
FOREIGN_DS_CODE=skip
if [[ -n "${USER_TOKEN:-}" ]]; then
  USER_ID=$(curl -s -H "Authorization: Bearer $USER_TOKEN" "$API/api/auth/me" | run_python -c "import sys,json; print(json.load(sys.stdin).get('userId',''))" 2>/dev/null || true)
  FOREIGN_DS=$(curl -s -X POST "$API/api/datasets" -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d "{\"name\":\"foreign-ds-$RUN_SUFFIX\",\"ownerId\":\"$USER_ID\"}")
  FOREIGN_DS_ID=$(echo "$FOREIGN_DS" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
  FOREIGN_DS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"foreign-ds-prj-$RUN_SUFFIX\",\"datasetIds\":[\"$FOREIGN_DS_ID\"],\"templateId\":\"$TPL_ID\"}")
fi
[[ "$NO_DS" == "422" && "$BAD_DS" == "422" && "$FOREIGN_DS_CODE" == "403" ]] && record PRJ-10 PASS "empty, missing and foreign-owner datasets rejected" || record PRJ-10 FAIL "empty=$NO_DS invalid=$BAD_DS foreign=$FOREIGN_DS_CODE"

if [[ -n "${USER_TOKEN:-}" ]]; then
  B_LIST=$(curl -s -H "Authorization: Bearer $USER_TOKEN" "$API/api/projects")
  B_LEAK=$(echo "$B_LIST" | run_python -c "import sys,json; print('yes' if any(p.get('id')=='$PRJ_ID' for p in json.load(sys.stdin)) else 'no')" 2>/dev/null || echo yes)
  B_GET=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $USER_TOKEN" "$API/api/projects/$PRJ_ID")
  B_RUN=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d '{}' "$API/api/projects/$PRJ_ID/run")
  B_DEL=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $USER_TOKEN" "$API/api/projects/$PRJ_ID")
  [[ "$B_LEAK" == "no" && "$B_GET" == "403" && "$B_RUN" == "403" && "$B_DEL" == "403" ]] && record PRJ-14 PASS "owner isolation enforced" || record PRJ-14 FAIL "leak=$B_LEAK get=$B_GET run=$B_RUN delete=$B_DEL"
else
  record PRJ-14 SKIP "secondary user token unavailable"
fi

FAIL_TPL=$(curl -s -X POST -H "$AUTH_H" -F "name=fail-tpl-$RUN_SUFFIX" \
  -F 'regionsJson={"regions":[{"id":"x","alias":"x","number":"1","type":"image","resource":"/definitely/missing-mask.png"}]}' \
  -F "imageFile=@$CORRECTION_FIXTURE" "$API/api/templates")
FAIL_TPL_ID=$(echo "$FAIL_TPL" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
FAIL_PRJ=$(curl -s -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"fail-prj-$RUN_SUFFIX\",\"datasetIds\":[\"$DS_ID\"],\"templateId\":\"$FAIL_TPL_ID\"}")
FAIL_PRJ_ID=$(echo "$FAIL_PRJ" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
FAIL_RUN=$(curl -s -X POST -H "$AUTH_H" -H "Content-Type: application/json" -d '{}' "$API/api/projects/$FAIL_PRJ_ID/run")
FAIL_TASK=$(echo "$FAIL_RUN" | run_python -c "import sys,json; d=json.load(sys.stdin); print(d.get('taskId') or d.get('id',''))" 2>/dev/null || true)
FAIL_STATUS="unknown"
for _ in $(seq 1 60); do
  FAIL_TASK_JSON=$(curl -s -H "$AUTH_H" "$API/api/tasks/$FAIL_TASK")
  FAIL_STATUS=$(echo "$FAIL_TASK_JSON" | run_python -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)
  [[ "$FAIL_STATUS" == "failed" ]] && break
  sleep 1
done
FAIL_PROJECT_STATUS=$(curl -s -H "$AUTH_H" "$API/api/projects/$FAIL_PRJ_ID" | run_python -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)
FAIL_LOG=$(echo "$FAIL_TASK_JSON" | run_python -c "import sys,json; print(json.load(sys.stdin).get('logs') or '')" 2>/dev/null || true)
FAIL_REPORT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/reports/projects/$FAIL_PRJ_ID/summary")
[[ "$FAIL_STATUS" == "failed" && "$FAIL_PROJECT_STATUS" == "failed" && -n "$FAIL_LOG" && "$FAIL_REPORT_CODE" == "400" ]] && record PRJ-13 PASS "Python failure propagated and report withheld" || record PRJ-13 FAIL "task=$FAIL_STATUS project=$FAIL_PROJECT_STATUS report=$FAIL_REPORT_CODE logs=$FAIL_LOG"

QUEUE_PROJECTS=()
QUEUE_TASKS=()
for slot in 1 2 3; do
  qp=$(curl -s -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"queue-$slot-$RUN_SUFFIX\",\"datasetIds\":[\"$DS_ID\",\"$DS2_ID\"],\"templateId\":\"$TPL_ID\"}")
  qpid=$(echo "$qp" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
  qr=$(curl -s -X POST -H "$AUTH_H" -H "Content-Type: application/json" -d '{}' "$API/api/projects/$qpid/run")
  qtid=$(echo "$qr" | run_python -c "import sys,json; d=json.load(sys.stdin); print(d.get('taskId') or d.get('id',''))" 2>/dev/null || true)
  QUEUE_PROJECTS+=("$qpid")
  QUEUE_TASKS+=("$qtid")
done
QUEUED_BEFORE=$(curl -s -H "$AUTH_H" "$API/api/tasks/${QUEUE_TASKS[2]}" | run_python -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)
QUEUE_CANCEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$AUTH_H" "$API/api/projects/${QUEUE_PROJECTS[2]}/cancel")
QUEUED_AFTER=$(curl -s -H "$AUTH_H" "$API/api/tasks/${QUEUE_TASKS[2]}" | run_python -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)
QUEUED_PROJECT_AFTER=$(curl -s -H "$AUTH_H" "$API/api/projects/${QUEUE_PROJECTS[2]}" | run_python -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)
for slot in 0 1; do curl -s -o /dev/null -X POST -H "$AUTH_H" "$API/api/projects/${QUEUE_PROJECTS[$slot]}/cancel" || true; done
[[ "$QUEUED_BEFORE" == "queued" && "$QUEUE_CANCEL_CODE" == "202" && "$QUEUED_AFTER" == "cancelled" && "$QUEUED_PROJECT_AFTER" == "cancelled" ]] && record PRJ-17 PASS "queued task cancelled before running" || record PRJ-17 FAIL "before=$QUEUED_BEFORE code=$QUEUE_CANCEL_CODE task=$QUEUED_AFTER project=$QUEUED_PROJECT_AFTER"

CANCEL_PRJ=$(curl -s -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"cancel-prj-$RUN_SUFFIX\",\"datasetIds\":[\"$DS_ID\",\"$DS2_ID\"],\"templateId\":\"$TPL_ID\"}")
CANCEL_ID=$(echo "$CANCEL_PRJ" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
CANCEL_RUN=$(curl -s -X POST -H "$AUTH_H" -H "Content-Type: application/json" -d '{}' "$API/api/projects/$CANCEL_ID/run")
CANCEL_TASK=$(echo "$CANCEL_RUN" | run_python -c "import sys,json; d=json.load(sys.stdin); print(d.get('taskId') or d.get('id',''))" 2>/dev/null || true)
RUNNING_BEFORE=no
for _ in $(seq 1 60); do
  CURRENT_CANCEL_STATUS=$(curl -s -H "$AUTH_H" "$API/api/tasks/$CANCEL_TASK" | run_python -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)
  if [[ "$CURRENT_CANCEL_STATUS" == "running" ]]; then RUNNING_BEFORE=yes; break; fi
  [[ "$CURRENT_CANCEL_STATUS" == "success" || "$CURRENT_CANCEL_STATUS" == "failed" ]] && break
  sleep 1
done
CANCEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$AUTH_H" "$API/api/projects/$CANCEL_ID/cancel")
for _ in $(seq 1 120); do
  CANCEL_STATUS=$(curl -s -H "$AUTH_H" "$API/api/tasks/$CANCEL_TASK" | run_python -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)
  [[ "$CANCEL_STATUS" == "cancelled" || "$CANCEL_STATUS" == "success" || "$CANCEL_STATUS" == "failed" ]] && break
  sleep 1
done
CANCEL_PROJECT_STATUS=$(curl -s -H "$AUTH_H" "$API/api/projects/$CANCEL_ID" | run_python -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)
[[ "$RUNNING_BEFORE" == "yes" && "$CANCEL_CODE" == "202" && "$CANCEL_STATUS" == "cancelled" && "$CANCEL_PROJECT_STATUS" == "cancelled" ]] && record PRJ-18 PASS "running task cancelled at pipeline boundary" || record PRJ-18 FAIL "running=$RUNNING_BEFORE cancel=$CANCEL_CODE task=$CANCEL_STATUS project=$CANCEL_PROJECT_STATUS"

DELETE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "$AUTH_H" "$API/api/projects/$EPRJ_ID")
AFTER_DELETE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/projects/$EPRJ_ID")
EDGE_DELETE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "$AUTH_H" "$API/api/projects/$EDGE_ID")
EDGE_TASK_AFTER_DELETE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/tasks/$EDGE_TASK")
[[ "$DELETE_CODE" == "204" && "$AFTER_DELETE" == "404" && "$EDGE_DELETE" == "204" && "$EDGE_TASK_AFTER_DELETE" == "404" ]] && record PRJ-20 PASS "draft/completed projects and tasks deleted" || record PRJ-20 FAIL "draft=$DELETE_CODE/$AFTER_DELETE completed=$EDGE_DELETE task=$EDGE_TASK_AFTER_DELETE"

# --- P1 RPT ---
SUMMARY_RESPONSE=$(curl -s -w "\n%{http_code}" -H "$AUTH_H" "$API/api/reports/projects/$PRJ_ID/summary")
code=$(echo "$SUMMARY_RESPONSE" | tail -1)
SUMMARY_BODY=$(echo "$SUMMARY_RESPONSE" | head -1)
if [[ "$code" == "200" ]]; then
  record RPT-01 PASS "summary $code"
elif [[ "$TASK_STATUS" != "success" && "$code" == "400" ]]; then
  record RPT-01 SKIP "summary $code (no success task yet)"
else
  record RPT-01 FAIL "summary $code"
fi

IMG_NAME=$(echo "$SUMMARY_BODY" | run_python -c "import sys,json; d=json.load(sys.stdin); rows=d.get('preview',{}).get('mainColor',[]); print(rows[0].get('image_name','') if rows else '')" 2>/dev/null || true)
code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/reports/projects/$PRJ_ID/images/$IMG_NAME")
if [[ "$code" == "200" ]]; then
  record RPT-02 PASS "image report $code"
elif [[ "$TASK_STATUS" != "success" && "$code" == "400" ]]; then
  record RPT-02 SKIP "image report $code (no success task)"
else
  record RPT-02 FAIL "image report $code (name=$IMG_NAME)"
fi

code_csv=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/reports/projects/$PRJ_ID/export?format=csv")
code_pdf=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_H" "$API/api/reports/projects/$PRJ_ID/export?format=pdf")
if [[ "$code_csv" == "200" && "$code_pdf" == "200" ]]; then
  record RPT-03 PASS "csv/pdf export 200"
elif [[ "$TASK_STATUS" != "success" && "$code_csv" == "400" && "$code_pdf" == "400" ]]; then
  record RPT-03 SKIP "csv/pdf export 400 (no success task)"
else
  record RPT-03 FAIL "csv=$code_csv pdf=$code_pdf"
fi

NEW_PRJ=$(curl -s -X POST "$API/api/projects" -H "$AUTH_H" -H "Content-Type: application/json" -d "{\"name\":\"no-run-$RUN_SUFFIX\",\"datasetIds\":[\"$DS_ID\"],\"templateId\":\"$TPL_ID\"}")
NEW_ID=$(echo "$NEW_PRJ" | run_python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
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
