export interface Tenant {
  id: string;
  name: string;
  slug: string;
  allowed_domains: string[];
  default_role: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  form_names: string[];
  is_archived: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: "owner" | "admin" | "viewer";
  created_at: string;
  tenant?: Tenant;
}

export interface Person {
  id: string;
  tenant_id: string;
  email: string;
  name: string | null;
  persona: string | null;
  latest_mood: string | null;
  latest_sentiment: string | null;
  response_count: number;
  created_at: string;
  updated_at: string;
}

export interface Response {
  id: string;
  tenant_id: string;
  campaign_id: string;
  person_id: string;
  transcription: string;
  themes: string[];
  mood: string | null;
  sentiment: string | null;
  video_url: string | null;
  source_type: string | null;
  source_form_name: string | null;
  share_url: string | null;
  raw_analysis: Record<string, unknown> | null;
  created_at: string;
  person?: Person;
}

export interface AnalysisConfig {
  id: string;
  tenant_id: string;
  campaign_id: string;
  name: string;
  system_prompt: string;
  output_schema: OutputSchema;
  model: string;
  is_active: boolean;
  created_at: string;
}

export interface OutputSchema {
  type: "object";
  properties: Record<string, SchemaProperty>;
  required: string[];
}

export interface SchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: { type: string };
  dashboard_display?: "bar" | "pie" | "list" | "top" | "hidden" | "none";
  dashboard_show_top?: boolean;
  dashboard_show_average?: boolean;
  [key: string]: unknown;
}

export interface FieldStat {
  type: "enum" | "array" | "scalar";
  counts?: Record<string, number>;
  items?: { value: string; count: number }[];
  top?: string | number;
}

export interface Taxonomy {
  id: string;
  tenant_id: string;
  campaign_id: string;
  name: string;
  buckets: PersonaBucket[];
  created_at: string;
}

export interface PersonaBucket {
  name: string;
  description: string;
  criteria: string;
}

export interface ApiKey {
  id: string;
  tenant_id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface Source {
  id: string;
  tenant_id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface Flow {
  id: string;
  tenant_id: string;
  campaign_id: string | null;
  name: string;
  description: string | null;
  trigger_on: "response_created" | "person_updated" | "both";
  conditions: FlowCondition[];
  condition_logic: "all" | "any";
  action_type: "webhook" | "slack" | "in_app" | "email_digest" | "webflow";
  action_config: WebhookActionConfig | SlackActionConfig | InAppActionConfig | EmailDigestActionConfig | WebflowActionConfig;
  category: "flow" | "notification" | "webflow";
  is_active: boolean;
  last_triggered_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlackActionConfig {
  webhook_url: string;
  channel?: string;
  message_template?: string;
}

export interface InAppActionConfig {
  title_template?: string;
}

export interface EmailDigestActionConfig {
  recipients: string[];
}

export interface WebflowActionConfig {
  site_id: string;
  site_name?: string;
  collection_id: string;
  collection_name?: string;
  field_mapping: Record<string, string>;
  auto_publish?: boolean;
  safety_required?: { no_pii: boolean; no_profanity: boolean; no_hate_speech: boolean };
}

export interface VideoFeed {
  id: string;
  tenant_id: string;
  campaign_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  topic: string | null;
  conditions: FlowCondition[];
  condition_logic: "all" | "any";
  safety_required: {
    no_pii: boolean;
    no_profanity: boolean;
    no_hate_speech: boolean;
    on_topic: boolean;
  };
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InAppNotification {
  id: string;
  tenant_id: string;
  campaign_id: string | null;
  flow_id: string | null;
  trigger_record_id: string | null;
  title: string;
  body: string | null;
  link: string | null;
  read_by: string[];
  created_at: string;
}

export interface FlowCondition {
  field: string; // built-ins (campaign, sentiment, mood, persona, themes, source_type, source_form_name, transcription) or any custom analysis field name
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "in" | "not_in";
  value: string | string[];
}

export interface WebhookActionConfig {
  url: string;
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
  include_fields?: string[];
  secret?: string;
}

export interface FlowExecution {
  id: string;
  flow_id: string;
  tenant_id: string;
  trigger_event: string;
  trigger_record_id: string;
  status: "success" | "failed" | "permanently_failed";
  response_status_code: number | null;
  response_body: string | null;
  error: string | null;
  payload_sent: Record<string, unknown> | null;
  retry_count: number;
  created_at: string;
}

export interface DashboardStats {
  totalPeople: number;
  totalResponses: number;
  sentimentBreakdown: Record<string, number>;
  topThemes: { theme: string; count: number }[];
  recentResponses: Response[];
  fieldStats?: Record<string, FieldStat>;
  fieldDisplays?: Record<string, string>;
}
