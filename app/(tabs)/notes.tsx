import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import {
  FileText,
  Plus,
  Edit3,
  Trash2,
  Pin,
  Search,
  Target,
  Bell,
  Lightbulb,
  Tag,
} from 'lucide-react-native';
import { Note } from '@/types/transaction';
import { useTheme } from '@/store/theme-store';

const NOTE_CATEGORIES = [
  { id: 'financial', name: 'Financial', icon: FileText, color: '#667eea' },
  { id: 'goal', name: 'Goal', icon: Target, color: '#4CAF50' },
  { id: 'reminder', name: 'Reminder', icon: Bell, color: '#FF9800' },
  { id: 'idea', name: 'Idea', icon: Lightbulb, color: '#9C27B0' },
  { id: 'other', name: 'Other', icon: Tag, color: '#607D8B' },
] as const;

const NOTE_COLORS = [
  '#FFE082', '#FFCDD2', '#C8E6C9', '#BBDEFB', '#E1BEE7',
  '#F8BBD9', '#FFCCBC', '#D7CCC8', '#CFD8DC', '#B39DDB'
];

export default function NotesScreen() {
  const { theme } = useTheme();
  const [notes, setNotes] = useState<Note[]>([
    {
      id: '1',
      title: 'Emergency Fund Goal',
      content: 'Save $10,000 for emergency fund by end of year. Currently at $6,500. Need to save $583/month.',
      category: 'goal',
      color: '#C8E6C9',
      isPinned: true,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-20'),
    },
    {
      id: '2',
      title: 'Investment Ideas',
      content: 'Research index funds: VTI, VXUS, BND. Consider increasing 401k contribution to 15%.',
      category: 'idea',
      color: '#E1BEE7',
      isPinned: false,
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-10'),
    },
    {
      id: '3',
      title: 'Monthly Budget Review',
      content: 'Review and adjust budget categories. Dining out exceeded by $200 last month.',
      category: 'reminder',
      color: '#FFCCBC',
      isPinned: false,
      createdAt: new Date('2024-01-05'),
      updatedAt: new Date('2024-01-05'),
    },
  ]);

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<Note['category'] | 'all'>('all');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'financial' as Note['category'],
    color: NOTE_COLORS[0],
  });

  const getCategoryInfo = (category: Note['category']) => {
    return NOTE_CATEGORIES.find(c => c.id === category) || NOTE_CATEGORIES[0];
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const pinnedNotes = filteredNotes.filter(note => note.isPinned);
  const unpinnedNotes = filteredNotes.filter(note => !note.isPinned);

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      category: 'financial',
      color: NOTE_COLORS[0],
    });
  };

  const handleAddNote = () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a note title');
      return;
    }

    const newNote: Note = {
      id: Date.now().toString(),
      title: formData.title.trim(),
      content: formData.content.trim(),
      category: formData.category,
      color: formData.color,
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setNotes(prev => [newNote, ...prev]);
    setShowAddModal(false);
    resetForm();
  };

  const handleEditNote = () => {
    if (!editingNote || !formData.title.trim()) {
      Alert.alert('Error', 'Please enter a note title');
      return;
    }

    const updatedNote: Note = {
      ...editingNote,
      title: formData.title.trim(),
      content: formData.content.trim(),
      category: formData.category,
      color: formData.color,
      updatedAt: new Date(),
    };

    setNotes(prev =>
      prev.map(note =>
        note.id === editingNote.id ? updatedNote : note
      )
    );
    setEditingNote(null);
    resetForm();
  };

  const handleDeleteNote = (noteId: string) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setNotes(prev => prev.filter(note => note.id !== noteId));
          },
        },
      ]
    );
  };

  const togglePin = (noteId: string) => {
    setNotes(prev =>
      prev.map(note =>
        note.id === noteId
          ? { ...note, isPinned: !note.isPinned, updatedAt: new Date() }
          : note
      )
    );
  };

  const openEditModal = (note: Note) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      category: note.category,
      color: note.color,
    });
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingNote(null);
    resetForm();
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const renderNote = (note: Note) => {
    const categoryInfo = getCategoryInfo(note.category);
    const IconComponent = categoryInfo.icon;

    return (
      <TouchableOpacity
        key={note.id}
        style={[styles.noteCard, { backgroundColor: note.color }]}
        onPress={() => openEditModal(note)}
      >
        <View style={styles.noteHeader}>
          <View style={styles.categoryBadge}>
            <IconComponent size={12} color={categoryInfo.color} />
            <Text style={[styles.categoryText, { color: categoryInfo.color }]}>
              {categoryInfo.name}
            </Text>
          </View>
          <View style={styles.noteActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => togglePin(note.id)}
            >
              <Pin
                size={16}
                color={note.isPinned ? '#FF9800' : '#999'}
                fill={note.isPinned ? '#FF9800' : 'none'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteNote(note.id)}
            >
              <Trash2 size={16} color="#F44336" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.noteTitle}>{note.title}</Text>
        {note.content && (
          <Text style={styles.noteContent} numberOfLines={3}>
            {note.content}
          </Text>
        )}

        <View style={styles.noteFooter}>
          <Text style={styles.noteDate}>
            {formatDate(note.updatedAt)}
          </Text>
          {note.isPinned && (
            <View style={styles.pinnedIndicator}>
              <Pin size={12} color="#FF9800" fill="#FF9800" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
          <Search size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search notes..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryFilter}
          contentContainerStyle={styles.categoryFilterContent}
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              { backgroundColor: theme.colors.card },
              selectedCategory === 'all' && { backgroundColor: theme.colors.primary }
            ]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text style={[
              styles.categoryChipText,
              { color: selectedCategory === 'all' ? 'white' : theme.colors.textSecondary }
            ]}>
              All
            </Text>
          </TouchableOpacity>
          {NOTE_CATEGORIES.map((category) => {
            const IconComponent = category.icon;
            return (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  { backgroundColor: theme.colors.card },
                  selectedCategory === category.id && { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <IconComponent size={16} color={category.color} />
                <Text style={[
                  styles.categoryChipText,
                  { color: selectedCategory === category.id ? 'white' : theme.colors.textSecondary }
                ]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {pinnedNotes.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Pinned</Text>
            <View style={styles.notesGrid}>
              {pinnedNotes.map(renderNote)}
            </View>
          </View>
        )}

        {unpinnedNotes.length > 0 && (
          <View style={styles.section}>
            {pinnedNotes.length > 0 && (
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notes</Text>
            )}
            <View style={styles.notesGrid}>
              {unpinnedNotes.map(renderNote)}
            </View>
          </View>
        )}

        {filteredNotes.length === 0 && (
          <View style={styles.emptyState}>
            <FileText size={48} color={theme.colors.border} />
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
              {searchQuery || selectedCategory !== 'all'
                ? 'No notes found'
                : 'No notes yet'}
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.border }]}>
              {searchQuery || selectedCategory !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Tap the + button to create your first note'}
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => setShowAddModal(true)}
      >
        <Plus size={24} color="white" />
      </TouchableOpacity>

      <Modal
        visible={showAddModal || editingNote !== null}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={closeModal}>
              <Text style={[styles.cancelButton, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {editingNote ? 'Edit Note' : 'New Note'}
            </Text>
            <TouchableOpacity
              onPress={editingNote ? handleEditNote : handleAddNote}
            >
              <Text style={[styles.saveButton, { color: theme.colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Title</Text>
              <TextInput
                style={[styles.titleInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                placeholder="Enter note title"
                placeholderTextColor={theme.colors.textSecondary}
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Content</Text>
              <TextInput
                style={[styles.contentInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={formData.content}
                onChangeText={(text) => setFormData(prev => ({ ...prev, content: text }))}
                placeholder="Write your note here..."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Category</Text>
              <View style={styles.categorySelector}>
                {NOTE_CATEGORIES.map((category) => {
                  const IconComponent = category.icon;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryOption,
                        { backgroundColor: theme.colors.background, borderColor: formData.category === category.id ? theme.colors.primary : 'transparent' }
                      ]}
                      onPress={() => setFormData(prev => ({ ...prev, category: category.id }))}
                    >
                      <IconComponent size={20} color={category.color} />
                      <Text style={[styles.categoryOptionText, { color: theme.colors.text }]}>{category.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Color</Text>
              <View style={styles.colorSelector}>
                {NOTE_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      formData.color === color && { borderColor: theme.colors.text }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 8,
    fontSize: 16,
  },
  categoryFilter: {
    marginBottom: 8,
  },
  categoryFilterContent: {
    paddingRight: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  notesGrid: {
    gap: 12,
  },
  noteCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
  },
  noteActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  noteContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteDate: {
    fontSize: 12,
    color: '#666',
  },
  pinnedIndicator: {
    padding: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 16,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 50,
  },
  contentInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
  },
  categorySelector: {
    gap: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  categoryOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  colorSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'transparent',
  },
});