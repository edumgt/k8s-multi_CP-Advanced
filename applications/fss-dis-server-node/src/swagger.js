export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "FSS DIS Server API",
    version: "0.1.0",
    description:
      "Jupyter governance & ADW platform API. MongoDB: `adw` DB. All protected endpoints require `Authorization: Bearer <token>`.",
  },
  servers: [{ url: "/fss-dis-server", description: "Backend base path" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "hex",
        description: "Token from POST /api/auth/login",
      },
    },
    schemas: {
      // ── MongoDB model shapes ────────────────────────────────────────────
      User: {
        type: "object",
        properties: {
          _id: { type: "string", example: "69e6f0a8da56cf1116e14b2b" },
          username: { type: "string", example: "test-admin" },
          role: { type: "string", enum: ["user", "admin"] },
          displayName: { type: "string", example: "ADMIN" },
          builtIn: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      UserMetric: {
        type: "object",
        properties: {
          username: { type: "string" },
          displayName: { type: "string" },
          role: { type: "string" },
          loginCount: { type: "integer" },
          launchCount: { type: "integer" },
          totalSessionSeconds: { type: "integer" },
          activeSince: { type: "string", format: "date-time", nullable: true },
          lastLoginAt: { type: "string", format: "date-time", nullable: true },
          lastLaunchAt: { type: "string", format: "date-time", nullable: true },
          lastSeenStatus: { type: "string", example: "idle" },
        },
      },
      AnalysisEnvironment: {
        type: "object",
        properties: {
          envId: { type: "string", example: "jupyter-default" },
          name: { type: "string", example: "Default Jupyter" },
          image: { type: "string", example: "192.168.56.32/app/jupyter:latest" },
          description: { type: "string" },
          gpuEnabled: { type: "boolean" },
          isActive: { type: "boolean" },
          updatedBy: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ResourceRequest: {
        type: "object",
        properties: {
          requestId: { type: "string" },
          username: { type: "string" },
          vcpu: { type: "number", example: 2 },
          memoryGib: { type: "number", example: 4 },
          diskGib: { type: "number", example: 10 },
          requestNote: { type: "string" },
          status: { type: "string", enum: ["pending", "approved", "rejected"] },
          reviewNote: { type: "string" },
          reviewedBy: { type: "string", nullable: true },
          pvcName: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ResourceAllocation: {
        type: "object",
        properties: {
          username: { type: "string" },
          vcpu: { type: "number" },
          memoryGib: { type: "number" },
          diskGib: { type: "number" },
          pvcName: { type: "string" },
          approvedBy: { type: "string" },
          approvedAt: { type: "string", format: "date-time" },
        },
      },
      EnvironmentRequest: {
        type: "object",
        properties: {
          requestId: { type: "string" },
          username: { type: "string" },
          envId: { type: "string" },
          requestNote: { type: "string" },
          status: { type: "string", enum: ["pending", "approved", "rejected"] },
          reviewNote: { type: "string" },
          reviewedBy: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      EnvironmentAssignment: {
        type: "object",
        properties: {
          username: { type: "string" },
          envId: { type: "string" },
          image: { type: "string" },
          approvedBy: { type: "string" },
          approvedAt: { type: "string", format: "date-time" },
        },
      },
      JupyterSessionSummary: {
        type: "object",
        properties: {
          session_id: { type: "string" },
          username: { type: "string" },
          namespace: { type: "string" },
          pod_name: { type: "string" },
          service_name: { type: "string", nullable: true },
          headless_service: { type: "string", nullable: true, example: "jupyter-named-pod" },
          image: { type: "string" },
          status: { type: "string", enum: ["provisioning", "ready", "failed", "missing"] },
          phase: { type: "string", example: "Running" },
          ready: { type: "boolean" },
          detail: { type: "string" },
          node_port: { type: "integer", nullable: true },
          created_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      JupyterPodItem: {
        type: "object",
        properties: {
          username: { type: "string" },
          pod_name: { type: "string" },
          namespace: { type: "string" },
          service_name: { type: "string", nullable: true },
          headless_service: { type: "string", nullable: true, example: "jupyter-named-pod" },
          workspace_subpath: { type: "string" },
          image: { type: "string" },
          status: { type: "string", enum: ["provisioning", "ready", "failed", "missing"] },
          phase: { type: "string", example: "Running" },
          ready: { type: "boolean" },
          detail: { type: "string" },
          node_port: { type: "integer", nullable: true },
          created_at: { type: "string", format: "date-time", nullable: true },
          updated_at: { type: "string", format: "date-time", nullable: true },
          source: { type: "string", example: "k8s-session" },
        },
      },
      K8sNode: {
        type: "object",
        properties: {
          name: { type: "string", example: "worker-1" },
          ready: { type: "boolean" },
          roles: { type: "string", example: "worker" },
          version: { type: "string", example: "v1.29.0" },
          internal_ip: { type: "string", example: "192.168.56.13" },
          os_image: { type: "string" },
          kernel_version: { type: "string" },
          container_runtime: { type: "string" },
          created_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      K8sPod: {
        type: "object",
        properties: {
          namespace: { type: "string" },
          name: { type: "string" },
          ready: { type: "string", example: "1/1" },
          status: { type: "string", example: "Running" },
          restarts: { type: "integer" },
          node_name: { type: "string" },
          pod_ip: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      K8sService: {
        type: "object",
        properties: {
          namespace: { type: "string" },
          name: { type: "string" },
          type: { type: "string", example: "ClusterIP" },
          cluster_ip: { type: "string" },
          ports: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                port: { type: "integer" },
                target_port: { type: "string" },
                protocol: { type: "string" },
              },
            },
          },
          created_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      K8sDeployment: {
        type: "object",
        properties: {
          namespace: { type: "string" },
          name: { type: "string" },
          replicas: { type: "integer" },
          ready_replicas: { type: "integer" },
          available_replicas: { type: "integer" },
          image: { type: "string" },
          created_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      K8sPVC: {
        type: "object",
        properties: {
          namespace: { type: "string" },
          name: { type: "string" },
          status: { type: "string", example: "Bound" },
          volume: { type: "string" },
          capacity: { type: "string", example: "10Gi" },
          access_modes: { type: "array", items: { type: "string" } },
          storage_class: { type: "string" },
          created_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      K8sEvent: {
        type: "object",
        properties: {
          namespace: { type: "string" },
          name: { type: "string" },
          reason: { type: "string" },
          message: { type: "string" },
          type: { type: "string", example: "Normal" },
          count: { type: "integer" },
          involved_object: {
            type: "object",
            properties: {
              kind: { type: "string" },
              name: { type: "string" },
              namespace: { type: "string" },
            },
          },
          last_timestamp: { type: "string", format: "date-time", nullable: true },
        },
      },
      K8sNodeMetrics: {
        type: "object",
        properties: {
          name: { type: "string" },
          cpu: { type: "string", example: "250m" },
          memory: { type: "string", example: "512Mi" },
          cpu_milli: { type: "integer" },
          memory_bytes: { type: "integer" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      K8sPodMetrics: {
        type: "object",
        properties: {
          namespace: { type: "string" },
          name: { type: "string" },
          cpu_milli: { type: "integer" },
          memory_bytes: { type: "integer" },
          containers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                cpu: { type: "string" },
                memory: { type: "string" },
              },
            },
          },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: { detail: { type: "string" } },
      },
    },
  },
  security: [],
  paths: {
    // ── Health ──────────────────────────────────────────────────────────
    "/healthz": {
      get: {
        tags: ["Health"],
        summary: "Readiness probe — MongoDB + Redis connectivity",
        responses: {
          200: {
            description: "ok or degraded",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["ok", "degraded"] },
                    backend_version: { type: "string" },
                    checks: {
                      type: "object",
                      properties: {
                        mongodb: {
                          type: "object",
                          properties: { ok: { type: "boolean" }, detail: { type: "string" } },
                        },
                        redis: {
                          type: "object",
                          properties: { ok: { type: "boolean" }, detail: { type: "string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/livez": {
      get: {
        tags: ["Health"],
        summary: "Liveness probe",
        responses: {
          200: {
            description: "always ok",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    backend_version: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    // ── Auth ─────────────────────────────────────────────────────────────
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login — returns Bearer token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string", example: "test-admin" },
                  password: { type: "string", example: "123456", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    access_token: { type: "string" },
                    token_type: { type: "string" },
                    expires_in: { type: "integer" },
                    token: { type: "string" },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          401: { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current authenticated user",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Current user info",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: {
                      type: "object",
                      properties: {
                        username: { type: "string" },
                        role: { type: "string" },
                        display_name: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout — invalidate session token",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "ok", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" } } } } } },
        },
      },
    },
    // ── Users ─────────────────────────────────────────────────────────────
    "/api/demo-users": {
      get: {
        tags: ["Users"],
        summary: "List all users (public — no auth required)",
        responses: {
          200: {
            description: "User list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/User" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/users": {
      get: {
        tags: ["Users"],
        summary: "List users (admin only)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "User list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/User" } },
                  },
                },
              },
            },
          },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Create a managed user (admin only)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string", example: "new-user" },
                  password: { type: "string", format: "password" },
                  role: { type: "string", enum: ["user", "admin"], default: "user" },
                  display_name: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Created user", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
        },
      },
    },
    // ── Dashboard ─────────────────────────────────────────────────────────
    "/api/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Platform dashboard info (services, runtime, links)",
        responses: {
          200: { description: "Dashboard payload" },
        },
      },
    },
    // ── Analysis Environments ─────────────────────────────────────────────
    "/api/analysis-environments": {
      get: {
        tags: ["Environments"],
        summary: "List active analysis environments",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Active environments",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/AnalysisEnvironment" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/analysis-environments": {
      get: {
        tags: ["Environments"],
        summary: "List all analysis environments including inactive (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "include_inactive",
            in: "query",
            schema: { type: "boolean", default: true },
          },
        ],
        responses: {
          200: {
            description: "All environments",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/AnalysisEnvironment" } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Environments"],
        summary: "Create or update an analysis environment (admin)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["envId", "name", "image"],
                properties: {
                  envId: { type: "string", example: "jupyter-gpu" },
                  name: { type: "string", example: "GPU Jupyter" },
                  image: { type: "string", example: "192.168.56.32/app/jupyter:gpu" },
                  description: { type: "string" },
                  gpuEnabled: { type: "boolean", default: false },
                  isActive: { type: "boolean", default: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated list of environments" },
        },
      },
    },
    // ── Resource Requests ─────────────────────────────────────────────────
    "/api/resource-requests": {
      post: {
        tags: ["Resource Requests"],
        summary: "Submit a resource allocation request",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["vcpu", "memoryGib", "diskGib"],
                properties: {
                  vcpu: { type: "number", example: 2 },
                  memoryGib: { type: "number", example: 4 },
                  diskGib: { type: "number", example: 20 },
                  requestNote: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Created request", content: { "application/json": { schema: { $ref: "#/components/schemas/ResourceRequest" } } } },
        },
      },
    },
    "/api/resource-requests/me": {
      get: {
        tags: ["Resource Requests"],
        summary: "My resource requests",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "List of my requests",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/ResourceRequest" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/resource-requests": {
      get: {
        tags: ["Resource Requests"],
        summary: "All resource requests (admin)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "All requests",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/ResourceRequest" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/resource-requests/{request_id}/review": {
      post: {
        tags: ["Resource Requests"],
        summary: "Approve or reject a resource request (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "request_id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["approved"],
                properties: {
                  approved: { type: "boolean" },
                  note: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Reviewed request", content: { "application/json": { schema: { $ref: "#/components/schemas/ResourceRequest" } } } },
        },
      },
    },
    // ── Environment Requests ──────────────────────────────────────────────
    "/api/environment-requests": {
      post: {
        tags: ["Environment Requests"],
        summary: "Submit an environment access request",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["envId"],
                properties: {
                  envId: { type: "string", example: "jupyter-default" },
                  requestNote: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Created request", content: { "application/json": { schema: { $ref: "#/components/schemas/EnvironmentRequest" } } } },
        },
      },
    },
    "/api/environment-requests/me": {
      get: {
        tags: ["Environment Requests"],
        summary: "My environment requests",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "List",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/EnvironmentRequest" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/environment-requests": {
      get: {
        tags: ["Environment Requests"],
        summary: "All environment requests (admin)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "All requests",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/EnvironmentRequest" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/environment-requests/{request_id}/review": {
      post: {
        tags: ["Environment Requests"],
        summary: "Approve or reject an environment request (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "request_id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["approved"],
                properties: {
                  approved: { type: "boolean" },
                  note: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Reviewed request", content: { "application/json": { schema: { $ref: "#/components/schemas/EnvironmentRequest" } } } },
        },
      },
    },
    // ── Jupyter / Lab ────────────────────────────────────────────────────
    "/api/users/me/lab-policy": {
      get: {
        tags: ["Jupyter"],
        summary: "My lab resource policy (approved quota + environment)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Lab policy" },
        },
      },
    },
    "/api/jupyter/sessions": {
      post: {
        tags: ["Jupyter"],
        summary: "Launch / ensure JupyterLab session pod",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  username: { type: "string", description: "Admin can specify another user" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Session summary", content: { "application/json": { schema: { $ref: "#/components/schemas/JupyterSessionSummary" } } } },
        },
      },
    },
    "/api/jupyter/sessions/{username}": {
      get: {
        tags: ["Jupyter"],
        summary: "Get session status for a user",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "username", in: "path", required: true, schema: { type: "string" }, example: "test-user" },
        ],
        responses: {
          200: { description: "Session summary", content: { "application/json": { schema: { $ref: "#/components/schemas/JupyterSessionSummary" } } } },
        },
      },
      delete: {
        tags: ["Jupyter"],
        summary: "Stop and delete a user's JupyterLab session",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "username", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Deletion summary" },
        },
      },
    },
    "/api/jupyter/pods/{username}": {
      get: {
        tags: ["Jupyter"],
        summary: "List the user's personal Jupyter pod status from Kubernetes session state",
        description:
          "After executing this request in Swagger UI, a `Jupyter Open` button appears under the response area and opens the user's Jupyter web session in a new tab.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "username", in: "path", required: true, schema: { type: "string" }, example: "test-user" },
        ],
        responses: {
          200: {
            description: "Pod list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/JupyterPodItem" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/jupyter/connect/{username}": {
      get: {
        tags: ["Jupyter"],
        summary: "Get connect URL and token for a user's JupyterLab",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "username", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Connect payload with URL and token" },
        },
      },
    },
    "/api/jupyter/snapshots/{username}": {
      get: {
        tags: ["Jupyter"],
        summary: "Get snapshot status for a user",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "username", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Snapshot status" },
        },
      },
    },
    "/api/jupyter/snapshots": {
      post: {
        tags: ["Jupyter"],
        summary: "Publish a workspace snapshot",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  username: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Snapshot result" },
        },
      },
    },
    // ── Usage ─────────────────────────────────────────────────────────────
    "/api/users/me/usage": {
      get: {
        tags: ["Usage"],
        summary: "My lab usage summary (from adw.usermetrics)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Usage payload" },
        },
      },
    },
    "/api/admin/sandboxes": {
      get: {
        tags: ["Usage"],
        summary: "Admin overview of all sandboxes (admin)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Admin overview" },
        },
      },
    },
    // ── Control Plane ─────────────────────────────────────────────────────
    "/api/control-plane/login": {
      post: {
        tags: ["Control Plane"],
        summary: "Login to control-plane dashboard (separate credentials)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string", example: "admin@test.com" },
                  password: { type: "string", format: "password", example: "123456" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Token + dashboard" },
          401: { description: "Login failed" },
        },
      },
    },
    "/api/control-plane/dashboard": {
      get: {
        tags: ["Control Plane"],
        summary: "K8s cluster dashboard — nodes, pods, namespaces",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "namespace",
            in: "query",
            schema: { type: "string" },
            description: "Filter pods by namespace (empty = all)",
          },
        ],
        responses: {
          200: {
            description: "Cluster dashboard",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    summary: {
                      type: "object",
                      properties: {
                        cluster_name: { type: "string" },
                        namespace_count: { type: "integer" },
                        node_count: { type: "integer" },
                        ready_node_count: { type: "integer" },
                        pod_count: { type: "integer" },
                        running_pod_count: { type: "integer" },
                      },
                    },
                    namespaces: { type: "array", items: { type: "string" } },
                    nodes: { type: "array", items: { $ref: "#/components/schemas/K8sNode" } },
                    pods: { type: "array", items: { $ref: "#/components/schemas/K8sPod" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    // ── K8s Resource Query API (examples using @kubernetes/client-node) ──
    "/api/k8s/namespaces": {
      get: {
        tags: ["K8s Resources"],
        summary: "List all namespaces (admin)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Namespace list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          status: { type: "string" },
                          labels: { type: "object" },
                          created_at: { type: "string", format: "date-time", nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/k8s/nodes": {
      get: {
        tags: ["K8s Resources"],
        summary: "List all nodes with conditions and resource info (admin)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Node list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/K8sNode" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/k8s/pods": {
      get: {
        tags: ["K8s Resources"],
        summary: "List pods (optionally filter by namespace, admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "namespace",
            in: "query",
            schema: { type: "string" },
            description: "Namespace to filter (empty = all namespaces)",
            example: "dis",
          },
          {
            name: "label",
            in: "query",
            schema: { type: "string" },
            description: "Label selector (e.g. app=jupyter-session)",
          },
        ],
        responses: {
          200: {
            description: "Pod list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    namespace: { type: "string", nullable: true },
                    items: { type: "array", items: { $ref: "#/components/schemas/K8sPod" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/k8s/pods/{namespace}/{name}": {
      get: {
        tags: ["K8s Resources"],
        summary: "Get a specific pod by namespace and name (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "namespace", in: "path", required: true, schema: { type: "string" }, example: "dis" },
          { name: "name", in: "path", required: true, schema: { type: "string" }, example: "lab-test-user-c56486f8-a1" },
        ],
        responses: {
          200: { description: "Pod detail (raw k8s object)" },
          404: { description: "Not found" },
        },
      },
    },
    "/api/k8s/services": {
      get: {
        tags: ["K8s Resources"],
        summary: "List services (optionally filter by namespace, admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "namespace",
            in: "query",
            schema: { type: "string" },
            description: "Namespace to filter (empty = all namespaces)",
          },
        ],
        responses: {
          200: {
            description: "Service list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/K8sService" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/k8s/deployments": {
      get: {
        tags: ["K8s Resources"],
        summary: "List deployments (optionally filter by namespace, admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "namespace",
            in: "query",
            schema: { type: "string" },
            description: "Namespace to filter (empty = all namespaces)",
          },
        ],
        responses: {
          200: {
            description: "Deployment list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/K8sDeployment" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/k8s/pvcs": {
      get: {
        tags: ["K8s Resources"],
        summary: "List PersistentVolumeClaims (optionally filter by namespace, admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "namespace",
            in: "query",
            schema: { type: "string" },
            description: "Namespace to filter (empty = all namespaces)",
          },
        ],
        responses: {
          200: {
            description: "PVC list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/K8sPVC" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/k8s/events": {
      get: {
        tags: ["K8s Resources"],
        summary: "List recent events (optionally filter by namespace, admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "namespace",
            in: "query",
            schema: { type: "string" },
            description: "Namespace to filter (empty = all namespaces)",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50 },
          },
        ],
        responses: {
          200: {
            description: "Event list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/K8sEvent" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/k8s/metrics/nodes": {
      get: {
        tags: ["K8s Resources"],
        summary: "Live node CPU/memory usage via metrics-server (metrics.k8s.io, admin)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Node metrics",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/K8sNodeMetrics" } },
                  },
                },
              },
            },
          },
          503: { description: "metrics-server unavailable" },
        },
      },
    },
    "/api/k8s/metrics/pods": {
      get: {
        tags: ["K8s Resources"],
        summary: "Live pod CPU/memory usage via metrics-server (metrics.k8s.io, admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "namespace",
            in: "query",
            schema: { type: "string" },
            description: "Namespace to filter (empty = all namespaces)",
          },
        ],
        responses: {
          200: {
            description: "Pod metrics",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/K8sPodMetrics" } },
                  },
                },
              },
            },
          },
          503: { description: "metrics-server unavailable" },
        },
      },
    },
  },
};
