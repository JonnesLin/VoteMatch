# VoteMatch — 产品需求文档 / Product Requirements Document

---

## 1. 产品概述 / Product Overview

**VoteMatch** 是一个帮助选民发现与自身政治立场最匹配的候选人的在线工具。用户选择所在选区后，回答一组关于政策议题的简单问题，系统会根据回答与候选人的公开立场进行匹配，给出匹配度排名及详细的逐议题对比。

**VoteMatch** is an online tool that helps voters discover which candidates best align with their political views. Users select their district, answer a set of simple policy-related questions, and the system matches their responses against candidates' public positions — delivering a ranked match result with detailed issue-by-issue comparisons.

---

## 2. 目标用户 / Target Users

- **核心用户：** 平时不太关注政治、但需要投票时希望做出知情选择的普通选民。
- **Primary users:** Everyday voters who don't closely follow politics but want to make informed choices when it's time to vote.

- **次要用户：** 候选人及其竞选团队（作为数据洞察和咨询服务的付费客户）。
- **Secondary users:** Candidates and their campaign teams (as paying customers for data insights and consulting services).

---

## 3. 核心用户流程 / Core User Flow

### 3.1 选民端 / Voter Side

```
选择地区/选举 → 系统展示该选区候选人 → 回答政策问题 → 查看匹配结果 → 深入了解候选人立场
Select district/election → System shows candidates → Answer policy questions → View match results → Explore candidate positions
```

**Step 1: 选择地区 / Select District**
- 用户输入地址或邮编，系统自动匹配当前可用的选举和候选人。
- User enters address or zip code; system auto-matches current elections and candidates.

**Step 2: 回答问题 / Answer Questions**
- 系统根据该选区候选人之间的实际政策分歧，动态生成 8-15 个问题。
- System dynamically generates 8-15 questions based on actual policy differences among candidates in that district.
- 问题使用日常口语，小学六年级能理解的语言水平，不使用任何政治术语。
- Questions use everyday language at a 6th-grade reading level, free of political jargon.
- 每个问题提供六个选项：强烈同意 / 同意 / 中立 / 反对 / 强烈反对 / 不感兴趣。
- Each question offers six options: Strongly Agree / Agree / Neutral / Disagree / Strongly Disagree / Not Interested.
- 每个问题附带可展开的背景说明（同样用大白话写）。
- Each question includes an expandable background explainer (also written in plain language).

**Step 3: 查看结果 / View Results**
- **第一屏：匹配度排名。** 展示每位候选人的总体匹配百分比。措辞为"XXX 的政策立场与你最接近"而非"你应该投给 XXX"。
- **First screen: Match ranking.** Shows overall match percentage for each candidate. Wording: "XXX's policy positions are closest to yours" — not "You should vote for XXX."
- **第二屏：逐议题对比。** 每个议题展示用户选择 vs 每位候选人的立场，标注匹配/不匹配。
- **Second screen: Issue-by-issue comparison.** Each issue shows user's choice vs each candidate's position, labeled as match/mismatch.
- **立场来源标注。** 每个候选人的立场旁边注明数据来源（官网 / 投票记录 / 候选人自述）。用户可点击查看原文链接。
- **Source attribution.** Each candidate's position is tagged with its source (official website / voting record / candidate self-report). Users can click to view the original source.
- **"未找到公开立场"** 明确标出候选人在某议题上无公开表态的情况。
- **"No public position found"** is explicitly shown when a candidate has no public stance on an issue.

### 3.2 候选人端 / Candidate Side

- 候选人可通过"认领档案"机制（类似 Google Business）认领并管理自己的候选人页面。
- Candidates can claim and manage their profile through a "Claim Your Profile" mechanism (similar to Google Business).
- 认领后可补充或修正立场信息，这些内容会标注为"候选人自述"，与 AI 抓取的客观数据区分。
- After claiming, they can add or correct position info, labeled as "Candidate Self-Report" and distinguished from AI-sourced data.
- 如果候选人自述与公开投票记录矛盾，系统会同时展示两者，让用户自行判断。
- If a candidate's self-report contradicts their public voting record, both are displayed for user judgment.

---

## 4. 数据体系 / Data Architecture

### 4.1 数据来源层级 / Data Source Hierarchy

| 层级 / Layer | 说明 / Description | 标注 / Label |
|---|---|---|
| AI 自动抓取 / AI Auto-Scraped | 从公开来源（官网、投票记录、新闻）提取 / Extracted from public sources (websites, voting records, news) | 来源类型 + 原文链接 / Source type + original link |
| 候选人自述 / Candidate Self-Report | 候选人认领档案后自行补充 / Added by candidate after claiming profile | "候选人自述" / "Candidate Self-Report" |
| 未找到 / Not Found | 该议题无公开立场信息 / No public position found on this issue | "未找到公开立场" / "No public position found" |

### 4.2 数据管线（两步分离）/ Data Pipeline (Two-Step Separation)

**Step 1: 搜集员 / Collector**
- 使用具备联网能力的 LLM，根据候选人名字和选区信息搜索公开信息。
- Uses a web-enabled LLM to search public information based on candidate name and district.
- 搜索策略清单：官方竞选网站 → 投票记录数据库 → 本地新闻报道 → 社交媒体公开帖。
- Search checklist: Official campaign website → Voting record databases → Local news coverage → Public social media posts.
- 输出：原始材料文本 + 来源 URL 列表。不做任何立场判断。
- Output: Raw text material + source URL list. No stance judgment at this stage.

**中间验证 / Intermediate Validation**
- 自动访问收集到的 URL，确认链接有效且内容与 LLM 描述一致。
- Automatically visit collected URLs to confirm links are valid and content matches LLM descriptions.

**Step 2: 分析员 / Analyzer**
- 接收 Step 1 的原始材料，按预定义的议题框架提取结构化立场。
- Takes raw materials from Step 1 and extracts structured positions based on a predefined issue framework.
- 输出结构化数据，包含：议题、立场摘要、支持原文、来源链接、置信度（高/中/低）。
- Outputs structured data including: issue, position summary, supporting text, source link, confidence level (high/medium/low).
- 置信度低的标注为"立场不明确"而非强行归类。
- Low-confidence items are labeled "Position unclear" rather than being force-classified.
- 能识别"说了很多但没有实质立场"的情况。
- Capable of identifying cases where a candidate says a lot without taking a substantive position.

### 4.3 更新策略 / Update Strategy

- 选举季前集中运行一轮完整抓取。
- Run a full scrape cycle before election season.
- 关键节点（辩论后、重大政策发布后）触发增量更新。
- Trigger incremental updates at key moments (after debates, major policy announcements).
- 候选人自主更新实时生效。
- Candidate self-updates take effect in real time.

---

## 5. 问题生成与匹配算法 / Question Generation & Matching Algorithm

### 5.1 动态问题生成 / Dynamic Question Generation

- LLM 接收该选区所有候选人的结构化立场数据，识别分歧最大的议题，优先生成这些议题的问题。
- LLM receives structured position data for all candidates in a district, identifies issues with the greatest divergence, and prioritizes generating questions on those topics.
- 问题数量控制在 8-15 个。
- Question count: 8-15.
- 语言要求：日常口语，无术语，一个问题只问一件事。
- Language requirement: Everyday language, no jargon, one concept per question.
- 每个问题需定义明确的"正方向"，确保分数映射一致。
- Each question must define a clear "positive direction" to ensure consistent score mapping.
- 问题在候选人数据更新时预生成并缓存，非实时调用 LLM。
- Questions are pre-generated and cached when candidate data updates, not generated in real-time.

### 5.2 匹配算法（混合方案）/ Matching Algorithm (Hybrid Approach)

- **量化打分：** LLM 预先将候选人在每个问题上的立场映射为 -2 到 +2 的量表。用户回答同样映射到此量表（强烈同意 = +2，同意 = +1，中立 = 0，反对 = -1，强烈反对 = -2，不感兴趣 = 跳过）。
- **Quantified scoring:** LLM pre-maps each candidate's position per question to a -2 to +2 scale. User answers map to the same scale (Strongly Agree = +2, Agree = +1, Neutral = 0, Disagree = -1, Strongly Disagree = -2, Not Interested = skip).
- **匹配度计算：** 使用加权相似度算法，"不感兴趣"的议题不参与计算。
- **Match calculation:** Uses weighted similarity algorithm; "Not Interested" issues are excluded from calculation.
- **结果解释：** 匹配度计算完成后，调用 LLM 生成自然语言解释（也可预生成缓存）。
- **Result explanation:** After match calculation, LLM generates natural language explanations (can also be pre-generated and cached).

---

## 6. 非功能需求 / Non-Functional Requirements

### 6.1 中立性 / Neutrality
- 问题措辞必须中立无引导。
- Question wording must be neutral and non-leading.
- 付费候选人不得在匹配算法中获得任何优势。
- Paying candidates must not receive any advantage in the matching algorithm.
- 所有立场数据来源透明可追溯。
- All position data must be transparent and traceable to sources.

### 6.2 隐私 / Privacy
- 用户无需注册即可使用核心功能。
- Users can access core features without registration.
- 用户的具体回答和匹配结果不可被分享或关联到个人。
- Individual user answers and match results must not be shareable or linkable to personal identity.
- 提供给候选人的数据洞察必须完全匿名和聚合。
- Data insights provided to candidates must be fully anonymized and aggregated.

### 6.3 可访问性 / Accessibility
- 多语言支持（LLM 动态翻译）。
- Multi-language support (LLM dynamic translation).
- 移动端优先设计。
- Mobile-first design.
- 低网速环境可用（问题页面轻量化）。
- Usable on low-bandwidth connections (lightweight question pages).

---

## 7. 商业模式 / Business Model

### 7.1 收入结构 / Revenue Structure

| 层级 / Tier | 客户 / Customer | 服务 / Service | 价格范围 / Price Range |
|---|---|---|---|
| 高端咨询 / Premium Consulting | 联邦/州级候选人 / Federal/State candidates | 真人咨询 + LLM 深度分析报告 / Human consulting + LLM deep analysis reports | $30,000 - $100,000+ /选举周期 per cycle |
| 中端自助 / Mid-Tier Self-Service | 城市级候选人 / City-level candidates | LLM 自动生成选民洞察报告 / LLM auto-generated voter insight reports | $1,000 - $10,000 /选举周期 per cycle |
| 低端基础 / Basic | 小型竞选 / Small campaigns | 基础数据 Dashboard / Basic data dashboard | $100 - $500 或免费 or free |
| B2B 嵌入 / B2B Embed | 媒体/公民组织 / Media/Civic orgs | 白标工具嵌入 / White-label tool embed | 按合作协议 / Per agreement |

### 7.2 核心逻辑 / Core Logic

```
免费选民工具做大用户量 → 用户数据成为核心资产 → 包装成咨询服务高价卖给候选人
Free voter tool drives user volume → User data becomes core asset → Packaged as consulting services sold to candidates at premium
```

### 7.3 咨询服务模式 / Consulting Service Model
- 咨询师拿到选区聚合数据 → 丢给 LLM 生成深度分析报告 → 咨询师加上经验判断 → 交付给候选人。
- Consultant receives aggregated district data → feeds to LLM for deep analysis report → consultant adds professional judgment → delivered to candidate.
- 交付内容包括：选民关注议题排名、候选人当前匹配度分析、与竞争对手的差距、竞选策略调整建议。
- Deliverables include: voter issue priority ranking, candidate match analysis, competitive gap analysis, campaign strategy recommendations.
- 单个咨询师借助 LLM 可同时服务多个客户，人力成本可控。
- A single consultant leveraging LLM can serve multiple clients simultaneously, keeping labor costs manageable.

---

## 8. MVP 范围 / MVP Scope

- 选择一个即将到来的竞争激烈的选举（单个城市或州）。
- Choose one upcoming competitive election (single city or state).
- 手动 + AI 整理该选区候选人数据。
- Manually + AI compile candidate data for that district.
- 前端：简单的单页 Web 应用（选区 → 问题 → 结果）。
- Frontend: Simple single-page web app (district → questions → results).
- 不含候选人后台（MVP 阶段手动处理）。
- No candidate portal (handled manually in MVP).
- 不含咨询服务（先验证用户端产品）。
- No consulting services (validate voter-side product first).
- 冷启动渠道：本地 Reddit、Facebook 社区群组、本地新闻媒体。
- Cold start channels: Local Reddit, Facebook community groups, local news media.

---

## 9. 成功指标 / Success Metrics

| 指标 / Metric | MVP 目标 / MVP Target |
|---|---|
| 问卷完成率 / Quiz completion rate | > 70% |
| 用户满意度 / User satisfaction | > 4/5 |
| 该选区选民覆盖率 / District voter coverage | > 1% |
| 候选人数据覆盖率 / Candidate data coverage | 100% (该选区) |
| 首个付费客户 / First paying customer | 选举结束前获得 / Acquired before election ends |
