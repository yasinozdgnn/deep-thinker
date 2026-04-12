export const REACT_EXPERT_RULES = `REACT EXPERT RULES (Strict Compliance):
- Components: Use Functional Components with Hooks. No Class Components.
- Styling: Prefer CSS Modules or Tailwind. Use semantic class names.
- State: Use useState/useReducer for local state. Context/Redux for global.
- Performance: Use React.memo, useMemo, and useCallback where appropriate.
- TEST PROTOCOL: If 'npm test' fails, check for missing props, broken hooks, or unmocked API calls.`;

export const LARAVEL_EXPERT_RULES = `LARAVEL EXPERT RULES (Strict Compliance):
- Models: Use Eloquent. Massive assignment protection (fillable/guarded) is mandatory.
- Logic: Keep Controllers "Thin". Use Services/Actions.
- Database: Use Migrations and Seeders.
- TEST PROTOCOL: Analyze 'phpunit' or 'pest' output. Verify CSRF, route bindings, and DB connectivity.`;

export const NODE_EXPERT_RULES = `NODE.JS EXPERT RULES (Strict Compliance):
- Architecture: Layered (Routes -> Controllers -> Services -> Models).
- Async: Use async/await. No callback hell.
- Error Handling: Use central error-handling middleware.
- TEST PROTOCOL: Focus on 'jest' or 'mocha' logs. Check for unhandled exceptions or connection timeouts.`;

export const VANILLA_EXPERT_RULES = `VANILLA JS & UI EXPERT RULES (Strict Compliance):
- Core: Use modern ES6+.
- DOM: Minimize direct access. Use fragments.
- Premium: Implement "Cyberpunk/Neon" theme with glows and glassmorphism.
- TEST PROTOCOL: Review browser console logs or runtime stderr for syntax errors.`;

export const ANGULAR_EXPERT_RULES = `ANGULAR EXPERT RULES (Strict Compliance):
- Version: Use Modern Angular (v16+) with Standalone Components.
- Language: TypeScript is MANDATORY. No 'any'.
- Reactive: Use RxJS and async pipe.
- TEST PROTOCOL: Analyze 'ng test' (Karma/Jest) output. Check for dependency injection errors.`;

export function getFrameworkRules(stack = []) {
  if (!stack || stack.length === 0) return VANILLA_EXPERT_RULES;

  const detectedRules = [];
  const lowerStack = stack.map(s => s.toLowerCase());

  // Check for specialized hardcoded rules first
  if (lowerStack.some(s => s.includes('react'))) detectedRules.push(REACT_EXPERT_RULES);
  if (lowerStack.some(s => s.includes('laravel'))) detectedRules.push(LARAVEL_EXPERT_RULES);
  if (lowerStack.some(s => s.includes('angular'))) detectedRules.push(ANGULAR_EXPERT_RULES);
  if (lowerStack.some(s => s.includes('node') || s.includes('express'))) detectedRules.push(NODE_EXPERT_RULES);

  // DYNAMIC EXPERTISE INJECTION
  const unknownStacks = stack.filter(s => {
      const ls = s.toLowerCase();
      return !['react', 'laravel', 'angular', 'node', 'express', 'js', 'javascript', 'html', 'css', 'php'].some(known => ls.includes(known));
  });

  if (unknownStacks.length > 0) {
      detectedRules.push(`UNIVERSAL EXPERT MODE (DYNAMIC):
Acting as a Lead Specialist for: ${unknownStacks.join(', ')}.
INSTRUCTIONS:
- Follow the official Best Practices of ${unknownStacks.join(' and ')}.
- Use idiomatic code patterns (e.g. "Pythonic", "Go-way").
- TEST PROTOCOL: Interpret language-specific error dump (e.g. Python Traceback, Go Panic) and identify the architectural or logic flaw.`);
  }

  // Base rules for UI/General stuff if needed
  if (detectedRules.length === 0) detectedRules.push(VANILLA_EXPERT_RULES);

  return detectedRules.join('\n\n---\n\n');
}
