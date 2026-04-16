<template>
  <q-layout view="lHh Lpr lFf" class="app-layout">
    <q-header v-if="isAuthenticated" bordered class="header-shell">
      <q-toolbar class="toolbar-shell">
        <div class="toolbar-brand">
          <div class="brand-eyebrow">ELT Framework</div>
          <div class="brand-title">dataxflow 업무 포털</div>
        </div>
        <q-space />
        <div class="toolbar-user">
          <q-chip square color="white" text-color="dark" icon="person">
            {{ session?.user?.display_name }} ({{ session?.user?.role }})
          </q-chip>
          <q-btn
            dense
            flat
            color="negative"
            no-caps
            icon="logout"
            label="로그아웃"
            :loading="authLoading"
            @click="logout"
          />
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page :class="['page-shell', { 'page-shell-with-offcanvas': isAuthenticated && leftDrawerOpen }]">
        <aside v-if="isAuthenticated" class="offcanvas-panel" :class="{ 'is-open': leftDrawerOpen }">
          <div class="offcanvas-head">
            <div class="section-eyebrow">ELT Navigation</div>
            <div class="section-title">업무 메뉴</div>
          </div>
          <div class="offcanvas-section">
            <div class="offcanvas-group-title">Workflow</div>
            <q-list class="offcanvas-list" separator>
              <q-item
                v-for="item in workflowMenu"
                :key="item.id"
                clickable
                v-ripple
                class="offcanvas-link-item"
                @click="moveToPanel(item.id)"
              >
                <q-item-section avatar>
                  <q-icon :name="item.icon" color="dark" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ item.label }}</q-item-label>
                  <q-item-label caption>{{ item.caption }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
          <div class="offcanvas-section">
            <div class="offcanvas-group-title">Quick Action</div>
            <div class="hero-actions">
              <q-btn
                outline
                color="dark"
                no-caps
                icon="refresh"
                label="업무 현황"
                :loading="overviewLoading"
                @click="loadOverview"
              />
              <q-btn
                outline
                color="dark"
                no-caps
                icon="table_view"
                label="카탈로그"
                :loading="catalogLoading"
                @click="loadCatalog"
              />
            </div>
          </div>
        </aside>
        <div
          v-if="isAuthenticated && leftDrawerOpen"
          class="offcanvas-backdrop"
          @click="leftDrawerOpen = false"
        />
        <q-btn
          v-if="isAuthenticated"
          class="offcanvas-toggle"
          :class="{ 'offcanvas-toggle-shifted': leftDrawerOpen }"
          round
          dense
          unelevated
          color="dark"
          icon="menu"
          aria-label="ELT 메뉴 열기"
          @click="leftDrawerOpen = !leftDrawerOpen"
        />
        <section v-if="!isAuthenticated" class="login-shell">
          <q-card flat class="surface-card login-card">
            <q-card-section>
              <div class="section-eyebrow">금감원 DX 중장기 사업</div>
              <h1 class="hero-title">dataxflow ELT Framework 로그인</h1>
              <p class="hero-description">
                문서 기준 업무 흐름에 맞춰 <strong>배치잡 등록</strong>, <strong>테스트 실행</strong>,
                <strong>Stored Procedure 컴파일</strong>, <strong>Airflow 등록</strong>을 한 화면에서 수행합니다.
              </p>

              <div class="login-grid">
                <q-input
                  v-model="loginForm.username"
                  outlined
                  dense
                  label="Username"
                  color="dark"
                  @keyup.enter="login"
                />
                <q-input
                  v-model="loginForm.password"
                  outlined
                  dense
                  label="Password"
                  color="dark"
                  type="password"
                  @keyup.enter="login"
                />
                <q-btn
                  color="dark"
                  unelevated
                  no-caps
                  icon="login"
                  label="로그인"
                  :loading="authLoading"
                  :disable="!canLogin"
                  @click="login"
                />
              </div>

              <q-separator class="q-my-md" />
              <div class="section-eyebrow">빠른 계정 선택</div>
              <div class="account-grid">
                <q-btn
                  v-for="account in demoAccounts"
                  :key="account.username"
                  outline
                  color="dark"
                  no-caps
                  :label="`${account.display_name} (${account.username})`"
                  @click="useDemoAccount(account.username, account.password)"
                />
              </div>
            </q-card-section>
          </q-card>
        </section>

        <template v-else>
          <section id="overview-panel" class="hero-panel surface-card panel-anchor">
            <div class="hero-header">
              <div>
                <div class="section-eyebrow">RFP Workflow</div>
                <h2>로그인 후 업무 실행 흐름</h2>
                <p>
                  소스/타겟/배치주기를 지정해 배치잡을 만들고 테스트 실행 후 프로시저를 컴파일합니다.
                  검증 완료된 잡은 Airflow DAG로 등록되어 반복 적재를 수행합니다.
                </p>
              </div>
              <div class="hero-actions">
                <q-btn
                  outline
                  color="dark"
                  no-caps
                  icon="refresh"
                  label="업무 현황 새로고침"
                  :loading="overviewLoading"
                  @click="loadOverview"
                />
                <q-btn
                  outline
                  color="dark"
                  no-caps
                  icon="table_view"
                  label="카탈로그 새로고침"
                  :loading="catalogLoading"
                  @click="loadCatalog"
                />
              </div>
            </div>

            <div class="workflow-steps">
              <div class="step-chip">1. 배치잡 등록</div>
              <div class="step-chip">2. 테스트 실행</div>
              <div class="step-chip">3. Stored Procedure 컴파일</div>
              <div class="step-chip">4. Airflow 스케줄 등록</div>
            </div>
          </section>

          <section id="kpi-panel" class="kpi-grid panel-anchor">
            <q-card v-for="card in kpiCards" :key="card.key" flat class="surface-card kpi-card">
              <q-card-section>
                <div class="kpi-label">{{ card.label }}</div>
                <div class="kpi-value">{{ card.value }}</div>
                <div class="kpi-note">{{ card.note }}</div>
              </q-card-section>
            </q-card>
          </section>

          <section id="batch-job-panel" class="main-grid panel-anchor">
            <q-card flat class="surface-card">
              <q-card-section>
                <div class="row items-center justify-between">
                  <div>
                    <div class="section-eyebrow">Batch Job</div>
                    <div class="section-title">{{ editingJobId ? "배치잡 수정" : "배치잡 등록" }}</div>
                  </div>
                  <q-badge :color="editingJobId ? 'warning' : 'primary'" rounded>
                    {{ editingJobId ? "edit mode" : "create mode" }}
                  </q-badge>
                </div>

                <div class="form-grid q-mt-md">
                  <q-input v-model="jobForm.name" outlined dense color="dark" label="배치잡 이름" />
                  <q-select
                    v-model="jobForm.batch_frequency"
                    outlined
                    dense
                    emit-value
                    map-options
                    option-label="label"
                    option-value="code"
                    :options="batchFrequencyOptions"
                    color="dark"
                    label="배치 주기"
                  />
                </div>

                <div class="form-grid q-mt-sm">
                  <q-select
                    v-model="jobForm.source_system_id"
                    outlined
                    dense
                    emit-value
                    map-options
                    option-label="name"
                    option-value="system_id"
                    :options="catalog.source_systems"
                    color="dark"
                    label="소스 시스템"
                    @update:model-value="handleSourceSystemChange"
                  />
                  <q-select
                    v-model="jobForm.source_table"
                    outlined
                    dense
                    emit-value
                    map-options
                    option-label="table_name"
                    option-value="table_name"
                    :options="sourceTableOptions"
                    color="dark"
                    label="소스 테이블"
                  />
                </div>

                <div class="form-grid q-mt-sm">
                  <q-select
                    v-model="jobForm.target_system_id"
                    outlined
                    dense
                    emit-value
                    map-options
                    option-label="name"
                    option-value="system_id"
                    :options="catalog.target_systems"
                    color="dark"
                    label="타겟 시스템"
                    @update:model-value="handleTargetSystemChange"
                  />
                  <q-select
                    v-model="jobForm.target_table"
                    outlined
                    dense
                    emit-value
                    map-options
                    option-label="table_name"
                    option-value="table_name"
                    :options="targetTableOptions"
                    color="dark"
                    label="타겟 테이블"
                  />
                </div>

                <q-input
                  v-model="jobForm.load_condition"
                  outlined
                  dense
                  color="dark"
                  label="적재 조건 (예: txn_date >= :last_success_dt)"
                  class="q-mt-sm"
                />

                <q-input
                  v-model="jobForm.description"
                  outlined
                  dense
                  autogrow
                  type="textarea"
                  color="dark"
                  label="설명"
                  class="q-mt-sm"
                />

                <div class="row q-gutter-sm q-mt-md">
                  <q-btn
                    color="dark"
                    unelevated
                    no-caps
                    icon="save"
                    :label="editingJobId ? '수정 저장' : '배치잡 생성'"
                    :loading="jobSaving"
                    :disable="!canSubmitJob"
                    @click="saveJob"
                  />
                  <q-btn
                    v-if="editingJobId"
                    outline
                    color="dark"
                    no-caps
                    icon="close"
                    label="수정 취소"
                    @click="cancelEdit"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-card flat class="surface-card">
              <q-card-section>
                <div class="section-eyebrow">Schedule Mix (Chart.js)</div>
                <div class="section-title">배치 주기 분포</div>
                <div class="chart-shell small"><canvas ref="scheduleChartCanvas" /></div>

                <q-separator class="q-my-md" />

                <div class="section-eyebrow">Recent Runtime (Chart.js)</div>
                <div class="section-title">최근 실행 소요시간</div>
                <div class="chart-shell"><canvas ref="runChartCanvas" /></div>
              </q-card-section>
            </q-card>
          </section>

          <section id="jobs-panel" class="table-grid panel-anchor">
            <q-card id="job-inventory-panel" flat class="surface-card panel-anchor">
              <q-card-section>
                <div class="row items-center justify-between q-mb-sm">
                  <div>
                    <div class="section-eyebrow">Batch Inventory</div>
                    <div class="section-title">등록된 배치잡</div>
                  </div>
                </div>

                <q-table
                  flat
                  :rows="jobs"
                  :columns="jobColumns"
                  row-key="job_id"
                  :loading="overviewLoading"
                  :rows-per-page-options="[10, 20, 50]"
                  :pagination="{ rowsPerPage: 10 }"
                >
                  <template #body-cell-status="props">
                    <q-td :props="props">
                      <q-badge rounded :color="statusColor(props.value)">{{ props.value }}</q-badge>
                    </q-td>
                  </template>
                  <template #body-cell-last_run_status="props">
                    <q-td :props="props">
                      <q-badge rounded :color="runStatusColor(props.value)">{{ props.value }}</q-badge>
                    </q-td>
                  </template>
                  <template #body-cell-last_run_at="props">
                    <q-td :props="props">{{ formatDateTime(props.value) }}</q-td>
                  </template>
                  <template #body-cell-actions="props">
                    <q-td :props="props" class="actions-cell">
                      <q-btn
                        dense
                        flat
                        color="primary"
                        icon="edit"
                        @click="startEdit(props.row)"
                      >
                        <q-tooltip>수정</q-tooltip>
                      </q-btn>
                      <q-btn
                        dense
                        flat
                        color="indigo"
                        icon="play_arrow"
                        :loading="isActionLoading(props.row.job_id, 'run')"
                        @click="runJob(props.row)"
                      >
                        <q-tooltip>테스트 실행</q-tooltip>
                      </q-btn>
                      <q-btn
                        dense
                        flat
                        color="teal"
                        icon="build"
                        :loading="isActionLoading(props.row.job_id, 'compile')"
                        @click="compileJob(props.row)"
                      >
                        <q-tooltip>프로시저 컴파일</q-tooltip>
                      </q-btn>
                      <q-btn
                        dense
                        flat
                        color="deep-orange"
                        icon="schedule"
                        :loading="isActionLoading(props.row.job_id, 'airflow')"
                        @click="openAirflowDialog(props.row)"
                      >
                        <q-tooltip>Airflow 등록</q-tooltip>
                      </q-btn>
                    </q-td>
                  </template>
                </q-table>
              </q-card-section>
            </q-card>

            <q-card id="run-history-panel" flat class="surface-card panel-anchor">
              <q-card-section>
                <div class="section-eyebrow">Run History</div>
                <div class="section-title">최근 실행 이력</div>

                <q-table
                  flat
                  :rows="runs"
                  :columns="runColumns"
                  row-key="run_id"
                  :loading="overviewLoading"
                  :rows-per-page-options="[8, 16, 24]"
                  :pagination="{ rowsPerPage: 8 }"
                >
                  <template #body-cell-status="props">
                    <q-td :props="props">
                      <q-badge rounded :color="runStatusColor(props.value)">{{ props.value }}</q-badge>
                    </q-td>
                  </template>
                  <template #body-cell-executed_at="props">
                    <q-td :props="props">{{ formatDateTime(props.value) }}</q-td>
                  </template>
                </q-table>
              </q-card-section>
            </q-card>
          </section>

          <section v-if="isAdmin" id="bootstrap-panel" class="table-grid panel-anchor">
            <q-card flat class="surface-card">
              <q-card-section>
                <div class="section-eyebrow">Admin Setup</div>
                <div class="section-title">Teradata Stored Procedure 초기 세팅</div>
                <p class="hero-description q-mt-sm">
                  RFP 기준으로 관리자 계정에서 초기 Stored Procedure/메타데이터 구성을 실행합니다.
                  먼저 Dry Run으로 SQL statement를 검증한 뒤 Execute를 진행하세요.
                </p>

                <div class="row q-gutter-sm q-mt-md">
                  <q-btn
                    color="dark"
                    unelevated
                    no-caps
                    icon="fact_check"
                    label="Dry Run"
                    :loading="bootstrapLoading"
                    @click="runTeradataBootstrap(true)"
                  />
                  <q-btn
                    color="deep-orange"
                    unelevated
                    no-caps
                    icon="play_circle"
                    label="Execute"
                    :loading="bootstrapLoading"
                    @click="runTeradataBootstrap(false)"
                  />
                </div>

                <q-banner v-if="bootstrapResult" rounded class="q-mt-md banner-note">
                  <div><strong>Mode:</strong> {{ bootstrapResult.mode }}</div>
                  <div><strong>Source:</strong> {{ bootstrapResult.source_file }}</div>
                  <div>
                    <strong>Statements:</strong> {{ bootstrapResult.statement_count }} (executed:
                    {{ bootstrapResult.executed_count }})
                  </div>
                  <div><strong>Note:</strong> {{ bootstrapResult.note }}</div>
                  <div v-if="bootstrapResult.statement_previews?.length" class="q-mt-sm">
                    <strong>Preview</strong>
                    <ul class="bootstrap-preview-list">
                      <li v-for="(preview, idx) in bootstrapResult.statement_previews" :key="idx">
                        {{ preview }}
                      </li>
                    </ul>
                  </div>
                </q-banner>
              </q-card-section>
            </q-card>
          </section>
        </template>
      </q-page>
    </q-page-container>

    <q-dialog v-model="airflowDialog.open" persistent>
      <q-card class="airflow-dialog">
        <q-card-section>
          <div class="section-eyebrow">Airflow Registration</div>
          <div class="section-title">{{ airflowDialog.jobName }}</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="airflowDialog.dag_id"
            outlined
            dense
            label="DAG ID (선택)"
            color="dark"
          />
          <q-input
            v-model="airflowDialog.cron"
            outlined
            dense
            label="Cron 표현식"
            color="dark"
            class="q-mt-sm"
          />
          <q-banner rounded class="q-mt-md banner-note">
            5개 필드 cron 예시: <strong>0 2 * * *</strong> (매일 02:00)
          </q-banner>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="취소" color="grey-8" @click="airflowDialog.open = false" />
          <q-btn
            color="deep-orange"
            unelevated
            no-caps
            label="등록"
            :loading="airflowDialog.loading"
            :disable="!airflowDialog.jobId || !airflowDialog.cron"
            @click="registerAirflow"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import axios from "axios";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { useQuasar } from "quasar";

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

const AUTH_TOKEN_KEY = "dataxflow.auth.token";
const $q = useQuasar();

function resolveApiBaseUrl() {
  const envValue = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  if (envValue) {
    return envValue.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    if (window.location.hostname.includes("dataxflow.fss.or.kr")) {
      return `${window.location.protocol}//api.dataxflow.fss.or.kr`;
    }
    return window.location.origin;
  }
  return "http://api.dataxflow.fss.or.kr";
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 15000,
});

const authToken = ref(localStorage.getItem(AUTH_TOKEN_KEY) || "");
api.interceptors.request.use((config) => {
  if (authToken.value) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${authToken.value}`,
      "X-Auth-Token": authToken.value,
    };
  }
  return config;
});

const session = ref(null);
const authLoading = ref(false);
const catalogLoading = ref(false);
const overviewLoading = ref(false);
const jobSaving = ref(false);

const actionLoading = reactive({});

const loginForm = reactive({
  username: "",
  password: "",
});

const demoAccounts = [
  {
    username: "admin@test.com",
    password: "123456",
    display_name: "ELT 관리자",
  },
  {
    username: "test1@test.com",
    password: "123456",
    display_name: "적재 개발자 1",
  },
];

function emptyCatalog() {
  return {
    source_systems: [],
    source_tables: [],
    target_systems: [],
    target_tables: [],
    batch_frequencies: [],
  };
}

function emptyOverview() {
  return {
    summary: {
      total_jobs: 0,
      draft_jobs: 0,
      tested_jobs: 0,
      compiled_jobs: 0,
      scheduled_jobs: 0,
      failed_jobs: 0,
      total_runs: 0,
      successful_runs: 0,
      failed_runs: 0,
    },
    schedule_breakdown: [],
    recent_runs: [],
    jobs: [],
  };
}

const catalog = ref(emptyCatalog());
const overview = ref(emptyOverview());

const jobForm = reactive({
  name: "",
  description: "",
  source_system_id: "",
  source_table: "",
  target_system_id: "",
  target_table: "",
  batch_frequency: "DAILY",
  load_condition: "",
});

const editingJobId = ref("");

const airflowDialog = reactive({
  open: false,
  loading: false,
  jobId: "",
  jobName: "",
  dag_id: "",
  cron: "0 2 * * *",
});

const scheduleChartCanvas = ref(null);
const runChartCanvas = ref(null);
let scheduleChart = null;
let runChart = null;
const leftDrawerOpen = ref(typeof window !== "undefined" ? window.innerWidth >= 1180 : true);
const bootstrapLoading = ref(false);
const bootstrapResult = ref(null);

const isAuthenticated = computed(() => Boolean(session.value?.user?.username));
const isAdmin = computed(() => session.value?.user?.role === "admin");
const canLogin = computed(() => Boolean(loginForm.username.trim() && loginForm.password.trim()));

const jobs = computed(() => overview.value.jobs || []);
const runs = computed(() => overview.value.recent_runs || []);
const summary = computed(() => overview.value.summary || emptyOverview().summary);

const sourceTableOptions = computed(() =>
  catalog.value.source_tables.filter((item) => item.system_id === jobForm.source_system_id),
);

const targetTableOptions = computed(() =>
  catalog.value.target_tables.filter((item) => item.system_id === jobForm.target_system_id),
);

const batchFrequencyOptions = computed(() => catalog.value.batch_frequencies || []);

const canSubmitJob = computed(() => {
  return Boolean(
    jobForm.name.trim() &&
      jobForm.source_system_id &&
      jobForm.source_table &&
      jobForm.target_system_id &&
      jobForm.target_table &&
      jobForm.batch_frequency &&
      jobForm.load_condition.trim(),
  );
});

const kpiCards = computed(() => [
  {
    key: "total_jobs",
    label: "전체 배치잡",
    value: summary.value.total_jobs,
    note: `draft ${summary.value.draft_jobs} / tested ${summary.value.tested_jobs}`,
  },
  {
    key: "compiled",
    label: "프로시저 컴파일",
    value: summary.value.compiled_jobs,
    note: `scheduled ${summary.value.scheduled_jobs}`,
  },
  {
    key: "runs",
    label: "총 실행 건수",
    value: summary.value.total_runs,
    note: `success ${summary.value.successful_runs} / failed ${summary.value.failed_runs}`,
  },
  {
    key: "risk",
    label: "실패 배치잡",
    value: summary.value.failed_jobs,
    note: "최근 실행 실패 기준",
  },
]);

const workflowMenu = computed(() => {
  const base = [
    {
      id: "overview-panel",
      label: "업무 개요",
      caption: "ELT 실행 흐름",
      icon: "dashboard",
    },
    {
      id: "kpi-panel",
      label: "KPI",
      caption: "배치 상태 지표",
      icon: "monitoring",
    },
    {
      id: "batch-job-panel",
      label: "배치잡 등록",
      caption: "소스/타겟/주기 설정",
      icon: "post_add",
    },
    {
      id: "job-inventory-panel",
      label: "배치잡 목록",
      caption: "실행/컴파일/Airflow 등록",
      icon: "table_view",
    },
    {
      id: "run-history-panel",
      label: "실행 이력",
      caption: "최근 실행 결과",
      icon: "history",
    },
  ];

  if (isAdmin.value) {
    base.push({
      id: "bootstrap-panel",
      label: "관리자 초기세팅",
      caption: "Stored Procedure bootstrap",
      icon: "admin_panel_settings",
    });
  }
  return base;
});

const jobColumns = [
  {
    name: "name",
    label: "배치잡",
    field: "name",
    align: "left",
    sortable: true,
  },
  {
    name: "mapping",
    label: "소스 -> 타겟",
    field: (row) => `${row.source_table} -> ${row.target_table}`,
    align: "left",
    sortable: false,
  },
  {
    name: "batch_frequency",
    label: "주기",
    field: "batch_frequency",
    align: "left",
    sortable: true,
  },
  {
    name: "status",
    label: "상태",
    field: "status",
    align: "left",
    sortable: true,
  },
  {
    name: "last_run_status",
    label: "최근 실행",
    field: "last_run_status",
    align: "left",
    sortable: true,
  },
  {
    name: "last_run_at",
    label: "최근 실행시각",
    field: "last_run_at",
    align: "left",
    sortable: true,
  },
  {
    name: "run_count",
    label: "실행횟수",
    field: "run_count",
    align: "right",
    sortable: true,
  },
  {
    name: "actions",
    label: "액션",
    field: "actions",
    align: "left",
    sortable: false,
  },
];

const runColumns = [
  {
    name: "job_name",
    label: "배치잡",
    field: "job_name",
    align: "left",
    sortable: true,
  },
  {
    name: "status",
    label: "결과",
    field: "status",
    align: "left",
    sortable: true,
  },
  {
    name: "duration_seconds",
    label: "소요시간(초)",
    field: "duration_seconds",
    align: "right",
    sortable: true,
  },
  {
    name: "executed_by",
    label: "실행자",
    field: "executed_by",
    align: "left",
    sortable: true,
  },
  {
    name: "executed_at",
    label: "실행시각",
    field: "executed_at",
    align: "left",
    sortable: true,
  },
  {
    name: "message",
    label: "메시지",
    field: "message",
    align: "left",
    sortable: false,
  },
];

function notifyPositive(message) {
  $q.notify({
    type: "positive",
    position: "top",
    message,
  });
}

function notifyError(error, fallback = "요청 처리 중 오류가 발생했습니다.") {
  const detail =
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;
  $q.notify({
    type: "negative",
    position: "top",
    timeout: 3500,
    message: detail,
  });
}

function statusColor(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "scheduled") {
    return "positive";
  }
  if (normalized === "compiled") {
    return "teal";
  }
  if (normalized === "tested") {
    return "indigo";
  }
  if (normalized === "failed") {
    return "negative";
  }
  return "grey-7";
}

function runStatusColor(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "success") {
    return "positive";
  }
  if (normalized === "failed") {
    return "negative";
  }
  if (normalized === "never") {
    return "grey-7";
  }
  return "warning";
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function useDemoAccount(username, password) {
  loginForm.username = username;
  loginForm.password = password;
}

function moveToPanel(panelId) {
  if (typeof window === "undefined") {
    return;
  }
  const element = document.getElementById(panelId);
  if (element) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
  if (window.innerWidth < 1024) {
    leftDrawerOpen.value = false;
  }
}

function resetJobForm() {
  jobForm.name = "";
  jobForm.description = "";
  jobForm.source_system_id = catalog.value.source_systems[0]?.system_id || "";
  jobForm.source_table = "";
  jobForm.target_system_id = catalog.value.target_systems[0]?.system_id || "";
  jobForm.target_table = "";
  jobForm.batch_frequency = catalog.value.batch_frequencies.find((item) => item.code === "DAILY")?.code || "MANUAL";
  jobForm.load_condition = "";
  handleSourceSystemChange();
  handleTargetSystemChange();
}

function startEdit(job) {
  editingJobId.value = job.job_id;
  jobForm.name = job.name;
  jobForm.description = job.description || "";
  jobForm.source_system_id = job.source_system_id;
  jobForm.source_table = job.source_table;
  jobForm.target_system_id = job.target_system_id;
  jobForm.target_table = job.target_table;
  jobForm.batch_frequency = job.batch_frequency;
  jobForm.load_condition = job.load_condition;
}

function cancelEdit() {
  editingJobId.value = "";
  resetJobForm();
}

function handleSourceSystemChange() {
  const options = sourceTableOptions.value;
  const currentMatch = options.some((item) => item.table_name === jobForm.source_table);
  if (!currentMatch) {
    jobForm.source_table = options[0]?.table_name || "";
  }
}

function handleTargetSystemChange() {
  const options = targetTableOptions.value;
  const currentMatch = options.some((item) => item.table_name === jobForm.target_table);
  if (!currentMatch) {
    jobForm.target_table = options[0]?.table_name || "";
  }
}

function isActionLoading(jobId, action) {
  return Boolean(actionLoading[`${jobId}:${action}`]);
}

function setActionLoading(jobId, action, value) {
  actionLoading[`${jobId}:${action}`] = value;
}

async function restoreSession() {
  if (!authToken.value) {
    return;
  }
  try {
    const { data } = await api.get("/api/auth/me");
    session.value = data;
  } catch (_error) {
    authToken.value = "";
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

async function login() {
  if (!canLogin.value) {
    return;
  }
  authLoading.value = true;
  try {
    const payload = {
      username: loginForm.username.trim(),
      password: loginForm.password,
    };
    const { data } = await api.post("/api/auth/login", payload);
    const token = data.access_token || data.token;
    authToken.value = token;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    const me = await api.get("/api/auth/me");
    session.value = me.data;
    await loadCatalog();
    await loadOverview();
    resetJobForm();
    notifyPositive("로그인 완료");
  } catch (error) {
    notifyError(error, "로그인에 실패했습니다.");
  } finally {
    authLoading.value = false;
  }
}

async function logout() {
  authLoading.value = true;
  try {
    if (authToken.value) {
      await api.post("/api/auth/logout");
    }
  } catch (_error) {
    // ignore logout API errors
  } finally {
    authToken.value = "";
    localStorage.removeItem(AUTH_TOKEN_KEY);
    session.value = null;
    overview.value = emptyOverview();
    catalog.value = emptyCatalog();
    bootstrapResult.value = null;
    cancelEdit();
    authLoading.value = false;
  }
}

async function loadCatalog() {
  if (!isAuthenticated.value) {
    return;
  }
  catalogLoading.value = true;
  try {
    const { data } = await api.get("/api/dataxflow/catalog");
    catalog.value = data;
    if (!editingJobId.value) {
      resetJobForm();
    }
  } catch (error) {
    notifyError(error, "카탈로그를 불러오지 못했습니다.");
  } finally {
    catalogLoading.value = false;
  }
}

async function loadOverview() {
  if (!isAuthenticated.value) {
    return;
  }
  overviewLoading.value = true;
  try {
    const { data } = await api.get("/api/dataxflow/overview");
    overview.value = data;
    await nextTick();
    renderCharts();
  } catch (error) {
    notifyError(error, "업무 현황을 불러오지 못했습니다.");
  } finally {
    overviewLoading.value = false;
  }
}

async function saveJob() {
  if (!canSubmitJob.value) {
    return;
  }

  const payload = {
    name: jobForm.name.trim(),
    description: jobForm.description.trim() || null,
    source_system_id: jobForm.source_system_id,
    source_table: jobForm.source_table,
    target_system_id: jobForm.target_system_id,
    target_table: jobForm.target_table,
    batch_frequency: jobForm.batch_frequency,
    load_condition: jobForm.load_condition.trim(),
  };

  jobSaving.value = true;
  try {
    if (editingJobId.value) {
      await api.patch(`/api/dataxflow/jobs/${editingJobId.value}`, payload);
      notifyPositive("배치잡 수정 완료");
    } else {
      await api.post("/api/dataxflow/jobs", payload);
      notifyPositive("배치잡 생성 완료");
    }
    cancelEdit();
    await loadOverview();
  } catch (error) {
    notifyError(error, "배치잡 저장에 실패했습니다.");
  } finally {
    jobSaving.value = false;
  }
}

async function runJob(job) {
  const action = "run";
  setActionLoading(job.job_id, action, true);
  try {
    await api.post(`/api/dataxflow/jobs/${job.job_id}/run`);
    notifyPositive(`${job.name} 테스트 실행 완료`);
    await loadOverview();
  } catch (error) {
    notifyError(error, "테스트 실행에 실패했습니다.");
  } finally {
    setActionLoading(job.job_id, action, false);
  }
}

async function compileJob(job) {
  const action = "compile";
  setActionLoading(job.job_id, action, true);
  try {
    await api.post(`/api/dataxflow/jobs/${job.job_id}/compile`);
    notifyPositive(`${job.name} 프로시저 컴파일 완료`);
    await loadOverview();
  } catch (error) {
    notifyError(error, "프로시저 컴파일에 실패했습니다.");
  } finally {
    setActionLoading(job.job_id, action, false);
  }
}

function openAirflowDialog(job) {
  airflowDialog.open = true;
  airflowDialog.loading = false;
  airflowDialog.jobId = job.job_id;
  airflowDialog.jobName = job.name;
  airflowDialog.dag_id = job.airflow_dag_id || `dag_${job.job_id.replace(/-/g, "_")}`;
  airflowDialog.cron = job.airflow_cron || "0 2 * * *";
}

async function registerAirflow() {
  if (!airflowDialog.jobId || !airflowDialog.cron.trim()) {
    return;
  }

  airflowDialog.loading = true;
  setActionLoading(airflowDialog.jobId, "airflow", true);
  try {
    await api.post(`/api/dataxflow/jobs/${airflowDialog.jobId}/airflow`, {
      dag_id: airflowDialog.dag_id.trim() || null,
      cron: airflowDialog.cron.trim(),
    });
    airflowDialog.open = false;
    notifyPositive("Airflow 등록 완료");
    await loadOverview();
  } catch (error) {
    notifyError(error, "Airflow 등록에 실패했습니다.");
  } finally {
    airflowDialog.loading = false;
    setActionLoading(airflowDialog.jobId, "airflow", false);
  }
}

async function runTeradataBootstrap(dryRun) {
  if (!isAdmin.value || bootstrapLoading.value) {
    return;
  }
  bootstrapLoading.value = true;
  try {
    const { data } = await api.post("/api/admin/teradata/bootstrap", {
      dry_run: Boolean(dryRun),
    });
    bootstrapResult.value = data;
    notifyPositive(dryRun ? "Teradata bootstrap dry-run 완료" : "Teradata bootstrap 실행 완료");
  } catch (error) {
    notifyError(error, dryRun ? "Teradata bootstrap dry-run 실패" : "Teradata bootstrap 실행 실패");
  } finally {
    bootstrapLoading.value = false;
  }
}

function renderCharts() {
  if (scheduleChart) {
    scheduleChart.destroy();
    scheduleChart = null;
  }
  if (runChart) {
    runChart.destroy();
    runChart = null;
  }

  if (scheduleChartCanvas.value) {
    const labels = overview.value.schedule_breakdown.map((item) => item.label);
    const data = overview.value.schedule_breakdown.map((item) => item.count);
    scheduleChart = new Chart(scheduleChartCanvas.value, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data,
            borderWidth: 0,
            backgroundColor: ["#155e63", "#1f7a8c", "#cf8a2e", "#516870"],
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    });
  }

  if (runChartCanvas.value) {
    const latest = [...runs.value].slice(0, 12).reverse();
    runChart = new Chart(runChartCanvas.value, {
      type: "bar",
      data: {
        labels: latest.map((item) => formatDateTime(item.executed_at).slice(5, 16)),
        datasets: [
          {
            label: "duration (sec)",
            data: latest.map((item) => item.duration_seconds),
            backgroundColor: latest.map((item) => (item.status === "success" ? "#2a9d8f" : "#d64545")),
            borderRadius: 8,
            maxBarThickness: 28,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
          },
        },
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    });
  }
}

onMounted(async () => {
  await restoreSession();
  if (isAuthenticated.value) {
    await loadCatalog();
    await loadOverview();
  }
});

onBeforeUnmount(() => {
  if (scheduleChart) {
    scheduleChart.destroy();
    scheduleChart = null;
  }
  if (runChart) {
    runChart.destroy();
    runChart = null;
  }
});
</script>
