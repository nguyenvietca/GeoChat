import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import { updateMyProfile } from '../api/userApi';
import { useAuth } from '../auth/AuthContext';

type EditProfileScreenProps = {
  onBack: () => void;
  onSaved: () => void;
};

export function EditProfileScreen({ onBack, onSaved }: EditProfileScreenProps) {
  const { token, user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  const handleSave = async () => {
    const normalizedDisplayName = displayName.trim();
    if (!normalizedDisplayName) {
      setError('Display name is required.');
      return;
    }
    if (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 100) {
      setError('Display name must be between 2 and 100 characters.');
      return;
    }
    if (!token || savingRef.current) {
      if (!token) {
        setError('Your session has expired. Please log in again.');
      }
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const updatedUser = await updateMyProfile({ displayName: normalizedDisplayName }, token);
      updateUser(updatedUser);
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'Unable to save your profile.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Edit profile</Text>

      <Text style={styles.label}>Display name</Text>
      <TextInput
        accessibilityLabel="Display name"
        style={styles.input}
        value={displayName}
        onChangeText={(value) => {
          setDisplayName(value);
          if (error) {
            setError('');
          }
        }}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={101}
        editable={!saving}
        returnKeyType="done"
      />

      <Text style={styles.label}>Username</Text>
      <TextInput
        accessibilityLabel="Username"
        style={[styles.input, styles.readOnlyInput]}
        value={user?.username ?? ''}
        editable={false}
        selectTextOnFocus={false}
      />
      <Text style={styles.helpText}>Username cannot be changed.</Text>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save profile changes"
        style={[styles.saveButton, saving && styles.disabledButton]}
        onPress={() => void handleSave()}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#102a2a" /> : <Text style={styles.saveText}>Save changes</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    paddingRight: 16,
  },
  backText: {
    color: '#67e8f9',
    fontSize: 15,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 28,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 7,
  },
  input: {
    minHeight: 48,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#f8fafc',
    fontSize: 16,
    marginBottom: 20,
  },
  readOnlyInput: {
    color: '#94a3b8',
  },
  helpText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: -15,
    marginBottom: 18,
  },
  error: {
    color: '#fca5a5',
    fontSize: 14,
    marginBottom: 12,
  },
  saveButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#67e8f9',
    borderRadius: 8,
    marginTop: 8,
  },
  saveText: {
    color: '#102a2a',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
});