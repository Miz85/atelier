// src/components/Settings.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useAtom } from 'jotai';
import { settingsAtom } from '../state/settings.js';

interface SettingsProps {
  onBack?: () => void;
}

type Field = 'ideCommand' | 'defaultAgent';

export function Settings({ onBack }: SettingsProps) {
  const [settings, setSettings] = useAtom(settingsAtom);
  const [activeField, setActiveField] = useState<Field>('ideCommand');
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  useInput((input, key) => {
    if (editing) {
      if (key.escape) {
        setEditing(false);
        setEditValue('');
      }
      return;
    }

    // Navigation
    if (key.upArrow || input === 'k') {
      setActiveField('ideCommand');
    }
    if (key.downArrow || input === 'j') {
      setActiveField('defaultAgent');
    }

    // Edit
    if (key.return || input === 'e') {
      if (activeField === 'ideCommand') {
        setEditValue(settings.ideCommand);
        setEditing(true);
      } else if (activeField === 'defaultAgent') {
        // Toggle between agents instead of text input
        const newAgent = settings.defaultAgent === 'claude' ? 'opencode' : 'claude';
        setSettings({ ...settings, defaultAgent: newAgent });
      }
    }

    // Back
    if (input === 'q' || key.escape) {
      onBack?.();
    }
  });

  const handleIdeCommandSubmit = (value: string) => {
    if (value.trim()) {
      setSettings({ ...settings, ideCommand: value.trim() });
    }
    setEditing(false);
    setEditValue('');
  };

  const renderField = (field: Field, label: string, value: string, hint?: string) => {
    const isActive = activeField === field;
    const isEditing = editing && isActive;

    return (
      <Box flexDirection="row" marginBottom={1}>
        <Text color={isActive ? 'cyan' : 'white'}>
          {isActive ? '> ' : '  '}
        </Text>
        <Text bold>{label}: </Text>
        {isEditing ? (
          <TextInput
            value={editValue}
            onChange={setEditValue}
            onSubmit={handleIdeCommandSubmit}
          />
        ) : (
          <Text color="green">{value}</Text>
        )}
        {hint && !isEditing && (
          <Text color="gray"> ({hint})</Text>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold underline>Settings</Text>
      </Box>

      {renderField('ideCommand', 'IDE Command', settings.ideCommand, 'Enter to edit')}
      {renderField('defaultAgent', 'Default Agent', settings.defaultAgent, 'Enter to toggle')}

      <Box marginTop={2} flexDirection="column">
        <Text color="gray">Navigation: j/k or arrows</Text>
        <Text color="gray">Edit: Enter | Back: q or Esc</Text>
      </Box>
    </Box>
  );
}
