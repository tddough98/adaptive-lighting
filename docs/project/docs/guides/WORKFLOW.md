# Workflow & Tooling Recommendations

> **Purpose**: Maximize development velocity with the right tools
> **Philosophy**: Use Claude for what it's good at, use specialized tools for the rest

---

## When to Use What

### Claude Projects (This Knowledge Base)

**Use for:**
- Storing this entire knowledge base as project context
- Design discussions and architecture decisions  
- Reviewing generated code before committing
- Asking questions about the codebase
- Drafting documentation

**Why:** Projects maintain context across conversations. Upload all the `/docs`, `/specs`, and `/context` folders as project knowledge. Every new conversation starts with full context.

**Setup:**
1. Create a Claude Project named "Adaptive Lighting Enhanced"
2. Upload all `.md` files from this knowledge base
3. Set custom instructions: "This is a Home Assistant custom component project. Reference the uploaded specs when implementing features."

### Claude Code (Terminal-Based)

**Use for:**
- All actual code generation (Python, TypeScript, React)
- File creation and modification
- Running tests and debugging
- Git operations
- Building and bundling

**Why:** Claude Code can execute commands, see file contents, and iterate quickly. It's 10x faster than copy-pasting code from chat.

**Workflow:**
```bash
# Start in the project directory
cd ~/adaptive-lighting-fork

# Launch Claude Code with context
claude --project "Adaptive Lighting Enhanced"

# Or load specific context files
claude --context docs/specs/TIMING_MODEL.md

# Example prompts:
# "Implement the EnhancedSunLightSettings class per the TIMING_MODEL.md spec"
# "Add unit tests for the overnight hold period edge case"
# "Build the React curve editor component per CURVE_EDITOR.md spec"
```

### GitHub Copilot (In-Editor)

**Use for:**
- Auto-completing boilerplate
- Quick inline suggestions while you're already in the editor
- Tab-completing imports and function signatures

**Why:** Lower latency for small completions. Doesn't interrupt flow.

**Don't use for:**
- Implementing full features (Claude Code is better)
- Understanding existing code (ask Claude Projects)

---

## Recommended Tools

### Essential (Install These)

| Tool | Purpose | Install |
|------|---------|---------|
| **Claude Code** | AI coding assistant | `npm install -g @anthropic-ai/claude-code` |
| **VS Code** | Editor | Standard install |
| **Node.js 20+** | React panel build | `nvm install 20` |
| **Python 3.12+** | HA component | `pyenv install 3.12` |
| **HACS** | Install custom components | Already have |
| **pnpm** | Fast package manager | `npm install -g pnpm` |

### Development Environment

```bash
# Clone the fork
git clone https://github.com/YOUR_USERNAME/adaptive-lighting.git
cd adaptive-lighting

# Set up Python environment
python -m venv venv
source venv/bin/activate
pip install -r requirements_dev.txt
pip install pytest pytest-asyncio pytest-homeassistant-custom-component

# Set up Node for panel development  
cd panel
pnpm install
```

### HA Dev Container (Recommended)

The adaptive-lighting repo includes a devcontainer config. Use it:

```bash
# In VS Code:
# 1. Install "Dev Containers" extension
# 2. Cmd+Shift+P → "Dev Containers: Reopen in Container"
# 3. You now have a full HA instance for testing
```

**Benefits:**
- Full Home Assistant instance running locally
- Hot reload for Python changes
- See your changes instantly

---

## Build & Test Pipeline

### Python Component

```bash
# Run tests
pytest tests/ -v

# Run specific test file
pytest tests/test_enhanced_timing.py -v

# Run with coverage
pytest tests/ --cov=custom_components/adaptive_lighting

# Type checking
mypy custom_components/adaptive_lighting

# Linting
ruff check custom_components/adaptive_lighting
```

### React Panel

```bash
cd panel

# Development server (with hot reload)
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### Integration Testing

```bash
# Start HA dev instance
hass -c ./config

# Or with devcontainer, it starts automatically

# Then test in browser:
# http://localhost:8123/adaptive-lighting
```

---

## File Watching & Hot Reload

### Python Changes

The devcontainer auto-reloads Python changes. If not using devcontainer:

```yaml
# In HA configuration.yaml during development
logger:
  default: info
  logs:
    custom_components.adaptive_lighting: debug

# Then restart HA after Python changes
# Or use the "Reload Custom Components" button in Developer Tools
```

### React Panel Changes

```bash
# In panel/ directory
pnpm dev

# This starts Vite dev server
# Changes hot-reload instantly
# Access at http://localhost:5173 for standalone testing
# Or http://localhost:8123/adaptive-lighting when embedded in HA
```

---

## Claude Code Prompting Patterns

### Starting a New Feature

```
Read the spec at specs/data-models/TIMING_MODEL.md and implement the
EnhancedSunLightSettings frozen dataclass in
custom_components/adaptive_lighting/enhanced_timing.py.

It should extend the existing SunLightSettings (frozen dataclass in
color_and_brightness.py). Include:
1. All dataclasses from the spec
2. The resolve_time function
3. The interpolate_with_sharpness function
4. The calculate_value function
5. Unit tests in tests/test_enhanced_timing.py
```

### Iterating on Existing Code

```
The overnight hold period calculation in enhanced_timing.py isn't handling 
the case where hold_start is 23:00 and hold_end is 05:00. 

Fix the get_phase function to correctly detect when we're in the hold 
period across midnight.
```

### Debugging

```
I'm getting this error when running pytest:

[paste error]

The relevant code is in enhanced_timing.py around line 45. 
What's wrong and how do I fix it?
```

### Code Review

```
Review this implementation of the curve editor for:
1. React best practices
2. Performance issues
3. Missing edge cases
4. Accessibility problems

[paste code or reference file]
```

---

## Git Workflow

### Branch Strategy

```
main                    # Stable, deployable
├── develop             # Integration branch
│   ├── feature/timing-model      # Enhanced timing
│   ├── feature/profiles          # Profile system
│   ├── feature/panel-scaffold    # React panel base
│   └── feature/curve-editor      # Curve editor component
```

### Commit Conventions

```bash
# Format: type(scope): description

feat(timing): implement enhanced brightness calculation
feat(profiles): add layer merging logic
feat(panel): add draggable time points to curve editor
fix(timing): handle overnight hold period correctly
docs(specs): update timing model with edge cases
test(timing): add tests for polar region sun times
```

### PR Checklist

- [ ] Tests pass (`pytest tests/ -v`)
- [ ] Types check (`mypy`)
- [ ] Linting passes (`ruff check`)
- [ ] Panel builds (`pnpm build`)
- [ ] Tested in local HA instance
- [ ] Spec updated if behavior changed
- [ ] CHANGELOG updated

---

## Debugging Tips

### HA Logs

```bash
# Watch logs live
tail -f config/home-assistant.log | grep adaptive_lighting

# Or in HA UI:
# Developer Tools → Logs → Filter by "adaptive_lighting"
```

### Browser DevTools

```javascript
// In browser console when panel is open:

// Get current HA connection
const hass = document.querySelector('home-assistant').hass;

// See all adaptive lighting entities
Object.entries(hass.states)
  .filter(([k]) => k.includes('adaptive_lighting'))
  .forEach(([k, v]) => console.log(k, v.attributes));

// Call a service manually
hass.callService('adaptive_lighting', 'change_switch_settings', {
  entity_id: 'switch.adaptive_lighting_bedroom',
  min_brightness: 20
});
```

### React DevTools

Install React DevTools browser extension. Useful for:
- Inspecting component state
- Profiling re-renders
- Debugging hooks

---

## Performance Monitoring

### Python Profiling

```python
# Add to switch.py during debugging
import cProfile
import pstats

profiler = cProfile.Profile()
profiler.enable()

# ... code to profile ...

profiler.disable()
stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats(10)  # Top 10 functions
```

### React Profiling

```typescript
// In development, use React.Profiler
<Profiler id="CurveEditor" onRender={onRenderCallback}>
  <CurveEditor {...props} />
</Profiler>

function onRenderCallback(
  id, phase, actualDuration, baseDuration, startTime, commitTime
) {
  console.log(`${id} ${phase}: ${actualDuration.toFixed(2)}ms`);
}
```

---

## Estimated Timeline

| Phase | Tasks | Claude Code Time | Calendar Time |
|-------|-------|------------------|---------------|
| 1: Foundation | Timing model + tests | 4 hours | 1-2 days |
| 2: Panel Scaffold | React + HA integration | 3 hours | 1 day |
| 3: Curve Editor | Interactive UI | 4 hours | 2 days |
| 4: Profiles | Layer system | 3 hours | 1 day |
| 5: Polish | Year slider, link toggle | 2 hours | 1 day |
| 6: Testing | Integration tests | 2 hours | 1 day |

**Total: ~18 hours of Claude Code work, ~1-2 weeks calendar time**

---

## Quick Reference Commands

```bash
# Start development
cd ~/adaptive-lighting-fork
source venv/bin/activate
code .

# Run tests
pytest tests/ -v

# Build panel
cd panel && pnpm build && cd ..

# Copy to HA (if not using devcontainer)
cp -r custom_components/adaptive_lighting ~/.homeassistant/custom_components/

# Restart HA
ha core restart  # If using HA CLI

# Launch Claude Code with context
claude --context MASTER_PLAN.md

# Git status check
git status && git diff --stat
```
