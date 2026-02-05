// src/components/WorkspaceTable.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAtom, useSetAtom } from 'jotai';
import { workspacesAtom, activeWorkspaceIdAtom } from '../state/workspace.js';
import { getDiffSummaryAtom, getDiffLoadingAtom } from '../state/diff.js';
import { getWorkspaceAgentStateAtom } from '../state/agents.js';
import { getDiffSummary, formatDiffSummary } from '../workspace/git-diff.js';
import { hasSession as hasAgentSession } from '../agents/tmux.js';
import type { Workspace } from '../state/workspace.js';

interface WorkspaceTableProps {
  onCreateWorkspace: () => void;
  onSettings: () => void;
  onOpenDiffView: (workspace: Workspace) => void;
  onAttachAgent: (workspace: Workspace) => void;
  onAttachTerminal: (workspace: Workspace) => void;
  onOpenWorkspaceView: (workspace: Workspace) => void;
}

export function WorkspaceTable({
  onCreateWorkspace,
  onSettings,
  onOpenDiffView,
  onAttachAgent,
  onAttachTerminal,
  onOpenWorkspaceView,
}: WorkspaceTableProps) {
  const [workspaces] = useAtom(workspacesAtom);
  const [activeWorkspaceId, setActiveWorkspaceId] = useAtom(activeWorkspaceIdAtom);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Ensure selected index is within bounds
  useEffect(() => {
    if (selectedIndex >= workspaces.length && workspaces.length > 0) {
      setSelectedIndex(workspaces.length - 1);
    }
  }, [workspaces.length, selectedIndex]);

  const selectedWorkspace = workspaces[selectedIndex];

  // Calculate diffs for all workspaces in background
  useEffect(() => {
    const calculateDiffs = async () => {
      for (const workspace of workspaces) {
        try {
          const summary = await getDiffSummary(
            workspace.id,
            workspace.path
          );
          const diffAtom = getDiffSummaryAtom(workspace.id);
          // Update atom (note: this is simplified, in practice we'd use setAtom)
        } catch (err) {
          // Silent fail - diff calculation is non-critical
        }
      }
    };

    if (workspaces.length > 0) {
      calculateDiffs();
    }
  }, [workspaces]);

  // Keyboard navigation
  useInput((input, key) => {
    // Navigation
    if (key.downArrow || input === 'j') {
      setSelectedIndex(prev => Math.min(prev + 1, workspaces.length - 1));
      return;
    }

    if (key.upArrow || input === 'k') {
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      return;
    }

    if (!selectedWorkspace) return;

    // Actions
    if (key.return) {
      // Set as active and open workspace view
      setActiveWorkspaceId(selectedWorkspace.id);
      onOpenWorkspaceView(selectedWorkspace);
      return;
    }

    if (input === 'a') {
      // Attach to agent tmux session
      onAttachAgent(selectedWorkspace);
      return;
    }

    if (input === 't') {
      // Attach to terminal tmux session
      onAttachTerminal(selectedWorkspace);
      return;
    }

    if (input === 'd') {
      // Open detailed diff view
      onOpenDiffView(selectedWorkspace);
      return;
    }

    if (input === 'n') {
      onCreateWorkspace();
      return;
    }

    if (input === 's') {
      onSettings();
      return;
    }
  });

  if (workspaces.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Workspaces</Text>
        <Box marginTop={1}>
          <Text color="gray">No workspaces yet.</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray" dimColor>Press 'n' to create a new workspace</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box>
        <Text bold color="cyan">Workspaces</Text>
        <Text color="gray"> ({workspaces.length})</Text>
      </Box>

      {/* Table Header */}
      <Box marginTop={1}>
        <Box width={25}>
          <Text bold dimColor>Name</Text>
        </Box>
        <Box width={20}>
          <Text bold dimColor>Branch</Text>
        </Box>
        <Box width={20}>
          <Text bold dimColor>Changes</Text>
        </Box>
        <Box width={15}>
          <Text bold dimColor>Status</Text>
        </Box>
      </Box>

      {/* Table Rows */}
      <Box flexDirection="column" marginTop={1}>
        {workspaces.map((workspace, index) => (
          <WorkspaceRow
            key={workspace.id}
            workspace={workspace}
            isSelected={index === selectedIndex}
            isActive={workspace.id === activeWorkspaceId}
          />
        ))}
      </Box>

      {/* Footer with keyboard shortcuts */}
      <Box marginTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray" paddingTop={1}>
        {selectedWorkspace ? (
          <Text color="gray" dimColor>
            Enter: open | a: agent | t: terminal | d: diff | n: new | s: settings | q: quit
          </Text>
        ) : (
          <Text color="gray" dimColor>
            n: new workspace | s: settings | q: quit
          </Text>
        )}
      </Box>
    </Box>
  );
}

interface WorkspaceRowProps {
  workspace: Workspace;
  isSelected: boolean;
  isActive: boolean;
}

function WorkspaceRow({ workspace, isSelected, isActive }: WorkspaceRowProps) {
  const diffAtom = getDiffSummaryAtom(workspace.id);
  const [diffSummary] = useAtom(diffAtom);
  const loadingAtom = getDiffLoadingAtom(workspace.id);
  const [isLoading] = useAtom(loadingAtom);

  const agentStateAtom = getWorkspaceAgentStateAtom(workspace.id);
  const [agentState] = useAtom(agentStateAtom);

  // Calculate diff summary on mount
  const setDiffSummary = useSetAtom(diffAtom);
  const setLoading = useSetAtom(loadingAtom);

  useEffect(() => {
    let mounted = true;

    const calculateDiff = async () => {
      setLoading(true);
      try {
        const summary = await getDiffSummary(
          workspace.id,
          workspace.path
        );
        if (mounted) {
          setDiffSummary(summary);
        }
      } catch (err) {
        // Silent fail
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    calculateDiff();

    return () => {
      mounted = false;
    };
  }, [workspace.id, workspace.path, setDiffSummary, setLoading]);

  // Determine agent status
  const agentStatus = agentState.status === 'idle' ? 'stopped' : agentState.status;
  const hasAgent = hasAgentSession(workspace.id);

  // Format diff summary
  const diffText = isLoading
    ? 'Loading...'
    : diffSummary
    ? formatDiffSummary(diffSummary)
    : 'No changes';

  // Status color
  const statusColor =
    agentStatus === 'running' ? 'green' :
    agentStatus === 'error' ? 'red' :
    'yellow';

  return (
    <Box>
      {/* Selection indicator */}
      <Box width={2}>
        <Text color="cyan">{isSelected ? '>' : ' '}</Text>
      </Box>

      {/* Name */}
      <Box width={25}>
        <Text color={isSelected ? 'cyan' : 'white'} bold={isActive}>
          {workspace.name}
          {isActive && <Text color="green"> *</Text>}
        </Text>
      </Box>

      {/* Branch */}
      <Box width={20}>
        <Text color={isSelected ? 'cyan' : 'gray'}>
          {workspace.branch}
        </Text>
      </Box>

      {/* Changes */}
      <Box width={20}>
        <Text color={isSelected ? 'cyan' : 'gray'}>
          {diffText}
        </Text>
      </Box>

      {/* Status */}
      <Box width={15}>
        <Text color={statusColor}>
          {hasAgent ? agentStatus : '-'}
        </Text>
      </Box>
    </Box>
  );
}
