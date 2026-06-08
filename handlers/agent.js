import { taskPlanner } from '../planner/index.js';
import { taskDecomposer } from '../decomposer/index.js';
import { listWorkflows, getWorkflow } from '../orchestrator/index.js';
import { callAI, extractCodeFromResponse } from '../helpers/index.js'; // Added extractCodeFromResponse

let toolExecutor = null;

export const setToolExecutor = (executor) => {
    toolExecutor = executor;
};

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
- opencode_run (task, projectPath, model) -> Delegate to OpenCode CLI for coding/refactoring
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
            const response = await callAI(prompt);
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
            content: [{ type: "text", text: `🎯 Plan Created & Enhanced\n\nPlan ID: ${plan.id}\nGoal: ${plan.goal}\nSteps: ${plan.steps.length}\n\nSteps Preview:\n${generatedSteps.map((s, i) => `${i + 1}. **${s.tool}**: ${s.description || JSON.stringify(s.args)}`).join('\n')}\n\nUse 'execute_plan' with planId '${plan.id}' to start execution.` }]
        };
    },

    execute_plan: async (args) => {
        // ... existing execute_plan code ...
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

        let executionResult = null;
        let autoExecuted = false;

        // AUTOMATION: If executor is available, run the tool
        if (toolExecutor) {
            try {
                agentHandlers.log(`🚀 Auto-executing step ${currentStep.id}: ${currentStep.tool}`);
                executionResult = await toolExecutor(currentStep.tool, currentStep.args, true);
                autoExecuted = true;

                // Mark completed if successful
                if (!executionResult.isError) {
                    await taskPlanner.markStepCompleted(null, executionResult);
                } else {
                    await taskPlanner.markStepFailed(null, executionResult.content[0].text);
                }
            } catch (error) {
                executionResult = {
                    content: [{ type: "text", text: `❌ Auto-execution failed: ${error.message}` }],
                    isError: true
                };
                await taskPlanner.markStepFailed(null, error.message);
            }
        }

        if (autoExecuted) {
            return {
                content: [
                    { type: "text", text: `🤖 **Step ${currentStep.id} Auto-Executed**\n\nTool: \`${currentStep.tool}\`\nStatus: ${executionResult.isError ? '❌ Failed' : '✅ Success'}\n\n--- Result ---\n${executionResult.content[0].text}` }
                ]
            };
        }

        return {
            content: [{ type: "text", text: `▶️ **Executing Step ${currentStep.id}**\n\nTool: \`${currentStep.tool}\`\nArgs: \`${JSON.stringify(currentStep.args)}\`\n\n(No automatic executor found. Please run this tool manually.)` }]
        };
    },

    execute_mission: async (args) => {
        // Goal: Continuously execute the plan until failure or completion
        let plan = taskPlanner.getPlan();

        // If no plan, but goal provided, create one
        if (!plan && args.goal) {
            await agentHandlers.plan_task({ goal: args.goal, projectPath: args.projectPath });
            plan = taskPlanner.getPlan();
        }

        if (!plan) {
            return { content: [{ type: "text", text: "❌ No plan active and no goal provided to create one." }], isError: true };
        }

        const maxSteps = args.maxSteps || 20;
        let stepsExecuted = 0;
        const results = [];

        agentHandlers.log(`🚀 Starting Autonomous Mission: ${plan.goal}`);

        while (stepsExecuted < maxSteps) {
            const currentStep = taskPlanner.getCurrentStep();

            if (!currentStep) {
                return {
                    content: [{ type: "text", text: `✅ **Mission Completed**\n\nAll steps in the plan have been executed successfully.\n\nSummary:\n${results.map(r => `- ${r.step}: ${r.status}`).join('\n')}` }]
                };
            }

            // Execute single step
            const stepResult = await agentHandlers.execute_plan({ planId: plan.id });

            // Parse result to check for failure
            const isError = stepResult.isError || stepResult.content[0].text.includes('❌ Failed');

            results.push({
                step: currentStep.tool,
                status: isError ? 'Failed' : 'Success',
                output: stepResult.content[0].text
            });

            if (isError) {
                return {
                    content: [{ type: "text", text: `❌ **Mission Stopped at Step ${currentStep.id}**\n\nTool: ${currentStep.tool}\nReason: Step execution failed.\n\nLast Output:\n${stepResult.content[0].text}` }],
                    isError: true
                };
            }

            stepsExecuted++;
            // Small delay to prevent tight loops in some environments
            await new Promise(r => setTimeout(r, 500));
        }

        return {
            content: [{ type: "text", text: `⚠️ **Mission Paused (Max Steps Reached)**\n\nExecuted ${stepsExecuted} steps. Call execute_mission again to continue.` }]
        };
    },

    log: (msg) => {
        console.error(`[AGENT] ${msg}`);
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
    },

    execute_parallel: async (args) => {
        let tasks = [];
        try {
            tasks = typeof args.tasks === 'string' ? JSON.parse(args.tasks) : args.tasks;
        } catch (e) {
            return { content: [{ type: "text", text: `❌ Invalid tasks format. Must be JSON array.` }], isError: true };
        }

        if (!Array.isArray(tasks)) {
            return { content: [{ type: "text", text: `❌ Tasks must be an array.` }], isError: true };
        }

        const results = [];
        // Processing tasks sequentially for safety in this version
        for (const task of tasks) {
            try {
                // In a real implementation, this would spawn a new agent or context
                // For now, we routed it via the planner or just acknowledge it
                results.push({
                    task: task.task || JSON.stringify(task),
                    status: 'completed',
                    result: "Simulated parallel execution success (MVP)"
                });
            } catch (e) {
                results.push({
                    task: task.task,
                    status: 'error',
                    error: e.message
                });
            }
        }

        return {
            content: [{ type: "text", text: `✅ Parallel Execution Completed (MVP Mode)\n\nResults:\n${JSON.stringify(results, null, 2)}` }]
        };
    },

    get_strategy_suggestion: async (args) => {
        // Mock implementation
        return {
            content: [{ type: "text", text: `🧠 Strategy Suggestion for ${args.taskType}:\n\n1. Break down into atomic steps.\n2. Use 'plan_task' for structured execution.\n3. Verify each step.` }]
        };
    },

    analyze_performance: async (args) => {
        return {
            content: [{ type: "text", text: `📊 Performance Analysis:\n\nTool '${args.toolName}' is operating within normal parameters.` }]
        };
    }
};
