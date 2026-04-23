<template>
  <q-layout view="lHh Lpr lFf">
    <q-header v-if="showDashboard" bordered class="gnb-shell">
      <q-toolbar class="gnb-toolbar">
        <q-btn
          flat
          round
          dense
          color="dark"
          icon="menu"
          aria-label="Toggle navigation menu"
          class="gnb-toggle"
          @click="leftDrawerOpen = !leftDrawerOpen"
        />

        <div class="gnb-brand">
          <div class="gnb-eyebrow">FSS DIS Kubernetes</div>
          <div class="gnb-title">Platform Sandbox Portal</div>
        </div>

        <q-space />

        <div class="gnb-actions">
          <q-btn
            outline
            color="dark"
            no-caps
            icon="refresh"
            label="Reload Dashboard"
            :loading="loading"
            @click="loadDashboard"
          />
          <q-chip square color="white" text-color="dark" icon="person" class="gnb-user-chip">
            {{ appSession.user.display_name }} ({{ appSession.user.role }})
          </q-chip>
          <q-btn
            flat
            color="negative"
            no-caps
            icon="logout"
            label="Logout"
            :loading="authLoading"
            @click="logoutApp"
          />
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page :class="['page-shell', { 'page-shell-with-offcanvas': showDashboard && leftDrawerOpen }]">
        <aside v-if="showDashboard" class="offcanvas-panel" :class="{ 'is-open': leftDrawerOpen }">
          <div class="offcanvas-head">
            <div class="section-title">Offcanvas Navigation</div>
            <div class="card-title">좌측 링크</div>
          </div>

          <div class="offcanvas-section">
            <div class="offcanvas-group-title">메뉴</div>
            <q-list class="offcanvas-list" separator>
              <q-item
                v-for="link in menuNavLinks"
                :key="link.id"
                clickable
                v-ripple
                class="offcanvas-link-item"
                @click="scrollToSection(link.id)"
              >
                <q-item-section avatar>
                  <q-icon :name="link.icon" color="dark" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ link.label }}</q-item-label>
                  <q-item-label caption>{{ link.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <div class="offcanvas-section">
            <div class="offcanvas-group-title">기능</div>
            <q-list class="offcanvas-list" separator>
              <q-item
                v-for="link in featureNavLinks"
                :key="link.id"
                clickable
                v-ripple
                class="offcanvas-link-item"
                @click="scrollToSection(link.id)"
              >
                <q-item-section avatar>
                  <q-icon :name="link.icon" color="dark" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ link.label }}</q-item-label>
                  <q-item-label caption>{{ link.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </aside>

        <div v-if="showDashboard && leftDrawerOpen" class="offcanvas-backdrop" @click="leftDrawerOpen = false" />

        <section v-if="!showDashboard" class="login-screen">
          <q-card flat class="surface-card login-page-card">
            <q-card-section>
              <div class="section-title">JWT Login</div>
              <div class="card-title">플랫폼 로그인</div>
              <p class="muted">
                사이트 첫 화면은 로그인 전용 화면입니다. 백엔드 JWT 로그인(`/fss-dis-server/api/auth/login`) 성공 후
                사용자 role(user/admin)에 맞는 화면으로 이동합니다.
              </p>
              <div class="admin-login-grid">
                <q-input
                  v-model="loginForm.username"
                  dense
                  outlined
                  color="dark"
                  label="Username (Email)"
                  class="admin-input"
                  @keyup.enter="loginApp"
                />
                <q-input
                  v-model="loginForm.password"
                  dense
                  outlined
                  color="dark"
                  type="password"
                  label="Password"
                  class="admin-input"
                  @keyup.enter="loginApp"
                />
                <q-btn
                  color="dark"
                  unelevated
                  no-caps
                  icon="login"
                  label="JWT Login"
                  :loading="authLoading"
                  :disable="!loginForm.username || !loginForm.password"
                  @click="loginApp"
                />
              </div>
              <q-banner rounded class="banner-note login-token-note">
                로그인 후 토큰은 로컬 세션에 저장되며 `Authorization: Bearer`와 `X-Auth-Token` 헤더로
                API 인증에 사용됩니다.
              </q-banner>
              <div class="demo-account-grid modal-account-grid">
                <q-btn
                  v-for="account in demoAccounts"
                  :key="account.username"
                  outline
                  color="dark"
                  no-caps
                  :label="`${account.display_name} (${account.username})`"
                  @click="applyDemoAccount(account)"
                />
              </div>
            </q-card-section>
          </q-card>
        </section>

        <template v-else>
        <section v-if="isUser" id="user-lab-panel" class="content-grid nav-anchor">
          <q-card flat class="surface-card lab-card">
            <q-card-section>
              <div class="row items-center justify-between q-col-gutter-md">
                <div>
                  <div class="section-title">Jupyter Pod Control</div>
                  <div class="card-title">로그인한 사용자 전용 Jupyter Pod</div>
                </div>
                <q-badge :color="labStatusColor" rounded>
                  {{ labSession.status }}
                </q-badge>
              </div>

              <p class="muted">
                현재 로그인한 계정 <strong>{{ managedUsername }}</strong> 전용 Jupyter Pod를 실행하고,
                중지하고, 준비가 끝나면 Pod 웹 화면으로 바로 연결할 수 있습니다.
              </p>

              <div class="chip-grid">
                <q-chip color="white" text-color="dark" square>
                  <strong>User</strong>&nbsp;{{ managedUsername }}
                </q-chip>
                <q-chip color="white" text-color="dark" square>
                  <strong>Workspace</strong>&nbsp;{{ labSession.workspace_subpath || "not created" }}
                </q-chip>
              </div>

              <div class="lab-form">
                <q-btn
                  color="dark"
                  unelevated
                  no-caps
                  icon="play_circle"
                  label="Jupyter Pod 실행"
                  :loading="sessionLoading"
                  :disable="!canStartLabSession"
                  @click="startLabSession"
                />
                <q-btn
                  outline
                  color="dark"
                  no-caps
                  icon="open_in_new"
                  label="Jupyter Pod 연결"
                  :disable="!canOpenLabSession"
                  @click="openLab"
                />
                <q-btn
                  flat
                  color="negative"
                  no-caps
                  icon="delete"
                  label="Jupyter Pod 중지"
                  :loading="sessionLoading"
                  :disable="!canStopLabSession"
                  @click="stopLabSession"
                />
              </div>

              <q-linear-progress
                v-if="labSession.status === 'provisioning'"
                indeterminate
                color="dark"
                class="lab-progress"
              />

              <q-banner rounded class="banner-note lab-banner">
                <div><strong>Pod Status</strong> {{ labSession.detail }}</div>
                <div v-if="labSession.workspace_subpath">Workspace: {{ labSession.workspace_subpath }}</div>
                <div v-if="labSession.node_port">NodePort: {{ labSession.node_port }}</div>
                <div v-if="labSession.image" class="lab-url">Image: {{ labSession.image }}</div>
                <div v-if="labSession.snapshot_status">Snapshot Publish: {{ labSession.snapshot_status }}</div>
                <div v-if="labSession.snapshot_job_name">Snapshot Job: {{ labSession.snapshot_job_name }}</div>
                <div v-if="labSession.snapshot_detail">Snapshot Detail: {{ labSession.snapshot_detail }}</div>
              </q-banner>
            </q-card-section>
          </q-card>

          <q-card id="user-usage-panel" flat class="surface-card nav-anchor">
            <q-card-section>
              <div class="row items-center justify-between q-col-gutter-md">
                <div>
                  <div class="section-title">My Jupyter Usage History</div>
                  <div class="card-title">내 계정 사용 이력</div>
                </div>
                <q-badge :color="usageSummary.current_status === 'ready' ? 'positive' : 'grey-7'" rounded>
                  {{ usageSummary.current_status }}
                </q-badge>
              </div>

              <q-linear-progress v-if="usageLoading" indeterminate color="dark" class="lab-progress" />

              <div class="chip-grid">
                <q-chip color="white" text-color="dark" square>
                  <strong>logins</strong>&nbsp;{{ usageSummary.login_count }}
                </q-chip>
                <q-chip color="white" text-color="dark" square>
                  <strong>launches</strong>&nbsp;{{ usageSummary.launch_count }}
                </q-chip>
                <q-chip color="white" text-color="dark" square>
                  <strong>current use</strong>&nbsp;{{ formatDuration(usageSummary.current_session_seconds) }}
                </q-chip>
                <q-chip color="white" text-color="dark" square>
                  <strong>total use</strong>&nbsp;{{ formatDuration(usageSummary.total_session_seconds) }}
                </q-chip>
              </div>

              <q-banner rounded class="banner-note lab-banner">
                <div><strong>Last Login</strong> {{ formatDateTime(usageSummary.last_login_at) }}</div>
                <div><strong>Last Launch</strong> {{ formatDateTime(usageSummary.last_launch_at) }}</div>
                <div><strong>Last Stop</strong> {{ formatDateTime(usageSummary.last_stop_at) }}</div>
              </q-banner>
            </q-card-section>
          </q-card>

          <q-card id="workspace-snapshot-panel" flat class="surface-card nav-anchor">
            <q-card-section>
              <div class="row items-center justify-between q-col-gutter-md">
                <div>
                  <div class="section-title">Workspace Snapshot</div>
                  <div class="card-title">개인 sandbox 복원 이미지</div>
                </div>
                <q-badge :color="snapshotStatusColor" rounded>
                  {{ snapshotState.status }}
                </q-badge>
              </div>

              <p class="muted">
                PVC `users/&lt;session-id&gt;`에 저장된 작업 내용을 Harbor snapshot으로 publish할 수
                있습니다. 다음 로그인 시 backend가 이 이미지를 우선 사용합니다.
              </p>

              <div class="lab-form">
                <q-btn
                  color="dark"
                  unelevated
                  no-caps
                  icon="cloud_upload"
                  label="Publish Snapshot"
                  :loading="snapshotLoading"
                  @click="publishSnapshot"
                />
                <q-btn
                  outline
                  color="dark"
                  no-caps
                  icon="inventory_2"
                  label="Refresh Snapshot"
                  :loading="snapshotLoading"
                  @click="refreshSnapshotStatus"
                />
              </div>

              <q-linear-progress
                v-if="snapshotState.status === 'building'"
                indeterminate
                color="dark"
                class="lab-progress"
              />

              <q-banner rounded class="banner-note lab-banner">
                <div><strong>Status</strong> {{ snapshotState.detail }}</div>
                <div v-if="snapshotState.job_name">Job: {{ snapshotState.job_name }}</div>
                <div v-if="snapshotState.workspace_subpath">
                  Workspace: {{ snapshotState.workspace_subpath }}
                </div>
                <div v-if="snapshotState.published_at">Published: {{ snapshotState.published_at }}</div>
                <div v-if="snapshotState.image" class="lab-url">
                  Snapshot Image: {{ snapshotState.image }}
                </div>
              </q-banner>
            </q-card-section>
          </q-card>
        </section>

        <section v-if="isUser" id="user-governance-panel" class="content-grid nav-anchor">
          <q-card flat class="surface-card">
            <q-card-section>
              <div class="row items-center justify-between q-col-gutter-md">
                <div>
                  <div class="section-title">Request Workflow</div>
                  <div class="card-title">리소스/분석환경 신청 상태</div>
                </div>
                <q-badge :color="userPolicyBadgeColor" rounded>
                  {{ userPolicyBadgeLabel }}
                </q-badge>
              </div>

              <p class="muted">
                사용자 리소스 요청 승인 후 분석환경을 신청합니다. 두 단계가 승인되면 개인 전용
                PVC/이미지 정책으로 JupyterLab 실행이 허용됩니다.
              </p>

              <div class="chip-grid">
                <q-chip color="white" text-color="dark" square>
                  <strong>governance</strong>&nbsp;{{ userLabPolicy.governance_enabled ? "on" : "off" }}
                </q-chip>
                <q-chip color="white" text-color="dark" square>
                  <strong>ready</strong>&nbsp;{{ userLabPolicy.ready ? "yes" : "no" }}
                </q-chip>
                <q-chip v-if="userLabPolicy.vcpu" color="white" text-color="dark" square>
                  <strong>vcpu</strong>&nbsp;{{ userLabPolicy.vcpu }}
                </q-chip>
                <q-chip v-if="userLabPolicy.memory_gib" color="white" text-color="dark" square>
                  <strong>memory</strong>&nbsp;{{ userLabPolicy.memory_gib }}Gi
                </q-chip>
                <q-chip v-if="userLabPolicy.disk_gib" color="white" text-color="dark" square>
                  <strong>disk</strong>&nbsp;{{ userLabPolicy.disk_gib }}Gi
                </q-chip>
                <q-chip v-if="userLabPolicy.analysis_env_id" color="white" text-color="dark" square>
                  <strong>env</strong>&nbsp;{{ userLabPolicy.analysis_env_id }}
                </q-chip>
              </div>

              <div class="lab-form">
                <q-btn
                  outline
                  color="dark"
                  no-caps
                  icon="sync"
                  label="Refresh Requests"
                  :loading="governanceLoading"
                  @click="loadUserGovernanceData"
                />
              </div>

              <q-linear-progress v-if="governanceLoading" indeterminate color="dark" class="lab-progress" />

              <q-banner rounded class="banner-note lab-banner">
                <div><strong>Policy</strong> {{ userLabPolicy.detail }}</div>
                <div v-if="userLabPolicy.pvc_name">PVC: {{ userLabPolicy.pvc_name }}</div>
                <div v-if="userLabPolicy.analysis_image" class="lab-url">
                  Image: {{ userLabPolicy.analysis_image }}
                </div>
              </q-banner>
            </q-card-section>
          </q-card>

          <q-card flat class="surface-card">
            <q-card-section>
              <div class="section-title">Step 1</div>
              <div class="card-title">리소스 할당 신청</div>

              <div class="request-form-grid">
                <q-input
                  v-model.number="resourceRequestForm.vcpu"
                  dense
                  outlined
                  color="dark"
                  type="number"
                  min="1"
                  max="64"
                  label="vCPU"
                  class="lab-input"
                />
                <q-input
                  v-model.number="resourceRequestForm.memory_gib"
                  dense
                  outlined
                  color="dark"
                  type="number"
                  min="1"
                  max="512"
                  label="Memory (GiB)"
                  class="lab-input"
                />
                <q-input
                  v-model.number="resourceRequestForm.disk_gib"
                  dense
                  outlined
                  color="dark"
                  type="number"
                  min="1"
                  max="2048"
                  label="Disk (GiB)"
                  class="lab-input"
                />
              </div>
              <q-input
                v-model="resourceRequestForm.note"
                dense
                outlined
                color="dark"
                type="textarea"
                autogrow
                label="요청 메모 (선택)"
                class="request-note-input"
              />

              <div class="lab-form">
                <q-btn
                  color="dark"
                  unelevated
                  no-caps
                  icon="send"
                  label="Submit Resource Request"
                  :loading="governanceLoading"
                  :disable="!canSubmitResourceRequest"
                  @click="submitResourceRequest"
                />
              </div>

              <q-separator class="inventory-separator" />

              <q-table
                flat
                :rows="userResourceRequests"
                :columns="userResourceRequestColumns"
                row-key="request_id"
                :rows-per-page-options="[5, 10, 20]"
                :pagination="{ rowsPerPage: 5 }"
              >
                <template #body-cell-status="props">
                  <q-td :props="props">
                    <q-badge :color="requestStatusColor(props.value)" rounded>
                      {{ props.value }}
                    </q-badge>
                  </q-td>
                </template>
                <template #body-cell-updated_at="props">
                  <q-td :props="props">
                    {{ formatDateTime(props.value) }}
                  </q-td>
                </template>
                <template #body-cell-review_note="props">
                  <q-td :props="props">
                    {{ props.value || "-" }}
                  </q-td>
                </template>
                <template #body-cell-pvc_name="props">
                  <q-td :props="props">
                    {{ props.value || "-" }}
                  </q-td>
                </template>
              </q-table>
            </q-card-section>
          </q-card>

          <q-card flat class="surface-card">
            <q-card-section>
              <div class="section-title">Step 2</div>
              <div class="card-title">분석환경 신청</div>

              <div class="request-form-grid">
                <q-select
                  v-model="environmentRequestForm.env_id"
                  dense
                  outlined
                  color="dark"
                  emit-value
                  map-options
                  option-label="label"
                  option-value="value"
                  :options="analysisEnvironmentOptions"
                  label="Analysis Environment"
                  class="lab-input"
                />
              </div>
              <q-input
                v-model="environmentRequestForm.note"
                dense
                outlined
                color="dark"
                type="textarea"
                autogrow
                label="요청 메모 (선택)"
                class="request-note-input"
              />

              <div class="lab-form">
                <q-btn
                  color="dark"
                  unelevated
                  no-caps
                  icon="send"
                  label="Submit Environment Request"
                  :loading="governanceLoading"
                  :disable="!canSubmitEnvironmentRequest"
                  @click="submitEnvironmentRequest"
                />
              </div>

              <q-separator class="inventory-separator" />

              <q-table
                flat
                :rows="userEnvironmentRequests"
                :columns="userEnvironmentRequestColumns"
                row-key="request_id"
                :rows-per-page-options="[5, 10, 20]"
                :pagination="{ rowsPerPage: 5 }"
              >
                <template #body-cell-status="props">
                  <q-td :props="props">
                    <q-badge :color="requestStatusColor(props.value)" rounded>
                      {{ props.value }}
                    </q-badge>
                  </q-td>
                </template>
                <template #body-cell-updated_at="props">
                  <q-td :props="props">
                    {{ formatDateTime(props.value) }}
                  </q-td>
                </template>
                <template #body-cell-review_note="props">
                  <q-td :props="props">
                    {{ props.value || "-" }}
                  </q-td>
                </template>
              </q-table>
            </q-card-section>
          </q-card>
        </section>

        <section
          v-if="isAdmin"
          id="governance-admin-panel"
          class="content-grid control-plane-anchor nav-anchor"
        >
          <q-card flat class="surface-card">
            <q-card-section>
              <div class="row items-center justify-between q-col-gutter-md">
                <div>
                  <div class="section-title">Governance Admin</div>
                  <div class="card-title">신청/승인 운영 대시보드</div>
                </div>
                <q-badge :color="pendingGovernanceCount ? 'warning' : 'positive'" rounded>
                  {{ pendingGovernanceCount }} pending
                </q-badge>
              </div>

              <div class="chip-grid">
                <q-chip color="white" text-color="dark" square>
                  <strong>users</strong>&nbsp;{{ adminManagedUsers.length }}
                </q-chip>
                <q-chip color="white" text-color="dark" square>
                  <strong>envs</strong>&nbsp;{{ adminAnalysisEnvironments.length }}
                </q-chip>
                <q-chip color="white" text-color="dark" square>
                  <strong>resource pending</strong>&nbsp;{{ pendingResourceRequestCount }}
                </q-chip>
                <q-chip color="white" text-color="dark" square>
                  <strong>environment pending</strong>&nbsp;{{ pendingEnvironmentRequestCount }}
                </q-chip>
              </div>

              <div class="lab-form">
                <q-btn
                  outline
                  color="dark"
                  no-caps
                  icon="sync"
                  label="Refresh Governance"
                  :loading="governanceAdminLoading"
                  @click="loadAdminGovernanceData"
                />
              </div>
              <q-linear-progress
                v-if="governanceAdminLoading"
                indeterminate
                color="dark"
                class="lab-progress"
              />
            </q-card-section>
          </q-card>

          <q-card flat class="surface-card">
            <q-card-section>
              <div class="section-title">User Provisioning</div>
              <div class="card-title">관리자 수동 사용자 생성</div>
              <div class="request-form-grid">
                <q-input
                  v-model="adminUserForm.username"
                  dense
                  outlined
                  color="dark"
                  label="Username (email)"
                  class="lab-input"
                />
                <q-input
                  v-model="adminUserForm.display_name"
                  dense
                  outlined
                  color="dark"
                  label="Display Name"
                  class="lab-input"
                />
                <q-input
                  v-model="adminUserForm.password"
                  dense
                  outlined
                  color="dark"
                  type="password"
                  label="Password"
                  class="lab-input"
                />
                <q-select
                  v-model="adminUserForm.role"
                  dense
                  outlined
                  color="dark"
                  :options="['user', 'admin']"
                  label="Role"
                  class="lab-input"
                />
              </div>
              <div class="lab-form">
                <q-btn
                  color="dark"
                  unelevated
                  no-caps
                  icon="person_add"
                  label="Create User"
                  :loading="governanceAdminLoading"
                  :disable="!canCreateManagedUser"
                  @click="createManagedUser"
                />
              </div>

              <q-separator class="inventory-separator" />

              <q-table
                flat
                :rows="adminManagedUsers"
                :columns="managedUserColumns"
                row-key="username"
                :rows-per-page-options="[5, 10, 20]"
                :pagination="{ rowsPerPage: 5 }"
              />
            </q-card-section>
          </q-card>

          <q-card flat class="surface-card">
            <q-card-section>
              <div class="section-title">Analysis Environment</div>
              <div class="card-title">분석환경 이미지 등록/갱신</div>
              <div class="request-form-grid">
                <q-input
                  v-model="analysisEnvForm.env_id"
                  dense
                  outlined
                  color="dark"
                  label="Environment ID"
                  class="lab-input"
                />
                <q-input
                  v-model="analysisEnvForm.name"
                  dense
                  outlined
                  color="dark"
                  label="Name"
                  class="lab-input"
                />
                <q-input
                  v-model="analysisEnvForm.image"
                  dense
                  outlined
                  color="dark"
                  label="Image"
                  class="lab-input request-wide-input"
                />
                <q-input
                  v-model="analysisEnvForm.description"
                  dense
                  outlined
                  color="dark"
                  label="Description"
                  class="lab-input request-wide-input"
                />
              </div>
              <div class="request-switch-grid">
                <q-toggle v-model="analysisEnvForm.gpu_enabled" color="dark" label="GPU Enabled" />
                <q-toggle v-model="analysisEnvForm.is_active" color="dark" label="Active" />
              </div>
              <div class="lab-form">
                <q-btn
                  color="dark"
                  unelevated
                  no-caps
                  icon="add_box"
                  label="Upsert Environment"
                  :loading="governanceAdminLoading"
                  :disable="!canUpsertAnalysisEnvironment"
                  @click="upsertAnalysisEnvironment"
                />
              </div>

              <q-separator class="inventory-separator" />

              <q-table
                flat
                :rows="adminAnalysisEnvironments"
                :columns="analysisEnvironmentColumns"
                row-key="env_id"
                :rows-per-page-options="[5, 10, 20]"
                :pagination="{ rowsPerPage: 5 }"
              >
                <template #body-cell-gpu_enabled="props">
                  <q-td :props="props">
                    <q-badge :color="props.value ? 'secondary' : 'grey-7'" rounded>
                      {{ props.value ? "gpu" : "cpu" }}
                    </q-badge>
                  </q-td>
                </template>
                <template #body-cell-is_active="props">
                  <q-td :props="props">
                    <q-badge :color="props.value ? 'positive' : 'negative'" rounded>
                      {{ props.value ? "active" : "inactive" }}
                    </q-badge>
                  </q-td>
                </template>
                <template #body-cell-updated_at="props">
                  <q-td :props="props">
                    {{ formatDateTime(props.value) }}
                  </q-td>
                </template>
              </q-table>
            </q-card-section>
          </q-card>

          <q-card flat class="surface-card">
            <q-card-section>
              <div class="section-title">Resource Approvals</div>
              <div class="card-title">리소스 신청 승인/반려</div>
              <q-table
                flat
                :rows="adminResourceRequests"
                :columns="adminResourceRequestColumns"
                row-key="request_id"
                :rows-per-page-options="[5, 10, 20]"
                :pagination="{ rowsPerPage: 8 }"
              >
                <template #body-cell-status="props">
                  <q-td :props="props">
                    <q-badge :color="requestStatusColor(props.value)" rounded>
                      {{ props.value }}
                    </q-badge>
                  </q-td>
                </template>
                <template #body-cell-updated_at="props">
                  <q-td :props="props">
                    {{ formatDateTime(props.value) }}
                  </q-td>
                </template>
                <template #body-cell-actions="props">
                  <q-td :props="props">
                    <div v-if="props.row.status === 'pending'" class="table-action-row">
                      <q-btn
                        dense
                        no-caps
                        color="positive"
                        icon="check"
                        label="Approve"
                        :loading="isReviewLoading(`resource:${props.row.request_id}`)"
                        @click="reviewResourceRequest(props.row, true)"
                      />
                      <q-btn
                        dense
                        no-caps
                        outline
                        color="negative"
                        icon="close"
                        label="Reject"
                        :loading="isReviewLoading(`resource:${props.row.request_id}`)"
                        @click="reviewResourceRequest(props.row, false)"
                      />
                    </div>
                    <span v-else>{{ props.row.reviewed_by || "-" }}</span>
                  </q-td>
                </template>
              </q-table>
            </q-card-section>
          </q-card>

          <q-card flat class="surface-card">
            <q-card-section>
              <div class="section-title">Environment Approvals</div>
              <div class="card-title">분석환경 신청 승인/반려</div>
              <q-table
                flat
                :rows="adminEnvironmentRequests"
                :columns="adminEnvironmentRequestColumns"
                row-key="request_id"
                :rows-per-page-options="[5, 10, 20]"
                :pagination="{ rowsPerPage: 8 }"
              >
                <template #body-cell-status="props">
                  <q-td :props="props">
                    <q-badge :color="requestStatusColor(props.value)" rounded>
                      {{ props.value }}
                    </q-badge>
                  </q-td>
                </template>
                <template #body-cell-updated_at="props">
                  <q-td :props="props">
                    {{ formatDateTime(props.value) }}
                  </q-td>
                </template>
                <template #body-cell-actions="props">
                  <q-td :props="props">
                    <div v-if="props.row.status === 'pending'" class="table-action-row">
                      <q-btn
                        dense
                        no-caps
                        color="positive"
                        icon="check"
                        label="Approve"
                        :loading="isReviewLoading(`environment:${props.row.request_id}`)"
                        @click="reviewEnvironmentRequest(props.row, true)"
                      />
                      <q-btn
                        dense
                        no-caps
                        outline
                        color="negative"
                        icon="close"
                        label="Reject"
                        :loading="isReviewLoading(`environment:${props.row.request_id}`)"
                        @click="reviewEnvironmentRequest(props.row, false)"
                      />
                    </div>
                    <span v-else>{{ props.row.reviewed_by || "-" }}</span>
                  </q-td>
                </template>
              </q-table>
            </q-card-section>
          </q-card>
        </section>

        <section v-if="isAdmin" id="sandbox-admin" class="content-grid control-plane-anchor nav-anchor">
          <q-card flat class="surface-card">
            <q-card-section>
              <div class="row items-center justify-between q-col-gutter-md">
                <div>
                  <div class="section-title">Admin Monitoring</div>
                  <div class="card-title">사용자별 Jupyter sandbox 모니터링</div>
                </div>
                <q-badge :color="adminOverview.summary.running_user_count ? 'positive' : 'grey-7'" rounded>
                  {{ adminOverview.summary.running_user_count }} running
                </q-badge>
              </div>

              <p class="muted">
                관리자는 `test-user` 사용자 sandbox의 실행 여부, 현재 사용시간,
                누적 사용시간, 로그인 회수, Jupyter 실행 회수를 확인할 수 있습니다.
              </p>

              <div class="chip-grid">
                <q-chip
                  v-for="item in adminSummaryItems"
                  :key="item.label"
                  color="white"
                  text-color="dark"
                  square
                >
                  <strong>{{ item.label }}</strong>&nbsp;{{ item.value }}
                </q-chip>
              </div>

              <q-banner rounded class="banner-note lab-banner">
                {{ adminMonitorMessage }}
              </q-banner>
            </q-card-section>
          </q-card>

          <q-card flat class="surface-card inventory-card">
            <q-card-section>
              <div class="section-title">User List (AG Grid CE)</div>
              <q-linear-progress v-if="adminLoading" indeterminate color="dark" class="inventory-separator" />
              <div class="ag-theme-quartz admin-user-grid">
                <AgGridVue
                  :rowData="adminOverview.users"
                  :columnDefs="adminUserGridColumns"
                  :defaultColDef="adminUserGridDefaultColDef"
                  :pagination="true"
                  :paginationPageSize="8"
                  :animateRows="true"
                  domLayout="autoHeight"
                />
              </div>
            </q-card-section>
          </q-card>
        </section>

        <section
          v-if="isAdmin"
          id="control-plane-panel"
          class="content-grid control-plane-anchor nav-anchor"
        >
          <q-card flat class="surface-card">
            <q-card-section>
              <div class="row items-center justify-between q-col-gutter-md">
                <div>
                  <div class="section-title">Control Plane Dashboard</div>
                  <div class="card-title">관리자 모드 cluster inventory</div>
                </div>
                <q-badge :color="isAdmin ? 'positive' : 'grey-7'" rounded>
                  {{ isAdmin ? "admin session" : "admin required" }}
                </q-badge>
              </div>

              <p class="muted">
                관리자 계정으로 로그인하면 node / pod inventory를 읽어 오고 namespace 필터로 cluster
                전체 상태를 확인할 수 있습니다.
              </p>

              <div v-if="isAdmin" class="admin-toolbar">
                <div class="chip-grid">
                  <q-chip
                    v-for="item in controlPlaneSummaryItems"
                    :key="item.label"
                    color="white"
                    text-color="dark"
                    square
                  >
                    <strong>{{ item.label }}</strong>&nbsp;{{ item.value }}
                  </q-chip>
                </div>
                <div class="hero-actions">
                  <q-select
                    v-model="controlPlane.namespace"
                    dense
                    outlined
                    color="dark"
                    label="Pod Namespace"
                    :options="controlPlane.namespaces"
                    class="namespace-select"
                    @update:model-value="loadControlPlaneDashboard"
                  />
                  <q-btn
                    outline
                    color="dark"
                    no-caps
                    icon="sync"
                    label="Refresh"
                    :loading="controlPlane.loading"
                    @click="loadControlPlaneDashboard"
                  />
                </div>
              </div>

              <q-banner rounded class="banner-note lab-banner">
                {{ controlPlaneMessage }}
              </q-banner>
            </q-card-section>
          </q-card>

          <q-card v-if="isAdmin" flat class="surface-card inventory-card">
            <q-card-section>
              <q-tabs
                v-model="controlPlane.activeTab"
                align="left"
                active-color="dark"
                indicator-color="dark"
                no-caps
              >
                <q-tab name="nodes" label="Nodes" icon="dns" />
                <q-tab name="pods" label="Pods" icon="deployed_code" />
              </q-tabs>

              <q-separator class="inventory-separator" />

              <q-tab-panels v-model="controlPlane.activeTab" animated class="inventory-panels">
                <q-tab-panel name="nodes">
                  <q-table
                    flat
                    :rows="controlPlane.nodes"
                    :columns="nodeColumns"
                    row-key="name"
                    :rows-per-page-options="[0]"
                    hide-pagination
                    :loading="controlPlane.loading"
                  >
                    <template #body-cell-ready="props">
                      <q-td :props="props">
                        <q-badge :color="props.value ? 'positive' : 'negative'" rounded>
                          {{ props.value ? "Ready" : "Check" }}
                        </q-badge>
                      </q-td>
                    </template>
                  </q-table>
                </q-tab-panel>

                <q-tab-panel name="pods">
                  <q-table
                    flat
                    :rows="controlPlane.pods"
                    :columns="podColumns"
                    row-key="name"
                    :rows-per-page-options="[0]"
                    hide-pagination
                    :loading="controlPlane.loading"
                  >
                    <template #body-cell-status="props">
                      <q-td :props="props">
                        <q-badge :color="podStatusColor(props.value)" rounded>
                          {{ props.value }}
                        </q-badge>
                      </q-td>
                    </template>
                  </q-table>
                </q-tab-panel>
              </q-tab-panels>
            </q-card-section>
          </q-card>
        </section>

        <section id="services-panel" class="section-grid nav-anchor">
          <q-card v-for="service in dashboard.services" :key="service.name" flat class="status-card">
            <q-card-section>
              <div class="row items-center justify-between">
                <div>
                  <div class="card-label">{{ service.kind }}</div>
                  <div class="card-title">{{ service.name }}</div>
                </div>
                <q-badge :color="service.ok ? 'positive' : 'negative'" rounded>
                  {{ service.ok ? "ready" : "check" }}
                </q-badge>
              </div>
              <div class="card-endpoint">{{ service.endpoint }}</div>
              <div class="card-detail">{{ service.detail }}</div>
            </q-card-section>
          </q-card>
        </section>

        <section id="runtime-panel" class="content-grid nav-anchor">
          <q-card flat class="surface-card">
            <q-card-section>
              <div class="section-title">Runtime Profile</div>
              <div class="chip-grid">
                <q-chip
                  v-for="(value, key) in dashboard.runtime"
                  :key="key"
                  color="white"
                  text-color="dark"
                  square
                >
                  <strong>{{ key }}</strong>&nbsp;{{ value }}
                </q-chip>
              </div>
            </q-card-section>
          </q-card>

          <q-card flat class="surface-card">
            <q-card-section>
              <div class="section-title">Quick Links</div>
              <div class="button-grid">
                <q-btn
                  v-for="link in dashboard.quick_links"
                  :key="link.name"
                  :href="link.url"
                  target="_blank"
                  no-caps
                  outline
                  color="dark"
                  class="link-button"
                >
                  <div class="text-left full-width">
                    <div class="link-title">{{ link.name }}</div>
                    <div class="link-description">{{ link.description }}</div>
                  </div>
                </q-btn>
              </div>
            </q-card-section>
          </q-card>

          <q-card flat class="surface-card">
            <q-card-section>
              <div class="section-title">Runtime Overview (Chart.js)</div>
              <q-banner rounded class="banner-note">
                서비스 준비 상태를 Chart.js bar chart 로 시각화한 예시입니다.
              </q-banner>
              <div style="position: relative; min-height: 220px; margin-top: 12px;">
                <canvas ref="runtimeChartCanvas" />
              </div>
            </q-card-section>
          </q-card>
        </section>

        <section v-if="showSqlModule" id="sample-panel" class="content-grid nav-anchor">
          <q-card flat class="surface-card">
            <q-card-section>
              <div class="section-title">Sample ANSI SQL</div>
              <q-table
                flat
                :rows="dashboard.sample_queries"
                :columns="queryColumns"
                row-key="name"
                :rows-per-page-options="[0]"
                hide-pagination
              >
                <template #body-cell-sql="props">
                  <q-td :props="props">
                    <code class="sql-preview">{{ props.value }}</code>
                  </q-td>
                </template>
              </q-table>
            </q-card-section>
          </q-card>

          <q-card flat class="surface-card">
            <q-card-section>
              <div class="section-title">Notebook Workspace</div>
              <div v-if="dashboard.notebooks.length" class="notebook-list">
                <q-chip
                  v-for="notebook in dashboard.notebooks"
                  :key="notebook"
                  icon="book"
                  color="secondary"
                  text-color="white"
                >
                  {{ notebook }}
                </q-chip>
              </div>
              <q-banner v-else rounded class="banner-note">
                Shared notebook volume is empty. Personal Jupyter sessions still start with the
                image-bundled sample notebook.
              </q-banner>
            </q-card-section>
          </q-card>
        </section>

        <section v-if="showSqlModule" id="query-panel" class="content-grid nav-anchor">
          <q-card flat class="surface-card">
            <q-card-section>
              <div class="section-title">Teradata Mode</div>
              <p class="muted">{{ dashboard.teradata.note }}</p>
              <q-banner rounded class="banner-note">
                Current mode: <strong>{{ dashboard.teradata.mode }}</strong>
              </q-banner>
            </q-card-section>
          </q-card>

          <q-card flat class="surface-card">
            <q-card-section>
              <div class="section-title">Query Result</div>
              <q-inner-loading :showing="queryLoading || loading">
                <q-spinner-grid color="dark" size="42px" />
              </q-inner-loading>
              <q-markup-table flat class="result-table" v-if="queryResult.rows.length">
                <thead>
                  <tr>
                    <th v-for="column in queryResult.columns" :key="column">{{ column }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rowIndex) in queryResult.rows" :key="rowIndex">
                    <td v-for="column in queryResult.columns" :key="column">{{ row[column] }}</td>
                  </tr>
                </tbody>
              </q-markup-table>
              <q-banner v-else rounded class="banner-note">
                Run the first sample query to preview the Teradata response shape.
              </q-banner>
            </q-card-section>
          </q-card>
        </section>
        </template>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import axios from "axios";
import { BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip } from "chart.js";
import { Notify } from "quasar";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { AgGridVue } from "ag-grid-vue3";

const browserOrigin = typeof window !== "undefined" ? window.location.origin : "http://platform.local";
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || `${browserOrigin}/fss-dis-server`).replace(/\/+$/, "");

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
});

const savedAuthToken =
  typeof window !== "undefined" ? window.localStorage.getItem("appAuthToken") || "" : "";
const savedAuthUser =
  typeof window !== "undefined" && window.localStorage.getItem("appAuthUser")
    ? JSON.parse(window.localStorage.getItem("appAuthUser"))
    : null;

const loading = ref(true);
const queryLoading = ref(false);
const authLoading = ref(false);
const sessionLoading = ref(false);
const snapshotLoading = ref(false);
const adminLoading = ref(false);
const usageLoading = ref(false);
const leftDrawerOpen = ref(typeof window !== "undefined" ? window.innerWidth >= 1024 : true);
const authResolved = ref(false);

const demoAccounts = ref([
  { username: "test-user", role: "user", display_name: "ADW Test User" },
  { username: "admin@test.com", role: "admin", display_name: "Platform Admin" },
]);

const loginForm = ref({
  username: savedAuthUser?.username || "test-user",
  password: "test-password",
});

const appSession = ref(emptyAppSession(savedAuthToken, savedAuthUser));
const labSession = ref(emptyLabSession());
const snapshotState = ref(emptySnapshotState());
const adminOverview = ref(emptyAdminOverview());
const userUsage = ref(emptyUserUsage());
const controlPlane = ref(emptyControlPlaneState());
const userLabPolicy = ref(emptyUserLabPolicy());
const userResourceRequests = ref([]);
const userEnvironmentRequests = ref([]);
const availableAnalysisEnvs = ref([]);
const adminManagedUsers = ref([]);
const adminResourceRequests = ref([]);
const adminEnvironmentRequests = ref([]);
const adminAnalysisEnvironments = ref([]);
const governanceLoading = ref(false);
const governanceAdminLoading = ref(false);
const reviewLoading = ref({});

const resourceRequestForm = ref({
  vcpu: 2,
  memory_gib: 1,
  disk_gib: 10,
  note: "",
});

const environmentRequestForm = ref({
  env_id: "",
  note: "",
});

const adminUserForm = ref({
  username: "",
  display_name: "",
  password: "123456",
  role: "user",
});

const analysisEnvForm = ref({
  env_id: "jupyter",
  name: "Jupyter",
  image: "",
  description: "",
  gpu_enabled: false,
  is_active: true,
});

const dashboard = ref({
  runtime: {},
  services: [],
  quick_links: [],
  sample_queries: [],
  notebooks: [],
  teradata: {
    mode: "mock",
    note: "",
  },
});

const queryResult = ref({
  columns: [],
  rows: [],
});
const runtimeChartCanvas = ref(null);

let labPollHandle = null;
let adminPollHandle = null;
let runtimeChart = null;

const isAuthenticated = computed(() => appSession.value.authenticated);
const showDashboard = computed(() => authResolved.value && isAuthenticated.value);
const isAdmin = computed(() => appSession.value.user?.role === "admin");
const isUser = computed(() => appSession.value.user?.role === "user");
const managedUsername = computed(() => (isUser.value ? appSession.value.user.username : ""));
const usageSummary = computed(() => userUsage.value.summary);
const analysisEnvironmentOptions = computed(() =>
  availableAnalysisEnvs.value.map((item) => ({
    label: `${item.name}${item.gpu_enabled ? " (GPU)" : ""} - ${item.env_id}`,
    value: item.env_id,
  })),
);
const pendingResourceRequestCount = computed(
  () => adminResourceRequests.value.filter((item) => item.status === "pending").length,
);
const pendingEnvironmentRequestCount = computed(
  () => adminEnvironmentRequests.value.filter((item) => item.status === "pending").length,
);
const pendingGovernanceCount = computed(
  () => pendingResourceRequestCount.value + pendingEnvironmentRequestCount.value,
);
const canSubmitResourceRequest = computed(() => {
  const vcpu = Number(resourceRequestForm.value.vcpu);
  const memory = Number(resourceRequestForm.value.memory_gib);
  const disk = Number(resourceRequestForm.value.disk_gib);
  return Number.isFinite(vcpu) && Number.isFinite(memory) && Number.isFinite(disk) && vcpu >= 1 && memory >= 1 && disk >= 1;
});
const canSubmitEnvironmentRequest = computed(
  () => Boolean(String(environmentRequestForm.value.env_id || "").trim()),
);
const canCreateManagedUser = computed(() => {
  return (
    Boolean(String(adminUserForm.value.username || "").trim()) &&
    Boolean(String(adminUserForm.value.password || "").trim()) &&
    Boolean(String(adminUserForm.value.display_name || "").trim()) &&
    ["user", "admin"].includes(String(adminUserForm.value.role || ""))
  );
});
const canUpsertAnalysisEnvironment = computed(() => {
  return (
    Boolean(String(analysisEnvForm.value.env_id || "").trim()) &&
    Boolean(String(analysisEnvForm.value.name || "").trim()) &&
    Boolean(String(analysisEnvForm.value.image || "").trim())
  );
});
const userPolicyBadgeLabel = computed(() => {
  if (!userLabPolicy.value.governance_enabled) {
    return "governance off";
  }
  return userLabPolicy.value.ready ? "ready" : "approval pending";
});
const userPolicyBadgeColor = computed(() => {
  if (!userLabPolicy.value.governance_enabled) {
    return "grey-7";
  }
  return userLabPolicy.value.ready ? "positive" : "warning";
});
const canStartLabSession = computed(() => {
  if (!isUser.value || !managedUsername.value || sessionLoading.value) {
    return false;
  }
  return !["ready", "provisioning"].includes(String(labSession.value.status || ""));
});
const canStopLabSession = computed(() => {
  if (!isUser.value || !managedUsername.value || sessionLoading.value) {
    return false;
  }
  return !["idle", "missing"].includes(String(labSession.value.status || ""));
});
const canOpenLabSession = computed(() => {
  if (!isUser.value || !managedUsername.value || sessionLoading.value) {
    return false;
  }
  return labConnectReady.value;
});

const menuNavLinks = computed(() => {
  if (!isAuthenticated.value) {
    return [];
  }

  const links = [
    {
      id: "services-panel",
      label: "서비스 상태",
      icon: "dns",
      description: "구성 요소 readiness",
    },
    {
      id: "runtime-panel",
      label: "런타임/링크",
      icon: "link",
      description: "실행 정보와 quick links",
    },
  ];

  if (isAdmin.value) {
    links.push(
      {
        id: "sandbox-admin",
        label: "Admin 모니터링",
        icon: "monitor_heart",
        description: "사용자 sandbox 상태",
      },
      {
        id: "governance-admin-panel",
        label: "신청/승인 운영",
        icon: "approval",
        description: "계정/환경/요청 승인",
      },
      {
        id: "control-plane-panel",
        label: "Control Plane",
        icon: "hub",
        description: "노드/파드 인벤토리",
      },
    );
  }

  return links;
});

const featureNavLinks = computed(() => {
  if (!isAuthenticated.value) {
    return [];
  }

  const links = [];

  if (showSqlModule.value) {
    links.push(
      {
        id: "sample-panel",
        label: "Sample ANSI SQL",
        icon: "dataset",
        description: "샘플 쿼리 목록",
      },
      {
        id: "query-panel",
        label: "Query Result",
        icon: "table_view",
        description: "Teradata 응답 미리보기",
      },
    );
  }

  if (isUser.value) {
    links.unshift(
      {
        id: "user-governance-panel",
        label: "신청 상태",
        icon: "fact_check",
        description: "리소스/환경 요청",
      },
      {
        id: "workspace-snapshot-panel",
        label: "Workspace Snapshot",
        icon: "cloud_upload",
        description: "개인 이미지 publish",
      },
      {
        id: "user-usage-panel",
        label: "사용 이력",
        icon: "history",
        description: "로그인/실행/사용시간",
      },
      {
        id: "user-lab-panel",
        label: "Jupyter Pod 제어",
        icon: "rocket_launch",
        description: "Pod 실행/중지/연결",
      },
    );
  }

  return links;
});

const labStatusColor = computed(() => {
  if (labSession.value.status === "ready") {
    return "positive";
  }
  if (labSession.value.status === "provisioning") {
    return "warning";
  }
  if (labSession.value.status === "failed") {
    return "negative";
  }
  return "grey-7";
});

const snapshotStatusColor = computed(() => {
  if (snapshotState.value.status === "ready") {
    return "positive";
  }
  if (snapshotState.value.status === "building" || snapshotState.value.status === "pending") {
    return "warning";
  }
  if (snapshotState.value.status === "failed") {
    return "negative";
  }
  return "grey-7";
});

const adminSummaryItems = computed(() => [
  {
    label: "users",
    value: `${adminOverview.value.summary.ready_user_count}/${adminOverview.value.summary.sandbox_user_count} ready`,
  },
  {
    label: "running",
    value: adminOverview.value.summary.running_user_count,
  },
  {
    label: "logins",
    value: adminOverview.value.summary.total_login_count,
  },
  {
    label: "launches",
    value: adminOverview.value.summary.total_launch_count,
  },
  {
    label: "total use",
    value: formatDuration(adminOverview.value.summary.total_session_seconds),
  },
]);

const adminMonitorMessage = computed(() => {
  if (!isAdmin.value) {
    return "Admin login is required to monitor user sandboxes.";
  }
  if (!adminOverview.value.users.length) {
    return "Sandbox monitoring data will appear here after users log in and start Jupyter.";
  }
  return `Tracking ${adminOverview.value.users.length} demo users with ${adminOverview.value.summary.running_user_count} active sandbox sessions.`;
});

const controlPlaneSummaryItems = computed(() => [
  {
    label: "cluster",
    value: controlPlane.value.summary.cluster_name,
  },
  {
    label: "version",
    value: controlPlane.value.summary.cluster_version,
  },
  {
    label: "nodes",
    value: `${controlPlane.value.summary.ready_node_count}/${controlPlane.value.summary.node_count} ready`,
  },
  {
    label: "pods",
    value: `${controlPlane.value.summary.running_pod_count}/${controlPlane.value.summary.pod_count} running`,
  },
  {
    label: "namespace",
    value: controlPlane.value.summary.current_namespace,
  },
]);

const controlPlaneMessage = computed(() => {
  if (!isAdmin.value) {
    return "Log in with admin@test.com / 123456 to unlock the control-plane dashboard.";
  }
  return `Loaded ${controlPlane.value.nodes.length} nodes and ${controlPlane.value.pods.length} pods.`;
});

const showSqlModule = computed(
  () => Array.isArray(dashboard.value.sample_queries) && dashboard.value.sample_queries.length > 0,
);

const labConnectReady = computed(() => labSession.value.ready || labSession.value.status === "ready");

const queryColumns = [
  { name: "name", label: "Query", field: "name", align: "left" },
  { name: "description", label: "Description", field: "description", align: "left" },
  { name: "sql", label: "SQL", field: "sql", align: "left" },
];

const nodeColumns = [
  { name: "name", label: "Node", field: "name", align: "left" },
  { name: "ready", label: "Ready", field: "ready", align: "left" },
  { name: "roles", label: "Roles", field: "roles", align: "left" },
  { name: "version", label: "Version", field: "version", align: "left" },
  { name: "internal_ip", label: "Internal IP", field: "internal_ip", align: "left" },
  { name: "os_image", label: "OS", field: "os_image", align: "left" },
];

const podColumns = [
  { name: "namespace", label: "Namespace", field: "namespace", align: "left" },
  { name: "name", label: "Pod", field: "name", align: "left" },
  { name: "ready", label: "Ready", field: "ready", align: "left" },
  { name: "status", label: "Status", field: "status", align: "left" },
  { name: "restarts", label: "Restarts", field: "restarts", align: "right" },
  { name: "node_name", label: "Node", field: "node_name", align: "left" },
];

const managedUserColumns = [
  { name: "display_name", label: "Display Name", field: "display_name", align: "left" },
  { name: "username", label: "Username", field: "username", align: "left" },
  { name: "role", label: "Role", field: "role", align: "left" },
];

const analysisEnvironmentColumns = [
  { name: "env_id", label: "Env ID", field: "env_id", align: "left" },
  { name: "name", label: "Name", field: "name", align: "left" },
  { name: "image", label: "Image", field: "image", align: "left" },
  { name: "gpu_enabled", label: "Compute", field: "gpu_enabled", align: "left" },
  { name: "is_active", label: "State", field: "is_active", align: "left" },
  { name: "updated_at", label: "Updated", field: "updated_at", align: "left" },
];

const userResourceRequestColumns = [
  { name: "request_id", label: "Request ID", field: "request_id", align: "left" },
  { name: "status", label: "Status", field: "status", align: "left" },
  { name: "vcpu", label: "vCPU", field: "vcpu", align: "right" },
  { name: "memory_gib", label: "Memory", field: "memory_gib", align: "right" },
  { name: "disk_gib", label: "Disk", field: "disk_gib", align: "right" },
  { name: "pvc_name", label: "PVC", field: "pvc_name", align: "left" },
  { name: "review_note", label: "Review Note", field: "review_note", align: "left" },
  { name: "updated_at", label: "Updated", field: "updated_at", align: "left" },
];

const userEnvironmentRequestColumns = [
  { name: "request_id", label: "Request ID", field: "request_id", align: "left" },
  { name: "env_id", label: "Env ID", field: "env_id", align: "left" },
  { name: "status", label: "Status", field: "status", align: "left" },
  { name: "review_note", label: "Review Note", field: "review_note", align: "left" },
  { name: "updated_at", label: "Updated", field: "updated_at", align: "left" },
];

const adminResourceRequestColumns = [
  { name: "request_id", label: "Request ID", field: "request_id", align: "left" },
  { name: "username", label: "User", field: "username", align: "left" },
  { name: "status", label: "Status", field: "status", align: "left" },
  { name: "vcpu", label: "vCPU", field: "vcpu", align: "right" },
  { name: "memory_gib", label: "Memory", field: "memory_gib", align: "right" },
  { name: "disk_gib", label: "Disk", field: "disk_gib", align: "right" },
  { name: "review_note", label: "Review Note", field: "review_note", align: "left" },
  { name: "updated_at", label: "Updated", field: "updated_at", align: "left" },
  { name: "actions", label: "Actions", field: "actions", align: "left" },
];

const adminEnvironmentRequestColumns = [
  { name: "request_id", label: "Request ID", field: "request_id", align: "left" },
  { name: "username", label: "User", field: "username", align: "left" },
  { name: "env_id", label: "Env ID", field: "env_id", align: "left" },
  { name: "status", label: "Status", field: "status", align: "left" },
  { name: "review_note", label: "Review Note", field: "review_note", align: "left" },
  { name: "updated_at", label: "Updated", field: "updated_at", align: "left" },
  { name: "actions", label: "Actions", field: "actions", align: "left" },
];

const adminUserGridDefaultColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  flex: 1,
  minWidth: 130,
};

const adminUserGridColumns = [
  { headerName: "User", field: "display_name", minWidth: 150 },
  { headerName: "Email", field: "username", minWidth: 190 },
  {
    headerName: "Sandbox",
    field: "status",
    minWidth: 130,
    cellClass: (params) => statusCellClass(params.value, params.data?.ready),
  },
  { headerName: "Logins", field: "login_count", type: "numericColumn", minWidth: 110 },
  { headerName: "Launches", field: "launch_count", type: "numericColumn", minWidth: 110 },
  {
    headerName: "Current Use",
    field: "current_session_seconds",
    valueFormatter: durationValueFormatter,
    minWidth: 140,
  },
  {
    headerName: "Total Use",
    field: "total_session_seconds",
    valueFormatter: durationValueFormatter,
    minWidth: 130,
  },
  { headerName: "NodePort", field: "node_port", type: "numericColumn", minWidth: 120 },
  {
    headerName: "Last Login",
    field: "last_login_at",
    valueFormatter: dateTimeValueFormatter,
    minWidth: 180,
  },
  {
    headerName: "Last Launch",
    field: "last_launch_at",
    valueFormatter: dateTimeValueFormatter,
    minWidth: 180,
  },
];

function emptyAppSession(token = "", user = null) {
  return {
    authenticated: Boolean(token && user),
    token,
    user,
  };
}

function emptyLabSession() {
  return {
    session_id: "",
    username: "",
    namespace: "",
    workspace_subpath: "",
    image: "",
    status: "idle",
    phase: "Idle",
    ready: false,
    detail: "Log in as a user to run your Jupyter Pod.",
    node_port: null,
    created_at: null,
    snapshot_status: "",
    snapshot_job_name: "",
    snapshot_detail: "",
  };
}

function emptySnapshotState() {
  return {
    username: "",
    session_id: "",
    workspace_subpath: "",
    image: "",
    status: "idle",
    job_name: "",
    published_at: "",
    restorable: false,
    detail: "Publish a workspace snapshot after your Jupyter Pod is running.",
  };
}

function emptyUserUsage() {
  return {
    summary: {
      username: "",
      display_name: "",
      role: "user",
      current_status: "idle",
      node_port: null,
      login_count: 0,
      launch_count: 0,
      current_session_seconds: 0,
      total_session_seconds: 0,
      last_login_at: null,
      last_launch_at: null,
      last_stop_at: null,
    },
  };
}

function emptyAdminOverview() {
  return {
    summary: {
      sandbox_user_count: 0,
      running_user_count: 0,
      ready_user_count: 0,
      total_login_count: 0,
      total_launch_count: 0,
      total_session_seconds: 0,
    },
    users: [],
  };
}

function emptyControlPlaneState() {
  return {
    loading: false,
    namespace: "all",
    namespaces: ["all"],
    activeTab: "nodes",
    summary: {
      cluster_name: "Kubernetes control plane",
      cluster_version: "-",
      current_namespace: "all",
      namespace_count: 0,
      node_count: 0,
      ready_node_count: 0,
      pod_count: 0,
      running_pod_count: 0,
    },
    nodes: [],
    pods: [],
  };
}

function emptyUserLabPolicy() {
  return {
    username: "",
    governance_enabled: false,
    ready: false,
    vcpu: null,
    memory_gib: null,
    disk_gib: null,
    pvc_name: null,
    analysis_env_id: null,
    analysis_image: null,
    detail: "Load request workflow status after login.",
  };
}

function authHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (appSession.value.token) {
    headers.Authorization = `Bearer ${appSession.value.token}`;
    headers["X-Auth-Token"] = appSession.value.token;
  }
  return headers;
}

function resolveAuthToken(payload) {
  return payload?.access_token || payload?.token || "";
}

async function parseJson(response) {
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return response.json();
}

function toRequestError(error, fallback = "Request failed") {
  if (error?.response?.data?.detail) {
    return new Error(String(error.response.data.detail));
  }
  if (error?.message) {
    return new Error(String(error.message));
  }
  return new Error(fallback);
}

function waitForDelay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function scrollToSection(sectionId) {
  if (typeof window === "undefined") {
    return;
  }
  const sectionNode = document.getElementById(sectionId);
  if (!sectionNode) {
    return;
  }
  sectionNode.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
  if (window.innerWidth < 1024) {
    leftDrawerOpen.value = false;
  }
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function durationValueFormatter(params) {
  return formatDuration(params.value);
}

function dateTimeValueFormatter(params) {
  return formatDateTime(params.value);
}

function statusCellClass(status, ready) {
  if (ready || status === "ready") {
    return "grid-status-ready";
  }
  if (status === "provisioning") {
    return "grid-status-provisioning";
  }
  if (status === "missing" || status === "idle") {
    return "grid-status-idle";
  }
  return "grid-status-error";
}

function podStatusColor(status) {
  if (status === "Running") {
    return "positive";
  }
  if (status === "Pending") {
    return "warning";
  }
  if (status === "Succeeded") {
    return "secondary";
  }
  return "negative";
}

function requestStatusColor(status) {
  if (status === "approved") {
    return "positive";
  }
  if (status === "pending") {
    return "warning";
  }
  if (status === "rejected") {
    return "negative";
  }
  return "grey-7";
}

function renderRuntimeChart() {
  if (runtimeChart) {
    runtimeChart.destroy();
    runtimeChart = null;
  }
  if (!runtimeChartCanvas.value) {
    return;
  }

  const services = Array.isArray(dashboard.value.services) ? dashboard.value.services : [];
  const labels = services.map((item) => item.name || "unknown");
  const values = services.map((item) => (item.ok ? 1 : 0));
  const colors = services.map((item) => (item.ok ? "#2e7d32" : "#b71c1c"));

  runtimeChart = new Chart(runtimeChartCanvas.value, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Service Ready (1=yes, 0=no)",
          data: values,
          backgroundColor: colors,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          min: 0,
          max: 1,
          ticks: { stepSize: 1 },
        },
      },
      plugins: {
        legend: { display: true },
      },
    },
  });
}

function isReviewLoading(key) {
  return Boolean(reviewLoading.value[key]);
}

function applyDemoAccount(account) {
  loginForm.value = {
    username: account.username,
    password: "123456",
  };
}

function persistAppSession(token, user) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem("appAuthToken", token);
  window.localStorage.setItem("appAuthUser", JSON.stringify(user));
}

function clearAppSessionStorage() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem("appAuthToken");
  window.localStorage.removeItem("appAuthUser");
}

function startLabPolling() {
  if (labPollHandle !== null || !isUser.value) {
    return;
  }
  labPollHandle = window.setInterval(() => {
    void refreshLabSession({ silent: true });
  }, 4000);
}

function stopLabPolling() {
  if (labPollHandle !== null) {
    window.clearInterval(labPollHandle);
    labPollHandle = null;
  }
}

function startAdminPolling() {
  if (adminPollHandle !== null || !isAdmin.value) {
    return;
  }
  adminPollHandle = window.setInterval(() => {
    void loadAdminOverview({ silent: true });
  }, 6000);
}

function stopAdminPolling() {
  if (adminPollHandle !== null) {
    window.clearInterval(adminPollHandle);
    adminPollHandle = null;
  }
}

function resetRoleScopedState() {
  stopLabPolling();
  stopAdminPolling();
  labSession.value = emptyLabSession();
  snapshotState.value = emptySnapshotState();
  userUsage.value = emptyUserUsage();
  userLabPolicy.value = emptyUserLabPolicy();
  userResourceRequests.value = [];
  userEnvironmentRequests.value = [];
  availableAnalysisEnvs.value = [];
  adminOverview.value = emptyAdminOverview();
  adminManagedUsers.value = [];
  adminResourceRequests.value = [];
  adminEnvironmentRequests.value = [];
  adminAnalysisEnvironments.value = [];
  reviewLoading.value = {};
  controlPlane.value = emptyControlPlaneState();
  resourceRequestForm.value = {
    vcpu: 2,
    memory_gib: 1,
    disk_gib: 10,
    note: "",
  };
  environmentRequestForm.value = {
    env_id: "",
    note: "",
  };
}

async function loadDemoUsers() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/demo-users`);
    const payload = await parseJson(response);
    demoAccounts.value = payload.items;
  } catch {
    // fallback to built-in demo accounts
  }
}

async function loadUserUsage(options = {}) {
  if (!isUser.value || usageLoading.value) {
    return;
  }

  usageLoading.value = true;
  try {
    const response = await fetch(`${apiBaseUrl}/api/users/me/usage`, {
      headers: authHeaders(),
    });
    userUsage.value = await parseJson(response);
  } catch (error) {
    if (!options.silent) {
      Notify.create({
        type: "negative",
        message: error.message,
      });
    }
  } finally {
    usageLoading.value = false;
  }
}

async function loadUserGovernanceData(options = {}) {
  if (!isUser.value || governanceLoading.value) {
    return;
  }

  governanceLoading.value = true;
  try {
    const [policyResponse, resourceResponse, environmentResponse, envCatalogResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/api/users/me/lab-policy`, { headers: authHeaders() }),
      fetch(`${apiBaseUrl}/api/resource-requests/me`, { headers: authHeaders() }),
      fetch(`${apiBaseUrl}/api/environment-requests/me`, { headers: authHeaders() }),
      fetch(`${apiBaseUrl}/api/analysis-environments`, { headers: authHeaders() }),
    ]);
    const [policyPayload, resourcePayload, environmentPayload, envCatalogPayload] = await Promise.all([
      parseJson(policyResponse),
      parseJson(resourceResponse),
      parseJson(environmentResponse),
      parseJson(envCatalogResponse),
    ]);

    userLabPolicy.value = {
      ...emptyUserLabPolicy(),
      ...policyPayload,
    };
    userResourceRequests.value = resourcePayload.items || [];
    userEnvironmentRequests.value = environmentPayload.items || [];
    availableAnalysisEnvs.value = envCatalogPayload.items || [];

    const envIds = availableAnalysisEnvs.value.map((item) => item.env_id);
    if (!envIds.includes(environmentRequestForm.value.env_id)) {
      environmentRequestForm.value = {
        ...environmentRequestForm.value,
        env_id: envIds[0] || "",
      };
    }
  } catch (error) {
    if (!options.silent) {
      Notify.create({
        type: "negative",
        message: error.message,
      });
    }
  } finally {
    governanceLoading.value = false;
  }
}

async function loadAdminGovernanceData(options = {}) {
  if (!isAdmin.value || governanceAdminLoading.value) {
    return;
  }

  governanceAdminLoading.value = true;
  try {
    const [usersResponse, envsResponse, resourceResponse, environmentResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/api/admin/users`, { headers: authHeaders() }),
      fetch(`${apiBaseUrl}/api/admin/analysis-environments?include_inactive=true`, {
        headers: authHeaders(),
      }),
      fetch(`${apiBaseUrl}/api/admin/resource-requests`, { headers: authHeaders() }),
      fetch(`${apiBaseUrl}/api/admin/environment-requests`, { headers: authHeaders() }),
    ]);
    const [usersPayload, envsPayload, resourcePayload, environmentPayload] = await Promise.all([
      parseJson(usersResponse),
      parseJson(envsResponse),
      parseJson(resourceResponse),
      parseJson(environmentResponse),
    ]);
    adminManagedUsers.value = usersPayload.items || [];
    adminAnalysisEnvironments.value = envsPayload.items || [];
    adminResourceRequests.value = resourcePayload.items || [];
    adminEnvironmentRequests.value = environmentPayload.items || [];
  } catch (error) {
    if (!options.silent) {
      Notify.create({
        type: "negative",
        message: error.message,
      });
    }
  } finally {
    governanceAdminLoading.value = false;
  }
}

async function submitResourceRequest() {
  if (!isUser.value || governanceLoading.value || !canSubmitResourceRequest.value) {
    return;
  }

  governanceLoading.value = true;
  try {
    const response = await fetch(`${apiBaseUrl}/api/resource-requests`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        vcpu: Number(resourceRequestForm.value.vcpu),
        memory_gib: Number(resourceRequestForm.value.memory_gib),
        disk_gib: Number(resourceRequestForm.value.disk_gib),
        note: resourceRequestForm.value.note || "",
      }),
    });
    await parseJson(response);
    resourceRequestForm.value = {
      ...resourceRequestForm.value,
      note: "",
    };
    Notify.create({
      type: "positive",
      message: "Resource request submitted.",
    });
    governanceLoading.value = false;
    await loadUserGovernanceData({ silent: true });
  } catch (error) {
    Notify.create({
      type: "negative",
      message: error.message,
    });
  } finally {
    governanceLoading.value = false;
  }
}

async function submitEnvironmentRequest() {
  if (!isUser.value || governanceLoading.value || !canSubmitEnvironmentRequest.value) {
    return;
  }

  governanceLoading.value = true;
  try {
    const response = await fetch(`${apiBaseUrl}/api/environment-requests`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        env_id: String(environmentRequestForm.value.env_id || "").trim(),
        note: environmentRequestForm.value.note || "",
      }),
    });
    await parseJson(response);
    environmentRequestForm.value = {
      ...environmentRequestForm.value,
      note: "",
    };
    Notify.create({
      type: "positive",
      message: "Environment request submitted.",
    });
    governanceLoading.value = false;
    await loadUserGovernanceData({ silent: true });
  } catch (error) {
    Notify.create({
      type: "negative",
      message: error.message,
    });
  } finally {
    governanceLoading.value = false;
  }
}

async function createManagedUser() {
  if (!isAdmin.value || governanceAdminLoading.value || !canCreateManagedUser.value) {
    return;
  }

  governanceAdminLoading.value = true;
  try {
    const response = await fetch(`${apiBaseUrl}/api/admin/users`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        username: String(adminUserForm.value.username || "").trim(),
        password: String(adminUserForm.value.password || ""),
        role: String(adminUserForm.value.role || "user"),
        display_name: String(adminUserForm.value.display_name || "").trim(),
      }),
    });
    await parseJson(response);
    adminUserForm.value = {
      username: "",
      display_name: "",
      password: "123456",
      role: "user",
    };
    Notify.create({
      type: "positive",
      message: "Managed user created.",
    });
    governanceAdminLoading.value = false;
    await Promise.all([loadAdminGovernanceData({ silent: true }), loadDemoUsers()]);
  } catch (error) {
    Notify.create({
      type: "negative",
      message: error.message,
    });
  } finally {
    governanceAdminLoading.value = false;
  }
}

async function upsertAnalysisEnvironment() {
  if (!isAdmin.value || governanceAdminLoading.value || !canUpsertAnalysisEnvironment.value) {
    return;
  }

  governanceAdminLoading.value = true;
  try {
    const response = await fetch(`${apiBaseUrl}/api/admin/analysis-environments`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        env_id: String(analysisEnvForm.value.env_id || "").trim().toLowerCase(),
        name: String(analysisEnvForm.value.name || "").trim(),
        image: String(analysisEnvForm.value.image || "").trim(),
        description: String(analysisEnvForm.value.description || "").trim(),
        gpu_enabled: Boolean(analysisEnvForm.value.gpu_enabled),
        is_active: Boolean(analysisEnvForm.value.is_active),
      }),
    });
    const payload = await parseJson(response);
    adminAnalysisEnvironments.value = payload.items || [];
    Notify.create({
      type: "positive",
      message: "Analysis environment upserted.",
    });
  } catch (error) {
    Notify.create({
      type: "negative",
      message: error.message,
    });
  } finally {
    governanceAdminLoading.value = false;
  }
}

async function reviewResourceRequest(item, approved) {
  if (!isAdmin.value) {
    return;
  }
  const key = `resource:${item.request_id}`;
  if (reviewLoading.value[key]) {
    return;
  }

  reviewLoading.value = {
    ...reviewLoading.value,
    [key]: true,
  };
  try {
    const response = await fetch(
      `${apiBaseUrl}/api/admin/resource-requests/${encodeURIComponent(item.request_id)}/review`,
      {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          approved: Boolean(approved),
          note: approved ? "Approved via web UI." : "Rejected via web UI.",
        }),
      },
    );
    await parseJson(response);
    Notify.create({
      type: approved ? "positive" : "warning",
      message: approved ? "Resource request approved." : "Resource request rejected.",
    });
    await Promise.all([loadAdminGovernanceData({ silent: true }), loadAdminOverview({ silent: true })]);
  } catch (error) {
    Notify.create({
      type: "negative",
      message: error.message,
    });
  } finally {
    reviewLoading.value = {
      ...reviewLoading.value,
      [key]: false,
    };
  }
}

async function reviewEnvironmentRequest(item, approved) {
  if (!isAdmin.value) {
    return;
  }
  const key = `environment:${item.request_id}`;
  if (reviewLoading.value[key]) {
    return;
  }

  reviewLoading.value = {
    ...reviewLoading.value,
    [key]: true,
  };
  try {
    const response = await fetch(
      `${apiBaseUrl}/api/admin/environment-requests/${encodeURIComponent(item.request_id)}/review`,
      {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          approved: Boolean(approved),
          note: approved ? "Approved via web UI." : "Rejected via web UI.",
        }),
      },
    );
    await parseJson(response);
    Notify.create({
      type: approved ? "positive" : "warning",
      message: approved ? "Environment request approved." : "Environment request rejected.",
    });
    await loadAdminGovernanceData({ silent: true });
  } catch (error) {
    Notify.create({
      type: "negative",
      message: error.message,
    });
  } finally {
    reviewLoading.value = {
      ...reviewLoading.value,
      [key]: false,
    };
  }
}

async function restoreAuthSession() {
  if (!appSession.value.token) {
    return;
  }
  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
      headers: authHeaders(),
    });
    const payload = await parseJson(response);
    appSession.value = emptyAppSession(appSession.value.token, payload.user);
    persistAppSession(appSession.value.token, payload.user);
  } catch (error) {
    clearAppSessionStorage();
    appSession.value = emptyAppSession();
    Notify.create({
      type: "warning",
      message: error.message,
    });
  }
}

async function loginApp() {
  if (authLoading.value) {
    return;
  }

  authLoading.value = true;
  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginForm.value),
    });
    const payload = await parseJson(response);
    const authToken = resolveAuthToken(payload);
    if (!authToken) {
      throw new Error("JWT login response is invalid.");
    }

    let authenticatedUser = payload.user || null;
    if (!authenticatedUser) {
      const meResponse = await fetch(`${apiBaseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "X-Auth-Token": authToken,
        },
      });
      const mePayload = await parseJson(meResponse);
      authenticatedUser = mePayload.user || null;
    }

    if (!authenticatedUser) {
      throw new Error("User session was not returned by backend.");
    }

    appSession.value = emptyAppSession(authToken, authenticatedUser);
    persistAppSession(authToken, authenticatedUser);
    resetRoleScopedState();
    await loadDashboard();
    await runFirstQuery();

    if (authenticatedUser.role === "user") {
      await refreshLabSession({ silent: true, skipSnapshotRefresh: true });
      await refreshSnapshotStatus({ silent: true });
      if (snapshotState.value.status === "building" || snapshotState.value.status === "pending") {
        void waitForSnapshotCompletion({
          notifyWaiting: false,
          notifyFailure: false,
          notifyTimeout: false,
          timeoutMs: 180000,
        });
      }
      await loadUserUsage({ silent: true });
      await loadUserGovernanceData({ silent: true });
    } else if (authenticatedUser.role === "admin") {
      await loadAdminOverview({ silent: true });
      await loadAdminGovernanceData({ silent: true });
      await loadControlPlaneDashboard({ silent: true });
      startAdminPolling();
    }

    Notify.create({
      type: "positive",
      message:
        authenticatedUser.role === "admin"
          ? "Admin mode is ready."
          : `Logged in as ${authenticatedUser.display_name}.`,
    });
  } catch (error) {
    Notify.create({
      type: "negative",
      message: error.message,
    });
  } finally {
    authLoading.value = false;
  }
}

async function logoutApp() {
  if (authLoading.value || !appSession.value.token) {
    return;
  }

  authLoading.value = true;
  try {
    await fetch(`${apiBaseUrl}/api/auth/logout`, {
      method: "POST",
      headers: authHeaders(),
    });
  } finally {
    clearAppSessionStorage();
    appSession.value = emptyAppSession();
    resetRoleScopedState();
    authLoading.value = false;
    Notify.create({
      type: "info",
      message: "Application session cleared.",
    });
  }
}

async function loadDashboard() {
  loading.value = true;
  try {
    const response = await api.get("/api/dashboard");
    dashboard.value = response.data;
    renderRuntimeChart();
    if (!Array.isArray(dashboard.value.sample_queries) || dashboard.value.sample_queries.length === 0) {
      queryResult.value = {
        columns: [],
        rows: [],
      };
    }
  } catch (error) {
    Notify.create({
      type: "negative",
      message: toRequestError(error).message,
    });
  } finally {
    loading.value = false;
  }
}

async function runFirstQuery() {
  const firstQuery = dashboard.value.sample_queries[0];
  if (!firstQuery) {
    return;
  }

  queryLoading.value = true;
  try {
    const response = await api.post("/api/teradata/query", {
        sql: firstQuery.sql,
        limit: 10,
      });
    const payload = response.data;
    queryResult.value = {
      columns: payload.columns,
      rows: payload.rows,
    };
    Notify.create({
      type: "positive",
      message: payload.note,
    });
  } catch (error) {
    Notify.create({
      type: "negative",
      message: toRequestError(error).message,
    });
  } finally {
    queryLoading.value = false;
  }
}

async function refreshLabSession(options = {}) {
  if (!isUser.value || !managedUsername.value || sessionLoading.value) {
    return;
  }

  sessionLoading.value = true;
  try {
    const response = await fetch(
      `${apiBaseUrl}/api/jupyter/sessions/${encodeURIComponent(managedUsername.value)}`,
      {
        headers: authHeaders(),
      },
    );
    const payload = await parseJson(response);
    labSession.value = {
      ...emptyLabSession(),
      ...payload,
    };

    if (labSession.value.status === "provisioning") {
      startLabPolling();
    } else {
      stopLabPolling();
    }

    if (!options.skipSnapshotRefresh) {
      void refreshSnapshotStatus({ silent: true });
    }
    void loadUserUsage({ silent: true });
  } catch (error) {
    stopLabPolling();
    Notify.create({
      type: "negative",
      message: error.message,
    });
  } finally {
    sessionLoading.value = false;
  }
}

async function waitForSnapshotCompletion(options = {}) {
  if (!isUser.value || !managedUsername.value) {
    return;
  }

  const timeoutMs = Number(options.timeoutMs ?? 120000);
  const pollIntervalMs = Number(options.pollIntervalMs ?? 2000);
  const notifyWaiting = options.notifyWaiting !== false;
  const notifyFailure = options.notifyFailure !== false;
  const notifyTimeout = options.notifyTimeout !== false;
  const deadline = Date.now() + timeoutMs;
  let announcedWaiting = false;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/jupyter/snapshots/${encodeURIComponent(managedUsername.value)}`,
        {
          headers: authHeaders(),
        },
      );
      const payload = await parseJson(response);
      snapshotState.value = {
        ...emptySnapshotState(),
        ...payload,
      };

      if (payload.status === "building" || payload.status === "pending") {
        if (notifyWaiting && !announcedWaiting) {
          Notify.create({
            type: "info",
            message: "Waiting for your latest Harbor snapshot publish before running the Jupyter Pod.",
          });
          announcedWaiting = true;
        }
        await waitForDelay(pollIntervalMs);
        continue;
      }

      if (payload.status === "failed" && notifyFailure) {
        Notify.create({
          type: "warning",
          message: "Latest Harbor snapshot publish failed. Starting with the last restorable image.",
        });
      }
      return;
    } catch (error) {
      if (notifyFailure) {
        Notify.create({
          type: "warning",
          message: `Snapshot status check failed: ${error.message}`,
        });
      }
      return;
    }
  }

  if (notifyTimeout) {
    Notify.create({
      type: "warning",
      message: "Snapshot publish is still running. Running your Jupyter Pod now.",
    });
  }
}

async function startLabSession() {
  if (!isUser.value || !managedUsername.value || sessionLoading.value) {
    return;
  }

  sessionLoading.value = true;
  try {
    await waitForSnapshotCompletion();
    const response = await fetch(`${apiBaseUrl}/api/jupyter/sessions`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        username: managedUsername.value,
      }),
    });
    const payload = await parseJson(response);
    labSession.value = {
      ...emptyLabSession(),
      ...payload,
    };
    if (labSession.value.status === "provisioning") {
      startLabPolling();
    }
    void refreshSnapshotStatus({ silent: true });
    void loadUserUsage({ silent: true });
    Notify.create({
      type: payload.status === "ready" ? "positive" : "info",
      message:
        payload.status === "ready"
          ? "Your Jupyter Pod is ready."
          : "Creating your Jupyter Pod.",
    });
  } catch (error) {
    stopLabPolling();
    Notify.create({
      type: "negative",
      message: error.message,
    });
  } finally {
    sessionLoading.value = false;
  }
}

async function stopLabSession() {
  if (!isUser.value || !managedUsername.value || sessionLoading.value) {
    return;
  }

  sessionLoading.value = true;
  try {
    const response = await fetch(
      `${apiBaseUrl}/api/jupyter/sessions/${encodeURIComponent(managedUsername.value)}`,
      {
        method: "DELETE",
        headers: authHeaders(),
      },
    );
    const payload = await parseJson(response);
    labSession.value = {
      ...emptyLabSession(),
      ...payload,
    };
    stopLabPolling();
    void refreshSnapshotStatus({ silent: true });
    if (payload.snapshot_status === "building" || payload.snapshot_status === "pending") {
      void waitForSnapshotCompletion({
        notifyWaiting: false,
        notifyFailure: false,
        notifyTimeout: false,
        timeoutMs: 180000,
      });
    }
    void loadUserUsage({ silent: true });
    let stopMessage = "Your Jupyter Pod was stopped and related resources were deleted.";
    if (payload.snapshot_status === "building" || payload.snapshot_status === "pending") {
      stopMessage += " Harbor snapshot publish started.";
    } else if (payload.snapshot_status === "ready") {
      stopMessage += " Latest Harbor snapshot is ready.";
    } else if (payload.snapshot_status === "failed") {
      stopMessage += " Harbor snapshot publish failed.";
    }
    Notify.create({
      type: "warning",
      message: stopMessage,
    });
  } catch (error) {
    Notify.create({
      type: "negative",
      message: error.message,
    });
  } finally {
    sessionLoading.value = false;
  }
}

async function refreshSnapshotStatus(options = {}) {
  if (!isUser.value || !managedUsername.value || snapshotLoading.value) {
    return;
  }

  snapshotLoading.value = true;
  try {
    const response = await fetch(
      `${apiBaseUrl}/api/jupyter/snapshots/${encodeURIComponent(managedUsername.value)}`,
      {
        headers: authHeaders(),
      },
    );
    const payload = await parseJson(response);
    snapshotState.value = {
      ...emptySnapshotState(),
      ...payload,
    };
    if (!options.silent && payload.status === "missing") {
      Notify.create({
        type: "info",
        message: "No Harbor snapshot exists for this user yet.",
      });
    }
  } catch (error) {
    Notify.create({
      type: "negative",
      message: error.message,
    });
  } finally {
    snapshotLoading.value = false;
  }
}

async function publishSnapshot() {
  if (!isUser.value || !managedUsername.value || snapshotLoading.value) {
    return;
  }

  snapshotLoading.value = true;
  try {
    const response = await fetch(`${apiBaseUrl}/api/jupyter/snapshots`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        username: managedUsername.value,
      }),
    });
    const payload = await parseJson(response);
    snapshotState.value = {
      ...emptySnapshotState(),
      ...payload,
    };
    Notify.create({
      type: payload.status === "building" ? "info" : "positive",
      message:
        payload.status === "building"
          ? "Publishing your Harbor snapshot."
          : "Latest Harbor snapshot is ready.",
    });
  } catch (error) {
    Notify.create({
      type: "negative",
      message: error.message,
    });
  } finally {
    snapshotLoading.value = false;
  }
}

async function loadAdminOverview(options = {}) {
  if (!isAdmin.value || adminLoading.value) {
    return;
  }

  adminLoading.value = true;
  try {
    const response = await fetch(`${apiBaseUrl}/api/admin/sandboxes`, {
      headers: authHeaders(),
    });
    adminOverview.value = await parseJson(response);
  } catch (error) {
    if (!options.silent) {
      Notify.create({
        type: "negative",
        message: error.message,
      });
    }
  } finally {
    adminLoading.value = false;
  }
}

async function loadControlPlaneDashboard(options = {}) {
  if (!isAdmin.value || controlPlane.value.loading) {
    return;
  }

  controlPlane.value = {
    ...controlPlane.value,
    loading: true,
  };
  try {
    const response = await api.get("/api/control-plane/dashboard", {
      params: { namespace: controlPlane.value.namespace },
      headers: authHeaders(),
    });
    const payload = response.data;
    controlPlane.value = {
      ...controlPlane.value,
      namespace: payload.summary.current_namespace,
      namespaces: payload.namespaces,
      nodes: payload.nodes,
      pods: payload.pods,
      summary: payload.summary,
    };
  } catch (error) {
    if (!options.silent) {
      Notify.create({
        type: "negative",
        message: toRequestError(error).message,
      });
    }
  } finally {
    controlPlane.value = {
      ...controlPlane.value,
      loading: false,
    };
  }
}

async function openLab() {
  if (!isUser.value || !managedUsername.value) {
    Notify.create({
      type: "warning",
      message: "User login is required.",
    });
    return;
  }
  if (!labConnectReady.value) {
    Notify.create({
      type: "warning",
      message: "Jupyter Pod is not ready yet.",
    });
    return;
  }

  const pendingWindowName = `jupyter-lab-${managedUsername.value.replace(/[^a-z0-9_-]/gi, "-")}`;
  let pendingWindow = null;
  try {
    pendingWindow = window.open("about:blank", pendingWindowName);
    if (pendingWindow && pendingWindow.document) {
      pendingWindow.document.title = "Connecting to Jupyter Pod";
      pendingWindow.document.body.innerHTML = "<p>Connecting to Jupyter Pod...</p>";
    }
  } catch {
    pendingWindow = null;
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/api/jupyter/connect/${encodeURIComponent(managedUsername.value)}`,
      {
        headers: authHeaders(),
      },
    );
    const payload = await parseJson(response);
    const redirectUrl = payload.redirect_url || "";
    if (!redirectUrl) {
      throw new Error("Jupyter Pod web URL is unavailable.");
    }

    if (pendingWindow && !pendingWindow.closed) {
      try {
        pendingWindow.opener = null;
      } catch {}
      pendingWindow.location.replace(redirectUrl);
      if (typeof pendingWindow.focus === "function") {
        pendingWindow.focus();
      }
    } else {
      window.open(redirectUrl, pendingWindowName, "noopener");
    }
  } catch (error) {
    if (pendingWindow && !pendingWindow.closed) {
      pendingWindow.close();
    }
    Notify.create({
      type: "negative",
      message: error.message,
    });
  }
}

onMounted(async () => {
  await loadDemoUsers();
  await restoreAuthSession();
  authResolved.value = true;

  if (!isAuthenticated.value) {
    loading.value = false;
    return;
  }

  await loadDashboard();
  await runFirstQuery();

  if (isUser.value) {
    await refreshLabSession({ silent: true, skipSnapshotRefresh: true });
    await refreshSnapshotStatus({ silent: true });
    if (snapshotState.value.status === "building" || snapshotState.value.status === "pending") {
      void waitForSnapshotCompletion({
        notifyWaiting: false,
        notifyFailure: false,
        notifyTimeout: false,
        timeoutMs: 180000,
      });
    }
    await loadUserUsage({ silent: true });
    await loadUserGovernanceData({ silent: true });
  }

  if (isAdmin.value) {
    await loadAdminOverview({ silent: true });
    await loadAdminGovernanceData({ silent: true });
    await loadControlPlaneDashboard({ silent: true });
    startAdminPolling();
  }
});

onUnmounted(() => {
  stopLabPolling();
  stopAdminPolling();
  if (runtimeChart) {
    runtimeChart.destroy();
    runtimeChart = null;
  }
});
</script>
