import { taskPlanner } from '../planner/index.js';
import { taskDecomposer } from '../decomposer/index.js';
import { listWorkflows, getWorkflow } from '../orchestrator/index.js';
import { callGLM, extractCodeFromResponse } from '../helpers/index.js'; // Added extractCodeFromResponse

export const agentHandlers = {
  plan_task: async (args) => {
    taskPlanner.setProject(args.projectPath || process.cwd());
    const plan = await taskPlanner.createPlan(args.goal, { originalTask: args.goal });
    
    let generatedSteps = [];

    // AI ile planı zenginleştir (Argümanları doldur)
    try {
        const prompt = `
Task Goal: "${args.goal}"
Suggested Tools (Optional): "${args.steps || 'Auto-detect best tools'}"

Create a concrete execution plan. For each step, specify the tool and its ARGUMENTS.
Return a valid JSON array.

Available Tools & Key Args:
- create_project (projectName, projectType[next|react|express])
- design_system (projectName) -> Use this for architecture design
- delegate_to_swarm (task) -> Use this for complex implementation features
- deep_think_code (prompt, filePath)
- write_file (TargetFile, CodeContent)
- read_file (AbsolutePath)

Response Format:
[
  {
    "tool": "tool_name",
    "args": { "argName": "value" },
    "description": "Short explanation"
  }
]
`;
        const response = await callGLM(prompt);
        const jsonStr = extractCodeFromResponse(response) || response;
        const parsed = JSON.parse(jsonStr.replace(/```json|```/g, '').trim());
        
        if (Array.isArray(parsed)) {
            generatedSteps = parsed;
        }
    } catch (e) {
        // Fallback: simple split if AI fails
        if (args.steps) {
             generatedSteps = args.steps.split(',').map(s => ({ tool: s.trim(), args: {} }));
        }
    }

    if (generatedSteps.length === 0) {
         // Default fallback
         generatedSteps = [
             { tool: 'analyze_directory', args: { dirPath: args.projectPath || process.cwd() } },
             { tool: 'decompose_task', args: { task: args.goal } }
         ];
    }
    
    taskPlanner.addSteps(generatedSteps);

    return {
      content: [{ type: "text", text: `🎯 Plan Created & Enhanced\n\nPlan ID: ${plan.id}\nGoal: ${plan.goal}\nSteps: ${plan.steps.length}\n\nSteps Preview:\n${generatedSteps.map((s, i) => `${i+1}. **${s.tool}**: ${s.description || JSON.stringify(s.args)}`).join('\n')}\n\nUse 'execute_plan' with planId '${plan.id}' to start execution.` }]
    };
  },
  
  execute_plan: async (args) => {
    // State persistence fix: Use singleton
    let plan = taskPlanner.getPlan();
    
    // If not current plan or specific plan requested, try to restore
    if (!plan || (args.planId && plan.id !== args.planId)) {
        try {
            if (args.planId) {
                const restored = await taskPlanner.restoreFromCheckpoint(args.planId);
                plan = restored.plan;
            }
        } catch (e) {
             // Continue if restore fails, will check below
        }
    }

    if (!plan) {
         return { content: [{ type: "text", text: `❌ No active plan found${args.planId ? ` with ID ${args.planId}` : ''}. Create one first with plan_task.` }], isError: true };
    }
    
    if (args.planId && plan.id !== args.planId) {
        return { content: [{ type: "text", text: `❌ Could not load plan ${args.planId}. Active plan is ${plan.id}.` }], isError: true };
    }

    const currentStep = taskPlanner.getCurrentStep();
    if (!currentStep) {
        return { content: [{ type: "text", text: `✅ Plan completed! No steps remaining.` }] };
    }

    // Mark started
    await taskPlanner.markStepStarted();

    // In a full implementation, we would execute the tool here.
    // Since we don't have direct access to tool execution engine from this handler yet,
    // we return the instruction to the user/agent.
    
    return { 
        content: [{ type: "text", text: `▶️ **Executing Step ${currentStep.id}**\n\nTool: \`${currentStep.tool}\`\nArgs: \`${JSON.stringify(currentStep.args)}\`\n\nTo proceed, please execute this tool manually/autonomously.` }] 
    };
  },

  decompose_task: async (args) => {
      taskDecomposer.setProject(args.projectPath || process.cwd());
      const result = await taskDecomposer.decompose(args.task);
      return {
          content: [{ type: "text", text: `🧩 Task Decomposed\n\nTask ID: ${result.taskId}\nSubtasks: ${result.subtasks.length}\n\nExecution Plan:\n${JSON.stringify(result.executionPlan, null, 2)}` }]
      };
  },

  list_workflows: async () => {
      const workflows = listWorkflows();
      const list = workflows.map(w => `- **${w.key}**: ${w.name} (${w.stepCount} steps)`).join('\n');
      return { content: [{ type: "text", text: `AVAILABLE WORKFLOWS:\n\n${list}` }] };
  },

  run_workflow: async (args) => {
      const workflow = getWorkflow(args.workflow);
      if (!workflow) {
          return { content: [{ type: "text", text: `❌ Workflow '${args.workflow}' not found.` }], isError: true };
      }
      return {
          content: [{ type: "text", text: `🚀 Starting workflow: ${workflow.name}\n\nSteps:\n${JSON.stringify(workflow.steps, null, 2)}` }]
      };
  },
  
  remember: async (args) => {
      taskPlanner.memory.setSessionVariable(args.key, args.value);
      return { content: [{ type: "text", text: `🧠 Remembered: ${args.key}` }] };
  },
  
  recall: async (args) => {
      // Simplistic recall
      const context = taskPlanner.memory.getSessionContext();
      return { content: [{ type: "text", text: `🧠 Memory Recall:\n${JSON.stringify(context, null, 2)}` }] };
  },
  
  get_insights: async (args) => {
      return { content: [{ type: "text", text: `💡 Insights feature not fully initialized in this version.` }] };
  }
};
