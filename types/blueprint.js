export const BlueprintSchema = {
  project_name: { type: 'string', required: true },
  tech_stack: { type: 'array', items: 'string', required: true },
  architecture: {
    type: 'object',
    required: true,
    properties: {
      database: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['relational', 'document', 'graph', 'key-value'] },
          provider: { type: 'string' },
          schema_visual: { type: 'string' },
          tables: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                columns: { type: 'array', items: 'string' },
                relations: { type: 'array', items: 'string' },
                indexes: { type: 'array', items: 'string' }
              }
            }
          }
        }
      },
      backend: {
        type: 'object',
        properties: {
          structure: { type: 'string' },
          framework: { type: 'string' },
          endpoints: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
                purpose: { type: 'string' },
                auth: { type: 'boolean' },
                params: { type: 'array', items: 'string' }
              }
            }
          },
          services: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                responsibility: { type: 'string' },
                dependencies: { type: 'array', items: 'string' }
              }
            }
          }
        }
      },
      frontend: {
        type: 'object',
        properties: {
          framework: { type: 'string' },
          state_management: { type: 'string' },
          styling: { type: 'string' },
          component_tree: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string', enum: ['page', 'layout', 'component', 'hook', 'context'] },
                props: { type: 'array', items: 'string' },
                parent: { type: 'string' },
                children: { type: 'array', items: 'string' }
              }
            }
          },
          routes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                component: { type: 'string' },
                auth: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  },
  execution_steps: { type: 'array', items: 'string', required: true },
  metadata: {
    type: 'object',
    properties: {
      version: { type: 'string' },
      created_at: { type: 'string' },
      author: { type: 'string' }
    }
  }
};

export function createEmptyBlueprint(projectName = 'Untitled Project') {
  return {
    project_name: projectName,
    tech_stack: [],
    architecture: {
      database: {
        type: 'relational',
        provider: 'PostgreSQL',
        schema_visual: '',
        tables: []
      },
      backend: {
        structure: 'API Routes',
        framework: 'Next.js',
        endpoints: [],
        services: []
      },
      frontend: {
        framework: 'Next.js',
        state_management: 'Zustand',
        styling: 'Tailwind CSS',
        component_tree: [],
        routes: []
      }
    },
    execution_steps: [],
    metadata: {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      author: 'Architect Agent'
    }
  };
}

export function validateBlueprint(blueprint) {
  const errors = [];

  if (!blueprint.project_name || typeof blueprint.project_name !== 'string') {
    errors.push('project_name is required and must be a string');
  }

  if (!Array.isArray(blueprint.tech_stack)) {
    errors.push('tech_stack must be an array');
  }

  if (!blueprint.architecture || typeof blueprint.architecture !== 'object') {
    errors.push('architecture is required and must be an object');
  } else {
    if (blueprint.architecture.database) {
      if (blueprint.architecture.database.tables && !Array.isArray(blueprint.architecture.database.tables)) {
        errors.push('architecture.database.tables must be an array');
      }
    }

    if (blueprint.architecture.backend) {
      if (blueprint.architecture.backend.endpoints && !Array.isArray(blueprint.architecture.backend.endpoints)) {
        errors.push('architecture.backend.endpoints must be an array');
      }
    }

    if (blueprint.architecture.frontend) {
      if (blueprint.architecture.frontend.component_tree && !Array.isArray(blueprint.architecture.frontend.component_tree)) {
        errors.push('architecture.frontend.component_tree must be an array');
      }
    }
  }

  if (!Array.isArray(blueprint.execution_steps)) {
    errors.push('execution_steps must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function mergeBlueprints(base, updates) {
  const merged = JSON.parse(JSON.stringify(base));

  if (updates.project_name) merged.project_name = updates.project_name;
  if (updates.tech_stack) merged.tech_stack = [...new Set([...merged.tech_stack, ...updates.tech_stack])];

  if (updates.architecture) {
    if (updates.architecture.database) {
      merged.architecture.database = { ...merged.architecture.database, ...updates.architecture.database };
      if (updates.architecture.database.tables) {
        merged.architecture.database.tables = updates.architecture.database.tables;
      }
    }

    if (updates.architecture.backend) {
      merged.architecture.backend = { ...merged.architecture.backend, ...updates.architecture.backend };
      if (updates.architecture.backend.endpoints) {
        merged.architecture.backend.endpoints = updates.architecture.backend.endpoints;
      }
      if (updates.architecture.backend.services) {
        merged.architecture.backend.services = updates.architecture.backend.services;
      }
    }

    if (updates.architecture.frontend) {
      merged.architecture.frontend = { ...merged.architecture.frontend, ...updates.architecture.frontend };
      if (updates.architecture.frontend.component_tree) {
        merged.architecture.frontend.component_tree = updates.architecture.frontend.component_tree;
      }
      if (updates.architecture.frontend.routes) {
        merged.architecture.frontend.routes = updates.architecture.frontend.routes;
      }
    }
  }

  if (updates.execution_steps) {
    merged.execution_steps = updates.execution_steps;
  }

  merged.metadata = {
    ...merged.metadata,
    ...updates.metadata,
    updated_at: new Date().toISOString()
  };

  return merged;
}

export function blueprintToSummary(blueprint) {
  const { project_name, tech_stack, architecture, execution_steps } = blueprint;
  
  const tableCount = architecture.database?.tables?.length || 0;
  const endpointCount = architecture.backend?.endpoints?.length || 0;
  const componentCount = architecture.frontend?.component_tree?.length || 0;

  return {
    name: project_name,
    stack: tech_stack.join(', '),
    stats: {
      tables: tableCount,
      endpoints: endpointCount,
      components: componentCount,
      steps: execution_steps.length
    },
    complexity: calculateComplexity(blueprint)
  };
}

function calculateComplexity(blueprint) {
  const { architecture, execution_steps } = blueprint;
  
  let score = 0;
  
  score += (architecture.database?.tables?.length || 0) * 2;
  score += (architecture.backend?.endpoints?.length || 0);
  score += (architecture.backend?.services?.length || 0) * 1.5;
  score += (architecture.frontend?.component_tree?.length || 0) * 0.5;
  score += execution_steps.length;

  if (score < 10) return 'simple';
  if (score < 25) return 'medium';
  if (score < 50) return 'complex';
  return 'enterprise';
}
