export const REACT_EXPERT_RULES = `REACT EXPERT RULES (Strict Compliance):
- Components: Use Functional Components with Hooks. No Class Components.
- Styling: Prefer CSS Modules or Tailwind. Use semantic class names.
- State: Use useState/useReducer for local state. Context/Redux for global.
- Best Practices: Keys in lists, no direct DOM mutation, proper cleanup in useEffect.
- Performance: Use React.memo, useMemo, and useCallback where appropriate.`;

export const LARAVEL_EXPERT_RULES = `LARAVEL EXPERT RULES (Strict Compliance):
- Standards: Follow PSR-12 and Laravel's naming conventions (PascalCase for Controllers, camelCase for variables).
- Models: Use Eloquent for DB interactions. Massive assignment protection (fillable/guarded) is mandatory.
- Logic: Keep Controllers "Thin". Move complex business logic to Services, Actions, or Domain classes.
- Security: Always use CSRF protection (if Blade), escape output, and handle validation in Form Requests.
- Database: Use Migrations and Seeders. Never write raw SQL unless absolutely necessary.`;

export const NODE_EXPERT_RULES = `NODE.JS EXPERT RULES (Strict Compliance):
- Architecture: Use a layered architecture (Routes -> Controllers -> Services -> Models).
- Async: Use async/await for all I/O operations. Avoid callback hell.
- Error Handling: Use central error-handling middleware. Never let the process crash.
- Security: Sanitize inputs, use environment variables for secrets, follow OWASP Node.js security best practices.`;

export const VANILLA_EXPERT_RULES = `VANILLA JS & UI EXPERT RULES (Strict Compliance):
- Core: Use modern ES6+ (arrow functions, destructuring, template literals).
- DOM: Minimize direct DOM access. Use document fragments for bulk updates.
- Styling: High-level CSS (Flexbox, Grid, Animations, Variables).
- Premium: Implement "Cyberpunk/Neon" theme with glows, transitions, and glassmorphism.`;

export const ANGULAR_EXPERT_RULES = `ANGULAR EXPERT RULES (Strict Compliance):
- Version: Use Modern Angular (v16+) with Standalone Components.
- Language: TypeScript is MANDATORY. Use strict types. No 'any'.
- Reactive: Use RxJS for state and event handling. Use async pipe in templates.
- Structure: Follow the official Angular style guide (Component/Service separation).
- Styling: Use SCSS or CSS variables. Use encapsulation properly.`;

export function getFrameworkRules(stack = []) {
  if (!stack || stack.length === 0) return VANILLA_EXPERT_RULES;

  const detectedRules = [];
  const lowerStack = stack.map(s => s.toLowerCase());

  // Check for specialized hardcoded rules first (for maximum precision)
  if (lowerStack.some(s => s.includes('react'))) detectedRules.push(REACT_EXPERT_RULES);
  if (lowerStack.some(s => s.includes('laravel'))) detectedRules.push(LARAVEL_EXPERT_RULES);
  if (lowerStack.some(s => s.includes('angular'))) detectedRules.push(ANGULAR_EXPERT_RULES);
  if (lowerStack.some(s => s.includes('node') || s.includes('express'))) detectedRules.push(NODE_EXPERT_RULES);

  // DYNAMIC EXPERTISE INJECTION (For "All Languages/Frameworks" compatibility)
  const unknownStacks = stack.filter(s => {
      const ls = s.toLowerCase();
      return !['react', 'laravel', 'angular', 'node', 'express', 'js', 'javascript', 'html', 'css'].some(known => ls.includes(known));
  });

  if (unknownStacks.length > 0) {
      detectedRules.push(`UNIVERSAL EXPERT MODE (DYNAMIC):
Acting as a Lead Specialist for: ${unknownStacks.join(', ')}.
INSTRUCTIONS:
- Follow the official Linter rules and Best Practices of ${unknownStacks.join(' and ')}.
- Use idiomatic code patterns (e.g. "Pythonic" for Python, "Rustic" for Rust, "Go-way" for Go).
- Implement standard directory structures and naming conventions of these specific techs.
- Prioritize safety, performance, and maintainability as per the latest versions of these stacks.`);
  }

  // Base rules for UI/General stuff if needed
  if (detectedRules.length === 0) detectedRules.push(VANILLA_EXPERT_RULES);

  return detectedRules.join('\n\n---\n\n');
}
