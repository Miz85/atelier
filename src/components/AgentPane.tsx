// src/components/AgentPane.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useFocus, useStdout } from 'ink';
import { useAtom, useSetAtom } from 'jotai';
import {
  spawnAgent,
  stopAgent,
  restartAgent,
  syncAgentStatus,
  getAgentInstance,
} from '../agents/spawn.js';
import {
  capturePane,
  sendKeys,
  hasSession,
  resizeSession,
} from '../agents/tmux.js';
import {
  getWorkspaceAgentStateAtom,
  initAgentStateAtom,
  setStatusAtom,
} from '../state/agents.js';
import { showHelpAtom } from '../state/ui.js';
import type { Workspace } from '../state/workspace.js';

interface AgentPaneProps {
  workspace: Workspace;
}

/**
 * Agent pane with embedded tmux session.
 * Shows real-time terminal content and forwards keystrokes when focused.
 */
export function AgentPane({ workspace }: AgentPaneProps) {
  const { isFocused } = useFocus({ id: 'agent-pane' });
  const [showHelp] = useAtom(showHelpAtom);
  const { stdout } = useStdout();

  // Agent state for this workspace
  const workspaceAgentStateAtom = getWorkspaceAgentStateAtom(workspace.id);
  const [agentState] = useAtom(workspaceAgentStateAtom);

  // Action atoms
  const initAgentState = useSetAtom(initAgentStateAtom);
  const setStatus = useSetAtom(setStatusAtom);

  // UI state
  const [terminalContent, setTerminalContent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const lastContentRef = useRef<string>('');
  const autoStartedRef = useRef(false);

  // Derived status for controls (map 'idle' to 'stopped')
  const controlStatus = agentState.status === 'idle' ? 'stopped' : agentState.status;

  // Calculate available height for terminal content
  const terminalHeight = Math.max(10, (stdout?.rows || 24) - 10);

  // Resize tmux session to match pane dimensions
  useEffect(() => {
    if (!hasSession(workspace.id)) return;
    resizeSession(workspace.id);
  }, [workspace.id, stdout?.columns, stdout?.rows]);

  // Capture tmux content periodically (fast refresh for responsiveness)
  useEffect(() => {
    if (!hasSession(workspace.id)) return;

    const captureContent = () => {
      const content = capturePane(workspace.id, terminalHeight);
      if (content !== lastContentRef.current) {
        lastContentRef.current = content;
        const lines = content.split('\n');
        setTerminalContent(lines.slice(-terminalHeight));
      }
    };

    // Initial capture
    captureContent();

    // Fast refresh when focused, slower when not
    const interval = setInterval(captureContent, isFocused ? 100 : 500);
    return () => clearInterval(interval);
  }, [workspace.id, terminalHeight, isFocused]);

  // Sync agent status periodically
  useEffect(() => {
    if (!agentState.agentId) return;

    const interval = setInterval(() => {
      syncAgentStatus(agentState.agentId!);
      const instance = getAgentInstance(agentState.agentId!);
      if (instance && instance.status !== agentState.status) {
        setStatus({
          workspaceId: workspace.id,
          status: instance.status,
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [agentState.agentId, agentState.status, workspace.id, setStatus]);

  // Auto-start agent on mount if not running
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (controlStatus === 'stopped' || controlStatus === 'error' || agentState.status === 'idle') {
      autoStartedRef.current = true;
      try {
        const instance = spawnAgent(workspace.id, workspace.path, workspace.agent);
        initAgentState({ workspaceId: workspace.id, agentId: instance.id });
      } catch (err) {
        setStatus({
          workspaceId: workspace.id,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else if (controlStatus === 'running') {
      autoStartedRef.current = true;
    }
  }, [controlStatus, agentState.status, workspace.id, workspace.path, workspace.agent, initAgentState, setStatus]);

  // Handle agent stop
  const handleStop = async () => {
    if (!agentState.agentId) return;
    setLoading(true);
    try {
      await stopAgent(agentState.agentId);
      setStatus({ workspaceId: workspace.id, status: 'stopped' });
      setTerminalContent([]);
      lastContentRef.current = '';
    } catch (err) {
      setStatus({
        workspaceId: workspace.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle agent restart
  const handleRestart = () => {
    if (!agentState.agentId) return;
    setLoading(true);
    try {
      const instance = restartAgent(agentState.agentId);
      initAgentState({ workspaceId: workspace.id, agentId: instance.id });
      setTerminalContent([]);
      lastContentRef.current = '';
    } catch (err) {
      setStatus({
        workspaceId: workspace.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle agent start
  const handleStart = () => {
    setLoading(true);
    try {
      const instance = spawnAgent(workspace.id, workspace.path, workspace.agent);
      initAgentState({ workspaceId: workspace.id, agentId: instance.id });
    } catch (err) {
      setStatus({
        workspaceId: workspace.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  // Forward keystrokes to tmux when focused and agent is running
  useInput((input, key) => {
    if (loading) return;

    // Control shortcuts (not forwarded to tmux)
    if (!key.ctrl && !key.meta) {
      // Stop agent with Ctrl+X (we use 'X' uppercase to avoid conflicts)
      if (input === 'X' && controlStatus === 'running') {
        handleStop();
        return;
      }

      // Start/restart when not running
      if (controlStatus !== 'running') {
        if (input === 's') {
          handleStart();
          return;
        }
        if (input === 'r' && controlStatus === 'stopped') {
          handleRestart();
          return;
        }
        return; // Don't forward input when agent not running
      }
    }

    // Forward input to tmux
    if (controlStatus === 'running' && hasSession(workspace.id)) {
      try {
        if (key.return) {
          sendKeys(workspace.id, 'Enter');
        } else if (key.backspace || key.delete) {
          sendKeys(workspace.id, 'BSpace');
        } else if (key.upArrow) {
          sendKeys(workspace.id, 'Up');
        } else if (key.downArrow) {
          sendKeys(workspace.id, 'Down');
        } else if (key.leftArrow) {
          sendKeys(workspace.id, 'Left');
        } else if (key.rightArrow) {
          sendKeys(workspace.id, 'Right');
        } else if (key.tab) {
          // Tab is used for pane navigation, don't forward
          return;
        } else if (key.escape) {
          // Escape goes back, don't forward
          return;
        } else if (key.ctrl && input === 'c') {
          sendKeys(workspace.id, 'C-c');
        } else if (key.ctrl && input === 'd') {
          sendKeys(workspace.id, 'C-d');
        } else if (key.ctrl && input === 'z') {
          sendKeys(workspace.id, 'C-z');
        } else if (key.ctrl && input === 'l') {
          sendKeys(workspace.id, 'C-l');
        } else if (input && !key.ctrl && !key.meta) {
          // Regular character input - escape special tmux chars
          const escaped = input
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/'/g, "\\'")
            .replace(/;/g, '\\;')
            .replace(/\$/g, '\\$');
          sendKeys(workspace.id, escaped);
        }
      } catch {
        // Send failed, session may have ended
      }
    }
  }, { isActive: isFocused && !showHelp });

  const isInteractive = isFocused && controlStatus === 'running';

  return (
    <Box
      flexDirection="column"
      borderStyle={isFocused ? 'double' : 'single'}
      borderColor={isFocused ? 'cyan' : 'gray'}
      width="60%"
      height="100%"
    >
      {/* Header bar */}
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text bold color={isFocused ? 'cyan' : 'white'}>
            Agent
          </Text>
          <Text color="gray"> - {workspace.name}</Text>
        </Box>
        <Box>
          <Text color={controlStatus === 'running' ? 'green' : controlStatus === 'error' ? 'red' : 'yellow'}>
            {controlStatus.toUpperCase()}
          </Text>
          {isInteractive && <Text color="cyan"> [INTERACTIVE]</Text>}
        </Box>
      </Box>

      {/* Terminal content */}
      <Box
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
        overflow="hidden"
      >
        {controlStatus === 'running' && terminalContent.length > 0 ? (
          terminalContent.map((line, i) => (
            <Text key={i} wrap="truncate">{line || ' '}</Text>
          ))
        ) : controlStatus === 'running' ? (
          <Text color="gray">Starting agent...</Text>
        ) : agentState.error ? (
          <Text color="red">Error: {agentState.error}</Text>
        ) : (
          <Box flexDirection="column">
            <Text color="gray">Agent not running</Text>
            <Text color="gray" dimColor>Press 's' to start</Text>
          </Box>
        )}
      </Box>

      {/* Status bar */}
      <Box paddingX={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray">
        {loading ? (
          <Text color="yellow">Loading...</Text>
        ) : isInteractive ? (
          <Text color="gray" dimColor>
            Type to interact | Shift+X: stop | Tab: switch pane
          </Text>
        ) : controlStatus === 'stopped' ? (
          <Text color="gray" dimColor>s: start | r: restart</Text>
        ) : controlStatus === 'error' ? (
          <Text color="gray" dimColor>s: retry</Text>
        ) : (
          <Text color="gray" dimColor>Tab: switch pane</Text>
        )}
      </Box>
    </Box>
  );
}
