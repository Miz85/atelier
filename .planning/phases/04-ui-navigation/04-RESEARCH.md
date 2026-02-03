# Phase 4: UI/Navigation - Research

**Researched:** 2026-02-03
**Domain:** Multi-pane terminal UI with keyboard navigation in Ink (React for CLIs)
**Confidence:** HIGH

## Summary

Phase 4 requires building a three-pane layout with keyboard-driven navigation in Ink, a React renderer for terminal applications. The standard approach leverages Ink's built-in Box component with Flexbox layout, useFocus/useFocusManager hooks for focus management, and useInput with isActive parameter to prevent keyboard shortcut conflicts.

The critical architectural challenge is integrating with the existing tmux-based agent system (from Phase 3). When users attach to agents, equipe uses spawnSync to completely block Node.js, giving tmux full terminal control. This means the UI must cleanly handle suspension and restoration, with focus indicators that accurately reflect whether Ink or tmux controls input routing.

Key findings:
- Ink's Flexbox-based Box component handles responsive multi-pane layouts
- useFocus + useFocusManager provide Tab navigation between panes
- useInput's isActive parameter prevents duplicate input handling across components
- Static component from Phase 3 already handles large output efficiently
- Modal overlays for help screens use conditional rendering with Box borders
- useStdoutDimensions enables responsive layout adaptation to terminal resize

**Primary recommendation:** Build three-pane layout with Box flexDirection="row", implement focus management with useFocus/useFocusManager, use isActive guards in useInput hooks, create help screen modal with conditional rendering, and leverage tmux attachment with proper Ink suspension.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ink | 5.2.1+ | React-based TUI rendering | Already in stack (Phase 1), provides Box/Text/useInput/useFocus, 2x perf improvement in v3, powers many major CLIs |
| jotai | 2.17+ | State management | Already in stack, manages focus state atoms, UI mode state |
| react | 18.3+ | Component framework | Already in stack, Ink dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ink-text-input | 6.0+ | Text input component | Already in stack, used in CreateWorkspace |
| ink-select-input | 6.2+ | Menu selection component | If adding keyboard-navigable menus (optional) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Ink Box | ink-box (deprecated) | ink-box is deprecated, Ink's built-in Box has all needed features |
| Custom focus manager | Manual state tracking | useFocus/useFocusManager are built-in, battle-tested, handle Tab/Shift+Tab |
| Custom modal overlay | Third-party modal lib | No mature modal lib for Ink, conditional rendering with Box borders is standard pattern |

**Installation:**
No new packages required - all needed functionality is in existing dependencies (ink, jotai, react).

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/           # Ink components
│   ├── ThreePaneLayout.tsx    # Main layout container
│   ├── AgentPane.tsx          # Agent output pane (reuses AgentView)
│   ├── DiffSummaryPane.tsx    # Diff summary pane (Phase 5)
│   ├── TerminalPane.tsx       # Terminal pane (Phase 5)
│   ├── HelpScreen.tsx         # Keyboard shortcuts modal
│   └── FocusIndicator.tsx     # Visual focus indicator component
└── state/
    └── ui.ts             # UI state atoms (focus, active pane, help visibility)
```

### Pattern 1: Three-Pane Layout with Flexbox
**What:** Horizontal split layout with three columns using Box flexDirection
**When to use:** Main application layout (UI-01)
**Example:**
```typescript
// Source: https://github.com/vadimdemedes/ink + https://developerlife.com/2021/11/25/ink-v3-advanced-ui-components/
import React from 'react';
import { Box } from 'ink';

const ThreePaneLayout = () => {
  return (
    <Box flexDirection="row" height="100%">
      {/* Left pane: Agent output */}
      <Box flexDirection="column" width="40%" borderStyle="single" borderColor="cyan">
        <AgentPane />
      </Box>

      {/* Center pane: Diff summary */}
      <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="gray">
        <DiffSummaryPane />
      </Box>

      {/* Right pane: Terminal */}
      <Box flexDirection="column" width="30%" borderStyle="single" borderColor="gray">
        <TerminalPane />
      </Box>
    </Box>
  );
};
```

### Pattern 2: Focus Management with useFocus
**What:** Enable Tab navigation between panes using Ink's focus hooks
**When to use:** Each pane that should be keyboard-navigable (UI-02)
**Example:**
```typescript
// Source: https://github.com/vadimdemedes/ink + https://developerlife.com/2021/11/25/ink-v3-advanced-ui-components/
import React from 'react';
import { Box, Text, useFocus } from 'ink';

interface PaneProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

const FocusablePane: React.FC<PaneProps> = ({ id, title, children }) => {
  const { isFocused } = useFocus({ id });

  return (
    <Box
      flexDirection="column"
      borderStyle={isFocused ? 'double' : 'single'}
      borderColor={isFocused ? 'cyan' : 'gray'}
    >
      <Text bold color={isFocused ? 'cyan' : 'white'}>
        {title}
      </Text>
      {children}
    </Box>
  );
};
```

### Pattern 3: Preventing Input Conflicts with isActive
**What:** Use isActive parameter to control which component processes keyboard input
**When to use:** Multiple useInput hooks in the UI to avoid duplicate handling (UI-04)
**Example:**
```typescript
// Source: https://github.com/vadimdemedes/ink/blob/master/src/hooks/use-input.ts
import { useInput, useFocus } from 'ink';

const AgentPane = () => {
  const { isFocused } = useFocus({ id: 'agent-pane' });

  // Only handle input when this pane is focused
  useInput((input, key) => {
    if (key.return) {
      // Attach to agent
      handleAttach();
    }
  }, { isActive: isFocused });

  return <Box>...</Box>;
};
```

### Pattern 4: Help Screen Modal Overlay
**What:** Conditional rendering of help screen over main UI
**When to use:** Displaying keyboard shortcuts with ? key (UI-03)
**Example:**
```typescript
// Source: https://combray.prose.sh/2025-12-01-tui-development + Ink patterns
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

const HelpScreen = ({ onClose }: { onClose: () => void }) => {
  useInput((input, key) => {
    if (input === '?' || key.escape) {
      onClose();
    }
  });

  return (
    <Box
      position="absolute"
      width="60%"
      height="80%"
      borderStyle="double"
      borderColor="yellow"
      flexDirection="column"
      padding={1}
    >
      <Text bold color="yellow">Keyboard Shortcuts</Text>
      <Box flexDirection="column" marginTop={1}>
        <Text>Tab         - Next pane</Text>
        <Text>Shift+Tab   - Previous pane</Text>
        <Text>Enter       - Attach to agent (when focused)</Text>
        <Text>?           - Toggle this help</Text>
        <Text>q           - Quit</Text>
        <Text>Esc         - Close modal / Go back</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press ? or Esc to close</Text>
      </Box>
    </Box>
  );
};

// In main app:
const [showHelp, setShowHelp] = useState(false);

useInput((input) => {
  if (input === '?') {
    setShowHelp(!showHelp);
  }
});

return (
  <Box>
    <ThreePaneLayout />
    {showHelp && <HelpScreen onClose={() => setShowHelp(false)} />}
  </Box>
);
```

### Pattern 5: Responsive Layout with useStdoutDimensions
**What:** Adapt layout to terminal size changes
**When to use:** Handling terminal resize to maintain usability (UI-05)
**Example:**
```typescript
// Source: https://app.studyraid.com/en/read/11921/379932/creating-responsive-cli-layouts
import { Box, useStdoutDimensions } from 'ink';

const ResponsiveLayout = () => {
  const { columns, rows } = useStdoutDimensions();

  // Switch to vertical layout on narrow terminals
  const direction = columns < 100 ? 'column' : 'row';

  return (
    <Box flexDirection={direction}>
      <Box width={direction === 'row' ? '40%' : '100%'}>
        <AgentPane />
      </Box>
      <Box flexGrow={1}>
        <DiffSummaryPane />
      </Box>
    </Box>
  );
};
```

### Pattern 6: Programmatic Focus Control
**What:** Use useFocusManager to set focus programmatically
**When to use:** Setting initial focus, focus after modal close, focus shortcuts
**Example:**
```typescript
// Source: https://developerlife.com/2021/11/25/ink-v3-advanced-ui-components/
import { useFocusManager, useInput } from 'ink';

const App = () => {
  const { focus } = useFocusManager();

  useInput((input) => {
    // Direct focus shortcuts (Shift+1, Shift+2, Shift+3)
    if (input === '!' || input === '1') {
      focus('agent-pane');
    }
    if (input === '@' || input === '2') {
      focus('diff-pane');
    }
    if (input === '#' || input === '3') {
      focus('terminal-pane');
    }
  });

  return <ThreePaneLayout />;
};
```

### Pattern 7: tmux Integration with Focus State
**What:** Handle focus correctly when attaching to tmux (blocks Ink)
**When to use:** Agent attach workflow from Phase 3 integration
**Example:**
```typescript
// Based on existing src/components/AgentView.tsx + tmux patterns
import { useAtom } from 'jotai';
import { attachToAgent } from '../agents/spawn.js';

const AgentPane = () => {
  const [attaching, setAttaching] = useState(false);

  const handleAttach = () => {
    if (attaching) return;

    setAttaching(true);

    try {
      // This blocks completely until user detaches (Ctrl+B D)
      // spawnSync in tmux.ts takes over terminal
      attachToAgent(agentId);

      // After detach, Ink redraws automatically
      // Sync status in case agent exited
      syncAgentStatus(agentId);
    } catch (err) {
      // Handle error
    } finally {
      setAttaching(false);
    }
  };

  return <Box>...</Box>;
};
```

### Anti-Patterns to Avoid
- **Not using isActive with multiple useInput:** Leads to duplicate keyboard handling, all components process same keystroke
- **Mixing console.log with Ink rendering:** Corrupts layout - use useStderr hook or Static component instead
- **Forgetting to check isFocused before handling input:** Causes unfocused panes to process input
- **Using absolute positioning without constraints:** Can overflow terminal, use percentage widths or flexGrow
- **Not handling terminal resize:** Fixed layouts break on small terminals, use useStdoutDimensions
- **Blocking Ink thread without spawnSync:** Async operations during tmux attach cause rendering conflicts

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus management | Custom Tab handling state | useFocus + useFocusManager | Built-in Tab/Shift+Tab support, automatic focus cycling, proven pattern |
| Flexbox layout | Custom terminal positioning | Ink Box with flexDirection | Uses Yoga layout engine (from React Native), handles edge cases, responsive |
| Modal overlays | Third-party modal library | Conditional rendering with Box | No mature Ink modal lib exists, Box with position + conditional render is standard |
| Terminal dimensions | Manual SIGWINCH handler | useStdoutDimensions hook | Automatic updates on resize, integrated with Ink's rendering |
| Input routing | Manual keyboard dispatcher | useInput with isActive | Prevents duplicate handling, type-safe, declarative |
| Debugging Ink apps | console.log (corrupts UI) | useStderr hook | Writes above Ink output, preserves layout |

**Key insight:** Ink provides hooks for almost all common TUI patterns. Custom solutions miss integration with Ink's rendering cycle and can cause visual corruption or input conflicts. The ecosystem has converged on these patterns through extensive battle-testing in production CLIs.

## Common Pitfalls

### Pitfall 1: Focus Indicator Not Matching Actual Input Routing
**What goes wrong:** UI shows one pane as focused but keyboard input goes to a different component, or focus indicator persists while tmux has control (UI-04)
**Why it happens:** Not coordinating isActive state with isFocused, or not clearing focus indicators during tmux attachment
**How to avoid:**
- Always use `isActive: isFocused` in useInput hooks
- Set attaching state during tmux attach to disable all Ink input handling
- Verify focus indicator border matches which component's useInput is processing input
**Warning signs:** Pressing keys does nothing, keys trigger wrong pane actions, focus indicator shows during tmux session

### Pitfall 2: console.log Breaking Layout
**What goes wrong:** console.log output appears mixed with Ink UI, causing visual corruption
**Why it happens:** console.log writes directly to stdout while Ink controls stdout for rendering
**How to avoid:** Use useStderr hook to write debug messages above Ink output:
```typescript
import { useStderr } from 'ink';

const { write } = useStderr();
write('Debug message\n');
```
**Warning signs:** UI flickering, debug messages appearing in wrong places, layout shifts

### Pitfall 3: Modal Not Capturing All Input
**What goes wrong:** Help screen modal overlay displays but background components still process keyboard input
**Why it happens:** Background components' useInput hooks still have isActive: true
**How to avoid:** Use a modal visibility atom to control isActive for all panes:
```typescript
const [showHelp] = useAtom(showHelpAtom);

// In each pane:
useInput((input, key) => {
  // Handle input
}, { isActive: isFocused && !showHelp });
```
**Warning signs:** Background actions trigger while modal is open, modal loses focus

### Pitfall 4: Static Component Used for Dynamic Content
**What goes wrong:** Content that should update doesn't change on screen
**Why it happens:** Static component is append-only, designed for completed logs not live updates (pattern from Phase 3)
**How to avoid:** Use Static only for immutable history (agent output logs), use regular Text components for status/counters/dynamic content
**Warning signs:** Updates to content don't render, expecting Static to behave like normal React component

### Pitfall 5: Not Handling Small Terminal Sizes
**What goes wrong:** Layout breaks, text overflows, borders misalign when terminal is narrow
**Why it happens:** Fixed width percentages or missing responsive breakpoints
**How to avoid:** Use useStdoutDimensions to switch layouts:
```typescript
const { columns } = useStdoutDimensions();

if (columns < 80) {
  return <Text color="red">Terminal too narrow. Minimum 80 columns required.</Text>;
}

// Or adapt layout:
const layout = columns < 120 ? 'compact' : 'full';
```
**Warning signs:** Layout breaks on resize, users with small terminals report visual issues

### Pitfall 6: Focus Lost After Modal Close
**What goes wrong:** After closing help modal with Esc, no pane has focus and keyboard navigation stops working
**Why it happens:** Modal close doesn't restore previous focus state
**How to avoid:** Store focus state before opening modal, restore after close:
```typescript
const [previousFocus, setPreviousFocus] = useState<string | null>(null);
const { focus, focusId } = useFocusManager();

const openHelp = () => {
  setPreviousFocus(focusId);
  setShowHelp(true);
};

const closeHelp = () => {
  setShowHelp(false);
  if (previousFocus) {
    focus(previousFocus);
  }
};
```
**Warning signs:** Tab stops working after modal, no pane appears focused

### Pitfall 7: Excessive Re-renders Causing Performance Issues
**What goes wrong:** UI becomes sluggish, high CPU usage, especially when agent outputs many lines (UI-05)
**Why it happens:** Updating large arrays or objects in atoms on every data chunk, causing full component tree re-renders
**How to avoid:**
- Use Static component for agent output (already done in Phase 3)
- Throttle atom updates (batch updates every 100ms instead of per-character)
- Use derived atoms instead of computed values in render
- Leverage React.memo for expensive components
**Warning signs:** CPU spikes during output, UI lag, frame drops

## Code Examples

Verified patterns from official sources:

### Complete Three-Pane Layout with Focus Management
```typescript
// Source: Combined from https://github.com/vadimdemedes/ink + https://developerlife.com/2021/11/25/ink-v3-advanced-ui-components/
import React, { useState } from 'react';
import { Box, Text, useInput, useFocus, useFocusManager } from 'ink';
import { useAtom } from 'jotai';

interface PaneProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

const FocusablePane: React.FC<PaneProps> = ({ id, title, children }) => {
  const { isFocused } = useFocus({ id });

  return (
    <Box
      flexDirection="column"
      borderStyle={isFocused ? 'double' : 'single'}
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      <Text bold color={isFocused ? 'cyan' : 'white'}>
        {isFocused ? '▶ ' : '  '}{title}
      </Text>
      <Box marginTop={1}>
        {children}
      </Box>
    </Box>
  );
};

const ThreePaneApp = () => {
  const [showHelp, setShowHelp] = useState(false);
  const { focus } = useFocusManager();

  // Global keyboard shortcuts
  useInput((input, key) => {
    if (input === '?' && !showHelp) {
      setShowHelp(true);
    }
    if (key.escape && showHelp) {
      setShowHelp(false);
    }
    // Direct focus shortcuts
    if (input === '!') focus('left-pane');
    if (input === '@') focus('center-pane');
    if (input === '#') focus('right-pane');
  }, { isActive: !showHelp });

  return (
    <Box flexDirection="column" height="100%">
      <Box flexDirection="row" flexGrow={1}>
        <FocusablePane id="left-pane" title="Agent Output">
          <Text>Agent output content...</Text>
        </FocusablePane>

        <FocusablePane id="center-pane" title="Diff Summary">
          <Text>Diff summary content...</Text>
        </FocusablePane>

        <FocusablePane id="right-pane" title="Terminal">
          <Text>Terminal content...</Text>
        </FocusablePane>
      </Box>

      {showHelp && (
        <Box
          position="absolute"
          width="60%"
          height="80%"
          borderStyle="double"
          borderColor="yellow"
          flexDirection="column"
          padding={1}
        >
          <Text bold color="yellow">Keyboard Shortcuts</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text>Tab / Shift+Tab  - Navigate panes</Text>
            <Text>! @ #            - Jump to pane 1/2/3</Text>
            <Text>?                - Toggle help</Text>
            <Text>Esc              - Close help</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
```

### Pane-Specific Keyboard Handling with isActive
```typescript
// Source: https://github.com/vadimdemedes/ink + focus management patterns
import { useFocus, useInput } from 'ink';
import { useAtom } from 'jotai';
import { showHelpAtom } from '../state/ui.js';

const AgentPane = () => {
  const { isFocused } = useFocus({ id: 'agent-pane' });
  const [showHelp] = useAtom(showHelpAtom);
  const [attaching, setAttaching] = useState(false);

  // Only process input when focused, not showing help, and not attaching
  useInput((input, key) => {
    if (key.return) {
      handleAttach();
    }
    if (input === 's') {
      handleStart();
    }
    if (input === 'x') {
      handleStop();
    }
  }, { isActive: isFocused && !showHelp && !attaching });

  const handleAttach = () => {
    setAttaching(true);
    try {
      // Blocks until user detaches
      attachToAgent(agentId);
    } finally {
      setAttaching(false);
    }
  };

  return (
    <Box flexDirection="column">
      <Text>Agent controls: s=start x=stop Enter=attach</Text>
      {attaching && <Text color="yellow">Attached to agent (Ctrl+B D to detach)</Text>}
    </Box>
  );
};
```

### Help Screen Component
```typescript
// Source: Terminal UI patterns + Ink conditional rendering
import React from 'react';
import { Box, Text, useInput } from 'ink';

interface HelpScreenProps {
  onClose: () => void;
}

export const HelpScreen: React.FC<HelpScreenProps> = ({ onClose }) => {
  useInput((input, key) => {
    if (input === '?' || key.escape) {
      onClose();
    }
  });

  return (
    <Box
      position="absolute"
      width="70%"
      height="90%"
      borderStyle="double"
      borderColor="yellow"
      flexDirection="column"
      padding={2}
    >
      <Text bold color="yellow" underline>Keyboard Shortcuts</Text>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Navigation:</Text>
        <Text>  Tab           - Focus next pane</Text>
        <Text>  Shift+Tab     - Focus previous pane</Text>
        <Text>  ! / @ / #     - Jump to pane 1 / 2 / 3</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Agent Control (when Agent pane focused):</Text>
        <Text>  s             - Start agent</Text>
        <Text>  x             - Stop agent</Text>
        <Text>  r             - Restart agent</Text>
        <Text>  Enter         - Attach to agent session</Text>
        <Text dimColor>    (Ctrl+B D to detach)</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Global:</Text>
        <Text>  ?             - Toggle this help</Text>
        <Text>  q             - Quit application</Text>
        <Text>  Esc           - Go back / Close modal</Text>
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Press ? or Esc to close</Text>
      </Box>
    </Box>
  );
};
```

### Responsive Layout Adaptation
```typescript
// Source: https://app.studyraid.com/en/read/11921/379932/creating-responsive-cli-layouts
import { Box, Text, useStdoutDimensions } from 'ink';

const ResponsiveThreePaneLayout = () => {
  const { columns, rows } = useStdoutDimensions();

  // Minimum terminal size check
  if (columns < 80 || rows < 20) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>Terminal Too Small</Text>
        <Text>Minimum size: 80 columns × 20 rows</Text>
        <Text>Current: {columns} columns × {rows} rows</Text>
      </Box>
    );
  }

  // Adapt layout based on width
  const isCompact = columns < 120;

  return (
    <Box flexDirection="row">
      <Box width={isCompact ? '50%' : '40%'}>
        <AgentPane />
      </Box>
      <Box flexGrow={1}>
        <DiffSummaryPane />
      </Box>
      {!isCompact && (
        <Box width="30%">
          <TerminalPane />
        </Box>
      )}
    </Box>
  );
};
```

### Debug Messages Without Breaking Layout
```typescript
// Source: https://github.com/vadimdemedes/ink + useStderr pattern
import { useStderr } from 'ink';
import { useEffect } from 'react';

const AgentPane = () => {
  const { write } = useStderr();

  useEffect(() => {
    // Debug messages go to stderr, above Ink UI
    write('[DEBUG] AgentPane mounted\n');

    return () => {
      write('[DEBUG] AgentPane unmounted\n');
    };
  }, []);

  // Never use console.log in Ink components - it breaks layout
  // Use useStderr instead

  return <Box>...</Box>;
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ink-box package | Built-in Box component | Ink 3.0+ (2021) | ink-box deprecated, Box has all features built-in |
| Manual focus state | useFocus/useFocusManager | Ink 3.0+ (2021) | Built-in Tab/Shift+Tab, automatic focus cycling, programmatic control |
| Custom virtual scrolling | Static component | Ink 3.0+ (2021) | 2x performance improvement, append-only logs optimized |
| Manual layout calculations | Yoga Layout engine | Ink 2.0+ | Flexbox in terminal, same as React Native, responsive by default |
| Manual terminal size tracking | useStdoutDimensions | Ink 3.2+ | Automatic resize handling, integrated with rendering |
| EventEmitter for input | useInput hook | Ink 3.0+ | Declarative, prevents leaks, isActive parameter for control |

**Deprecated/outdated:**
- **ink-box:** Package deprecated, use built-in Box component instead
- **Manual stdin.on('data'):** Use useInput hook, prevents raw mode issues
- **console.log for debugging:** Corrupts Ink layout, use useStderr hook
- **Fixed position layouts:** Use Flexbox with percentage widths or flexGrow for responsiveness

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal pane width ratios**
   - What we know: Flexbox supports percentages, flexGrow, fixed widths
   - What's unclear: Best default split (40/40/20? 33/33/33? Dynamic based on content?)
   - Recommendation: Start with 40% agent / 40% diff / 20% terminal, make configurable later based on user feedback

2. **Terminal size validation strategy**
   - What we know: Can check columns/rows with useStdoutDimensions
   - What's unclear: Minimum usable size (80x24? 100x30?), whether to block or adapt layout
   - Recommendation: Show warning below 80x20, gracefully degrade layout below 120 columns (hide terminal pane)

3. **Focus restoration after tmux detach**
   - What we know: spawnSync blocks completely, Ink redraws after
   - What's unclear: Does focus state persist correctly, or need manual restoration?
   - Recommendation: Test thoroughly, may need to store and restore focus ID around attach/detach

4. **Help screen positioning**
   - What we know: Can use position="absolute" with Box
   - What's unclear: Whether absolute positioning works reliably across terminal emulators, or if centered overlay needs manual calculation
   - Recommendation: Test with percentage width/height first, fall back to manual centering if needed

5. **Keyboard shortcut discoverability**
   - What we know: ? key for help is standard TUI pattern
   - What's unclear: Whether to show persistent help hint in UI, or rely on ? discovery
   - Recommendation: Show "Press ? for help" in footer or corner initially, hide after first help view

## Sources

### Primary (HIGH confidence)
- [Ink GitHub repository](https://github.com/vadimdemedes/ink) - Official documentation, hooks API, Box component
- [Ink 3 announcement](https://vadimdemedes.com/posts/ink-3) - Static component performance, focus management features
- [developerlife.com Ink v3 handbook](https://developerlife.com/2021/11/25/ink-v3-advanced-ui-components/) - useFocus/useFocusManager patterns, multi-pane examples
- [TUI Development: Ink + React (Dec 2025)](https://combray.prose.sh/2025-12-01-tui-development) - Current state of Ink ecosystem, best practices
- [StudyRaid: Creating responsive CLI layouts](https://app.studyraid.com/en/read/11921/379932/creating-responsive-cli-layouts) - useStdoutDimensions patterns, responsive design
- [StudyRaid: Keyboard input processing](https://app.studyraid.com/en/read/11921/379937/keyboard-input-processing) - useInput hook details

### Secondary (MEDIUM confidence)
- [Microsoft Learn: Keyboard UI Guidelines](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/dnacc/guidelines-for-keyboard-user-interface-design) - Tab navigation patterns, pane switching standards
- [Medium: Building CLI tools with React using Ink](https://medium.com/trabe/building-cli-tools-with-react-using-ink-and-pastel-2e5b0d3e2793) - useStderr pattern, debugging
- [npm: ink-select-input](https://www.npmjs.com/package/ink-select-input) - Supporting library ecosystem
- [npm: ink-text-input](https://www.npmjs.com/package/ink-text-input) - Input component patterns

### Tertiary (LOW confidence - validation recommended)
- WebSearch results on terminal UI patterns (2025-2026) - General TUI best practices, modal patterns
- [GitHub Issue: Claude Code scroll events](https://github.com/anthropics/claude-code/issues/9935) - Performance considerations for large output (4000+ scrolls/second)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Ink is de facto standard for React-based TUIs, verified through official docs and ecosystem usage
- Architecture: HIGH - Patterns verified through official Ink documentation, recent tutorials (Dec 2025), and type definitions
- Pitfalls: MEDIUM - Derived from community tutorials, GitHub issues, and best practice guides; tmux integration pitfall is project-specific inference

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - Ink is stable, patterns unlikely to change rapidly)
