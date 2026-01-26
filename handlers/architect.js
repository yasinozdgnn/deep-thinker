import { ArchitectAgent } from '../agents/architect/index.js';
import { validateBlueprint, blueprintToSummary } from '../types/blueprint.js';

let activeArchitect = null;

function getArchitect(projectPath = null) {
  if (!activeArchitect) {
    activeArchitect = new ArchitectAgent({
      useLayeredAnalysis: true,
      autoSaveArchitectureDoc: true
    });
  }
  return activeArchitect;
}

export async function handleDesignSystem(args) {
  const { projectPath, requirements: req, description, goal, techStackPreference } = args;
  const requirements = req || description || goal;

  if (!requirements) {
    return {
      content: [{ type: 'text', text: 'Error: requirements parametresi zorunludur.' }],
      isError: true
    };
  }

  const architect = getArchitect(projectPath);
  
  if (techStackPreference && Array.isArray(techStackPreference)) {
    architect.config.defaultTechStack = techStackPreference;
  }

  const blueprint = await architect.generateBlueprint(requirements, { projectPath });
  const summary = blueprintToSummary(blueprint);

  return {
    content: [{
      type: 'text',
      text: `[Architect Agent - System Design]

✅ Blueprint oluşturuldu: ${blueprint.project_name}

📊 Özet:
- Tech Stack: ${summary.stack}
- Tablolar: ${summary.stats.tables}
- API Endpoints: ${summary.stats.endpoints}
- Komponentler: ${summary.stats.components}
- Adımlar: ${summary.stats.steps}
- Karmaşıklık: ${summary.complexity}

${projectPath ? `📄 ARCHITECTURE.md kaydedildi: ${projectPath}/ARCHITECTURE.md` : ''}

Blueprint JSON:
\`\`\`json
${JSON.stringify(blueprint, null, 2)}
\`\`\``
    }]
  };
}

export async function handleAnalyzeArchitecture(args) {
  const { projectPath } = args;

  if (!projectPath) {
    return {
      content: [{ type: 'text', text: 'Error: projectPath parametresi zorunludur.' }],
      isError: true
    };
  }

  const architect = getArchitect(projectPath);
  
  const analysisPrompt = `Mevcut proje yapısını analiz et: ${projectPath}
  
Şunları belirle:
1. Kullanılan teknolojiler
2. Mimari pattern
3. Klasör yapısı
4. İyileştirme önerileri`;

  const blueprint = await architect.generateBlueprint(analysisPrompt, { 
    projectPath,
    isAnalysis: true 
  });

  return {
    content: [{
      type: 'text',
      text: `[Architect Agent - Architecture Analysis]

📂 Proje: ${projectPath}

${JSON.stringify(blueprint, null, 2)}`
    }]
  };
}

export async function handleGenerateBlueprint(args) {
  const { requirements, projectName, techStack } = args;

  if (!requirements) {
    return {
      content: [{ type: 'text', text: 'Error: requirements parametresi zorunludur.' }],
      isError: true
    };
  }

  const architect = getArchitect();
  
  if (techStack) {
    architect.config.defaultTechStack = techStack;
  }

  const task = projectName 
    ? `${projectName}: ${requirements}`
    : requirements;

  const blueprint = await architect.generateBlueprint(task, {});

  return {
    content: [{
      type: 'text',
      text: `[Architect Agent - Blueprint Generated]

\`\`\`json
${JSON.stringify(blueprint, null, 2)}
\`\`\``
    }]
  };
}

export async function handleVisualizeArchitecture(args) {
  const { projectPath } = args;

  const architect = getArchitect(projectPath);
  const blueprint = architect.getBlueprint();

  if (!blueprint) {
    return {
      content: [{ type: 'text', text: 'Önce design_system veya generate_blueprint çalıştırın.' }],
      isError: true
    };
  }

  if (projectPath) {
    await architect.saveArchitectureDoc(blueprint, projectPath);
  }

  const markdown = architect.generateArchitectureMarkdown(blueprint);

  return {
    content: [{
      type: 'text',
      text: `[Architect Agent - Architecture Visualization]

${projectPath ? `📄 ARCHITECTURE.md kaydedildi: ${projectPath}/ARCHITECTURE.md` : ''}

${markdown}`
    }]
  };
}

export async function handleGetBlueprintSummary(_args) {
  const architect = getArchitect();
  const summary = architect.getBlueprintSummary();

  if (!summary) {
    return {
      content: [{ type: 'text', text: 'Aktif blueprint yok. Önce design_system çalıştırın.' }],
      isError: true
    };
  }

  return {
    content: [{
      type: 'text',
      text: `[Blueprint Summary]

📋 Proje: ${summary.name}
🔧 Stack: ${summary.stack}
📊 İstatistikler:
  - Tablolar: ${summary.tables}
  - Endpoints: ${summary.endpoints}
  - Komponentler: ${summary.components}
  - Adımlar: ${summary.steps}`
    }]
  };
}

export const architectHandlers = {
  design_system: handleDesignSystem,
  analyze_architecture: handleAnalyzeArchitecture,
  generate_blueprint: handleGenerateBlueprint,
  visualize_architecture: handleVisualizeArchitecture,
  get_blueprint_summary: handleGetBlueprintSummary
};
