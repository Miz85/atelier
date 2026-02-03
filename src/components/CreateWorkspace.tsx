// src/components/CreateWorkspace.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useAtom } from 'jotai';
import { homedir } from 'node:os';
import { workspacesAtom, repoPathAtom, activeWorkspaceIdAtom } from '../state/workspace.js';
import { settingsAtom } from '../state/settings.js';
import { createWorkspace } from '../workspace/workspace-manager.js';

interface CreateWorkspaceProps {
  onBack: () => void;
  onCreated?: (workspaceId: string) => void;
}

export function CreateWorkspace({ onBack, onCreated }: CreateWorkspaceProps) {
  const [workspaces, setWorkspaces] = useAtom(workspacesAtom);
  const [repoPath, setRepoPath] = useAtom(repoPathAtom);
  const [, setActiveWorkspaceId] = useAtom(activeWorkspaceIdAtom);
  const [settings] = useAtom(settingsAtom);

  // Form state
  const [step, setStep] = useState<'repo' | 'branch' | 'creating' | 'error'>('repo');
  const [repoInput, setRepoInput] = useState(repoPath || '');
  const [branchInput, setBranchInput] = useState('');
  const [agentOverride, setAgentOverride] = useState<'claude' | 'opencode' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Skip repo step if already set
  React.useEffect(() => {
    if (repoPath && step === 'repo') {
      setStep('branch');
    }
  }, [repoPath, step]);

  useInput((input, key) => {
    // Escape to go back
    if (key.escape) {
      onBack();
      return;
    }

    // Tab to cycle agent types when on branch step
    if (key.tab && step === 'branch') {
      if (agentOverride === null) {
        setAgentOverride('claude');
      } else if (agentOverride === 'claude') {
        setAgentOverride('opencode');
      } else {
        setAgentOverride(null);
      }
    }
  });

  const handleRepoSubmit = (value: string) => {
    let trimmed = value.trim();
    if (!trimmed) {
      setError('Repository path is required');
      setStep('error');
      return;
    }
    // Expand ~ to home directory
    if (trimmed.startsWith('~/')) {
      trimmed = trimmed.replace('~', homedir());
    } else if (trimmed === '~') {
      trimmed = homedir();
    }
    setRepoPath(trimmed);
    setStep('branch');
  };

  const handleBranchSubmit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Branch name is required');
      setStep('error');
      return;
    }

    setStep('creating');

    try {
      const workspace = await createWorkspace({
        repoPath: repoPath!,
        branchName: trimmed,
        agent: agentOverride ?? settings.defaultAgent,
      });

      // Add to state
      setWorkspaces([...workspaces, workspace]);

      // Set as active
      setActiveWorkspaceId(workspace.id);

      // Notify parent
      onCreated?.(workspace.id);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Create Workspace</Text>
      </Box>

      {step === 'repo' && (
        <Box flexDirection="column">
          <Text>Repository path:</Text>
          <Box>
            <TextInput
              value={repoInput}
              onChange={setRepoInput}
              onSubmit={handleRepoSubmit}
              placeholder="/path/to/your/repo"
            />
          </Box>
          <Text color="gray" dimColor>
            Enter the path to your git repository
          </Text>
        </Box>
      )}

      {step === 'branch' && (
        <Box flexDirection="column">
          <Text color="gray">Repository: {repoPath}</Text>
          <Box marginTop={1}>
            <Text>Branch name:</Text>
          </Box>
          <Box>
            <TextInput
              value={branchInput}
              onChange={setBranchInput}
              onSubmit={handleBranchSubmit}
              placeholder="feature/my-feature"
            />
          </Box>
          <Text color="gray" dimColor>
            A new branch and worktree will be created
          </Text>
          <Box marginTop={1}>
            <Text>Agent: </Text>
            <Text bold color="cyan">
              {agentOverride === 'claude' && '[claude] '}
              {agentOverride === 'opencode' && '[opencode] '}
              {agentOverride === null && `[${settings.defaultAgent}] `}
            </Text>
            {agentOverride === 'claude' && <Text>opencode</Text>}
            {agentOverride === 'opencode' && <Text>claude</Text>}
            {agentOverride === null && (
              <Text>
                {settings.defaultAgent === 'claude' ? 'opencode' : 'claude'}
                <Text color="gray"> (default: {settings.defaultAgent})</Text>
              </Text>
            )}
          </Box>
          <Text color="gray" dimColor>
            Tab: cycle agent types
          </Text>
        </Box>
      )}

      {step === 'creating' && (
        <Box>
          <Text color="yellow">Creating workspace...</Text>
        </Box>
      )}

      {step === 'error' && (
        <Box flexDirection="column">
          <Text color="red">Error: {error}</Text>
          <Box marginTop={1}>
            <Text color="gray">Press Esc to go back</Text>
          </Box>
        </Box>
      )}

      <Box marginTop={2}>
        <Text color="gray">Esc: back</Text>
      </Box>
    </Box>
  );
}
