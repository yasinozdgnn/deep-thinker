export const projectTools = [
  {
    name: "create_project",
    description: "Create boilerplate project structure.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Where to create project" },
        projectType: { type: "string", description: "Type: express, react, node, python" },
        projectName: { type: "string", description: "Project name" },
      },
      required: ["projectPath", "projectType", "projectName"],
    },
  },
  {
    name: "add_dependency",
    description: "Add and explain a npm dependency.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project path with package.json" },
        packageName: { type: "string", description: "Package to add" },
        isDev: { type: "boolean", description: "Add as devDependency" },
      },
      required: ["projectPath", "packageName"],
    },
  },
  {
    name: "architecture_review",
    description: "Review architecture and provide recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        reviewType: { type: "string", description: "Review type: scalability, maintainability, security, performance, all" },
      },
      required: ["projectPath", "reviewType"],
    },
  },
  {
    name: "tech_stack_migration",
    description: "Guide tech stack migration.",
    inputSchema: {
      type: "object",
      properties: {
        currentStack: { type: "string", description: "Current tech stack" },
        targetStack: { type: "string", description: "Target tech stack" },
        projectType: { type: "string", description: "Project type: frontend, backend, fullstack" },
      },
      required: ["currentStack", "targetStack", "projectType"],
    },
  },
  {
    name: "scaling_strategy",
    description: "Design scaling strategy for the project.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root path" },
        scaleTarget: { type: "string", description: "Scale target: 1000, 10000, 100000, 1000000" },
        metric: { type: "string", description: "Metric: concurrent_users, requests_per_second" },
      },
      required: ["projectPath", "scaleTarget", "metric"],
    },
  },
  {
    name: "cost_optimization",
    description: "Optimize cloud infrastructure costs.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", description: "Cloud platform: aws, gcp, azure" },
        services: { type: "string", description: "List of services used" },
        usagePattern: { type: "string", description: "Usage pattern description" },
      },
      required: ["platform", "services"],
    },
  },
];
