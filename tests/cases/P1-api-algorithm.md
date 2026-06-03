# P1 图像算法 API（Spring 转发 Python）

**前置：** AUTH-01、`TOKEN`；Python 服务正常（SMK-02）。

| ID | 场景 | 步骤 | 期望 | 状态 |
|----|------|------|------|------|
| ALG-01 | Canny 检测 | `POST /api/images/canny` multipart `image` + 可选 `config` | 200 JSON，含 `regions` | 待测 |
| ALG-02 | 校正角点 | `POST /api/images/correction/points` + 小图 | 200，含 `points` 数组 | 待测 |
| ALG-03 | 透视对齐 | `POST /api/images/correction/align` model+image | 200，`Content-Type` 含 image/png | 待测 |
| ALG-04 | HSV 处理 | `POST /api/images/hsv/process` image+mask | 200 图像流 | 待测 |
| ALG-05 | Python 不可用 | 停 `color-python` 后重试 ALG-01 | 5xx 或明确错误信息（记录实际） | 待测 |

## 样例文件

- `tests/fixtures/images/sample.png`（通用）
- 模板图：可复制 `algorithm-service/model_image.jpg` 到 fixtures

## 执行记录

| 执行人 | 日期 | 通过/总数 | 备注 |
|--------|------|-----------|------|
| | | /5 | |
