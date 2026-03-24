import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Briefcase, Calendar, MapPin, Edit3, User } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';

interface ProfileHeaderProps {
  name: string;
  occupation?: string;
  location?: string;
  memberSince: string;
  avatarUrl?: string | null;
  onAvatarError?: () => void;
  onEdit: () => void;
}

export function ProfileHeader({
  name,
  occupation,
  location,
  memberSince,
  avatarUrl,
  onAvatarError,
  onEdit,
}: ProfileHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
      <View style={styles.headerRow}>
        <View style={[styles.avatarWrap, { backgroundColor: theme.colors.primary + '12' }]}> 
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
              resizeMode="cover"
              onError={onAvatarError}
            />
          ) : (
            <User size={36} color={theme.colors.primary} />
          )}
        </View>
        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: theme.colors.primary }]}
          onPress={onEdit}
          activeOpacity={0.85}
        >
          <Edit3 size={16} color="#fff" />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.name, { color: theme.colors.text }]}>{name}</Text>

      <View style={styles.metaRow}>
        <Briefcase size={14} color={theme.colors.textSecondary} />
        <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
          {occupation || 'Occupation not set'}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <MapPin size={14} color={theme.colors.textSecondary} />
        <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
          {location || 'Location not set'}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Calendar size={14} color={theme.colors.textSecondary} />
        <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>Member since {memberSince}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
