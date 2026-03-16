# VoteMatch — 技术架构文档 / Technical Architecture Spec

---

## 1. 系统总览 / System Overview

VoteMatch 系统由三个核心模块组成：数据管线（后台数据采集与处理）、应用服务（面向选民和候选人的 Web 应用）、咨询分析平台（面向内部咨询师的数据洞察工具）。

The VoteMatch system consists of three core modules: Data Pipeline (backend data collection and processing), Application Service (voter and candidate-facing web app), and Consulting Analytics Platform (internal data insights tool for consultants).

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Pipeline (后台数据管线)               │
│                                                             │
│  候选人名单获取 ──→ Step 1: 搜集员 ──→ 链接验证 ──→ Step 2: 分析员  │
│  Candidate List     Collector        URL Check    Analyzer  │
│       │                                              │      │
│       ▼                                              ▼      │
│  ┌──────────┐                              ┌──────────────┐ │
│  │ 选举数据库 │                              │ 立场数据库     │ │
│  │ Election │                              │ Position DB  │ │
│  │ DB       │                              │              │ │
│  └──────────┘                              └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Application Service (应用服务)               │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐   │
│  │ 选民前端    │  │ 候选人后台  │  │ 问题生成 & 匹配引擎  │   │
│  │ Voter UI   │  │ Candidate  │  │ Question Gen &      │   │
│  │            │  │ Portal     │  │ Match Engine        │   │
│  └────────────┘  └────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│            Consulting Analytics (咨询分析平台)                 │
│                                                             │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ 聚合数据 Dashboard │  │ LLM 分析报告  │  │ 咨询师工作台   │  │
│  │ Aggregated Data │  │ LLM Report   │  │ Consultant    │  │
│  │ Dashboard       │  │ Generator    │  │ Workbench     │  │
│  └────────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈 / Tech Stack

| 模块 / Module | 技术选型 / Technology | 说明 / Rationale |
|---|---|---|
| 前端 / Frontend | Next.js (React) | SSR 有利于 SEO；选举相关内容需要被搜索引擎收录 / SSR benefits SEO; election content needs to be indexable |
| 后端 API | Node.js (Next.js API Routes) 或 Python (FastAPI) | MVP 阶段用 Next.js API Routes 减少复杂度 / Use Next.js API Routes in MVP to reduce complexity |
| 数据库 / Database | PostgreSQL | 结构化数据为主，关系型数据库足够 / Primarily structured data; relational DB is sufficient |
| 缓存 / Cache | Redis | 缓存预生成的问题集和匹配结果 / Cache pre-generated question sets and match results |
| LLM 集成 / LLM Integration | Anthropic Claude API (或其他具备联网搜索能力的 LLM) | 搜集员需要联网能力；分析员需要强推理能力 / Collector needs web access; Analyzer needs strong reasoning |
| 部署 / Deployment | Vercel (前端) + Railway/Fly.io (后端服务) | 低成本快速部署 / Low-cost rapid deployment |
| 定时任务 / Scheduler | GitHub Actions 或 Cron job | 触发数据管线定期运行 / Trigger periodic pipeline runs |
| 身份验证 / Auth | NextAuth.js | 仅候选人端需要，选民端无需登录 / Only for candidate portal; voters don't need to log in |

---

## 3. 数据管线详细设计 / Data Pipeline Detailed Design

### 3.1 候选人名单获取 / Candidate List Acquisition

**数据源 / Data Sources:**
- 各州选举委员会 API/网站（Secretary of State websites）
- FEC（联邦选举委员会）公开数据
- BallotReady、Vote Smart 等第三方数据聚合

**数据模型 / Data Model:**
```
Election {
  id: UUID
  name: string              // e.g. "2026 Wisconsin State Assembly"
  type: enum                // federal | state | city | local
  district: string          // 选区标识
  election_date: date
  status: enum              // upcoming | active | completed
}

Candidate {
  id: UUID
  name: string
  election_id: FK → Election
  party: string
  incumbent: boolean
  official_website: string?
  claimed: boolean          // 是否已认领档案
  claimed_by: FK → User?
}
```

### 3.2 Step 1: 搜集员 / Collector

**输入 / Input:** 候选人姓名、选区、职位 / Candidate name, district, office

**LLM Prompt 策略 / LLM Prompt Strategy:**
```
你是一个政治信息搜集员。请为以下候选人搜索并收集所有与政策立场相关的公开信息。

候选人: {candidate_name}
竞选职位: {office}
选区: {district}

搜索策略（按以下顺序逐一搜索）:
1. 候选人官方竞选网站，尤其是 /issues, /platform, /about 页面
2. 如为现任官员，搜索其投票记录
3. 本地新闻媒体的采访和报道
4. 候选人公开社交媒体帖子（关于政策的）

输出要求:
- 列出所有找到的信息来源，每条包含：
  - source_url: 原始链接
  - source_type: official_website | voting_record | news | social_media
  - raw_text: 与政策相关的原文摘录
  - access_date: 访问日期
- 不做任何立场判断或摘要
- 如果某类来源未找到任何结果，明确标注"未找到"
```

**输出数据模型 / Output Data Model:**
```
RawMaterial {
  id: UUID
  candidate_id: FK → Candidate
  source_url: string
  source_type: enum         // official_website | voting_record | news | social_media
  raw_text: text
  access_date: timestamp
  url_verified: boolean     // 中间验证步骤填充
  content_verified: boolean
}
```

### 3.3 中间验证 / Intermediate Validation

- 程序化访问每个 `source_url`，确认 HTTP 200。
- Programmatically visit each `source_url` to confirm HTTP 200.
- 对页面内容做基础文本匹配，验证 `raw_text` 确实存在于该页面。
- Basic text matching on page content to verify `raw_text` actually exists on the page.
- 验证失败的标记为 `url_verified = false`，进入人工审核队列或直接丢弃。
- Failed verifications are flagged `url_verified = false` and enter manual review queue or are discarded.

### 3.4 Step 2: 分析员 / Analyzer

**输入 / Input:** 该候选人所有通过验证的 RawMaterial / All verified RawMaterial for a candidate

**预定义议题框架 / Predefined Issue Framework:**
```
IssueCategory {
  id: UUID
  name: string           // e.g. "healthcare", "education", "taxation"
  level: enum            // federal | state | local
  display_name_en: string
  display_name_zh: string
  // ... 其他语言
}
```

议题框架按选举层级不同而不同：联邦级关注移民、国防、外交；地方级关注 zoning、学区、公共交通等。

Issue framework varies by election level: federal focuses on immigration, defense, foreign policy; local focuses on zoning, school districts, public transit, etc.

**LLM Prompt 策略 / LLM Prompt Strategy:**
```
你是一个政治立场分析员。根据以下原始材料，提取该候选人在各议题上的立场。

候选人: {candidate_name}
原始材料: {raw_materials}
议题框架: {issue_categories}

输出要求（JSON 格式）:
对每个议题，输出:
{
  "issue_id": "...",
  "position_summary": "一句话概括立场",
  "position_score": -2 到 +2 的数值 (正值=支持/进步立场, 负值=反对/保守立场, 0=中立或模糊),
  "confidence": "high | medium | low",
  "supporting_evidence": [
    {
      "raw_material_id": "...",
      "relevant_quote": "原文中支持此判断的关键段落"
    }
  ],
  "notes": "如立场模糊/矛盾/未找到，在此说明"
}

特别注意:
- 置信度 low 的立场标记为"立场不明确"
- 如候选人在某议题上说了很多但无实质立场，标注为"未找到明确立场"
- 如存在自相矛盾的表态，标注并同时保留
- 不要编造或推测候选人没有公开表达过的立场
```

**输出数据模型 / Output Data Model:**
```
CandidatePosition {
  id: UUID
  candidate_id: FK → Candidate
  issue_id: FK → IssueCategory
  position_summary: string
  position_score: float        // -2.0 to +2.0
  confidence: enum             // high | medium | low
  source: enum                 // ai_extracted | candidate_self_report
  supporting_evidence: JSON[]  // [{raw_material_id, relevant_quote}]
  notes: string?
  created_at: timestamp
  updated_at: timestamp
}
```

---

## 4. 问题生成引擎 / Question Generation Engine

### 4.1 触发时机 / Trigger

每当某选区的候选人立场数据发生变化时（新抓取、候选人自主更新），重新生成该选区的问题集。

Regenerate the question set for a district whenever candidate position data changes (new scrape, candidate self-update).

### 4.2 生成流程 / Generation Flow

```
1. 获取该选区所有候选人的 CandidatePosition 数据
   Fetch all CandidatePosition data for candidates in the district

2. 计算每个议题上候选人之间的分歧度
   Calculate divergence score among candidates for each issue
   divergence = max(position_scores) - min(position_scores)

3. 按分歧度降序排列，选取 top 8-15 个议题
   Sort by divergence descending, select top 8-15 issues

4. 调用 LLM 为每个选中的议题生成用户问题
   Call LLM to generate user-facing question for each selected issue
```

**LLM Prompt 策略（问题生成）/ LLM Prompt Strategy (Question Generation):**
```
为以下政策议题生成一个面向普通选民的问题。

议题: {issue_name}
候选人立场摘要: {candidate_positions_summary}

要求:
- 使用日常口语，小学六年级学生能理解
- 不使用任何政治术语或专业词汇
- 一个问题只问一件事
- 措辞完全中立，不带任何引导
- 定义该问题的"正方向"（同意=支持什么）
- 附带一段 2-3 句的背景说明（同样用大白话）

输出 JSON:
{
  "question_text": "...",
  "positive_direction": "同意此问题意味着支持...",
  "background": "...",
  "reading_level_check": true/false  // 自检：是否达到小学六年级可理解
}
```

**输出数据模型 / Output Data Model:**
```
QuestionSet {
  id: UUID
  election_id: FK → Election
  generated_at: timestamp
  questions: Question[]
}

Question {
  id: UUID
  question_set_id: FK → QuestionSet
  issue_id: FK → IssueCategory
  question_text: string
  positive_direction: string
  background: string
  display_order: int
}
```

---

## 5. 匹配引擎 / Match Engine

### 5.1 用户回答映射 / User Answer Mapping

```
strongly_agree    → +2
agree             → +1
neutral           →  0
disagree          → -1
strongly_disagree → -2
not_interested    → NULL (excluded from calculation)
```

### 5.2 匹配度计算 / Match Calculation

```python
def calculate_match(user_answers, candidate_positions):
    """
    user_answers: dict of {issue_id: score} (不含 not_interested)
    candidate_positions: dict of {issue_id: position_score}
    """
    total_weight = 0
    weighted_similarity = 0

    for issue_id, user_score in user_answers.items():
        if issue_id not in candidate_positions:
            continue

        candidate_score = candidate_positions[issue_id]

        # 最大可能差距为 4 (-2 vs +2)
        # Max possible difference is 4 (-2 vs +2)
        difference = abs(user_score - candidate_score)
        similarity = 1 - (difference / 4)  # 归一化到 0-1

        # 用户立场越强烈，该议题权重越高
        # Stronger user stance = higher weight for this issue
        weight = abs(user_score) if user_score != 0 else 0.5

        weighted_similarity += similarity * weight
        total_weight += weight

    if total_weight == 0:
        return 0

    match_percentage = (weighted_similarity / total_weight) * 100
    return round(match_percentage, 1)
```

### 5.3 结果解释生成 / Result Explanation Generation

匹配度计算完成后，调用 LLM 生成自然语言的匹配解释。此步骤可部分预生成缓存。

After match calculation, LLM generates natural language match explanations. This step can be partially pre-generated and cached.

```
输入: 用户回答、候选人立场、匹配分数
Input: User answers, candidate positions, match scores

输出: 每位候选人的简短匹配摘要 + 逐议题对比说明
Output: Brief match summary per candidate + issue-by-issue comparison
```

---

## 6. 数据库 Schema 总览 / Database Schema Overview

```sql
-- 选举信息
CREATE TABLE elections (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,          -- federal|state|city|local
    district VARCHAR(255) NOT NULL,
    state VARCHAR(50),
    election_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'upcoming'
);

-- 候选人
CREATE TABLE candidates (
    id UUID PRIMARY KEY,
    election_id UUID REFERENCES elections(id),
    name VARCHAR(255) NOT NULL,
    party VARCHAR(100),
    incumbent BOOLEAN DEFAULT FALSE,
    official_website VARCHAR(500),
    claimed BOOLEAN DEFAULT FALSE,
    claimed_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 议题分类
CREATE TABLE issue_categories (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,         -- internal key
    level VARCHAR(20) NOT NULL,         -- federal|state|local
    display_name_en VARCHAR(255),
    display_name_zh VARCHAR(255)
);

-- 原始材料 (Step 1 输出)
CREATE TABLE raw_materials (
    id UUID PRIMARY KEY,
    candidate_id UUID REFERENCES candidates(id),
    source_url TEXT NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    raw_text TEXT NOT NULL,
    access_date TIMESTAMP NOT NULL,
    url_verified BOOLEAN DEFAULT FALSE,
    content_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 候选人立场 (Step 2 输出)
CREATE TABLE candidate_positions (
    id UUID PRIMARY KEY,
    candidate_id UUID REFERENCES candidates(id),
    issue_id UUID REFERENCES issue_categories(id),
    position_summary TEXT,
    position_score DECIMAL(3,1),        -- -2.0 to +2.0
    confidence VARCHAR(10),             -- high|medium|low
    source VARCHAR(30),                 -- ai_extracted|candidate_self_report
    supporting_evidence JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(candidate_id, issue_id)
);

-- 问题集
CREATE TABLE question_sets (
    id UUID PRIMARY KEY,
    election_id UUID REFERENCES elections(id),
    generated_at TIMESTAMP DEFAULT NOW()
);

-- 问题
CREATE TABLE questions (
    id UUID PRIMARY KEY,
    question_set_id UUID REFERENCES question_sets(id),
    issue_id UUID REFERENCES issue_categories(id),
    question_text TEXT NOT NULL,
    positive_direction TEXT NOT NULL,
    background TEXT,
    display_order INT
);

-- 用户回答 (匿名，不关联个人身份)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY,
    election_id UUID REFERENCES elections(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_answers (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES user_sessions(id),
    question_id UUID REFERENCES questions(id),
    answer VARCHAR(20) NOT NULL,        -- strongly_agree|agree|neutral|disagree|strongly_disagree|not_interested
    answer_score DECIMAL(3,1),          -- -2.0 to +2.0, NULL for not_interested
    created_at TIMESTAMP DEFAULT NOW()
);

-- 候选人用户 (仅已认领档案的候选人)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'candidate',
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 7. API 设计 / API Design

### 7.1 选民端 API / Voter API

```
GET  /api/elections?zip={zipCode}
     → 根据邮编返回当前可用选举列表
     → Returns available elections by zip code

GET  /api/elections/{electionId}/candidates
     → 返回该选举所有候选人基础信息
     → Returns all candidates for an election

GET  /api/elections/{electionId}/questions
     → 返回该选举的问题集（预生成缓存）
     → Returns question set for an election (pre-generated, cached)

POST /api/match
     Body: { election_id, answers: [{question_id, answer}] }
     → 返回匹配结果：每位候选人的匹配度 + 逐议题对比
     → Returns match results: match percentage per candidate + issue breakdown

GET  /api/candidates/{candidateId}/positions
     → 返回某候选人的详细立场信息（含来源标注）
     → Returns detailed positions for a candidate (with source attribution)
```

### 7.2 候选人端 API / Candidate API (Authenticated)

```
POST /api/candidates/claim
     Body: { candidate_id, verification_info }
     → 候选人认领档案
     → Candidate claims their profile

GET  /api/candidates/me/positions
     → 获取自己的立场数据
     → Get own position data

PUT  /api/candidates/me/positions/{positionId}
     Body: { position_summary, position_score, notes }
     → 修正/补充立场信息（标记为 candidate_self_report）
     → Update/add position (marked as candidate_self_report)

GET  /api/candidates/me/insights (付费功能 / Paid feature)
     → 获取该选区匿名聚合的选民洞察
     → Get anonymized aggregated voter insights for the district
```

---

## 8. 安全与隐私 / Security & Privacy

- 用户回答存储在匿名 session 中，不关联 IP、设备指纹或任何个人身份信息。
- User answers stored in anonymous sessions, not linked to IP, device fingerprint, or any PII.
- 候选人端的 insights API 仅返回聚合数据，最小聚合单位需 ≥ 50 个用户 session。
- Candidate insights API returns only aggregated data; minimum aggregation unit requires ≥ 50 user sessions.
- 候选人认领需通过邮箱验证 + 人工审核（MVP 阶段）。
- Candidate claiming requires email verification + manual review (MVP stage).
- 所有 LLM 调用不传入用户个人信息。
- No user PII is sent in any LLM API calls.

---

## 9. MVP 技术实现计划 / MVP Implementation Plan

### Phase 1: 数据准备 (1-2 周) / Data Preparation (1-2 weeks)
- [ ] 选定目标选举和选区
- [ ] 手动整理候选人名单，录入数据库
- [ ] 开发并测试 Step 1 (搜集员) prompt
- [ ] 开发并测试 Step 2 (分析员) prompt
- [ ] 运行管线，人工校验输出质量
- [ ] 定义该选区的议题框架

### Phase 2: 核心应用 (2-3 周) / Core Application (2-3 weeks)
- [ ] 搭建 Next.js 项目 + PostgreSQL
- [ ] 实现问题生成引擎
- [ ] 开发选民前端 UI（选区 → 问题 → 结果）
- [ ] 实现匹配算法
- [ ] 结果页面（匹配度排名 + 逐议题对比 + 来源标注）

### Phase 3: 上线验证 (1-2 周) / Launch & Validate (1-2 weeks)
- [ ] 部署上线
- [ ] 冷启动推广（本地社区渠道）
- [ ] 收集用户反馈
- [ ] 监控完成率和数据准确性

### Phase 4: 商业化准备 (选举前) / Commercialization Prep (Before Election)
- [ ] 开发候选人认领功能
- [ ] 开发聚合数据 dashboard
- [ ] 接触候选人竞选团队，推销洞察服务

---

## 10. 成本估算 / Cost Estimates (MVP)

| 项目 / Item | 估算 / Estimate |
|---|---|
| LLM API 费用（数据管线）/ LLM API (pipeline) | $50-200 (取决于候选人数量) |
| LLM API 费用（问题生成+结果解释）/ LLM API (questions + explanations) | $20-100/月 |
| Vercel 部署 / Vercel hosting | 免费层 (Free tier) |
| PostgreSQL (Railway/Supabase) | 免费层 (Free tier) |
| Redis (Upstash) | 免费层 (Free tier) |
| 域名 / Domain | ~$15/年 |
| **总计 / Total** | **< $500 启动 / to start** |
