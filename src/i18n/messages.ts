export type Locale = "en" | "zh";

export const LOCALES: Locale[] = ["en", "zh"];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

export const messages: Record<Locale, Record<string, string>> = {
  en: {
    // Landing
    "landing.title": "VoteMatch",
    "landing.tagline":
      "Answer a few simple questions about issues that matter to you. We'll show you which candidates are closest to your views.",
    "landing.getStarted": "Get Started",

    // District selection
    "district.title": "Find Your Election",
    "district.subtitle": "Enter your zip code to see elections in your area.",
    "district.zipTab": "Zip Code",
    "district.addressTab": "Address",
    "district.zipPlaceholder": "e.g. 53703",
    "district.addressPlaceholder": "e.g. 123 Main St, Madison, WI 53703",
    "district.zipError": "Please enter a valid 5-digit zip code.",
    "district.addressError": "Please enter a street address.",
    "district.searching": "Searching...",
    "district.search": "Search",
    "district.noElections":
      "No upcoming elections found for this area. Check back closer to election season.",
    "district.unrecognizedZip":
      "Could not recognize zip code {zip}. Please check and try again.",
    "district.electionsTitle": "Elections in your area",
    "district.candidatesTitle": "Candidates",
    "district.loadingCandidates": "Loading candidates...",
    "district.startQuiz": "Start Quiz",
    "district.independent": "Independent",
    "district.incumbent": "Incumbent",

    // Quiz
    "quiz.loading": "Loading questions...",
    "quiz.electionNotFound": "Election not found.",
    "quiz.noQuestions": "No questions available for this election.",
    "quiz.backToElections": "Back to Elections",
    "quiz.questionProgress": "Question {current} of {total}",
    "quiz.answered": "{count} answered",
    "quiz.background": "Background",
    "quiz.previous": "Previous",
    "quiz.next": "Next",
    "quiz.seeResults": "See Results",
    "quiz.calculating": "Calculating...",
    "quiz.timeout":
      "Request timed out. Please check your connection and try again.",
    "quiz.networkError":
      "Network error. Please check your connection and try again.",
    "quiz.submitError": "Failed to calculate results. Please try again.",

    // Answer options
    "answer.strongly_agree": "Strongly Agree",
    "answer.agree": "Agree",
    "answer.neutral": "Neutral",
    "answer.disagree": "Disagree",
    "answer.strongly_disagree": "Strongly Disagree",
    "answer.not_interested": "Not Interested",

    // Results
    "results.title": "Your Results",
    "results.subtitle":
      "Candidates whose policy positions are closest to yours.",
    "results.issueComparison": "Issue-by-Issue Comparison",
    "results.yourPosition": "Your Position",
    "results.candidatePosition": "{name}'s Position",
    "results.source": "Source: {source}",
    "results.confidence": "Confidence: {level}",
    "results.noPosition": "No public position found",
    "results.retakeQuiz": "Retake Quiz",
    "results.tryDifferent": "Try Different Election",
    "results.matchPercent": "{percent}% match",
    "results.independent": "Independent",

    // Score labels
    "score.stronglySupport": "Strongly Support",
    "score.support": "Support",
    "score.neutral": "Neutral",
    "score.oppose": "Oppose",
    "score.stronglyOppose": "Strongly Oppose",
    "score.noPosition": "No position",

    // Source labels
    "source.ai_extracted": "Public Record",
    "source.candidate_self_report": "Candidate Statement",
    "source.official_website": "Official Website",
    "source.voting_record": "Voting Record",

    // Feedback
    "feedback.prompt": "How helpful were these results?",
    "feedback.thankYou": "Thanks for your feedback!",
    "feedback.rate": "Rate",

    // Candidate Portal
    "candidate.claimProfile": "Claim Your Profile",
    "candidate.claimTitle": "Claim Your Candidate Profile",
    "candidate.claimSubtitle": "Are you a candidate in this election? Claim your profile to manage your positions and see voter insights.",
    "candidate.registerTitle": "Create Account",
    "candidate.loginTitle": "Sign In",
    "candidate.email": "Email",
    "candidate.password": "Password",
    "candidate.register": "Create Account",
    "candidate.login": "Sign In",
    "candidate.switchToLogin": "Already have an account? Sign in",
    "candidate.switchToRegister": "Need an account? Register",
    "candidate.verifyEmail": "Verify Email",
    "candidate.verificationSent": "A verification token has been generated. Use it to verify your email.",
    "candidate.verificationSuccess": "Email verified! You can now claim your profile.",
    "candidate.claimButton": "Claim This Profile",
    "candidate.claimPending": "Claim submitted! An admin will review your request.",
    "candidate.selectCandidate": "Select the candidate profile you want to claim:",
    "candidate.dashboardTitle": "Candidate Dashboard",
    "candidate.positionsTitle": "Your Positions",
    "candidate.sourceAI": "AI Extracted",
    "candidate.sourceSelf": "Self-Reported",
    "candidate.editPosition": "Edit",
    "candidate.savePosition": "Save",
    "candidate.cancel": "Cancel",
    "candidate.noPositions": "No positions found yet.",
    "candidate.addPosition": "Add Position",
    "candidate.contradictionNote": "Both AI-extracted and your self-reported positions will be shown to voters.",

    // B2B Embed
    "embed.poweredBy": "Powered by VoteMatch",
  },
  zh: {
    // Landing
    "landing.title": "VoteMatch",
    "landing.tagline":
      "回答几个关于你关心的议题的简单问题，我们会告诉你哪些候选人与你的观点最接近。",
    "landing.getStarted": "开始",

    // District selection
    "district.title": "查找你的选举",
    "district.subtitle": "输入邮编查看你所在地区的选举。",
    "district.zipTab": "邮编",
    "district.addressTab": "地址",
    "district.zipPlaceholder": "例如 53703",
    "district.addressPlaceholder": "例如 123 Main St, Madison, WI 53703",
    "district.zipError": "请输入有效的5位邮编。",
    "district.addressError": "请输入街道地址。",
    "district.searching": "搜索中...",
    "district.search": "搜索",
    "district.noElections":
      "该地区当前无即将到来的选举，请在选举季前再来查看。",
    "district.unrecognizedZip":
      "无法识别邮编 {zip}，请检查后重试。",
    "district.electionsTitle": "你所在地区的选举",
    "district.candidatesTitle": "候选人",
    "district.loadingCandidates": "加载候选人...",
    "district.startQuiz": "开始答题",
    "district.independent": "无党派",
    "district.incumbent": "现任",

    // Quiz
    "quiz.loading": "加载问题中...",
    "quiz.electionNotFound": "未找到该选举。",
    "quiz.noQuestions": "该选举暂无可用问题。",
    "quiz.backToElections": "返回选举列表",
    "quiz.questionProgress": "第 {current} 题，共 {total} 题",
    "quiz.answered": "已回答 {count} 题",
    "quiz.background": "背景说明",
    "quiz.previous": "上一题",
    "quiz.next": "下一题",
    "quiz.seeResults": "查看结果",
    "quiz.calculating": "计算中...",
    "quiz.timeout": "请求超时。请检查网络连接后重试。",
    "quiz.networkError": "网络错误。请检查网络连接后重试。",
    "quiz.submitError": "计算结果失败。请重试。",

    // Answer options
    "answer.strongly_agree": "非常同意",
    "answer.agree": "同意",
    "answer.neutral": "中立",
    "answer.disagree": "不同意",
    "answer.strongly_disagree": "非常不同意",
    "answer.not_interested": "不感兴趣",

    // Results
    "results.title": "你的结果",
    "results.subtitle": "政策立场与你最接近的候选人。",
    "results.issueComparison": "逐项对比",
    "results.yourPosition": "你的立场",
    "results.candidatePosition": "{name}的立场",
    "results.source": "来源：{source}",
    "results.confidence": "可信度：{level}",
    "results.noPosition": "未找到公开立场",
    "results.retakeQuiz": "重新答题",
    "results.tryDifferent": "换一个选举",
    "results.matchPercent": "{percent}% 匹配",
    "results.independent": "无党派",

    // Score labels
    "score.stronglySupport": "强烈支持",
    "score.support": "支持",
    "score.neutral": "中立",
    "score.oppose": "反对",
    "score.stronglyOppose": "强烈反对",
    "score.noPosition": "无立场",

    // Source labels
    "source.ai_extracted": "公开记录",
    "source.candidate_self_report": "候选人声明",
    "source.official_website": "官方网站",
    "source.voting_record": "投票记录",

    // Feedback
    "feedback.prompt": "这些结果对您有帮助吗？",
    "feedback.thankYou": "感谢您的反馈！",
    "feedback.rate": "评分",

    // Candidate Portal
    "candidate.claimProfile": "认领你的档案",
    "candidate.claimTitle": "认领候选人档案",
    "candidate.claimSubtitle": "你是这次选举的候选人吗？认领你的档案来管理你的立场并查看选民洞察。",
    "candidate.registerTitle": "创建账号",
    "candidate.loginTitle": "登录",
    "candidate.email": "邮箱",
    "candidate.password": "密码",
    "candidate.register": "创建账号",
    "candidate.login": "登录",
    "candidate.switchToLogin": "已有账号？登录",
    "candidate.switchToRegister": "需要账号？注册",
    "candidate.verifyEmail": "验证邮箱",
    "candidate.verificationSent": "验证令牌已生成。请使用它来验证你的邮箱。",
    "candidate.verificationSuccess": "邮箱已验证！你现在可以认领档案了。",
    "candidate.claimButton": "认领此档案",
    "candidate.claimPending": "认领已提交！管理员将审核你的请求。",
    "candidate.selectCandidate": "选择你要认领的候选人档案：",
    "candidate.dashboardTitle": "候选人仪表盘",
    "candidate.positionsTitle": "你的立场",
    "candidate.sourceAI": "AI 提取",
    "candidate.sourceSelf": "自行报告",
    "candidate.editPosition": "编辑",
    "candidate.savePosition": "保存",
    "candidate.cancel": "取消",
    "candidate.noPositions": "暂无立场数据。",
    "candidate.addPosition": "添加立场",
    "candidate.contradictionNote": "AI 提取和你的自行报告立场都会向选民展示。",

    // B2B Embed
    "embed.poweredBy": "由 VoteMatch 提供",
  },
};
