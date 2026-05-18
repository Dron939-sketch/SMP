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

export interface DashboardPayload {
  viewer: { id: string; role: UserRole; full_name: string | null };
  company: string;
  cycle_tag: string;
  respondents: number;
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
