// src/components/DiffContent.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

interface DiffContentProps {
  content: string | null;
  fileName: string | null;
  isFocused: boolean;
}

/**
 * Parse diff content into lines with metadata
 */
interface DiffLine {
  text: string;
  type: 'header' | 'addition' | 'deletion' | 'context' | 'meta';
}

function parseDiffLines(content: string): DiffLine[] {
  if (!content) return [];

  const lines = content.split('\n');
  return lines.map(line => {
    if (line.startsWith('diff --git') || line.startsWith('index ')) {
      return { text: line, type: 'meta' as const };
    }
    if (line.startsWith('+++') || line.startsWith('---')) {
      return { text: line, type: 'meta' as const };
    }
    if (line.startsWith('@@')) {
      return { text: line, type: 'header' as const };
    }
    if (line.startsWith('+')) {
      return { text: line, type: 'addition' as const };
    }
    if (line.startsWith('-')) {
      return { text: line, type: 'deletion' as const };
    }
    return { text: line, type: 'context' as const };
  });
}

export function DiffContent({ content, fileName, isFocused }: DiffContentProps) {
  const { stdout } = useStdout();
  const [scrollOffset, setScrollOffset] = useState(0);

  const lines = content ? parseDiffLines(content) : [];

  // Calculate visible height (account for borders and padding)
  const visibleHeight = Math.max(10, (stdout?.rows || 24) - 6);

  // Reset scroll when content changes
  useEffect(() => {
    setScrollOffset(0);
  }, [content]);

  // Keyboard navigation (only when focused)
  useInput((input, key) => {
    if (!isFocused) return;

    // Scroll down one line
    if (key.downArrow || input === 'j') {
      setScrollOffset(prev => Math.min(prev + 1, Math.max(0, lines.length - visibleHeight)));
      return;
    }

    // Scroll up one line
    if (key.upArrow || input === 'k') {
      setScrollOffset(prev => Math.max(prev - 1, 0));
      return;
    }

    // Page down (half page)
    if (key.ctrl && input === 'd') {
      const halfPage = Math.floor(visibleHeight / 2);
      setScrollOffset(prev => Math.min(prev + halfPage, Math.max(0, lines.length - visibleHeight)));
      return;
    }

    // Page up (half page)
    if (key.ctrl && input === 'u') {
      const halfPage = Math.floor(visibleHeight / 2);
      setScrollOffset(prev => Math.max(prev - halfPage, 0));
      return;
    }

    // Jump to top
    if (input === 'g') {
      setScrollOffset(0);
      return;
    }

    // Jump to bottom
    if (input === 'G') {
      setScrollOffset(Math.max(0, lines.length - visibleHeight));
      return;
    }
  }, { isActive: isFocused });

  if (!content) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="gray">Select a file to view diff</Text>
      </Box>
    );
  }

  if (lines.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="gray">No diff content</Text>
      </Box>
    );
  }

  // Get visible lines
  const visibleLines = lines.slice(scrollOffset, scrollOffset + visibleHeight);

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* File name header */}
      {fileName && (
        <Box marginBottom={1}>
          <Text bold color="cyan">{fileName}</Text>
          {lines.length > visibleHeight && (
            <Text color="gray"> (showing {scrollOffset + 1}-{Math.min(scrollOffset + visibleHeight, lines.length)} of {lines.length})</Text>
          )}
        </Box>
      )}

      {/* Diff content */}
      {visibleLines.map((line, index) => {
        const actualIndex = scrollOffset + index;
        return (
          <Box key={actualIndex}>
            <DiffLine line={line} />
          </Box>
        );
      })}

      {/* Scroll indicator */}
      {lines.length > visibleHeight && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {scrollOffset > 0 && '↑ More above '}
            {scrollOffset + visibleHeight < lines.length && '↓ More below'}
          </Text>
        </Box>
      )}
    </Box>
  );
}

interface DiffLineProps {
  line: DiffLine;
}

function DiffLine({ line }: DiffLineProps) {
  switch (line.type) {
    case 'addition':
      return <Text color="green">{line.text}</Text>;
    case 'deletion':
      return <Text color="red">{line.text}</Text>;
    case 'header':
      return <Text color="cyan">{line.text}</Text>;
    case 'meta':
      return <Text color="gray" dimColor>{line.text}</Text>;
    case 'context':
      return <Text>{line.text}</Text>;
    default:
      return <Text>{line.text}</Text>;
  }
}
