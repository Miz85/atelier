// src/components/DeleteWorkspaceConfirm.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Workspace } from '../state/workspace.js';

interface DeleteWorkspaceConfirmProps {
  workspace: Workspace;
  onConfirm: (options: { deleteFolder: boolean; deleteBranch: boolean }) => void;
  onCancel: () => void;
}

type Step = 'confirm' | 'folder' | 'branch';

export function DeleteWorkspaceConfirm({
  workspace,
  onConfirm,
  onCancel,
}: DeleteWorkspaceConfirmProps) {
  const [step, setStep] = useState<Step>('confirm');
  const [deleteFolder, setDeleteFolder] = useState(false);
  const [deleteBranch, setDeleteBranch] = useState(false);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (step === 'confirm') {
      if (input === 'y' || input === 'Y') {
        setStep('folder');
        return;
      }
      if (input === 'n' || input === 'N') {
        onCancel();
        return;
      }
    }

    if (step === 'folder') {
      if (input === 'y' || input === 'Y') {
        setDeleteFolder(true);
        setStep('branch');
        return;
      }
      if (input === 'n' || input === 'N') {
        setDeleteFolder(false);
        setStep('branch');
        return;
      }
    }

    if (step === 'branch') {
      if (input === 'y' || input === 'Y') {
        setDeleteBranch(true);
        onConfirm({ deleteFolder, deleteBranch: true });
        return;
      }
      if (input === 'n' || input === 'N') {
        setDeleteBranch(false);
        onConfirm({ deleteFolder, deleteBranch: false });
        return;
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="red">Delete Workspace</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="white">Workspace: </Text>
        <Text bold color="cyan">{workspace.name}</Text>
        <Text color="gray"> ({workspace.branch})</Text>
      </Box>

      {step === 'confirm' && (
        <>
          <Box marginBottom={1}>
            <Text color="yellow">⚠ Are you sure you want to delete this workspace?</Text>
          </Box>
          <Box>
            <Text color="white">
              Type <Text color="cyan" bold>y</Text> to confirm, <Text color="cyan" bold>n</Text> to cancel (Esc to cancel)
            </Text>
          </Box>
        </>
      )}

      {step === 'folder' && (
        <>
          <Box marginBottom={1}>
            <Text color="white">Delete the git worktree folder?</Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="gray">Path: {workspace.path}</Text>
          </Box>
          <Box>
            <Text color="white">
              Type <Text color="cyan" bold>y</Text> for yes, <Text color="cyan" bold>n</Text> for no (Esc to cancel)
            </Text>
          </Box>
        </>
      )}

      {step === 'branch' && (
        <>
          <Box marginBottom={1}>
            <Text color="white">Delete the git branch?</Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="gray">Branch: {workspace.branch}</Text>
          </Box>
          <Box>
            <Text color="white">
              Type <Text color="cyan" bold>y</Text> for yes, <Text color="cyan" bold>n</Text> for no (Esc to cancel)
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
