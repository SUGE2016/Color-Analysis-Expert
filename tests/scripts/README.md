# 自动化脚本（占位）

用例评审通过后，按优先级实现：

| 脚本 | 对应用例 | 工具 |
|------|----------|------|
| `smoke.sh` | P0 `SMK-*` | curl + jq |
| `api-auth.sh` | P1 AUTH | curl |
| `newman/` | P1 全集 | Postman CLI，集合见 `backend/APIdoc/` |

执行约定：

```bash
# 示例（未实现）
./tests/scripts/smoke.sh
```

CI 建议见 `tests/test-plan.md` §7。
