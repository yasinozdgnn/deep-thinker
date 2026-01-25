export const architectTools = [
  {
    name: 'design_system',
    description: 'Design complete system architecture with database, backend, and frontend layers. Creates a detailed ProjectBlueprint JSON and optionally saves ARCHITECTURE.md documentation.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Absolute path to the project directory. If provided, ARCHITECTURE.md will be saved here.'
        },
        requirements: {
          type: 'string',
          description: 'Detailed description of what system to build. Be specific about features and requirements.'
        },
        techStackPreference: {
          type: 'array',
          items: { type: 'string' },
          description: 'Preferred technology stack (e.g., ["Next.js", "Prisma", "PostgreSQL", "Tailwind"])'
        }
      },
      required: ['requirements']
    }
  },
  {
    name: 'analyze_architecture',
    description: 'Analyze existing project architecture and identify patterns, technologies, and improvement opportunities.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Absolute path to the project to analyze.'
        }
      },
      required: ['projectPath']
    }
  },
  {
    name: 'generate_blueprint',
    description: 'Generate a ProjectBlueprint JSON from requirements without saving any files. Useful for planning phase.',
    inputSchema: {
      type: 'object',
      properties: {
        requirements: {
          type: 'string',
          description: 'System requirements description.'
        },
        projectName: {
          type: 'string',
          description: 'Name for the project.'
        },
        techStack: {
          type: 'array',
          items: { type: 'string' },
          description: 'Technology stack to use.'
        }
      },
      required: ['requirements']
    }
  },
  {
    name: 'visualize_architecture',
    description: 'Generate ARCHITECTURE.md with Mermaid diagrams from the current blueprint. Must run design_system first.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to save ARCHITECTURE.md file.'
        }
      },
      required: []
    }
  },
  {
    name: 'get_blueprint_summary',
    description: 'Get a summary of the current active blueprint including stats and complexity rating.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];
