/**
 * TaskSplitter: Devasa mimari adımları mikro-görevlere (Atomic Tasks) böler.
 */
export class TaskSplitter {
  static splitPhaseIntoTasks(phaseName, phaseTasks, architecture = {}) {
    const atomicTasks = [];

    // Fallback if phaseTasks is actually just a string (raw task)
    if (typeof phaseTasks === 'string') {
        return this.splitRawTask(phaseTasks, architecture);
    }

    for (const task of phaseTasks) {
      if (typeof task !== 'string') continue;
      atomicTasks.push(this.createAtomicTask(task, architecture));
    }

    return {
      tasks: atomicTasks,
      todoMarkdown: this.generateTodo(phaseName, atomicTasks)
    };
  }

  static splitRawTask(rawTask, architecture = {}) {
    this.log(`🧠 Splitting raw task intelligently: ${rawTask}`);
    // Break down a raw UI request into logical files
    const tasks = [
        { title: `Initialize HTML structure for ${rawTask}`, layer: 'frontend' },
        { title: `Add premium CSS/animations for ${rawTask}`, layer: 'frontend' },
        { title: `Implement JS interactivity for ${rawTask}`, layer: 'frontend' }
    ];

    const atomicTasks = tasks.map(t => this.createAtomicTask(t.title, architecture, t.layer));
    return {
        tasks: atomicTasks,
        todoMarkdown: this.generateTodo('Automated Implementation', atomicTasks)
    };
  }

  static createAtomicTask(title, architecture, layer = 'logic') {
    // Architecture'ın tamamını değil, sadece proje adı ve stack özetini gönder
    const stackSummary = Array.isArray(architecture?.tech_stack)
      ? architecture.tech_stack.join(', ')
      : '';
    return {
        id: `${layer}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title,
        prompt: `Implement this specific part: ${title}. ${layer === 'frontend' ? 'Focus on modern UI/UX.' : ''} Stack: ${stackSummary}`,
        targetLayer: layer
    };
  }

  static generateTodo(phaseName, tasks) {
    const list = tasks.map((t, i) => `- [ ] Task ${i + 1}: ${t.title}`).join('\n');
    return `## Phase: ${phaseName}\n\n${list}\n`;
  }

  static log(msg) { console.log(`[Splitter] ${msg}`); }
}
