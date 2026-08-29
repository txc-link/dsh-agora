# 06 — 3 台机部署拓扑（Windows / Linux / Mac）

> 子能力: 部署（用户 turn 158："3 machines Windows/Linux/Mac, 全有 DSH, 全连 Discord, 将连 Matrix, 可装 agora; Linux = home server + memo0 server = 本机"）
> 日期: 2026-08-30

## 1. 现状

| 已有 | 说明 |
|---|---|
| federation P1/P2 baseline | `dsh-agora-coordination-and-federation-v1.md`（coordination run / A2A / artifact / layered memory / sandbox / credentials） |
| matrix roadmap | `Doc/03-ARCHITECTURE/2026-08-30-matrix-roadmap/` |
| homeserver access | `Doc/03-ARCHITECTURE/2026-08-30-homeserver-access/` |
| 跨平台 serve | `agora serve --platform=systemd\|launchd\|windows\|docker\|bare`（turn 157 已实现！） |
| 跨平台 install | `Doc/scripts/install-agora.sh`（turn 157 已实现！） |

## 2. 目标拓扑

```
┌─────────────────────────────────────────────┐
│  Linux (本机) = 中央 homeserver + agora server │
│   - home server (Synapse homeserver)         │
│   - memo0 server                             │
│   - agora server (18008)                     │
│   - Qdrant (向量索引)                         │
└─────────────────────────────────────────────┘
        ▲ Matrix 联邦 / agora federation
        │
┌───────┴────────┐  ┌───────────────┐
│  Windows 机器   │  │  Mac 机器      │
│  - DSH          │  │  - DSH        │
│  - agora plugin │  │  - agora plugin│
│  - 连 Matrix    │  │  - 连 Matrix  │
└────────────────┘  └───────────────┘
```

## 3. 复用（turn 157 已交付）

- **`agora serve --platform=systemd|launchd|windows|docker|bare`** — 3 台机都能装服务
- **`install-agora.sh`** — 一行安装脚本（curl | bash）
- **`agora init --non-interactive`** — 无人值守初始化

## 4. 部署步骤（每台机）

```bash
# 1. 安装 agora CLI（每台机）
npm i -g agora-ts  # 或从仓库构建

# 2. 初始化 + 启动服务
curl -sSL .../install.sh | bash -s -- \
  --admin-password "$(openssl rand -base64 16)" \
  --platform=windows   # 或 systemd / launchd

# 3. 配置 Matrix 连接（每台机）
#    agora 连中央 homeserver (Linux)

# 4. 联邦配置（如需跨机）
#    federation P1/P2
```

## 5. 角色分配建议（未决）

| 方案 | 说明 | 优劣 |
|---|---|---|
| A: Linux 集中 | 中央 agora server + 所有 agent 跑 Linux | 简单，但 Win/Mac 只是客户端 |
| B: 每台有 agora | 三台各自 agora server + 联邦 | 复杂，资源分散 |
| C: 混合 | Linux 中央 + Win/Mac 只跑本地 agent 连中央 | 推荐（用户场景：Linux 有 GPU/memo0） |

## 6. 未决

- 三台机是"一个组织"还是"三个组织联邦"？（用户 Q5，未答）
- Windows/Mac 上 agora 的形态（plugin？独立 server？）
- matrix 是中央 homeserver 还是联邦？
- memo0 部署在 Linux（用户已说 Linux = memo0 server）
