export function generateERDiagram(tables) {
  if (!tables || tables.length === 0) {
    return '```mermaid\nerDiagram\n    EMPTY["No tables defined"]\n```';
  }

  let diagram = '```mermaid\nerDiagram\n';

  const relationMap = new Map();

  for (const table of tables) {
    const tableName = sanitizeMermaidId(table.name);
    
    diagram += `    ${tableName} {\n`;
    
    if (table.columns && table.columns.length > 0) {
      for (const col of table.columns) {
        const colType = inferColumnType(col);
        const colName = sanitizeMermaidId(col);
        diagram += `        ${colType} ${colName}\n`;
      }
    }
    
    diagram += '    }\n';

    if (table.relations && table.relations.length > 0) {
      for (const relation of table.relations) {
        const parsed = parseRelation(relation, tableName);
        if (parsed) {
          const key = [parsed.from, parsed.to].sort().join('-');
          if (!relationMap.has(key)) {
            relationMap.set(key, parsed);
          }
        }
      }
    }
  }

  for (const rel of relationMap.values()) {
    diagram += `    ${rel.from} ${rel.cardinality} ${rel.to} : "${rel.label}"\n`;
  }

  diagram += '```';
  return diagram;
}

export function generateFlowchart(steps, direction = 'TD') {
  if (!steps || steps.length === 0) {
    return '```mermaid\ngraph TD\n    EMPTY["No steps defined"]\n```';
  }

  let diagram = `\`\`\`mermaid\ngraph ${direction}\n`;

  for (let i = 0; i < steps.length; i++) {
    const stepId = `S${i}`;
    const stepText = sanitizeMermaidLabel(steps[i]);
    
    const shape = determineStepShape(steps[i]);
    diagram += `    ${stepId}${shape.open}"${stepText}"${shape.close}\n`;
  }

  for (let i = 0; i < steps.length - 1; i++) {
    diagram += `    S${i} --> S${i + 1}\n`;
  }

  diagram += '```';
  return diagram;
}

export function generateComponentTree(components) {
  if (!components || components.length === 0) {
    return '```mermaid\ngraph TD\n    EMPTY["No components defined"]\n```';
  }

  let diagram = '```mermaid\ngraph TD\n';

  const componentMap = new Map();
  for (const comp of components) {
    componentMap.set(comp.name, comp);
  }

  for (const comp of components) {
    const compId = sanitizeMermaidId(comp.name);
    const compLabel = comp.name;
    const shape = getComponentShape(comp.type);
    
    diagram += `    ${compId}${shape.open}"${compLabel}"${shape.close}\n`;
  }

  for (const comp of components) {
    if (comp.parent) {
      const parentId = sanitizeMermaidId(comp.parent);
      const compId = sanitizeMermaidId(comp.name);
      diagram += `    ${parentId} --> ${compId}\n`;
    }
    
    if (comp.children && comp.children.length > 0) {
      for (const child of comp.children) {
        const compId = sanitizeMermaidId(comp.name);
        const childId = sanitizeMermaidId(child);
        diagram += `    ${compId} --> ${childId}\n`;
      }
    }
  }

  diagram += '```';
  return diagram;
}

export function generateEndpointDiagram(endpoints) {
  if (!endpoints || endpoints.length === 0) {
    return '```mermaid\ngraph LR\n    EMPTY["No endpoints defined"]\n```';
  }

  let diagram = '```mermaid\ngraph LR\n';
  
  diagram += '    CLIENT[("Client")]\n';
  diagram += '    API["API Gateway"]\n';
  diagram += '    CLIENT --> API\n\n';

  const groupedEndpoints = groupEndpointsByResource(endpoints);

  for (const [resource, eps] of Object.entries(groupedEndpoints)) {
    const resourceId = sanitizeMermaidId(resource);
    diagram += `    subgraph ${resourceId}["${resource}"]\n`;
    
    for (let i = 0; i < eps.length; i++) {
      const ep = eps[i];
      const epId = `${resourceId}_${i}`;
      const methodColor = getMethodStyle(ep.method);
      diagram += `        ${epId}["${ep.method} ${ep.path}"]\n`;
    }
    
    diagram += '    end\n';
    diagram += `    API --> ${resourceId}\n`;
  }

  diagram += '```';
  return diagram;
}

export function generateArchitectureDiagram(blueprint) {
  let diagram = '```mermaid\ngraph TB\n';
  
  diagram += '    subgraph Frontend["🖥️ Frontend"]\n';
  if (blueprint.architecture.frontend) {
    diagram += `        FW["${blueprint.architecture.frontend.framework || 'Framework'}"]\n`;
    diagram += `        SM["${blueprint.architecture.frontend.state_management || 'State'}"]\n`;
    diagram += `        ST["${blueprint.architecture.frontend.styling || 'Styles'}"]\n`;
  }
  diagram += '    end\n\n';

  diagram += '    subgraph Backend["⚙️ Backend"]\n';
  if (blueprint.architecture.backend) {
    diagram += `        API["${blueprint.architecture.backend.framework || 'API'}"]\n`;
    if (blueprint.architecture.backend.services) {
      for (const svc of blueprint.architecture.backend.services) {
        const svcId = sanitizeMermaidId(svc.name);
        diagram += `        ${svcId}["${svc.name}"]\n`;
      }
    }
  }
  diagram += '    end\n\n';

  diagram += '    subgraph Database["🗄️ Database"]\n';
  if (blueprint.architecture.database) {
    diagram += `        DB[("${blueprint.architecture.database.provider || 'Database'}")]\n`;
  }
  diagram += '    end\n\n';

  diagram += '    Frontend --> Backend\n';
  diagram += '    Backend --> Database\n';

  diagram += '```';
  return diagram;
}

function sanitizeMermaidId(str) {
  return str.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
}

function sanitizeMermaidLabel(str) {
  return str.replace(/"/g, "'").replace(/[\[\]{}]/g, '').substring(0, 50);
}

function inferColumnType(columnName) {
  const lowerName = columnName.toLowerCase();
  
  if (lowerName === 'id' || lowerName.endsWith('_id')) return 'int';
  if (lowerName.includes('email')) return 'string';
  if (lowerName.includes('password') || lowerName.includes('hash')) return 'string';
  if (lowerName.includes('date') || lowerName.includes('_at')) return 'datetime';
  if (lowerName.includes('is_') || lowerName.includes('has_')) return 'boolean';
  if (lowerName.includes('price') || lowerName.includes('amount')) return 'decimal';
  if (lowerName.includes('count') || lowerName.includes('quantity')) return 'int';
  
  return 'string';
}

function parseRelation(relationStr, fromTable) {
  const patterns = [
    { regex: /hasMany\s+(\w+)/i, cardinality: '||--o{', label: 'has many' },
    { regex: /hasOne\s+(\w+)/i, cardinality: '||--||', label: 'has one' },
    { regex: /belongsTo\s+(\w+)/i, cardinality: '}o--||', label: 'belongs to' },
    { regex: /manyToMany\s+(\w+)/i, cardinality: '}o--o{', label: 'many to many' }
  ];

  for (const pattern of patterns) {
    const match = relationStr.match(pattern.regex);
    if (match) {
      return {
        from: sanitizeMermaidId(fromTable),
        to: sanitizeMermaidId(match[1]),
        cardinality: pattern.cardinality,
        label: pattern.label
      };
    }
  }

  return null;
}

function determineStepShape(stepText) {
  const lower = stepText.toLowerCase();
  
  if (lower.includes('if') || lower.includes('check') || lower.includes('validate')) {
    return { open: '{', close: '}' };
  }
  if (lower.includes('start') || lower.includes('begin')) {
    return { open: '([', close: '])' };
  }
  if (lower.includes('end') || lower.includes('finish') || lower.includes('complete')) {
    return { open: '([', close: '])' };
  }
  if (lower.includes('database') || lower.includes('db') || lower.includes('store')) {
    return { open: '[(', close: ')]' };
  }
  
  return { open: '[', close: ']' };
}

function getComponentShape(type) {
  switch (type) {
    case 'page': return { open: '([', close: '])' };
    case 'layout': return { open: '[[', close: ']]' };
    case 'hook': return { open: '{{', close: '}}' };
    case 'context': return { open: '[(', close: ')]' };
    default: return { open: '[', close: ']' };
  }
}

function groupEndpointsByResource(endpoints) {
  const groups = {};
  
  for (const ep of endpoints) {
    const pathParts = ep.path.split('/').filter(Boolean);
    const resource = pathParts[1] || pathParts[0] || 'root';
    
    if (!groups[resource]) {
      groups[resource] = [];
    }
    groups[resource].push(ep);
  }
  
  return groups;
}

function getMethodStyle(method) {
  const styles = {
    GET: 'fill:#61affe',
    POST: 'fill:#49cc90',
    PUT: 'fill:#fca130',
    PATCH: 'fill:#50e3c2',
    DELETE: 'fill:#f93e3e'
  };
  return styles[method] || 'fill:#999';
}
