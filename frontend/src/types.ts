export type UserRole =
  | "admin"
  | "executive"
  | "political_officer"
  | "manager"
  | "employee";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  department: string | null;
  site: string | null;
  position: string | null;
  consent_given: boolean;
}

export type QuestionType =
  | "likert_5"
  | "multiple_choice"
  | "single_choice"
  | "open_text"
  | "ranking"
  | "scenario";

export interface Question {
  id: string;
  code: string;
  display_text: string;
  question_type: QuestionType;
  options: { choices?: string[] } | null;
  order_index: number;
  is_required: boolean;
}

export interface Test {
  id: string;
  title: string;
  description: string | null;
  real_focus: string | null;
  cycle: string;
  is_active: boolean;
  time_limit_seconds: number | null;
  created_at: string;
  questions: Question[];
}

export interface ShareLink {
  id: string;
  token: string;
  cycle_tag: string;
  expires_at: string | null;
  uses: number;
  note: string | null;
  share_url: string;
}

export interface CompanyMetrics {
  stress_index: number;
  burnout_risk: number;
  work_life_balance: number;
  employer_brand: number;
  leadership_trust: number;
  safety_culture: number;
  career_clarity: number;
  team_cohesion: number;
  loyalty_intent: number;
  psychological_safety: number;
  conscientiousness?: number;
  openness?: number;
  learning_agility?: number;
}

export interface AnchorPretender {
  user_id: string;
  department: string | null;
  site: string | null;
  position: string | null;
  confidence: number | null;
  reasoning: string | null;
  cycle_tag: string;
}

export interface EmployerImage {
  top_keywords: { keyword: string; weight: number }[];
  sample_sentences: string[];
}

export interface AdvisorItem {
  title: string;
  detail: string;
  severity: "info" | "warn" | "critical";
}

export interface AdvisorOutput {
  content: AdvisorItem[];
  promotion: AdvisorItem[];
  internal_policy: AdvisorItem[];
  summary: string;
}

export interface VKPost {
  id: number;
  date: number;
  text: string;
  likes: number;
  reposts: number;
  comments: number;
  views: number;
  has_image: boolean;
}

export interface VKSnapshot {
  enabled: boolean;
  reason?: string;
  domain: string;
  group: {
    name?: string;
    members_count?: number;
    description?: string;
    activity?: string;
  } | null;
  posts: VKPost[];
  aggregate?: {
    posts: number;
    avg_likes?: number;
    max_likes?: number;
    avg_views?: number | null;
    image_share?: number;
  };
}

export interface TestStats {
  test_id: string;
  title: string;
  submissions: number;
  unique_respondents: number;
}

export type CompanyPhaseKind = "разбитие" | "среднее" | "стагнация";

export interface CompanyPhase {
  phase: CompanyPhaseKind;
  reason: string;
  engines_share: number;
  anchors_share: number;
  composite_positive: number;
}

export interface ResponseListItem {
  response_id: string;
  test_id: string;
  test_title: string;
  respondent_name: string | null;
  cycle_tag: string;
  submitted_at: string;
  total_time_ms: number | null;
  validity_flag: string | null;
  anchor_engine: string | null;
  anchor_confidence: number | null;
  summary_text: string | null;
  risk_flags: string[];
  score_metrics: Record<string, number>;
}

export interface ResponseDetail {
  response_id: string;
  test: {
    id: string;
    title: string;
    description: string | null;
    real_focus: string | null;
    cycle: string;
  };
  respondent_name: string | null;
  cycle_tag: string;
  submitted_at: string;
  total_time_ms: number | null;
  median_time_per_question_ms: number | null;
  rushed_share: number | null;
  validity_flag: string | null;
  answers: {
    code: string;
    display_text: string | null;
    value: unknown;
    text: string | null;
    time_spent_ms: number | null;
    revisions: number | null;
  }[];
  analysis: {
    score_metrics: Record<string, number>;
    risk_flags: string[];
    recommendations: string[];
    summary_text: string;
    employer_image: { keywords: string[]; one_sentence: string; sentiment: string } | null;
    anchor_engine: string | null;
    anchor_engine_confidence: number | null;
    anchor_engine_reasoning: string | null;
    prompt_version: string;
    ai_model: string;
  } | null;
}

export interface DashboardPayload {
  viewer: { id: string; role: UserRole; full_name: string | null };
  company: string;
  cycle_tag: string;
  respondents: number;
  company_phase: CompanyPhase;
  company_metrics: CompanyMetrics;
  by_department: Record<string, CompanyMetrics>;
  by_site: Record<string, CompanyMetrics>;
  anchor_engine_distribution: Record<string, number>;
  anchor_pretenders: AnchorPretender[];
  employer_image: EmployerImage;
  alerts_summary: [string, number][];
  vk: VKSnapshot;
  advisor: AdvisorOutput | null;
  test_stats: TestStats[];
  total_submissions: number;
  total_unique_respondents: number;
}

export interface AppSettings {
  consent_collection_enabled: boolean;
}

export interface AssistantGreeting {
  name: string;
  text: string;
  voice_lang: string;
  voice_id: string | null;
  tts_provider: "fish_audio" | "browser";
  stt_provider: "deepgram" | "browser";
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantAskResponse {
  answer: string;
  voice_lang: string;
  used_context: boolean;
  sources: { title: string; url: string; snippet: string }[];
}
// === Портреты ===

export interface PortraitEmployeeSummary {
  user_id: string;
  full_name: string;
  department: string | null;
  site: string | null;
  position: string | null;
  tests_passed: number;
  last_cycle_tag: string;
  last_submitted_at: string | null;
  avg_metrics: Record<string, number>;
  anchor_engine: string | null;
  anchor_engine_confidence: number | null;
  risk_flags: string[];
  latest_summary: string | null;
}

export interface PortraitEmployeesResponse {
  count: number;
  items: PortraitEmployeeSummary[];
}

export interface PortraitTimelinePoint {
  cycle_tag: string;
  value: number;
  submitted_at: string | null;
}

export interface PortraitHistoryItem {
  cycle_tag: string;
  submitted_at: string | null;
  validity_flag: string | null;
  summary: string;
  score_metrics: Record<string, number>;
  risk_flags: string[];
  recommendations: string[];
  anchor_engine: string | null;
  anchor_engine_confidence: number | null;
  anchor_engine_reasoning: string | null;
}

export interface PortraitEmployeeDetail {
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    department: string | null;
    site: string | null;
    position: string | null;
  };
  tests_passed: number;
  avg_metrics: Record<string, number>;
  metric_timeline: Record<string, PortraitTimelinePoint[]>;
  risk_freq: Record<string, number>;
  top_recommendations: { text: string; count: number }[];
  history: PortraitHistoryItem[];
}

export interface PortraitCompany {
  respondents: number;
  cycle_tag: string | null;

  // 9 секций
  diagnosis: {
    phase: string;
    phase_label: string;
    phase_color: string;
    enps_proxy: number;
    engines_share: number;
    anchors_share: number;
    pretenders_count: number;
    verdict: string;
  };
  company_metrics_avg: Record<string, number>;
  evp_attractive: {
    top_strengths: { metric: string; value: number }[];
    light_signals: string[];
  };
  evp_repelling: {
    top_weaknesses: { metric: string; value: number }[];
    dark_signals: string[];
  };
  schein: {
    espoused: string[];
    underlying: string[];
    gap_detected: boolean;
    note: string;
  };
  risk_map: {
    by_department: Record<
      string,
      {
        respondents: number;
        risk_score: number;
        top_risks: { flag: string; count: number }[];
      }
    >;
    by_site: Record<
      string,
      {
        respondents: number;
        risk_score: number;
        top_risks: { flag: string; count: number }[];
      }
    >;
  };
  trends: {
    cycle_timeline: {
      cycle_tag: string;
      metrics: Record<string, number>;
      engines_pct: number;
      anchors_pct: number;
    }[];
    improving: { metric: string; delta: number }[];
    deteriorating: { metric: string; delta: number }[];
  };
  top_actions: { text: string; count: number }[];

  // Старые поля (обратная совместимость)
  top_keywords: { keyword: string; weight: number; mentions: number }[];
  sample_sentences: { text: string; cycle_tag: string }[];
  flag_freq: Record<string, number>;
  dark_signals: string[];
  light_signals: string[];
  by_department_top_keywords: Record<string, string[]>;
}
