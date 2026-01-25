export const devopsTools = [
  {
    name: "generate_dockerfile",
    description: "Generate optimized Dockerfile for the project.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        framework: { type: "string", description: "Framework: express, react, next, vue, nestjs, python, go, rust" },
        target: { type: "string", description: "Target: production, development, testing" },
        optimization: { type: "string", description: "Optimization: size, speed, multi-stage" },
      },
      required: ["projectPath", "framework", "target"],
    },
  },
  {
    name: "generate_github_actions",
    description: "Generate GitHub Actions CI/CD workflow files.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        workflowType: { type: "string", description: "Workflow type: ci, cd, cicd, security, linting" },
        language: { type: "string", description: "Language: js, ts, py, go, rust" },
      },
      required: ["projectPath", "workflowType", "language"],
    },
  },
  {
    name: "k8s_manifest",
    description: "Generate Kubernetes manifests for deployment.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        deploymentType: { type: "string", description: "Type: deployment, statefulset, daemonset" },
        resources: { type: "string", description: "Resources: Deployment, Service, Ingress, ConfigMap, Secret, HPA" },
      },
      required: ["projectPath", "deploymentType"],
    },
  },
  {
    name: "terraform_module",
    description: "Generate Terraform modules for infrastructure.",
    inputSchema: {
      type: "object",
      properties: {
        infrastructureType: { type: "string", description: "Infrastructure: aws, gcp, azure, multi-cloud" },
        serviceType: { type: "string", description: "Service type: web_api, database, storage, cdn, function" },
      },
      required: ["infrastructureType", "serviceType"],
    },
  },
];
