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
  onDeleteWorkspace: (workspace: Workspace) => void;
}

export function WorkspaceTable({
  onCreateWorkspace,
  onSettings,
  onOpenDiffView,
  onAttachAgent,
  onAttachTerminal,
  onOpenWorkspaceView,
  onDeleteWorkspace,
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

    if (input === 'x') {
      // Delete workspace
      onDeleteWorkspace(selectedWorkspace);
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
      <Box marginBottom={1}>
        <Text bold color="cyan">Workspaces</Text>
        <Text color="gray"> ({workspaces.length})</Text>
      </Box>

      {/* Table with solid border */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray">
        {/* Table Header */}
        <Box paddingX={1} paddingY={0}>
          <Box width={3} marginRight={1}>
            <Text> </Text>
          </Box>
          <Box width={25} marginRight={2}>
            <Text bold color="cyan">Name</Text>
          </Box>
          <Box width={12} marginRight={2}>
            <Text bold color="cyan">Agent</Text>
          </Box>
          <Box width={28} marginRight={2}>
            <Text bold color="cyan">Branch</Text>
          </Box>
          <Box width={28} marginRight={2}>
            <Text bold color="cyan">Changes</Text>
          </Box>
          <Box width={15}>
            <Text bold color="cyan">Status</Text>
          </Box>
        </Box>

        {/* Separator */}
        <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray" />

        {/* Table Rows */}
        <Box flexDirection="column">
          {workspaces.map((workspace, index) => (
            <WorkspaceRow
              key={workspace.id}
              workspace={workspace}
              isSelected={index === selectedIndex}
              isActive={workspace.id === activeWorkspaceId}
            />
          ))}
        </Box>
      </Box>

      {/* Footer with keyboard shortcuts */}
      <Box marginTop={1}>
        {selectedWorkspace ? (
          <Text color="white">
            <Text color="cyan">Enter</Text>: open | <Text color="cyan">a</Text>: agent | <Text color="cyan">t</Text>: terminal | <Text color="cyan">d</Text>: diff | <Text color="cyan">x</Text>: delete | <Text color="cyan">n</Text>: new | <Text color="cyan">s</Text>: settings | <Text color="cyan">q</Text>: quit
          </Text>
        ) : (
          <Text color="white">
            <Text color="cyan">n</Text>: new workspace | <Text color="cyan">s</Text>: settings | <Text color="cyan">q</Text>: quit
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
        // Log error for debugging
        console.error(`[WorkspaceTable] Failed to calculate diff for ${workspace.name}:`, err);
        // Set empty summary on error
        if (mounted) {
          setDiffSummary({
            workspaceId: workspace.id,
            filesChanged: 0,
            insertions: 0,
            deletions: 0,
            files: [],
            timestamp: Date.now(),
          });
        }
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

  // Status color
  const statusColor =
    agentStatus === 'running' ? 'green' :
    agentStatus === 'error' ? 'red' :
    'yellow';

  // Render diff summary with color coding
  const renderDiffSummary = () => {
    if (isLoading) {
      return <Text color="gray">Loading...</Text>;
    }

    if (!diffSummary || diffSummary.filesChanged === 0) {
      // Check if there are uncommitted changes
      if (diffSummary?.hasUncommittedChanges) {
        const uncommittedFileCount = diffSummary.uncommittedFiles || 0;
        const fileText = uncommittedFileCount === 1 ? 'file' : 'files';

        return (
          <Text>
            <Text color="yellow">{uncommittedFileCount} {fileText}</Text>
            {(diffSummary.uncommittedInsertions || diffSummary.uncommittedDeletions) ? (
              <>
                <Text color="yellow">, </Text>
                <Text color="green">+{diffSummary.uncommittedInsertions || 0}</Text>
                <Text color="yellow">/</Text>
                <Text color="red">-{diffSummary.uncommittedDeletions || 0}</Text>
                <Text color="yellow"> (uncommitted)</Text>
              </>
            ) : (
              <Text color="yellow"> (uncommitted)</Text>
            )}
          </Text>
        );
      }
      return <Text color="gray">No changes</Text>;
    }

    const fileText = diffSummary.filesChanged === 1 ? 'file' : 'files';

    return (
      <Text>
        <Text color={isSelected ? 'cyan' : 'white'}>{diffSummary.filesChanged} {fileText}, </Text>
        <Text color="green">+{diffSummary.insertions}</Text>
        <Text color={isSelected ? 'cyan' : 'white'}>/</Text>
        <Text color="red">-{diffSummary.deletions}</Text>
      </Text>
    );
  };

  return (
    <Box paddingX={1} paddingY={0}>
      {/* Selection indicator */}
      <Box width={3} marginRight={1}>
        <Text color="cyan" bold>{isSelected ? '❯' : ' '}</Text>
      </Box>

      {/* Name */}
      <Box width={25} marginRight={2}>
        <Text color={isSelected ? 'cyan' : 'white'} bold={isActive} wrap="truncate-end">
          {workspace.name}
          {isActive && <Text color="green"> ●</Text>}
        </Text>
      </Box>

      {/* Agent */}
      <Box width={12} marginRight={2}>
        <Text color={isSelected ? 'cyan' : 'gray'} wrap="truncate-end">
          {workspace.agent}
        </Text>
      </Box>

      {/* Branch */}
      <Box width={28} marginRight={2}>
        <Text color={isSelected ? 'cyan' : 'gray'} wrap="truncate-end">
          {workspace.branch}
        </Text>
      </Box>

      {/* Changes */}
      <Box width={28} marginRight={2}>
        {renderDiffSummary()}
      </Box>

      {/* Status */}
      <Box width={15}>
        <Text color={statusColor} bold={agentStatus === 'running'}>
          {hasAgent ? agentStatus : '-'}
        </Text>
      </Box>
    </Box>
  );
}
