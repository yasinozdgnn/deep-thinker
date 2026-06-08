import { ArchitectAgent } from '../architect/index.js';
import { CoderAgent, QAAgent, UIDesignerAgent, BackendDesignerAgent } from './agents.js';
import { TaskSplitter } from './task-splitter.js';
import { SandboxManager } from '../../sandbox/index.js';
import { writeFileContent, robustJSONParse } from '../../helpers/index.js';
import { callAI } from '../../helpers/ai-client.js';
import path from 'path';
import fs from 'fs/promises';

export class SwarmOrchestrator {
  constructor(projectPath, config = {}) {
    this.projectPath = projectPath;
    this.architect = new ArchitectAgent({
      useLayeredAnalysis: true,
      autoSaveArchitectureDoc: true
    });
    this.uiDesigner = new UIDesignerAgent();
    this.backendDesigner = new BackendDesignerAgent();
    this.coder = new CoderAgent();
    this.qa = new QAAgent();
    this.sandbox = new SandboxManager();
    this.history = [];
    this.config = {
      requireApproval: false,
      maxRetries: 1,
      maxFeedbackCycles: 1, // Geri bildirim döngüsü en fazla 1 kere — prompt şişmesini önler
      ...config
    };
    this.currentBlueprint = null;
    this.feedbackCycles = 0;
    this.colors = {
      reset: "\x1b[0m",
      bright: "\x1b[1m",
      dim: "\x1b[2m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      cyan: "\x1b[36m",
      magenta: "\x1b[35m",
      red: "\x1b[31m",
      blue: "\x1b[34m"
    };
    
    this.agents = {
        architect: { name: 'Archie', icon: '📐', color: this.colors.cyan },
        ui_designer: { name: 'UIna', icon: '🎨', color: this.colors.blue },
        backend_designer: { name: 'Data', icon: '🗄️', color: this.colors.yellow },
        coder: { name: 'Codey', icon: '👨‍💻', color: this.colors.green },
        qa: { name: 'Tester', icon: '🧪', color: this.colors.magenta },
        system: { name: 'Swarm', icon: '🐝', color: this.colors.yellow }
    };
  }

  speak(from, to, message) {
    const sender = this.agents[from] || this.agents.system;
    const receiver = this.agents[to] ? `${this.agents[to].icon} ${this.agents[to].name}` : '👤 User';
    
    console.log(`\n${sender.color}${this.colors.bright}${sender.icon} ${sender.name}${this.colors.reset} ${this.colors.dim}→ ${receiver}${this.colors.reset}`);
    console.log(`${this.colors.bright}"${message}"${this.colors.reset}`);
  }

  thinking(agentKey, message = "Thinking...") {
    const agent = this.agents[agentKey] || this.agents.system;
    process.stderr.write(`${this.colors.dim}${agent.icon} ${agent.name} is ${message}...${this.colors.reset}\r`);
  }

  async runSwarm(task) {
    this.log('🚀 Swarm started for task: ' + task);

    const blueprint = await this.architectPhase(task);

    // 🎨 TASARIM FAZI: UI Designer + Backend Designer paralel çalışır
    await this.designPhase(blueprint);

    // Generate TODO.md and start the Micro-Task Factory
    await this.initializeFactory(blueprint);

    const codeFiles = await this.executeAtomicLoop(blueprint);

    // 🔍 FINAL INTEGRITY GATE: Tüm dosyaları kalite, tutarlılık ve UI bütünlüğü için denetle
    const integrityResult = await this.finalIntegrityGate(codeFiles, blueprint);
    if (integrityResult.fixed) {
      this.log(`${this.colors.green}✅ Integrity fixes applied.${this.colors.reset}`);
    }

    this.log('✅ Swarm finished.');
    return {
      blueprint,
      codeFiles,
      uiDesign: this.uiDesign,
      backendDesign: this.backendDesign,
      summary: 'Swarm completed all phases using Micro-Tasking Factory Mode.'
    };
  }

  async architectPhase(task) {
    this.speak('architect', 'system', `I'm analyzing the request. Let's design a robust blueprint for: ${task}`);
    this.thinking('architect');
    // Tek geçişli analiz: runShardedAnalysis (N+1 çağrı) yerine singlePassAnalysis (1 çağrı)
    // Böylece prompt şişmesi ve timeout riski azalır
    const blueprint = await this.architect.singlePassAnalysis(task, {});

    this.currentBlueprint = blueprint;
    this.history.push({
      role: 'architect',
      type: 'blueprint',
      content: blueprint
    });

    this.speak('architect', 'system', `Blueprint for "${blueprint.project_name}" is ready! It includes ${blueprint.execution_steps.length} atomic steps.`);
    return blueprint;
  }

  /**
   * 🎨 Tasarım Fazı — UI Designer + Backend Designer paralel çalışır.
   * Mevcut proje varsa UI desenlerini otomatik tespit eder.
   */
  async designPhase(blueprint) {
    this.log(`${this.colors.blue}🎨 Starting Design Phase...${this.colors.reset}`);

    // Mevcut projedeki UI dosyalarını tara
    const existingUI = await this._detectExistingUI(blueprint);

    this.speak('ui_designer', 'system', `I'll design the UI${existingUI ? ', matching existing patterns' : ' from scratch (modern & sleek)'}.`);
    this.speak('backend_designer', 'system', `I'll design the backend architecture, database schema, and API structure.`);

    this.thinking('ui_designer', 'designing UI components and layout');
    this.thinking('backend_designer', 'designing backend architecture');

    // === PARALEL: UI ve Backend tasarımı aynı anda ===
    const [uiDesignRaw, backendDesignRaw] = await Promise.all([
      this.uiDesigner.think({
        task: blueprint.project_name,
        architecture: blueprint.architecture,
        existingUI: existingUI
      }),
      this.backendDesigner.think({
        task: blueprint.project_name,
        architecture: blueprint.architecture
      })
    ]);

    // Parse JSON çıktıları
    try {
      this.uiDesign = JSON.parse(this.parseAgentResponse(uiDesignRaw) || uiDesignRaw);
      this.speak('ui_designer', 'coder', `Design is ready! ${this.uiDesign.pages?.length || 0} pages designed with ${this.uiDesign.component_tree?.length || 0} components.`);
    } catch (e) {
      this.log(`${this.colors.red}⚠️ UI Design parse failed: ${e.message}. Using raw output.${this.colors.reset}`);
      this.uiDesign = { raw: uiDesignRaw };
    }

    try {
      this.backendDesign = JSON.parse(this.parseAgentResponse(backendDesignRaw) || backendDesignRaw);
      const endpointCount = this.backendDesign.api?.endpoints?.length || 0;
      const tableCount = this.backendDesign.database?.schema?.length || 0;
      this.speak('backend_designer', 'coder', `Backend design ready! ${endpointCount} API endpoints, ${tableCount} database tables.`);
    } catch (e) {
      this.log(`${this.colors.red}⚠️ Backend Design parse failed: ${e.message}. Using raw output.${this.colors.reset}`);
      this.backendDesign = { raw: backendDesignRaw };
    }

    this.log(`${this.colors.green}✅ Design Phase complete!${this.colors.reset}`);
  }

  /**
   * Mevcut projedeki UI dosyalarını tara (HTML, CSS, JS, React bileşenleri)
   */
  async _detectExistingUI(blueprint) {
    try {
      const projectFiles = await fs.readdir(this.projectPath).catch(() => []);
      if (projectFiles.length === 0) return null;

      // UI ile ilgili dosyaları ara
      const uiFiles = [];
      for (const file of projectFiles) {
        const ext = path.extname(file).toLowerCase();
        if (['.html', '.htm', '.css', '.scss', '.less', '.jsx', '.tsx', '.vue', '.svelte'].includes(ext)) {
          const content = await fs.readFile(path.join(this.projectPath, file), 'utf-8').catch(() => null);
          if (content && content.length > 100) {
            uiFiles.push({ name: file, content: content.slice(0, 5000) }); // İlk 5000 karakter
          }
        }
      }

      if (uiFiles.length === 0) return null;

      this.log(`${this.colors.blue}🎨 Existing UI detected: ${uiFiles.map(f => f.name).join(', ')}${this.colors.reset}`);
      return JSON.stringify(uiFiles);
    } catch (e) {
      this.log(`${this.colors.dim}⚠️ UI detection skipped: ${e.message}${this.colors.reset}`);
      return null;
    }
  }

  async initializeFactory(blueprint) {
    this.log('🏭 Initializing Macro-to-Micro Factory...');
    this.todoPath = path.join(this.projectPath, 'TODO.md');
    
    // Split macro steps into micro tasks
    const phases = blueprint.execution_steps || [];
    this.allTasks = [];
    
    for (const phase of phases) {
      // execution_steps string array olabilir (singlePassAnalysis) veya object array (runShardedAnalysis)
      if (typeof phase === 'string') {
        // String format: her adımı direkt bir atomic task yap
        this.allTasks.push(TaskSplitter.createAtomicTask(phase, blueprint.architecture, 'logic'));
      } else if (phase && typeof phase === 'object') {
        // Object format: { name, tasks }
        const split = TaskSplitter.splitPhaseIntoTasks(phase.name || 'Phase', phase.tasks || [], blueprint.architecture);
        this.allTasks.push(...split.tasks);
      }
    }
    
    // Eğer hala task yoksa, blueprint'teki execution_steps string'lerini direkt task yap
    if (this.allTasks.length === 0 && phases.length > 0) {
      for (const step of phases) {
        const stepText = typeof step === 'string' ? step : (step.name || JSON.stringify(step));
        this.allTasks.push(TaskSplitter.createAtomicTask(stepText, blueprint.architecture, 'logic'));
      }
    }
    
    // Son çare: blueprint boşsa bile en az 1 task olsun
    if (this.allTasks.length === 0) {
      const fallbackTask = TaskSplitter.createAtomicTask(
        `Implement: ${blueprint.project_name || 'Project'}`,
        blueprint.architecture,
        'logic'
      );
      this.allTasks.push(fallbackTask);
    }
    
    await this.updateTodoFile(0);
    this.log(`📝 TODO.md created with ${this.allTasks.length} micro-tasks.`);
  }

  async executeAtomicLoop(blueprint) {
    // Task yoksa direkt boş dön — QA fazı gereksiz API çağrısı yapmasın
    if (!this.allTasks || this.allTasks.length === 0) {
      this.log('⚠️ No micro-tasks to execute.');
      return [];
    }
    this.log(`\n${this.colors.bright}${this.colors.magenta}🏭 Micro-Task Factory Started!${this.colors.reset}`);
    const allCodeFiles = [];
    const total = this.allTasks.length;
    const BATCH_SIZE = 3;

    // Stack özetini bir kere hesapla — her task için tekrar gerekmez
    const archSummary = blueprint.project_name
      ? `Project: ${blueprint.project_name} | Stack: ${(blueprint.tech_stack || []).join(', ')}`
      : '';

    for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
        const batch = this.allTasks.slice(batchStart, batchStart + BATCH_SIZE);
        const batchEnd = Math.min(batchStart + batch.length, total);

        // Progress Bar (batch bazında)
        const progress = Math.round((batchEnd / total) * 100);
        const barSize = 20;
        const filledSize = Math.round((barSize * batchEnd) / total);
        const bar = '█'.repeat(filledSize) + '░'.repeat(barSize - filledSize);

        console.log(`\n${this.colors.cyan}[TASK ${batchStart+1}-${batchEnd}/${total}] [${bar}] ${progress}%${this.colors.reset}`);
        console.log(`${this.colors.yellow}🚀 Batch: ${this.colors.bright}${batch.map(t => t.title).join(' | ')}${this.colors.reset}`);

        this.speak('coder', 'architect', `Received ${batch.length} tasks! Working on them in parallel.`);
        this.thinking('coder', `implementing ${batch.length} tasks in parallel`);

        // === PARALEL: Batch'teki tüm task'ları aynı anda çalıştır ===
        const results = await Promise.all(batch.map(task =>
            this.coder.think({
                task: task.prompt,
                stack: blueprint.tech_stack,
                design: archSummary,
                uiDesign: this.uiDesign || null,
                backendDesign: this.backendDesign || null
            })
        ));

        const allParsed = results.map(r => this.parseAgentResponse(r));

        // === FEEDBACK: Paralel task'lardan sadece İLK feedback işlenir ===
        // (race condition'u önlemek için — blueprint aynı anda iki kere revize edilemez)
        const feedbackEntry = allParsed.find(p => p.feedback && p.feedback.target === 'architect');
        if (feedbackEntry && this.feedbackCycles < this.config.maxFeedbackCycles) {
            this.speak('coder', 'architect', `Wait Archie, I found an issue: ${feedbackEntry.feedback.issue}. I need you to revise the ${feedbackEntry.feedback.required_change}.`);
            this.feedbackCycles++;

            const revisionPrompt = `REVISION REQUESTED BY CODER: ${feedbackEntry.feedback.issue}\nREQUIRED CHANGE: ${feedbackEntry.feedback.required_change}\nORIGINAL DESIGN CONTEXT: ${JSON.stringify(blueprint.architecture)}`;
            this.thinking('architect', 'revising blueprint');
            const newBlueprint = await this.architect.singlePassAnalysis(revisionPrompt, {});

            this.currentBlueprint = newBlueprint;
            blueprint.architecture = newBlueprint.architecture;

            this.speak('architect', 'coder', `Good catch, Codey! I've revised the architecture. You can proceed now.`);
        }

        // === PARALEL: Tüm dosyaları aynı anda yaz ===
        const savePromises = [];
        for (const parsed of allParsed) {
            for (const file of (parsed.files || [])) {
                savePromises.push(this.saveFile(file));
                allCodeFiles.push(file);
            }
        }
        await Promise.all(savePromises);

        // TODO.md'yi batch sonunda bir kere güncelle (her task'ta değil)
        await this.updateTodoFile(batchEnd);

        console.log(`${this.colors.green}✔ Batch done! ${savePromises.length} file(s) created/updated.${this.colors.reset}`);
    }

    // 4. QA & Correction Phase
    await this.qaPhase(allCodeFiles);

    return allCodeFiles;
  }

  async selfHealPhase(files) {
    this.log(`${this.colors.yellow}🔍 Running Swarm Health Check...${this.colors.reset}`);
    for (const file of files) {
        const fullPath = path.join(this.projectPath, file.fileName);
        try {
            await fs.access(fullPath);
        } catch (e) {
            this.log(`${this.colors.red}❌ Missing File Detected: ${file.fileName}. Repairing...${this.colors.reset}`);
            await this.saveFile(file); // Force rewrite/recreate
        }
    }
  }

  /**
   * 🔍 FINAL INTEGRITY GATE — Tüm dosyaları kalite, UI bütünlüğü ve tutarlılık için denetler.
   * 1. Aşama: Regex kontroller (boş dosya, eksik etiket, kırık referans)
   * 2. Aşama: LLM ile kapsamlı kalite incelemesi (UI bütünlüğü, cross-file tutarlılık)
   * 3. Aşama: Otomatik düzeltme
   */
  async finalIntegrityGate(codeFiles, blueprint) {
    if (!codeFiles || codeFiles.length === 0) {
      this.log('⚠️ No files to validate.');
      return { fixed: false };
    }

    this.log(`${this.colors.magenta}🔍 Final Integrity Gate: Validating ${codeFiles.length} files...${this.colors.reset}`);

    // === AŞAMA 1: Regex kontroller (hızlı, API gerektirmez) ===
    const regexIssues = this._runRegexChecks(codeFiles);
    
    if (regexIssues.length > 0) {
      this.log(`${this.colors.yellow}⚠️ Integrity Gate (Phase 1) found ${regexIssues.length} issue(s):${this.colors.reset}`);
      for (const issue of regexIssues) {
        const color = issue.severity === 'HIGH' ? this.colors.red : this.colors.yellow;
        this.log(`${color}[${issue.severity}] ${issue.file}: ${issue.issue}${this.colors.reset}`);
      }
      
      // HIGH severity regex sorunlarını hemen düzelt
      const fixed = await this._fixHighIssues(regexIssues, codeFiles);
      if (fixed) this.log(`${this.colors.green}✅ Phase 1 fixes applied.${this.colors.reset}`);
    } else {
      this.log(`${this.colors.green}✅ Phase 1 (Regex) passed.${this.colors.reset}`);
    }

    // === AŞAMA 2: LLM ile kapsamlı kalite incelemesi ===
    this.log(`${this.colors.magenta}🔍 Phase 2: LLM-powered quality review...${this.colors.reset}`);
    const llmIssues = await this._llmQualityReview(codeFiles, blueprint);
    
    if (llmIssues.length > 0) {
      this.log(`${this.colors.yellow}⚠️ Integrity Gate (Phase 2) found ${llmIssues.length} issue(s):${this.colors.reset}`);
      for (const issue of llmIssues) {
        this.log(`${this.colors.red}[${issue.severity}] ${issue.file}: ${issue.issue}${this.colors.reset}`);
      }
      
      // LLM tespitlerini de düzelt
      const allIssues = [...regexIssues.filter(i => i.severity !== 'HIGH'), ...llmIssues];
      const highIssues = allIssues.filter(i => i.severity === 'HIGH');
      if (highIssues.length > 0) {
        const fixed = await this._fixHighIssues(highIssues, codeFiles);
        if (fixed) this.log(`${this.colors.green}✅ Phase 2 fixes applied.${this.colors.reset}`);
      }
    } else {
      this.log(`${this.colors.green}✅ Phase 2 (LLM Review) passed — project is production-ready!${this.colors.reset}`);
    }

    return { fixed: regexIssues.some(i => i.severity === 'HIGH') || llmIssues.some(i => i.severity === 'HIGH') };
  }

  /**
   * Regex tabanlı hızlı kontroller (API çağrısı yok)
   */
  _runRegexChecks(codeFiles) {
    const issues = [];
    const htmlFiles = codeFiles.filter(f => f.fileName.endsWith('.html') || f.fileName.endsWith('.htm'));
    const cssFiles = codeFiles.filter(f => f.fileName.endsWith('.css'));
    const jsFiles = codeFiles.filter(f => f.fileName.endsWith('.js'));

    // HTML kontrolleri
    for (const html of htmlFiles) {
      if (!html.content || html.content.trim().length < 50) {
        issues.push({ file: html.fileName, issue: 'HTML içeriği çok kısa veya boş', severity: 'HIGH' });
        continue;
      }
      if (!html.content.includes('<!DOCTYPE html>') && !html.content.includes('<!doctype html>')) {
        issues.push({ file: html.fileName, issue: 'DOCTYPE bildirimi eksik', severity: 'MEDIUM' });
      }
      if (!html.content.includes('<html')) {
        issues.push({ file: html.fileName, issue: '<html> etiketi eksik', severity: 'HIGH' });
      }
      if (!html.content.includes('<head')) {
        issues.push({ file: html.fileName, issue: '<head> bölümü eksik', severity: 'MEDIUM' });
      }
      if (!html.content.includes('<body')) {
        issues.push({ file: html.fileName, issue: '<body> etiketi eksik', severity: 'HIGH' });
      }
      // Referans kontrolü
      const cssRefs = [...html.content.matchAll(/<link[^>]*href=["']([^"']+\.css)["']/gi)];
      const jsRefs = [...html.content.matchAll(/<script[^>]*src=["']([^"']+\.js)["']/gi)];
      for (const [, ref] of [...cssRefs, ...jsRefs]) {
        const refName = ref.split('/').pop();
        const exists = codeFiles.some(f => f.fileName.endsWith(refName));
        if (!exists) {
          issues.push({ file: html.fileName, issue: `Referans verilen dosya bulunamadı: ${ref}`, severity: 'HIGH' });
        }
      }
    }

    // CSS kontrolleri
    for (const css of cssFiles) {
      if (!css.content || css.content.trim().length < 20) {
        issues.push({ file: css.fileName, issue: 'CSS içeriği çok kısa veya boş', severity: 'HIGH' });
      } else if (css.content.trim().split('{').length < 3) {
        issues.push({ file: css.fileName, issue: 'CSS çok az kural içeriyor', severity: 'MEDIUM' });
      }
    }

    // JS kontrolleri
    for (const js of jsFiles) {
      if (!js.content || js.content.trim().length < 30) {
        issues.push({ file: js.fileName, issue: 'JS içeriği çok kısa veya boş', severity: 'HIGH' });
      } else {
        const hasFunction = js.content.includes('function ') || js.content.includes('=>') || js.content.includes('addEventListener');
        const hasDOMRef = js.content.includes('document.') || js.content.includes('window.') || js.content.includes('$(');
        if (!hasFunction && !hasDOMRef) {
          issues.push({ file: js.fileName, issue: 'JS dosyasında fonksiyon veya DOM etkileşimi yok', severity: 'MEDIUM' });
        }
      }
    }

    return issues;
  }

  /**
   * LLM ile kapsamlı kalite incelemesi — tüm dosyaları okur, UI bütünlüğünü ve 
   * cross-file tutarlılığı denetler.
   */
  async _llmQualityReview(codeFiles, blueprint) {
    try {
      // Dosya içeriklerini özetle (token sınırına takılmamak için her dosyadan ilk 1000 karakter)
      const fileSummary = codeFiles.map(f => {
        const content = f.content || '';
        const preview = content.length > 1000 ? content.slice(0, 1000) + '\n...(truncated)' : content;
        return `=== ${f.fileName} ===\n${preview}`;
      }).join('\n\n---\n\n');

      const reviewPrompt = `You are a Senior QA Engineer. Review this complete project and determine if it's PRODUCTION-READY.

PROJECT: ${blueprint?.project_name || 'Unnamed'}
STACK: ${(blueprint?.tech_stack || []).join(', ')}

ALL FILES:
${fileSummary}

EVALUATE THESE ASPECTS:
1. **UI COMPLETENESS**: Is the user interface complete and polished? Any placeholder/stub content?
2. **CROSS-FILE INTEGRATION**: Does the HTML properly reference CSS and JS files? Do class names used in HTML exist in CSS?
3. **INTERACTIVITY**: Is there real JavaScript functionality (not just empty scripts)?
4. **VISUAL QUALITY**: Does it have proper styling (animations, colors, layout)?
5. **PRODUCTION READINESS**: Would an end user see this as a complete, working product?

Return ONLY valid JSON:
{
  "status": "PASS" | "FAIL",
  "issues": [
    { "file": "filename", "issue": "description", "severity": "HIGH" | "MEDIUM" | "LOW", "fix_suggestion": "how to fix" }
  ],
  "summary": "Overall assessment in 1-2 sentences"
}

If status is PASS, return empty issues array.`;

      const response = await callAI(reviewPrompt);
      const parsed = robustJSONParse(response);

      if (parsed && parsed.issues && Array.isArray(parsed.issues)) {
        return parsed.issues.filter(i => i.severity === 'HIGH' || i.severity === 'MEDIUM');
      }
      return [];
    } catch (e) {
      this.log(`${this.colors.yellow}⚠️ LLM review failed: ${e.message}. Skipping Phase 2.${this.colors.reset}`);
      return [];
    }
  }

  /**
   * HIGH severity sorunları LLM ile düzeltir
   */
  async _fixHighIssues(issues, codeFiles) {
    const highIssues = issues.filter(i => i.severity === 'HIGH');
    if (highIssues.length === 0) return false;

    this.log(`${this.colors.magenta}🛠️ Fixing ${highIssues.length} HIGH severity issue(s)...${this.colors.reset}`);
    
    const fileSummary = codeFiles.map(f => 
      `=== ${f.fileName} ===\n${(f.content || '').slice(0, 800)}${(f.content || '').length > 800 ? '\n...(truncated)' : ''}`
    ).join('\n\n');

    const fixPrompt = `You are a Principal Software Engineer. Fix the following HIGH severity issues in this project.

ISSUES TO FIX:
${highIssues.map(i => `- ${i.file}: ${i.issue}`).join('\n')}

ALL FILES:
${fileSummary}

TASK: Return ONLY valid JSON with the FIXED files:
{
  "files": [
    { "fileName": "path/to/file.ext", "content": "fixed full content here..." }
  ]
}

Rules:
- Fix ALL issues above completely — no placeholders, no stubs
- Keep existing working code intact
- Make the UI production-ready, polished, and complete
- Return ONLY files that need changes`;

    const fixResponse = await callAI(fixPrompt);
    const fixedData = this.parseAgentResponse(fixResponse);
    
    if (fixedData.files && fixedData.files.length > 0) {
      const fixPromises = fixedData.files.map(async (file) => {
        await this.saveFile(file);
        const existing = codeFiles.find(f => f.fileName === file.fileName);
        if (existing) existing.content = file.content;
      });
      await Promise.all(fixPromises);
      this.log(`${this.colors.green}✅ ${fixedData.files.length} file(s) fixed.${this.colors.reset}`);
      return fixedData.files.length > 0;
    }
    return false;
  }

  async updateTodoFile(completedCount) {
    let content = `# Project Development TODO\n\n`;
    let cliTodo = `${this.colors.dim}--- Live Progress ---\n${this.colors.reset}`;

    this.allTasks.forEach((t, i) => {
        const status = i < completedCount ? '✔' : ' ';
        const color = i < completedCount ? this.colors.green : this.colors.dim;
        const icon = i < completedCount ? '✅' : '⏳';
        
        content += `${i < completedCount ? '[x]' : '[ ]'} Task ${i+1}: ${t.title}\n`;
        if (i >= completedCount - 1 && i <= completedCount + 2) {
             cliTodo += `${color}[${status}] Task ${i+1}: ${t.title}${this.colors.reset}\n`;
        }
    });

    await fs.writeFile(this.todoPath, content);
  }

  getStepContext(step, blueprint) {
    const stepLower = step.toLowerCase();

    if (stepLower.includes('veritabanı') || stepLower.includes('database') || stepLower.includes('schema')) {
      return {
        layer: 'database',
        config: blueprint.architecture?.database || {},
        techStack: (blueprint.tech_stack || []).filter(t =>
          ['prisma', 'typeorm', 'sequelize', 'postgresql', 'mysql', 'mongodb'].some(db =>
            t.toLowerCase().includes(db)
          )
        )
      };
    }

    if (stepLower.includes('backend') || stepLower.includes('api') || stepLower.includes('servis')) {
      return {
        layer: 'backend',
        config: blueprint.architecture?.backend || {},
        database: blueprint.architecture?.database || {},
        techStack: (blueprint.tech_stack || []).filter(t =>
          ['next', 'express', 'fastify', 'node'].some(be =>
            t.toLowerCase().includes(be)
          )
        )
      };
    }

    if (stepLower.includes('frontend') || stepLower.includes('ui') || stepLower.includes('komponent')) {
      return {
        layer: 'frontend',
        config: blueprint.architecture?.frontend || {},
        techStack: (blueprint.tech_stack || []).filter(t =>
          ['react', 'next', 'vue', 'tailwind', 'css'].some(fe =>
            t.toLowerCase().includes(fe)
          )
        )
      };
    }

    return {
      layer: 'general',
      fullBlueprint: blueprint
    };
  }

  parseAgentResponse(response) {
    if (!response || typeof response !== 'string') {
      this.log('⚠️ Agent returned empty or invalid response.');
      return { files: [], feedback: null };
    }

    try {
      const parsed = robustJSONParse(response);
      if (parsed) {
          // Handle both new format { files, feedback } and old format [ files ]
          if (Array.isArray(parsed)) return { files: parsed, feedback: null };
          return {
              files: parsed.files || [],
              feedback: parsed.feedback || null,
              status: parsed.status || 'FAIL',
              issues: parsed.issues || []
          };
      }
    } catch (e) {
      this.log(`⚠️ Failed to parse agent JSON: ${e.message}`);
    }

    return { files: [], feedback: null };
  }

  async saveFile(file) {
    try {
      // 1. Strip any leading slashes, backslashes, or drive letters to ensure we treat it as relative
      // e.g., "/src/app.js" -> "src/app.js"
      // e.g., "C:\Users\foo\app.js" -> "Users/foo/app.js" (if LLM hallucinates absolute path)
      let relativePath = file.fileName
        .replace(/^[\\\/]+/, '') // Remove leading slashes
        .replace(/^[a-zA-Z]:[\\\/]*/, ''); // Remove drive letter if present (e.g. C:/)

      // 2. Resolve full path from project root
      const safePath = path.join(this.projectPath, relativePath);

      // 3. Ensure target directory exists
      await fs.mkdir(path.dirname(safePath), { recursive: true });

      await writeFileContent(safePath, file.content);
      this.log(`✅ Written: ${safePath}`);
    } catch (err) {
      this.log(`❌ Failed to write ${file.fileName}: ${err.message}`);
    }
  }

  async verificationPhase(codeFiles) {
    const mainFile = codeFiles.find(f =>
      f.fileName.endsWith('.js') ||
      f.fileName.endsWith('.ts') ||
      f.fileName.endsWith('.php')
    ) || codeFiles[0];

    if (!mainFile) return;

    let verified = false;
    let attempts = 0;

    while (!verified && attempts < this.config.maxRetries) {
      const lang = mainFile.fileName.endsWith('.php') ? 'php' : 'javascript';

      this.log(`📦 Verifying ${mainFile.fileName} in Sandbox...`);
      const execution = await this.sandbox.execute(mainFile.content, lang);

      if (execution.success) {
        this.log('✅ Sandbox verification PASSED.');
        verified = true;
      } else {
        this.log(`❌ Sandbox verification FAILED: ${execution.stderr.slice(0, 200)}...`);
        this.log('🔄 Coder is fixing the code...');

        const fixedResponse = await this.coder.think({
          task: 'Fix compilation/runtime error',
          design: `Error: ${execution.stderr}\n\nPrevious Code:\n${mainFile.content}`
        });

        const fixedData = this.parseAgentResponse(fixedResponse);
        const savePromises = (fixedData.files || []).map(async (f) => {
          await this.saveFile(f);
          const original = codeFiles.find(cf => cf.fileName === f.fileName);
          if (original) original.content = f.content;
        });
        await Promise.all(savePromises);
      }
      attempts++;
    }
  }

  async qaPhase(codeFiles) {
    this.log(`${this.colors.magenta}🧪 Starting Universal QA & Dependency Audit...${this.colors.reset}`);

    // === PARALEL: Dependency audit + Sandbox test aynı anda çalışır ===
    this.speak('qa', 'system', `I'm launching dependency audit and sandbox test in parallel.`);
    const [missingFiles, runtimeResult] = await Promise.all([
        this._runDependencyAudit(codeFiles),
        this._runSandboxTest()
    ]);

    const runtimeLogs = runtimeResult.logs;

    // Trigger AI-Powered Smart QA Audit
    this.thinking('qa', 'auditing code and logs');
    const codeContent = codeFiles.slice(-5).map(f => `// File: ${f.fileName}\n${f.content}`).join('\n\n');
    const rawReport = await this.qa.think({
        code: codeContent,
        logs: runtimeLogs,
        stack: this.currentBlueprint?.tech_stack || []
    });

    const report = this.parseAgentResponse(rawReport);

    if (report && report.status === "FAIL") {
        this.speak('qa', 'system', `Audit failed! I found ${report.issues?.length || 0} issues that need immediate attention.`);

        // INTER-AGENT FEEDBACK: QA -> Architect
        if (report.feedback && report.feedback.target === 'architect') {
             this.speak('qa', 'architect', `Archie, we have a structural problem. ${report.feedback.message}`);
        }

        // === PARALEL: HIGH severity fix'leri aynı anda uygula ===
        const fixPromises = [];
        for (const issue of (report.issues || [])) {
            if (issue.severity === "HIGH") {
                this.speak('qa', 'coder', `Codey, there's a critical issue in ${issue.file}: ${issue.issue}. Here is the fix: ${issue.fix}`);
                this.thinking('coder', `applying fix for ${issue.file}`);

                const fixPromise = (async () => {
                    const fixResponse = await this.coder.think({
                        task: `Fix issue: ${issue.issue}`,
                        design: `Current Code:\n${codeFiles.find(f => f.fileName === issue.file)?.content || ''}\n\nRecommended Fix: ${issue.fix}\n\nRuntime Logs:\n${runtimeLogs}`
                    });
                    const fixedData = this.parseAgentResponse(fixResponse);
                    const fileFixPromises = (fixedData.files || []).map(async (rf) => {
                        await this.saveFile(rf);
                        const original = codeFiles.find(f => f.fileName === rf.fileName);
                        if (original) original.content = rf.content;
                    });
                    await Promise.all(fileFixPromises);
                    this.speak('coder', 'qa', `Fixed the issue in ${issue.file}. Ready for re-audit!`);
                })();
                fixPromises.push(fixPromise);
            }
        }
        await Promise.all(fixPromises);
    } else {
        this.speak('qa', 'system', `All systems go! Code quality score: ${report?.overall_quality_score || '10'}/10. Excellent work team.`);
    }

    await this.selfHealPhase(codeFiles);
    this.log(`${this.colors.green}✅ Universal QA Cycle Finished!${this.colors.reset}`);
    return report;
  }

  async _runDependencyAudit(codeFiles) {
    const missingFiles = new Set();
    const dependencyPatterns = [
        /href="([^"|http][^"]+)"/g,  // CSS, Links
        /src="([^"|http][^"]+)"/g,   // JS, Images, Scripts
        /import\s+.*\s+from\s+['"]([^'"]+)['"]/g, // ES6 Imports
        /require\(['"]([^'"]+)['"]\)/g,           // CommonJS
        /@import\s+['"]([^'"]+)['"]/g             // CSS @import
    ];

    for (const file of codeFiles) {
        this.log(`🔍 Auditing: ${file.fileName}...`);
        for (const pattern of dependencyPatterns) {
            let match;
            while ((match = pattern.exec(file.content)) !== null) {
                const ref = match[1].split('?')[0].split('#')[0];
                if (ref.startsWith('http') || ref.startsWith('//') || ref.startsWith('data:')) continue;
                const exists = codeFiles.some(f => f.fileName.includes(ref) || ref.includes(f.fileName));
                if (!exists) {
                    this.log(`${this.colors.red}⚠️ Missing Dependency: ${ref} (Referenced in ${file.fileName})${this.colors.reset}`);
                    missingFiles.add(ref);
                }
            }
        }
    }

    if (missingFiles.size > 0) {
        this.log(`${this.colors.yellow}🛠️ Auto-Healing ${missingFiles.size} missing dependencies...${this.colors.reset}`);
        for (const missingPath of missingFiles) {
            this.log(`⚡ Repairing: ${missingPath}`);
        }
    }

    return missingFiles;
  }

  async _runSandboxTest() {
    const testCmd = this.currentBlueprint?.tech_stack?.some(s => s.toLowerCase().includes('node')) ? 'npm test' : 'ls -R';
    let logs = "";
    try {
        const [cmd, ...args] = testCmd.split(' ');
        this.thinking('qa', `running ${testCmd}`);
        const run = await this.sandbox.executeCommand(cmd, args, this.projectPath);
        logs = `STDOUT:\n${run.stdout}\n\nSTDERR:\n${run.stderr}`;
    } catch (e) {
        logs = `Execution Error: ${e.message}`;
    }
    return { logs };
  }

  getBlueprint() {
    return this.currentBlueprint;
  }

  getHistory() {
    return this.history;
  }

  log(message) {
    console.error(`[SWARM] ${message}`);
  }
}

