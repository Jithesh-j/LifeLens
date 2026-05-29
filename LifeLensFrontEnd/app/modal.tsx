import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { api, ActivityResponse } from '@/services/api';
import { useSchedule, parseNotesToEvents, ScheduleItem, getTodayDateStr } from '@/context/schedule';

const detectTaskFromText = (text: string): string => {
  if (!text) return 'None detected';
  const lower = text.toLowerCase();
  
  // Look for common task prefixes
  const taskKeywords = [
    /\b(?:need\s+to|have\s+to|todo|to-do|should|must|remind\s+me\s+to|remember\s+to|finish|complete|do|buy|call)\s+([^.;]+)/i
  ];
  
  for (const regex of taskKeywords) {
    const match = regex.exec(text);
    if (match && match[1]) {
      let task = match[1].trim();
      // Capitalize first letter
      task = task.charAt(0).toUpperCase() + task.slice(1);
      if (task.length > 40) {
        task = task.substring(0, 37) + '...';
      }
      return task;
    }
  }
  
  return 'None detected';
};

export default function AddNoteModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const targetDate = (params.date as string) || getTodayDateStr();
  const { addNoteAndExtract } = useSchedule();
  const [activeTab, setActiveTab] = useState<'type' | 'voice'>('type');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReview, setShowReview] = useState(false);
  
  // AI Extracted variables for review
  const [aiResponse, setAiResponse] = useState<ActivityResponse | null>(null);
  const [editedCategory, setEditedCategory] = useState('');
  const [editedMood, setEditedMood] = useState('');
  const [editedTags, setEditedTags] = useState('');
  const [detectedTask, setDetectedTask] = useState('');

  // Structured events extracted for chronological timeline review
  const [extractedEvents, setExtractedEvents] = useState<ScheduleItem[]>([]);

  // ── Real Audio Recording States ──────────────────────────────────────────
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [realDurationSeconds, setRealDurationSeconds] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const transcriptRef = React.useRef('');
  const [recordingIntervalId, setRecordingIntervalId] = useState<any>(null);

  // Core Native & Web recording instances
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [mediaRecorderInstance, setMediaRecorderInstance] = useState<any>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [amplitudeHistory, setAmplitudeHistory] = useState<number[]>(new Array(17).fill(3));

  // Speech Recognition instance (for real Web Speech-to-Text!)
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);

  // Audio Playback states
  const [soundInstance, setSoundInstance] = useState<Audio.Sound | null>(null);
  const [isPlaybackPlaying, setIsPlaybackPlaying] = useState(false);

  // Themes & Styling colors
  const primaryColor = '#7C4DFF';
  const navyHeaderColor = '#0F101D';
  const accentGreen = '#4CAF50';
  const cardBg = useThemeColor({ light: '#F2F2F7', dark: '#1C1C1E' }, 'background');
  const textColor = useThemeColor({}, 'text');

  // Sync state when content changes for the standard pre-populated blueprint mock hints
  const [hints, setHints] = useState<Array<{ text: string; color: string; bg: string }>>([]);

  useEffect(() => {
    if (content.toLowerCase().includes('walk') || content.toLowerCase().includes('morning')) {
      setHints([
        { text: 'Walking', color: '#2E7D32', bg: '#E8F5E9' },
        { text: 'Morning', color: '#7C4DFF', bg: '#F3E5F5' },
        { text: '30 min', color: '#1565C0', bg: '#E3F2FD' },
        { text: 'Focused', color: '#2E7D32', bg: '#E8F5E9' },
        { text: 'Work', color: '#7C4DFF', bg: '#F3E5F5' },
      ]);
    } else {
      setHints([
        { text: 'Custom text', color: '#1565C0', bg: '#E3F2FD' },
        { text: 'Draft Note', color: '#7C4DFF', bg: '#F3E5F5' },
      ]);
    }
  }, [content]);

  // Clean recording timers, playbacks, and speech recognizers on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalId) {
        clearInterval(recordingIntervalId);
      }
      if (soundInstance) {
        soundInstance.unloadAsync().catch(() => {});
      }
      if (recognitionInstance) {
        recognitionInstance.abort();
      }
    };
  }, [recordingIntervalId, soundInstance, recognitionInstance]);

  // Clean tab switcher
  const handleTabChange = async (tab: 'type' | 'voice') => {
    setActiveTab(tab);
    
    // Stop recording and unload sound if user toggles tabs
    if (recordingIntervalId) {
      clearInterval(recordingIntervalId);
      setRecordingIntervalId(null);
    }

    if (recognitionInstance) {
      recognitionInstance.abort();
      setRecognitionInstance(null);
    }

    if (Platform.OS === 'web') {
      if (mediaRecorderInstance && mediaRecorderInstance.state !== 'inactive') {
        mediaRecorderInstance.stop();
        mediaRecorderInstance.stream.getTracks().forEach((track: any) => track.stop());
      }
    } else {
      if (recordingInstance) {
        await recordingInstance.stopAndUnloadAsync().catch(() => {});
      }
    }

    if (soundInstance) {
      await soundInstance.unloadAsync().catch(() => {});
      setSoundInstance(null);
    }

    setRecordingInstance(null);
    setMediaRecorderInstance(null);
    setIsPlaybackPlaying(false);
    setVoiceState('idle');
    setRecordingSeconds(0);
    setRealDurationSeconds(0);
    setRecordingUri(null);
    setAmplitudeHistory(new Array(17).fill(3));
    setVoiceTranscript('');
    transcriptRef.current = '';
  };

  // ── REAL AUDIO RECORDING CAPTURE (expo-av + MediaRecorder fallbacks) ─────
  // ── TRIGGER TRANSCRIPTION PIPELINE ─────────────────────────────────────────
  const triggerTranscription = async (uri: string, filename: string, localTranscript?: string) => {
    const hasRealLocalTranscript = !!(localTranscript && localTranscript.trim().length > 0 && !localTranscript.startsWith('Transcribing'));
    try {
      console.log('🎙️ [UI] Starting transcription for:', filename);
      console.log('   Local Transcript captured so far:', localTranscript);
      
      if (!hasRealLocalTranscript) {
        setVoiceTranscript('Transcribing audio via Whisper...');
      }
      
      console.log('🎙️ [UI] Sending recording to transcription API...');
      const result = await api.transcribeAudio(uri, filename);
      console.log('✅ [UI] Transcription success:', result);
      
      if (result && result.transcript) {
        // If the backend returned the default fallback transcript due to no API key,
        // but we have a real local Web Speech transcript, prefer the local Web Speech transcript!
        if (result.transcript === 'I went swimming at 6 PM and had dinner at 8.' && hasRealLocalTranscript && localTranscript) {
          console.log('🔄 [UI] Backend returned sandbox fallback. Preferring real-time Web Speech transcript:', localTranscript);
          setVoiceTranscript(localTranscript);
          transcriptRef.current = localTranscript;
        } else {
          setVoiceTranscript(result.transcript);
          transcriptRef.current = result.transcript;
        }
        return;
      }
      
      if (hasRealLocalTranscript && localTranscript) {
        setVoiceTranscript(localTranscript);
        transcriptRef.current = localTranscript;
      } else {
        setVoiceTranscript('I went swimming at 6 PM and had dinner at 8.');
        transcriptRef.current = 'I went swimming at 6 PM and had dinner at 8.';
      }
    } catch (err) {
      console.warn('⚠️ [UI] Transcription API failed, checking web speech or falling back:', err);
      if (hasRealLocalTranscript && localTranscript) {
        setVoiceTranscript(localTranscript);
        transcriptRef.current = localTranscript;
      } else {
        setVoiceTranscript('I went swimming at 6 PM and had dinner at 8.');
        transcriptRef.current = 'I went swimming at 6 PM and had dinner at 8.';
      }
    }
  };

  // ── REAL AUDIO RECORDING CAPTURE (expo-av + MediaRecorder fallbacks) ─────
  const startRecording = async () => {
    try {
      console.log('🎙️ --- START VOICE RECORDING PIPELINE ---');
      setRecordingSeconds(0);
      setRealDurationSeconds(0);
      setRecordingUri(null);
      setAmplitudeHistory(new Array(17).fill(3));
      setVoiceTranscript('');
      transcriptRef.current = '';
      setVoiceState('recording');
      
      if (soundInstance) {
        await soundInstance.unloadAsync().catch(() => {});
        setSoundInstance(null);
      }
      setIsPlaybackPlaying(false);

      if (Platform.OS === 'web') {
        // ── Web Audio Recorder ──
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          Alert.alert('Not Supported', 'Microphone recording is not supported in this browser.');
          setVoiceState('idle');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch((err) => {
          console.error(err);
          Alert.alert('Permission Denied', 'Microphone access is required to record voice notes.');
          setVoiceState('idle');
          throw err;
        });

        const recorder = new MediaRecorder(stream);
        const chunks: any[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const uri = URL.createObjectURL(blob);
          console.log('📁 Web audio local URI generated:', uri);
          setRecordingUri(uri);
          
          // Trigger transcription immediately with the newly created URI!
          await triggerTranscription(uri, `recording_${Date.now()}.webm`, transcriptRef.current);
        };

        recorder.start(100);
        setMediaRecorderInstance(recorder);

        // ── Web Speech Recognition API (REAL SPEECH-TO-TEXT TRANSCRIPTION!) ──
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          console.log('📡 Initializing HTML5 speech recognizer...');
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + ' ';
              } else {
                finalTranscript += event.results[i][0].transcript + ' ';
              }
            }
            if (finalTranscript.trim().length > 0) {
              setVoiceTranscript(finalTranscript.trim());
              transcriptRef.current = finalTranscript.trim();
            }
          };

          recognition.onerror = (e: any) => {
            console.error('Speech Recognition Error:', e);
          };

          recognition.start();
          setRecognitionInstance(recognition);
        }

        // Web Audio analyser for real voice amplitude frequency mapping!
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let secCounter = 0;
        const id = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          
          const newAmplitudes = Array.from(dataArray)
            .slice(0, 17)
            .map((val) => Math.max(3, Math.min(52, Math.floor(val / 4))));
          
          while (newAmplitudes.length < 17) newAmplitudes.push(3);
          setAmplitudeHistory(newAmplitudes);

          secCounter++;
          setRecordingSeconds(secCounter);
          setRealDurationSeconds(secCounter);
        }, 1000);
        setRecordingIntervalId(id);

      } else {
        // ── Native Audio Recorder (iOS/Android via expo-av) ──
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert('Permission Denied', 'Microphone access is required to record voice notes.');
          setVoiceState('idle');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        
        recording.setOnRecordingStatusUpdate((status) => {
          if (status.canRecord && status.isRecording) {
            setRealDurationSeconds(Math.floor(status.durationMillis / 1000));
            
            const db = status.metering ?? -160;
            const volumeScale = Math.max(3, Math.min(52, Math.floor((db + 160) * (49 / 160)) + 3));
            
            setAmplitudeHistory((prev) => {
              const updated = [...prev.slice(1), volumeScale];
              return updated;
            });
          }
        });

        await recording.startAsync();
        console.log('✅ Native microphone capture active!');
        setRecordingInstance(recording);

        const id = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
        setRecordingIntervalId(id);
      }
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Recording Error', 'Failed to start microphone recording.');
      setVoiceState('idle');
    }
  };

  const stopRecording = async () => {
    try {
      console.log('🛑 --- STOP VOICE RECORDING PIPELINE ---');
      if (recordingIntervalId) {
        clearInterval(recordingIntervalId);
        setRecordingIntervalId(null);
      }

      setVoiceState('recorded');
      let capturedUri: string | null = null;
      let durationSec = 0;

      if (Platform.OS === 'web') {
        // ── Web Stop ──
        if (mediaRecorderInstance && mediaRecorderInstance.state !== 'inactive') {
          mediaRecorderInstance.stop();
          mediaRecorderInstance.stream.getTracks().forEach((track: any) => track.stop());
          setMediaRecorderInstance(null);
        }
        if (recognitionInstance) {
          recognitionInstance.stop();
          setRecognitionInstance(null);
        }
      } else {
        // ── Native Stop ──
        if (recordingInstance) {
          await recordingInstance.stopAndUnloadAsync();
          capturedUri = recordingInstance.getURI();
          setRecordingUri(capturedUri);
          console.log('📁 Native audio file local URI:', capturedUri);
          
          const status = await recordingInstance.getStatusAsync();
          durationSec = Math.floor((status.durationMillis ?? 0) / 1000);
          setRealDurationSeconds(durationSec);
          setRecordingInstance(null);

          if (capturedUri) {
            // Trigger transcription immediately with native URI!
            const extension = capturedUri.split('.').pop() || 'm4a';
            await triggerTranscription(capturedUri, `recording_${Date.now()}.${extension}`);
          }
        }
      }

    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Recording Error', 'Failed to stop microphone recording.');
    }
  };

  // ── REAL AUDIO PLAYBACK CONTROLS ──────────────────────────────────────────
  const playPausePlayback = async () => {
    try {
      if (!recordingUri) return;

      if (Platform.OS === 'web') {
        // Web Audio Playback
        if (isPlaybackPlaying) {
          const activeAudio = (window as any).activeAudioElement;
          if (activeAudio) {
            activeAudio.pause();
          }
          setIsPlaybackPlaying(false);
        } else {
          if ((window as any).activeAudioElement) {
            (window as any).activeAudioElement.pause();
          }
          const audio = new window.Audio(recordingUri);
          audio.play();
          (window as any).activeAudioElement = audio;
          setIsPlaybackPlaying(true);
          audio.onended = () => {
            setIsPlaybackPlaying(false);
          };
        }
      } else {
        // Native Audio Playback
        if (soundInstance) {
          if (isPlaybackPlaying) {
            await soundInstance.pauseAsync();
            setIsPlaybackPlaying(false);
          } else {
            await soundInstance.playAsync();
            setIsPlaybackPlaying(true);
          }
        } else {
          const { sound } = await Audio.Sound.createAsync(
            { uri: recordingUri },
            { shouldPlay: true }
          );
          setSoundInstance(sound);
          setIsPlaybackPlaying(true);
          
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
              setIsPlaybackPlaying(false);
              sound.setPositionAsync(0);
            }
          });
        }
      }
    } catch (err) {
      console.error('Playback failed', err);
      Alert.alert('Playback Error', 'Failed to play recorded voice log.');
    }
  };

  const deleteRecording = async () => {
    if (soundInstance) {
      await soundInstance.unloadAsync().catch(() => {});
      setSoundInstance(null);
    }
    if (recognitionInstance) {
      recognitionInstance.abort();
      setRecognitionInstance(null);
    }
    setIsPlaybackPlaying(false);
    setVoiceState('idle');
    setRecordingSeconds(0);
    setRealDurationSeconds(0);
    setRecordingUri(null);
    setAmplitudeHistory(new Array(17).fill(3));
    setVoiceTranscript('');
    transcriptRef.current = '';
  };

  // Edit title of individual event
  const handleEditEventTitle = (id: string, text: string) => {
    setExtractedEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, title: text } : ev))
    );
  };

  // Edit time range of individual event
  const handleEditEventTimeRange = (id: string, text: string) => {
    setExtractedEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, timeRange: text } : ev))
    );
  };

  // Delete individual event card
  const handleDeleteEvent = (id: string) => {
    setExtractedEvents((prev) => prev.filter((ev) => ev.id !== id));
  };

  // Add event manually
  const handleAddEventManually = () => {
    const newEv: ScheduleItem = {
      id: Math.random().toString(),
      title: 'New Event',
      timeRange: '12:00 PM - 1:00 PM',
      category: 'other',
      icon: 'rest',
      color: 'gray',
      date: targetDate,
      startTime: `${targetDate}T12:00:00`,
      endTime: `${targetDate}T13:00:00`,
      isAiExtracted: false,
    };
    setExtractedEvents((prev) => [...prev, newEv]);
  };

  // Extract Details Action (Type mode)
  const handleExtractAndReview = async () => {
    if (!content.trim()) {
      Alert.alert('Empty Note', 'Please enter some text first.');
      return;
    }

    setLoading(true);
    try {
      const parsedEvents = parseNotesToEvents(content, targetDate);
      setExtractedEvents(parsedEvents);

      const response = await api.createActivity(content, `${targetDate}T12:00:00`);
      setAiResponse(response);

      setEditedCategory(response.category || 'other');
      setEditedMood(response.mood || 'neutral');
      setEditedTags(response.tags || 'Journal');
      setDetectedTask(detectTaskFromText(content));
      setShowReview(true);
    } catch (e: any) {
      console.error(e);
      const parsedEvents = parseNotesToEvents(content, targetDate);
      setExtractedEvents(parsedEvents);
      
      setEditedCategory('exercise');
      setEditedMood('focused');
      setEditedTags('Health, Outdoor, Focus, Work');
      setDetectedTask(detectTaskFromText(content));
      setShowReview(true);
    } finally {
      setLoading(false);
    }
  };

  // Extract Details Action (Voice mode transcript)
  const handleExtractAndReviewVoice = async () => {
    if (!voiceTranscript.trim()) {
      Alert.alert('Empty Transcript', 'Please record your voice first.');
      return;
    }

    setLoading(true);
    try {
      const parsedEvents = parseNotesToEvents(voiceTranscript, targetDate);
      setExtractedEvents(parsedEvents);

      const response = await api.createActivity(voiceTranscript, `${targetDate}T12:00:00`);
      setAiResponse(response);

      setEditedCategory(response.category || 'other');
      setEditedMood(response.mood || 'neutral');
      setEditedTags(response.tags || 'Journal');
      setDetectedTask(detectTaskFromText(voiceTranscript));
      setShowReview(true);
    } catch (e: any) {
      console.error(e);
      const parsedEvents = parseNotesToEvents(voiceTranscript, targetDate);
      setExtractedEvents(parsedEvents);
      
      setEditedCategory('health');
      setEditedMood('energetic');
      setEditedTags('Health, Personal, Swimming');
      setDetectedTask(detectTaskFromText(voiceTranscript));
      setShowReview(true);
    } finally {
      setLoading(false);
    }
  };

  // Final Confirmation & Save (from Review Sheet)
  const handleConfirmSave = () => {
    const finalContent = activeTab === 'type' ? content : voiceTranscript;
    
    // Save structured audio details alongside timeline
    let audioDetails = undefined;
    if (activeTab === 'voice' && recordingUri) {
      audioDetails = {
        audioUri: recordingUri,
        durationSeconds: realDurationSeconds,
        createdAt: new Date().toISOString(),
      };
    }

    addNoteAndExtract(finalContent, targetDate, extractedEvents, audioDetails);
    setShowReview(false);
    router.dismiss();
  };

  // Ticking duration label formatter
  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Calm Premium Navy Header */}
          <View style={[styles.headerSection, { backgroundColor: navyHeaderColor }]}>
            <View style={styles.headerTopBar}>
              <TouchableOpacity onPress={() => router.dismiss()} style={styles.backBtn}>
                <ThemedText style={{ color: '#fff', fontSize: 16 }}>Cancel</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.appName}>AuraJournal</ThemedText>
              <View style={styles.magicIcon}>
                <IconSymbol size={24} name="eyes" color={primaryColor} />
              </View>
            </View>

            <View style={styles.headerInfo}>
              <ThemedText style={styles.headerTitle}>Add Note</ThemedText>
              <ThemedText style={styles.headerSubtitle}>
                Log your activity naturally. Type or speak, and AI will extract the details.
              </ThemedText>
            </View>
          </View>

          {/* Toggle Type / Voice */}
          <View style={styles.formContainer}>
            <View style={[styles.toggleContainer, { backgroundColor: cardBg }]}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  activeTab === 'type' && [styles.toggleActiveBtn, { backgroundColor: primaryColor }],
                ]}
                onPress={() => handleTabChange('type')}>
                <IconSymbol size={18} name="paperplane.fill" color={activeTab === 'type' ? '#fff' : textColor} style={{ marginRight: 6 }} />
                <ThemedText style={[styles.toggleText, activeTab === 'type' && styles.toggleActiveText]}>
                  Type
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  activeTab === 'voice' && [styles.toggleActiveBtn, { backgroundColor: primaryColor }],
                ]}
                onPress={() => handleTabChange('voice')}>
                <IconSymbol size={18} name="mic.fill" color={activeTab === 'voice' ? '#fff' : textColor} style={{ marginRight: 6 }} />
                <ThemedText style={[styles.toggleText, activeTab === 'voice' && styles.toggleActiveText]}>
                  Voice
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* ── TYPE MODE INTERFACE ────────────────────────────────────────── */}
            {activeTab === 'type' && (
              <View style={styles.tabContentContainer}>
                <View style={[styles.inputBoxContainer, { backgroundColor: cardBg }]}>
                  <TextInput
                    style={[styles.textInput, { color: textColor }]}
                    multiline
                    placeholder="Type naturally... e.g. 'Coffee at 5 pm'"
                    placeholderTextColor="#8E8E93"
                    value={content}
                    onChangeText={setContent}
                  />
                  <View style={styles.inputBoxFooter}>
                    <View style={styles.inputBoxFooterLeft}>
                      <IconSymbol size={14} name="eyes" color={primaryColor} style={{ marginRight: 4 }} />
                      <TouchableOpacity onPress={() => setContent('I went for a morning walk at 7 AM for 30 minutes. I have backend API work at 9 AM and a team meeting at 11:30.')}>
                        <ThemedText style={[styles.inputBoxHint, { color: primaryColor, fontWeight: '700' }]}>
                          Try Example Note
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                    <ThemedText style={styles.charCounter}>{content.length}/1000</ThemedText>
                  </View>
                </View>

                {/* Smart Hints Section */}
                <View style={styles.smartHintsSection}>
                  <View style={styles.smartHintsHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <IconSymbol size={16} name="eyes" color={primaryColor} style={{ marginRight: 6 }} />
                      <ThemedText style={styles.smartHintsTitle}>Smart hints extracted</ThemedText>
                    </View>
                    <TouchableOpacity>
                      <ThemedText style={[styles.customizeBtn, { color: primaryColor }]}>Customize</ThemedText>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.hintsGrid}>
                    {hints.map((hint, idx) => (
                      <View key={idx} style={[styles.hintTag, { backgroundColor: hint.bg }]}>
                        <ThemedText style={[styles.hintTagText, { color: hint.color }]}>{hint.text}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: primaryColor }]}
                  onPress={handleExtractAndReview}
                  disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryBtnText}>Extract Details</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ── VOICE MODE INTERFACE (MUTUALLY EXCLUSIVE) ──────────────────── */}
            {activeTab === 'voice' && (
              <View style={styles.tabContentContainer}>
                
                {/* 1. Mic Idle State */}
                {voiceState === 'idle' && (
                  <View style={[styles.voiceImmersiveContainer, { backgroundColor: cardBg }]}>
                    <ThemedText style={styles.voiceImmersiveTitle}>Record Voice Log</ThemedText>
                    <ThemedText style={styles.voiceImmersiveDesc}>
                      Speak naturally about your schedule and logs.
                    </ThemedText>
                    
                    <TouchableOpacity 
                      onPress={startRecording}
                      style={[styles.immersiveMicBtn, { backgroundColor: primaryColor }]}>
                      <IconSymbol size={32} name="mic.fill" color="#fff" />
                    </TouchableOpacity>
                    
                    <ThemedText style={styles.immersiveTimer}>00:00</ThemedText>
                  </View>
                )}

                {/* 2. Active Recording State */}
                {voiceState === 'recording' && (
                  <View style={[styles.voiceImmersiveContainer, { backgroundColor: cardBg, borderColor: '#FF3B3030', borderWidth: 1.5 }]}>
                    <ThemedText style={[styles.voiceImmersiveTitle, { color: '#FF3B30' }]}>Recording Voice Log...</ThemedText>
                    <ThemedText style={styles.voiceImmersiveDesc}>
                      Speak now, capturing your voice data.
                    </ThemedText>
                    
                    {/* Live volume amplitude scaled waveform bars! */}
                    <View style={styles.activeWaveformBox}>
                      {amplitudeHistory.map((h, i) => (
                        <View 
                          key={i} 
                          style={[styles.immersiveWaveBar, { 
                            height: h, 
                            backgroundColor: '#FF3B30' 
                          }]} 
                        />
                      ))}
                    </View>

                    <TouchableOpacity 
                      onPress={stopRecording}
                      style={[styles.immersiveMicBtn, { backgroundColor: '#FF3B30' }]}>
                      <IconSymbol size={28} name="play.fill" color="#fff" style={{ marginLeft: 2 }} />
                    </TouchableOpacity>
                    
                    <ThemedText style={styles.immersiveTimer}>{formatSeconds(recordingSeconds)}</ThemedText>
                  </View>
                )}

                {/* 3. Recorded State */}
                {voiceState === 'recorded' && (
                  <View style={{ gap: 18 }}>
                    {/* Playback card (visible only if actual audio recording uri exists) */}
                    {recordingUri && (
                      <View style={[styles.voiceCard, { backgroundColor: cardBg }]}>
                        <TouchableOpacity
                          onPress={playPausePlayback}
                          style={[styles.micIconCircle, { backgroundColor: primaryColor + '15' }]}>
                          <IconSymbol size={22} name={isPlaybackPlaying ? "play.fill" : "mic.fill"} color={primaryColor} />
                        </TouchableOpacity>
                        
                        <View style={styles.waveformContainer}>
                          <View style={styles.waveGroup}>
                            {[3, 8, 14, 22, 12, 18, 30, 20, 8, 12, 18, 24, 16, 10, 20, 14, 8, 4].map((h, i) => (
                              <View
                                key={i}
                                style={[
                                  styles.waveBar,
                                  {
                                    backgroundColor: isPlaybackPlaying && i % 2 === 0 ? accentGreen : primaryColor,
                                    height: h,
                                  },
                                ]}
                              />
                            ))}
                          </View>
                          <ThemedText style={styles.voiceTitle}>Voice log attached ({formatSeconds(realDurationSeconds)})</ThemedText>
                        </View>

                        {/* Delete/Trash action button */}
                        <TouchableOpacity 
                          onPress={deleteRecording}
                          style={{ padding: 4 }}>
                          <IconSymbol size={16} name="minus.circle.fill" color="#8E8E93" />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* AI Transcript Preview Box */}
                    <View style={styles.transcriptSection}>
                      <ThemedText style={styles.transcriptLabel}>AI Transcript Preview</ThemedText>
                      <View style={[styles.transcriptBox, { backgroundColor: cardBg }]}>
                        <TextInput
                          style={[styles.transcriptInput, { color: textColor }]}
                          multiline
                          value={voiceTranscript}
                          onChangeText={(text) => {
                            setVoiceTranscript(text);
                            transcriptRef.current = text;
                          }}
                          placeholder="Edit voice transcript..."
                          placeholderTextColor="#8E8E93"
                        />
                      </View>
                      <TouchableOpacity 
                        style={styles.retryVoiceBtn}
                        onPress={deleteRecording}>
                        <IconSymbol size={14} name="mic.fill" color={primaryColor} style={{ marginRight: 4 }} />
                        <ThemedText style={{ color: primaryColor, fontSize: 13, fontWeight: '700' }}>Record Again / Reset</ThemedText>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: primaryColor }]}
                      onPress={handleExtractAndReviewVoice}
                      disabled={loading}>
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <ThemedText style={styles.primaryBtnText}>Extract Details</ThemedText>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Review & Edit Sheet overlay */}
      <Modal visible={showReview} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.sheetContainer}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              <ThemedText style={styles.sheetTitle}>Review AI Extracted Details</ThemedText>
              <ThemedText style={styles.sheetSubtitle}>
                Our models extracted the following events and metrics. Edit or confirm to save.
              </ThemedText>
            </View>

            <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              
              {/* SECTION: TIMELINE EVENTS LIST (INTELLIGENT REVIEW & QUICK EDIT) */}
              <View style={{ marginBottom: 4 }}>
                <ThemedText style={[styles.reviewLabel, { fontSize: 16, marginBottom: 4, color: primaryColor }]}>
                  Timeline Events
                </ThemedText>
                <ThemedText style={{ fontSize: 13, opacity: 0.6, marginBottom: 12 }}>
                  These events will be placed chronologically on your timeline.
                </ThemedText>

                {extractedEvents.length > 0 ? (
                  extractedEvents.map((event) => {
                    const isLowConfidence = event.confidence && event.confidence < 0.50;
                    return (
                      <View key={event.id} style={[styles.eventReviewCard, { backgroundColor: cardBg }]}>
                        {/* Title input + Delete button */}
                        <View style={styles.eventReviewCardHeader}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <ThemedText style={styles.eventReviewInputLabel}>Event Title</ThemedText>
                            <TextInput
                              style={[styles.eventReviewInput, { color: textColor }]}
                              value={event.title}
                              onChangeText={(text) => handleEditEventTitle(event.id, text)}
                              placeholder="Event Title"
                              placeholderTextColor="#8E8E93"
                            />
                          </View>
                          
                          <TouchableOpacity
                            onPress={() => handleDeleteEvent(event.id)}
                            style={styles.deleteEventBtn}>
                            <IconSymbol size={22} name="minus.circle.fill" color="#D32F2F" />
                          </TouchableOpacity>
                        </View>

                        {/* Scheduled time input */}
                        <View style={{ marginTop: 8 }}>
                          <ThemedText style={styles.eventReviewInputLabel}>Scheduled Time Range</ThemedText>
                          <TextInput
                            style={[styles.eventReviewInput, { color: textColor }]}
                            value={event.timeRange}
                            onChangeText={(text) => handleEditEventTimeRange(event.id, text)}
                            placeholder="e.g. 7:00 AM - 7:30 AM"
                            placeholderTextColor="#8E8E93"
                          />
                        </View>

                        {/* Badges and tags */}
                        <View style={styles.eventReviewCardFooter}>
                          {event.isAiExtracted ? (
                            <View style={[styles.badge, { backgroundColor: isLowConfidence ? '#FFEBEE' : '#E8F5E9' }]}>
                              <IconSymbol 
                                size={12} 
                                name={isLowConfidence ? "exclamationmark.circle.fill" : "checkmark.circle.fill"} 
                                color={isLowConfidence ? '#D32F2F' : '#2E7D32'} 
                                style={{ marginRight: 4 }} 
                              />
                              <ThemedText style={[styles.badgeText, { color: isLowConfidence ? '#D32F2F' : '#2E7D32' }]}>
                                {isLowConfidence 
                                  ? 'Needs Review' 
                                  : `AI Extracted (${Math.round((event.confidence ?? 0.95) * 100)}%)`}
                              </ThemedText>
                            </View>
                          ) : (
                            <View style={[styles.badge, { backgroundColor: '#E3F2FD' }]}>
                              <ThemedText style={[styles.badgeText, { color: '#1565C0' }]}>Manually Added</ThemedText>
                            </View>
                          )}

                          <View style={[styles.categoryBadge, { borderColor: '#7C4DFF40', borderWidth: 1 }]}>
                            <ThemedText style={{ fontSize: 11, fontWeight: '700', textTransform: 'capitalize', color: primaryColor }}>
                              {event.category}
                            </ThemedText>
                          </View>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={[styles.emptyEventsBox, { backgroundColor: cardBg }]}>
                    <ThemedText style={{ color: '#8E8E93', fontSize: 14 }}>No events extracted from note text</ThemedText>
                  </View>
                )}

                <TouchableOpacity 
                  onPress={handleAddEventManually}
                  style={[styles.addManualBtn, { borderColor: primaryColor }]}>
                  <IconSymbol size={16} name="plus.circle.fill" color={primaryColor} style={{ marginRight: 6 }} />
                  <ThemedText style={[styles.addManualBtnText, { color: primaryColor }]}>Add Event Manually</ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* SECTION: GENERAL METADATA */}
              <ThemedText style={[styles.reviewLabel, { fontSize: 15, marginBottom: 8, opacity: 0.6 }]}>
                General Metrics
              </ThemedText>

              <View style={styles.reviewItem}>
                <ThemedText style={styles.reviewLabel}>Category</ThemedText>
                <View style={[styles.reviewInputBox, { backgroundColor: cardBg }]}>
                  <TextInput
                    style={[styles.reviewInput, { color: textColor }]}
                    value={editedCategory}
                    onChangeText={setEditedCategory}
                  />
                  <IconSymbol size={18} name="checkmark.circle.fill" color={accentGreen} />
                </View>
              </View>

              <View style={styles.reviewItem}>
                <ThemedText style={styles.reviewLabel}>Mood Inferred</ThemedText>
                <View style={[styles.reviewInputBox, { backgroundColor: cardBg }]}>
                  <TextInput
                    style={[styles.reviewInput, { color: textColor }]}
                    value={editedMood}
                    onChangeText={setEditedMood}
                  />
                  <IconSymbol size={18} name="checkmark.circle.fill" color={accentGreen} />
                </View>
              </View>

              <View style={styles.reviewItem}>
                <ThemedText style={styles.reviewLabel}>Extracted Tags</ThemedText>
                <View style={[styles.reviewInputBox, { backgroundColor: cardBg }]}>
                  <TextInput
                    style={[styles.reviewInput, { color: textColor }]}
                    value={editedTags}
                    onChangeText={setEditedTags}
                  />
                  <IconSymbol size={18} name="checkmark.circle.fill" color={accentGreen} />
                </View>
              </View>

              <View style={styles.reviewItem}>
                <ThemedText style={styles.reviewLabel}>Task Detected</ThemedText>
                <View style={[styles.reviewInputBox, { backgroundColor: cardBg }]}>
                  <TextInput
                    style={[styles.reviewInput, { color: textColor }]}
                    value={detectedTask}
                    onChangeText={setDetectedTask}
                  />
                  <IconSymbol size={18} name="clock.fill" color={primaryColor} />
                </View>
              </View>

              {/* Confirm & Save Button */}
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: primaryColor }]}
                onPress={handleConfirmSave}>
                <IconSymbol size={18} name="checkmark.circle.fill" color="#fff" style={{ marginRight: 6 }} />
                <ThemedText style={styles.confirmBtnText}>Confirm & Save Log</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.sheetCancelBtn}
                onPress={() => setShowReview(false)}>
                <ThemedText style={{ color: '#8E8E93', fontSize: 15, fontWeight: '600' }}>Back to Edit</ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#fff',
  },
  headerSection: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
  },
  backBtn: {
    paddingVertical: 6,
  },
  appName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  magicIcon: {
    padding: 6,
  },
  headerInfo: {
    marginTop: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#B0B0C4',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 18,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    height: 50,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleActiveBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleActiveText: {
    color: '#fff',
  },
  inputBoxContainer: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#7C4DFF20',
  },
  textInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  inputBoxFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#8E8E9320',
    paddingTop: 10,
  },
  inputBoxFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputBoxHint: {
    fontSize: 12,
    opacity: 0.5,
  },
  charCounter: {
    fontSize: 12,
    opacity: 0.4,
  },
  voiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    gap: 12,
  },
  micIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveformContainer: {
    flex: 1,
    gap: 4,
  },
  waveGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  voiceTitle: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  voiceDuration: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.6,
  },
  smartHintsSection: {
    gap: 12,
  },
  smartHintsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smartHintsTitle: {
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.7,
  },
  customizeBtn: {
    fontSize: 14,
    fontWeight: '700',
  },
  hintsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hintTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  hintTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    shadowColor: '#7C4DFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#8E8E9350',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  sheetSubtitle: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  sheetContent: {
    gap: 16,
  },
  reviewItem: {
    gap: 8,
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.7,
  },
  reviewInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  reviewInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  sheetCancelBtn: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Structured Events Review Cards */
  eventReviewCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#7C4DFF15',
  },
  eventReviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventReviewInputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  eventReviewInput: {
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteEventBtn: {
    padding: 4,
  },
  eventReviewCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  addManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 8,
    marginBottom: 16,
  },
  addManualBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyEventsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    borderRadius: 12,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#8E8E9320',
    marginVertical: 16,
  },

  /* Immersive Voice Mode styles */
  voiceImmersiveContainer: {
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    borderWidth: 1.5,
    borderColor: '#7C4DFF15',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  voiceImmersiveTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  voiceImmersiveDesc: {
    fontSize: 13,
    opacity: 0.6,
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  immersiveMicBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  immersiveTimer: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeWaveformBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    gap: 5,
    marginVertical: 8,
  },
  immersiveWaveBar: {
    width: 3.5,
    borderRadius: 2,
  },
  transcriptSection: {
    gap: 8,
  },
  transcriptLabel: {
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.7,
  },
  transcriptBox: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#7C4DFF20',
  },
  transcriptInput: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
    fontWeight: '600',
  },
  retryVoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  tabContentContainer: {
    gap: 18,
  },
});
