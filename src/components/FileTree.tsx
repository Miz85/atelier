// src/components/FileTree.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { FileDiff } from '../workspace/git-diff.js';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  status?: 'M' | 'A' | 'D' | 'R';
  children?: TreeNode[];
  expanded?: boolean;
}

interface FileTreeProps {
  files: FileDiff[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  isFocused: boolean;
}

/**
 * Build a tree structure from flat file paths
 */
function buildTree(files: FileDiff[]): TreeNode {
  const root: TreeNode = {
    name: '',
    path: '',
    type: 'directory',
    children: [],
    expanded: true,
  };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    // Navigate/create path
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const pathSoFar = parts.slice(0, i + 1).join('/');

      let child = current.children?.find(c => c.name === part);

      if (!child) {
        child = {
          name: part,
          path: pathSoFar,
          type: isFile ? 'file' : 'directory',
          status: isFile ? file.status : undefined,
          children: isFile ? undefined : [],
          expanded: true, // All directories start expanded
        };
        current.children?.push(child);
      }

      current = child;
    }
  }

  // Sort: directories first, then files
  function sortChildren(node: TreeNode) {
    if (!node.children) return;

    node.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    node.children.forEach(sortChildren);
  }

  sortChildren(root);
  return root;
}

/**
 * Flatten visible nodes for navigation
 */
function flattenVisibleNodes(root: TreeNode, depth: number = 0): Array<{ node: TreeNode; depth: number }> {
  const result: Array<{ node: TreeNode; depth: number }> = [];

  function traverse(node: TreeNode, currentDepth: number) {
    // Don't include root
    if (node.path) {
      result.push({ node, depth: currentDepth });
    }

    // Include children if directory is expanded
    if (node.type === 'directory' && node.expanded && node.children) {
      for (const child of node.children) {
        traverse(child, currentDepth + 1);
      }
    }
  }

  traverse(root, depth);
  return result;
}

/**
 * Get status icon for file
 */
function getStatusIcon(status?: 'M' | 'A' | 'D' | 'R'): string {
  switch (status) {
    case 'M': return '[M]';
    case 'A': return '[A]';
    case 'D': return '[D]';
    case 'R': return '[R]';
    default: return '   ';
  }
}

/**
 * Get status color
 */
function getStatusColor(status?: 'M' | 'A' | 'D' | 'R'): string {
  switch (status) {
    case 'M': return 'yellow';
    case 'A': return 'green';
    case 'D': return 'red';
    case 'R': return 'cyan';
    default: return 'white';
  }
}

export function FileTree({ files, selectedPath, onSelectFile, isFocused }: FileTreeProps) {
  const [tree] = useState(() => buildTree(files));
  const [visibleNodes, setVisibleNodes] = useState(() => flattenVisibleNodes(tree));
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Update visible nodes when tree changes
  useEffect(() => {
    setVisibleNodes(flattenVisibleNodes(tree));
  }, [tree]);

  // Ensure selected index is within bounds
  useEffect(() => {
    if (selectedIndex >= visibleNodes.length && visibleNodes.length > 0) {
      setSelectedIndex(visibleNodes.length - 1);
    }
  }, [visibleNodes.length, selectedIndex]);

  // Keyboard navigation (only when focused)
  useInput((input, key) => {
    if (!isFocused) return;

    // Navigation
    if (key.downArrow || input === 'j') {
      const newIndex = Math.min(selectedIndex + 1, visibleNodes.length - 1);
      setSelectedIndex(newIndex);
      const node = visibleNodes[newIndex]?.node;
      if (node?.type === 'file') {
        onSelectFile(node.path);
      }
      return;
    }

    if (key.upArrow || input === 'k') {
      const newIndex = Math.max(selectedIndex - 1, 0);
      setSelectedIndex(newIndex);
      const node = visibleNodes[newIndex]?.node;
      if (node?.type === 'file') {
        onSelectFile(node.path);
      }
      return;
    }

    // Toggle directory expansion
    if (key.return) {
      const item = visibleNodes[selectedIndex];
      if (item?.node.type === 'directory') {
        item.node.expanded = !item.node.expanded;
        setVisibleNodes(flattenVisibleNodes(tree));
      }
      return;
    }

    // Jump to top
    if (input === 'g') {
      setSelectedIndex(0);
      const node = visibleNodes[0]?.node;
      if (node?.type === 'file') {
        onSelectFile(node.path);
      }
      return;
    }

    // Jump to bottom
    if (input === 'G') {
      const newIndex = visibleNodes.length - 1;
      setSelectedIndex(newIndex);
      const node = visibleNodes[newIndex]?.node;
      if (node?.type === 'file') {
        onSelectFile(node.path);
      }
      return;
    }
  }, { isActive: isFocused });

  if (files.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="gray">No files changed</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {visibleNodes.map((item, index) => {
        const { node, depth } = item;
        const isSelected = index === selectedIndex;
        const indentation = '  '.repeat(depth);

        return (
          <Box key={node.path}>
            <Text>
              {indentation}
              {node.type === 'directory' ? (
                <>
                  <Text color={isSelected ? 'cyan' : 'white'}>
                    {node.expanded ? '▼' : '▶'} {node.name}/
                  </Text>
                </>
              ) : (
                <>
                  <Text color={getStatusColor(node.status)}>
                    {getStatusIcon(node.status)}
                  </Text>
                  <Text color={isSelected ? 'cyan' : 'white'}> {node.name}</Text>
                </>
              )}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
