// src/components/WorkspaceList.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAtom } from 'jotai';
import {
  workspacesAtom,
  activeWorkspaceIdAtom,
  repoPathAtom,
  type Workspace
} from '../state/workspace.js';
import { deleteWorkspace } from '../workspace/workspace-manager.js';

interface WorkspaceListProps {
  onBack: () => void;
  onSelect?: (workspace: Workspace) => void;
}

export function WorkspaceList({ onBack, onSelect }: WorkspaceListProps) {
  const [workspaces, setWorkspaces] = useAtom(workspacesAtom);
  const [activeId, setActiveId] = useAtom(activeWorkspaceIdAtom);
  const [repoPath] = useAtom(repoPathAtom);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useInput((input, key) => {
    if (deleting) return; // Ignore input while deleting

    // Navigation
    if (input === 'j' || key.downArrow) {
      setSelectedIndex(i => Math.min(i + 1, workspaces.length - 1));
      setConfirmDelete(false);
    }
    if (input === 'k' || key.upArrow) {
      setSelectedIndex(i => Math.max(i - 1, 0));
      setConfirmDelete(false);
    }

    // Select/activate workspace
    if (key.return && workspaces.length > 0) {
      const workspace = workspaces[selectedIndex];
      setActiveId(workspace.id);
      onSelect?.(workspace);
      onBack();  // Return to main screen after selection
    }

    // Delete workspace
    if (input === 'd' && workspaces.length > 0) {
      if (confirmDelete) {
        // Second press - actually delete
        handleDelete(workspaces[selectedIndex]);
      } else {
        // First press - ask for confirmation
        setConfirmDelete(true);
      }
    }

    // Cancel delete confirmation on any other key
    if (input !== 'd') {
      setConfirmDelete(false);
    }

    // Escape to go back
    if (key.escape) {
      onBack();
    }
  });

  const handleDelete = async (workspace: Workspace) => {
    if (!repoPath) {
      console.error('No repo path set');
      return;
    }

    setDeleting(workspace.id);
    setConfirmDelete(false);

    try {
      await deleteWorkspace(workspace, repoPath);

      // Remove from state
      const newWorkspaces = workspaces.filter(w => w.id !== workspace.id);
      setWorkspaces(newWorkspaces);

      // If deleted workspace was active, clear active
      if (activeId === workspace.id) {
        setActiveId(newWorkspaces.length > 0 ? newWorkspaces[0].id : null);
      }

      // Adjust selection index
      setSelectedIndex(i => Math.min(i, newWorkspaces.length - 1));
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Workspaces</Text>
        <Text color="gray"> ({workspaces.length})</Text>
      </Box>

      {workspaces.length === 0 ? (
        <Box marginBottom={1}>
          <Text color="yellow">No workspaces. Press 'n' on main screen to create one.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginBottom={1}>
          {workspaces.map((ws, index) => {
            const isSelected = index === selectedIndex;
            const isActive = ws.id === activeId;
            const isDeleting = ws.id === deleting;

            return (
              <Box key={ws.id}>
                <Text color={isSelected ? 'cyan' : undefined}>
                  {isSelected ? '> ' : '  '}
                </Text>
                <Text
                  color={isDeleting ? 'red' : isActive ? 'green' : undefined}
                  dimColor={isDeleting}
                >
                  {ws.name}
                </Text>
                <Text color="gray"> ({ws.branch})</Text>
                <Text color="gray" dimColor> [{ws.agent}]</Text>
                {isActive && <Text color="green"> *</Text>}
                {isDeleting && <Text color="red"> deleting...</Text>}
                {isSelected && confirmDelete && !isDeleting && (
                  <Text color="red"> Press 'd' again to delete</Text>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color="gray">j/k: navigate | Enter: select | d: delete | Esc: back</Text>
        {activeId && (
          <Text color="gray" dimColor>* = active workspace</Text>
        )}
      </Box>
    </Box>
  );
}
