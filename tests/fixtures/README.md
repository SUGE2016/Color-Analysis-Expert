# 测试 Fixtures

本期执行 P1/P2 前，建议至少准备：

| 文件 | 用途 | 来源建议 |
|------|------|----------|
| `images/sample.png` | 上传、Canny、角点 | 任意小 PNG（<500KB） |
| `images/model.jpg` | 校正 align | 复制 `algorithm-service/model_image.jpg` |
| `regions/butterfly.json` | 完整 run（可选） | 复制 `algorithm-service/butterfly.json` |
| `regions/edge.json` | 完整 run（可选） | 复制 `algorithm-service/edge.json` |

目录结构（待创建）：

```
fixtures/
├── images/
│   ├── sample.png
│   └── model.jpg
└── regions/
    ├── butterfly.json
    └── edge.json
```

> 大图/样例集（`butterfly_image/` 等）不放入 tests，继续放在 `algorithm-service/` 供算法回归。
