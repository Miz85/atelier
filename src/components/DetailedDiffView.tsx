// src/components/DetailedDiffView.tsx
import React, { useEffect } from 'react';
import { Box, Text, useInput, useFocus } from 'ink';
import { useAtom, useSetAtom } from 'jotai';
import { FileTree } from './FileTree.js';
import { DiffContent } from './DiffContent.js';
import { getDiffSummaryAtom, diffViewStateAtom } from '../state/diff.js';
import { getDiffSummary, getFileDiff } from '../workspace/git-diff.js';
import type { Workspace } from '../state/workspace.js';

interface DetailedDiffViewProps {
  workspace: Workspace;
  onBack: () => void;
}

/**
 * Detailed diff view with file tree on left and diff content on right
 */
export function DetailedDiffView({ workspace, onBack }: DetailedDiffViewProps) {
  const { isFocused: isTreeFocused } = useFocus({ id: 'file-tree', autoFocus: true });
  const { isFocused: isDiffFocused } = useFocus({ id: 'diff-content' });

  // Get diff summary
  const diffSummaryAtom = getDiffSummaryAtom(workspace.id);
  const [diffSummary, setDiffSummary] = useAtom(diffSummaryAtom);

  // Get diff view state
  const [diffViewState, setDiffViewState] = useAtom(diffViewStateAtom);

  // Load diff summary on mount
  useEffect(() => {
    let mounted = true;

    const loadDiff = async () => {
      const summary = await getDiffSummary(workspace.id, workspace.path);
      if (mounted) {
        setDiffSummary(summary);

        // Auto-select first file if available
        if (summary.files.length > 0 && !diffViewState?.selectedFilePath) {
          const firstFile = summary.files[0].path;
          const content = await getFileDiff(workspace.path, firstFile);
          setDiffViewState({
            workspaceId: workspace.id,
            selectedFilePath: firstFile,
            selectedFileContent: content,
          });
        }
      }
    };

    loadDiff();

    return () => {
      mounted = false;
    };
  }, [workspace.id, workspace.path, setDiffSummary, diffViewState?.selectedFilePath, setDiffViewState]);

  // Handle file selection
  const handleSelectFile = async (filePath: string) => {
    if (filePath === diffViewState?.selectedFilePath) return;

    // Load diff for selected file
    const content = await getFileDiff(workspace.path, filePath);
    setDiffViewState({
      workspaceId: workspace.id,
      selectedFilePath: filePath,
      selectedFileContent: content,
    });
  };

  // Global keyboard shortcuts
  useInput((input, key) => {
    // Escape and 'b' go back
    if (key.escape || input === 'b') {
      onBack();
      return;
    }

    // 'q' also goes back
    if (input === 'q') {
      onBack();
      return;
    }
  });

  if (!diffSummary) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Loading diff...</Text>
      </Box>
    );
  }

  if (diffSummary.filesChanged === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">Diff View</Text>
          <Text color="gray"> - {workspace.name}</Text>
        </Box>
        <Box>
          <Text color="gray">No changes in this workspace</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray" dimColor>Press Esc or 'b' to go back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box paddingX={1} paddingY={0}>
        <Text bold color="cyan">Diff View</Text>
        <Text color="gray"> - {workspace.name} ({workspace.branch})</Text>
        <Text color="gray"> - {diffSummary.filesChanged} files, +{diffSummary.insertions}/-{diffSummary.deletions}</Text>
      </Box>

      {/* Split panes: FileTree (30%) | DiffContent (70%) */}
      <Box flexGrow={1}>
        {/* File Tree */}
        <Box
          width="30%"
          flexDirection="column"
          borderStyle={isTreeFocused ? 'double' : 'single'}
          borderColor={isTreeFocused ? 'cyan' : 'gray'}
        >
          <Box paddingX={1}>
            <Text bold color={isTreeFocused ? 'cyan' : 'white'}>Files</Text>
          </Box>
          <Box flexGrow={1} flexDirection="column" overflowY="hidden">
            <FileTree
              files={diffSummary.files}
              selectedPath={diffViewState?.selectedFilePath || null}
              onSelectFile={handleSelectFile}
              isFocused={isTreeFocused}
            />
          </Box>
        </Box>

        {/* Diff Content */}
        <Box
          width="70%"
          flexDirection="column"
          borderStyle={isDiffFocused ? 'double' : 'single'}
          borderColor={isDiffFocused ? 'cyan' : 'gray'}
        >
          <Box paddingX={1}>
            <Text bold color={isDiffFocused ? 'cyan' : 'white'}>Diff</Text>
          </Box>
          <Box flexGrow={1} flexDirection="column" overflowY="hidden">
            <DiffContent
              content={diffViewState?.selectedFileContent || null}
              fileName={diffViewState?.selectedFilePath || null}
              isFocused={isDiffFocused}
            />
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box
        paddingX={1}
        borderStyle="single"
        borderTop
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderColor="gray"
      >
        <Text color="gray" dimColor>
          Tab: switch pane | j/k: navigate | Enter: expand/collapse | Ctrl+d/u: scroll | Esc/b: back
        </Text>
      </Box>
    </Box>
  );
}
