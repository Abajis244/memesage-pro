import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Battery, Wifi, Signal, ChevronLeft, Video, Phone, 
  MoreVertical, Mic, Camera, Smile, Paperclip, Send, 
  Check, CheckCheck, Info, PlusCircle, Trash2, Image as ImageIcon,
  Play, Square, Moon, Sun, Save, Download, Settings, 
  MessageSquare, Pause, UploadCloud, Edit, Users, Image, LayoutPanelLeft,
  GripVertical, Wand2, Bell, Video as VideoIcon, Keyboard, FolderOpen,
  Undo, Redo, MapPin, FileText, Plane, ArrowUp, ArrowDown, AlertCircle,
  X, AlertTriangle, PlayCircle, PauseCircle
} from 'lucide-react';

// --- UTILS & CONSTANTS ---
const generateId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `msg-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

const FALLBACK_AVATAR = "data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3e%3crect width='150' height='150' fill='%23e2e8f0'/%3e%3ccircle cx='75' cy='60' r='35' fill='%2394a3b8'/%3e%3cpath d='M15,150 a60,60 0 0,1 120,0' fill='%2394a3b8'/%3e%3c/svg%3e";

const QWERTY_MAP = {
  'a': 's', 's': 'a', 'd': 's', 'f': 'd', 'g': 'f', 'h': 'g', 'j': 'h', 'k': 'j', 'l': 'k',
  'q': 'w', 'w': 'q', 'e': 'w', 'r': 'e', 't': 'r', 'y': 't', 'u': 'y', 'i': 'u', 'o': 'i', 'p': 'o',
  'z': 'x', 'x': 'z', 'c': 'x', 'v': 'c', 'b': 'v', 'n': 'b', 'm': 'n', ' ': ' '
};

const getTypo = (char) => {
  const lower = char.toLowerCase();
  const typo = QWERTY_MAP[lower] || String.fromCharCode(char.charCodeAt(0) + 1);
  return char === char.toUpperCase() ? typo.toUpperCase() : typo;
};

const parseDuration = (str) => {
  if (!str) return 5;
  const parts = str.split(':').map(Number);
  if (parts.length === 1 && !isNaN(parts[0])) return parts[0];
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return (parts[0] * 60) + parts[1];
  return 5;
};

const getNextTime = (timeStr) => {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
  if (!match) return timeStr;
  let [_, h, m, ampm] = match;
  let hrs = parseInt(h, 10); let mins = parseInt(m, 10);
  mins++;
  if (mins >= 60) {
    mins = 0; hrs++;
    if (ampm && hrs === 12) ampm = (ampm.toLowerCase() === 'am') ? 'PM' : 'AM';
    if (ampm && hrs > 12) hrs = 1;
    else if (!ampm && hrs >= 24) hrs = 0;
  }
  const pad = (n) => n.toString().padStart(2, '0');
  return `${ampm ? hrs : pad(hrs)}:${pad(mins)}${ampm ? ' ' + ampm : ''}`;
};

// Async pause & abort controller for robust animations
const pausableDelay = async (ms, signal, pauseRef) => {
  const checkState = async () => {
    if (signal?.aborted) throw new Error('Aborted');
    while (pauseRef.current) {
      if (signal?.aborted) throw new Error('Aborted');
      await new Promise(r => setTimeout(r, 100));
    }
  };
  await checkState();
  let elapsed = 0;
  while (elapsed < ms) {
    await checkState();
    await new Promise(r => setTimeout(r, 50));
    elapsed += 50;
  }
};

// --- CUSTOM HOOKS ---
function useAudioEngine() {
  const audioCtxRef = useRef(null);

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
  }, []);

  const playSound = useCallback((type) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === 'key') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.02);
      gain.gain.setValueAtTime(0.04, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      osc.start(now); osc.stop(now + 0.02);
    } else if (type === 'send' || type === 'receive') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(type === 'send' ? 400 : 800, now); osc.frequency.exponentialRampToValueAtTime(type === 'send' ? 800 : 400, now + 0.15);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.1, now + 0.05); gain.gain.linearRampToValueAtTime(0, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'notification') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.05, now + 0.05); gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
    }
  }, []);

  useEffect(() => {
    return () => { if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close(); };
  }, []);

  return { initAudio, playSound };
}

function useHistory(initialState) {
  const [state, setState] = useState(initialState);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const setWithHistory = useCallback((newState) => {
    setUndoStack(prev => [...prev, state]);
    // Garbage collect blob URLs from discarded redo stack
    if (redoStack.length > 0) {
      const activeBlobs = new Set([...newState, ...state, ...undoStack.flat()].flatMap(m => [m.text, m.audioUrl]).filter(url => url?.startsWith('blob:')));
      redoStack.flat().forEach(m => {
        if (m.text?.startsWith('blob:') && !activeBlobs.has(m.text)) URL.revokeObjectURL(m.text);
        if (m.audioUrl?.startsWith('blob:') && !activeBlobs.has(m.audioUrl)) URL.revokeObjectURL(m.audioUrl);
      });
    }
    setRedoStack([]);
    setState(newState);
  }, [state, undoStack, redoStack]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, state]);
    setUndoStack(u => u.slice(0, -1));
    setState(prev);
  }, [state, undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, state]);
    setRedoStack(r => r.slice(0, -1));
    setState(next);
  }, [state, redoStack]);

  const resetHistory = useCallback((newState) => {
    setUndoStack([]); setRedoStack([]); setState(newState);
  }, []);

  return { state, setWithHistory, undo, redo, undoStack, redoStack, resetHistory };
}

// --- SHARED COMPONENTS ---
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200" role="dialog" aria-modal="true">
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <AlertTriangle size={24} />
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
        <p className="text-gray-600 font-medium mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-all active:scale-95">Confirm</button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [activeTab, setActiveTab] = useState('messages');
  
  // FIXED: Added missing states
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);

  // Settings Config
  const [config, setConfig] = useState({
    platform: 'whatsapp', isDarkMode: false, wallpaperUrl: '', isGroupChat: false, phoneFrame: 'modern',
    contactName: 'Billionaires Club', contactStatus: '3 members, 2 online', profilePic: FALLBACK_AVATAR, myProfilePic: FALLBACK_AVATAR,
    time: '09:41', battery: '100', connectionType: 'wifi', typingSpeed: 3, showWatermark: true, clumsyTypist: false,
    navStyle: 'ios', autoIncrementTime: true,
    characters: [
      { id: 'char1', name: 'Elon', avatar: FALLBACK_AVATAR, color: 'text-blue-500' },
      { id: 'char2', name: 'Zuck', avatar: FALLBACK_AVATAR, color: 'text-green-500' }
    ]
  });

  const { state: messages, setWithHistory: setMessages, undo, redo, undoStack, redoStack, resetHistory } = useHistory([
    { id: '1', type: "system", text: "Yesterday", sender: "system", time: "", status: "" },
    { id: '2', type: "text", text: "Hey guys, you want to buy Twitter?", sender: "them", senderId: "char1", senderName: "Elon", time: "09:30", status: "" },
    { id: '3', type: "document", text: "Twitter_Acquisition_Draft.pdf", sender: "me", time: "09:31", status: "read", reaction: "" },
    { id: '4', type: "text", text: "I only have $5 right now.", sender: "me", time: "09:32", status: "read", reaction: "😂" },
    { id: '5', type: "text", text: "Count me out, focusing on Meta.", sender: "them", senderId: "char2", senderName: "Zuck", time: "09:40", status: "", reaction: "👎" }
  ]);

  // Form State
  const [form, setForm] = useState({ type: 'text', text: '', sender: 'me', senderId: '', senderName: '', time: '09:41', status: 'read', replyToId: '', audioUrl: '', reaction: '' });
  const [editingId, setEditingId] = useState(null);

  // Animation & UI State
  const [anim, setAnim] = useState({ isPlaying: false, isPaused: false, visibleMessages: messages, input: '', activity: '', keyboard: false, activeKey: null, notification: null, recordingTime: 0 });
  const abortControllerRef = useRef(null);
  const isPausedRef = useRef(false);

  const [audioPlayback, setAudioPlayback] = useState({ id: null, progress: 0 });
  const currentAudioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  
  const [showClearModal, setShowClearModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [savedProjectsList, setSavedProjectsList] = useState([]);
  const [exportScale, setExportScale] = useState(2);
  const [exportTransparent, setExportTransparent] = useState(false);
  const [phoneHovered, setPhoneHovered] = useState(false);

  const phoneRef = useRef(null);
  const chatContainerRef = useRef(null);
  const formRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null); // Added for JSON import
  const { initAudio, playSound } = useAudioEngine();

  // Cleanup Object URLs on unmount
  useEffect(() => {
    return () => {
      messages.forEach(msg => {
        if (msg.text?.startsWith('blob:')) URL.revokeObjectURL(msg.text);
        if (msg.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(msg.audioUrl);
      });
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [messages]);

  // Auto-scroll
  useEffect(() => { 
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: anim.isPlaying ? "auto" : "smooth" });
    }
  }, [anim.visibleMessages, config.platform, anim.keyboard, anim.input, anim.recordingTime, anim.isPlaying]);

  const updateConfig = (key, val) => setConfig(p => ({ ...p, [key]: val }));
  const updateForm = (key, val) => setForm(p => ({ ...p, [key]: val }));

  // Character Management Handlers
  const addCharacter = () => {
    setConfig(prev => ({ ...prev, characters: [...(prev.characters || []), { id: generateId(), name: 'New Char', avatar: FALLBACK_AVATAR, color: 'text-indigo-500' }] }));
  };
  const updateCharacter = (id, key, val) => {
    setConfig(prev => ({ ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, [key]: val } : c) }));
  };
  const removeCharacter = (id) => {
    setConfig(prev => ({ ...prev, characters: prev.characters.filter(c => c.id !== id) }));
  };

  // --- ACTIONS & HANDLERS ---
  const clearAllMessages = () => {
    if (anim.isPlaying) return;
    setMessages([]);
  };

  const stopAnimation = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    isPausedRef.current = false;
    setAnim({ isPlaying: false, isPaused: false, visibleMessages: messages, input: '', activity: '', keyboard: false, activeKey: null, notification: null, recordingTime: 0 });
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  };

  const togglePause = () => {
    isPausedRef.current = !isPausedRef.current;
    setAnim(p => ({ ...p, isPaused: isPausedRef.current }));
  };

  const exportJSON = () => {
    if (anim.isPlaying) return;
    const cleanMessages = messages.map(m => ({...m, text: m.text?.startsWith('blob:')?'':m.text, audioUrl: m.audioUrl?.startsWith('blob:')?'':m.audioUrl}));
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ config, messages: cleanMessages }));
    const a = document.createElement('a');
    a.href = dataStr; a.download = `memesage_project_${Date.now()}.json`; a.click();
  };

  const importJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.config) setConfig(parsed.config);
        if (parsed.messages) resetHistory(parsed.messages);
        alert('Project loaded successfully!');
      } catch (err) {
        alert('Invalid project file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const runAnimation = async () => {
    if (messages.length === 0) return;
    initAudio();
    if (audioPlayback.id) togglePlayAudio({ id: audioPlayback.id }); // Force stop audio previews
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    isPausedRef.current = false;
    
    setAnim({ isPlaying: true, isPaused: false, visibleMessages: [], input: '', activity: '', keyboard: false, activeKey: null, notification: null, recordingTime: 0 });
    const speedMult = 4 - config.typingSpeed; 

    try {
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.type === 'system') { 
          setAnim(p => ({ ...p, visibleMessages: [...p.visibleMessages, msg] }));
          await pausableDelay(300, signal, isPausedRef); 
          continue; 
        }

        if (msg.sender === 'me') {
          await pausableDelay(400 * speedMult, signal, isPausedRef);
          if (msg.type === 'text') {
            setAnim(p => ({ ...p, keyboard: true }));
            await pausableDelay(200, signal, isPausedRef);
            
            let currentInput = '';
            for (let char of msg.text) {
              if (config.clumsyTypist && Math.random() > 0.92 && char.match(/[a-zA-Z]/)) {
                const wrongChar = getTypo(char);
                setAnim(p => ({ ...p, activeKey: wrongChar.toLowerCase(), input: currentInput + wrongChar }));
                playSound('key'); await pausableDelay(Math.random() * (40 * speedMult) + 50, signal, isPausedRef);
                setAnim(p => ({ ...p, activeKey: '⌫', input: currentInput }));
                playSound('key'); await pausableDelay(Math.random() * (40 * speedMult) + 50, signal, isPausedRef);
              }
              currentInput += char;
              setAnim(p => ({ ...p, activeKey: char.toLowerCase(), input: currentInput }));
              playSound('key');
              const tDelay = Math.random() * (30 * speedMult) + (20 * speedMult);
              await pausableDelay(tDelay * 0.7, signal, isPausedRef);
              setAnim(p => ({ ...p, activeKey: null }));
              await pausableDelay(tDelay * 0.3, signal, isPausedRef);
            }
            await pausableDelay(200, signal, isPausedRef);
            setAnim(p => ({ ...p, keyboard: false }));
          } else if (msg.type === 'audio') {
            playSound('key'); 
            const displaySecs = Math.min(parseDuration(msg.text), 5); 
            for(let s = 1; s <= displaySecs; s++) {
              setAnim(p => ({ ...p, recordingTime: s }));
              await pausableDelay(1000, signal, isPausedRef); 
            }
            setAnim(p => ({ ...p, recordingTime: 0 }));
          } else {
            setAnim(p => ({ ...p, input: `[Attaching ${msg.type}...]` })); playSound('key'); 
            await pausableDelay(800 * speedMult, signal, isPausedRef);
          }
          await pausableDelay(200 * speedMult, signal, isPausedRef); 
          playSound('send'); 
          setAnim(p => ({ ...p, input: '' }));
        } else {
          // 1. Show typing indicator first
          setAnim(p => ({ ...p, activity: msg.type === 'audio' ? 'recording audio...' : 'typing...' }));
          await pausableDelay((msg.type === 'text' ? msg.text.length * (40 * speedMult) : 1000 * speedMult) + 300, signal, isPausedRef);
          setAnim(p => ({ ...p, activity: '' }));
        }
        
        const msgBase = { ...msg, reaction: null };
        if (msg.sender === 'me') {
          let liveMsg = { ...msgBase, status: 'sent' };
          setAnim(p => ({ ...p, visibleMessages: [...p.visibleMessages, liveMsg] }));
          if (msg.status === 'delivered' || msg.status === 'read') {
            await pausableDelay(600 * speedMult, signal, isPausedRef);
            liveMsg = { ...liveMsg, status: 'delivered' };
            setAnim(p => ({ ...p, visibleMessages: p.visibleMessages.map(m => m.id === msg.id ? liveMsg : m) }));
          }
          if (msg.status === 'read') {
            await pausableDelay(800 * speedMult, signal, isPausedRef);
            liveMsg = { ...liveMsg, status: 'read' };
            setAnim(p => ({ ...p, visibleMessages: p.visibleMessages.map(m => m.id === msg.id ? liveMsg : m) }));
          }
        } else {
          // 2. Play sound, drop down notification, and add message simultaneously
          playSound('notification');
          setAnim(p => ({ 
            ...p, 
            visibleMessages: [...p.visibleMessages, msgBase],
            notification: { title: config.isGroupChat ? (msg.senderName || config.contactName) : config.contactName, text: msg.type === 'text' ? msg.text : `Sent a ${msg.type}` } 
          }));
          
          // Wait for notification to be readable before dismissing
          await pausableDelay(2000, signal, isPausedRef);
          setAnim(p => ({ ...p, notification: null }));
        }
        
        if (msg.reaction) {
          await pausableDelay(800 * speedMult, signal, isPausedRef);
          playSound('key');
          setAnim(p => ({ ...p, visibleMessages: p.visibleMessages.map(m => m.id === msg.id ? { ...m, reaction: msg.reaction } : m) }));
          await pausableDelay(400 * speedMult, signal, isPausedRef);
        } else {
          await pausableDelay(600 * speedMult, signal, isPausedRef);
        }
      }
    } catch (e) {
      if (e.message !== 'Aborted') console.error(e);
    } finally {
      if (signal && !signal.aborted) stopAnimation();
    }
  };

  const togglePlayAudio = (msg) => {
    if (anim.isPlaying) return; 
    const clearAudio = () => {
      if (currentAudioRef.current?.pause) currentAudioRef.current.pause();
      clearTimeout(currentAudioRef.current?.timeoutId); clearInterval(currentAudioRef.current?.intervalId);
    };
    if (audioPlayback.id === msg.id) {
      clearAudio(); setAudioPlayback({ id: null, progress: 0 }); return;
    }
    clearAudio();
    setAudioPlayback({ id: msg.id, progress: 0 });
    
    if (msg.audioUrl && !msg.audioUrl.startsWith('blob:')) {
      const audio = new Audio(msg.audioUrl);
      currentAudioRef.current = audio;
      audio.ontimeupdate = () => setAudioPlayback(p => ({ ...p, progress: audio.currentTime / audio.duration }));
      audio.onended = () => setAudioPlayback({ id: null, progress: 0 });
      audio.play().catch(e => { console.warn("Playback failed", e); setAudioPlayback({ id: null, progress: 0 }); });
    } else {
      const totalMs = parseDuration(msg.text) * 1000;
      let elapsed = 0;
      const intervalId = setInterval(() => {
        elapsed += 100;
        setAudioPlayback(p => ({ ...p, progress: elapsed / totalMs }));
        if (elapsed >= totalMs) { clearInterval(intervalId); setAudioPlayback({ id: null, progress: 0 }); }
      }, 100);
      currentAudioRef.current = { intervalId };
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (anim.isPlaying) return;
    if (!form.text.trim() && form.type !== 'audio') return;
    
    const msgObj = {
      id: editingId || generateId(),
      type: form.type, text: (form.type === 'audio' && !form.text.trim()) ? '0:05' : form.text,
      audioUrl: form.type === 'audio' ? form.audioUrl : undefined, sender: form.type === 'system' ? 'system' : form.sender,
      senderId: config.isGroupChat && form.sender === 'them' ? form.senderId : '',
      senderName: config.isGroupChat && form.sender === 'them' ? form.senderName : '', 
      time: form.time, status: form.sender === 'me' ? form.status : '',
      reaction: form.reaction, replyTo: form.replyToId ? messages.find(m => String(m.id) === String(form.replyToId)) : null
    };

    if (editingId) {
      setMessages(messages.map(m => m.id === editingId ? msgObj : m));
      setEditingId(null);
    } else {
      setMessages([...messages, msgObj]);
      if (config.autoIncrementTime && messages.length % 2 === 0) {
        const nextT = getNextTime(form.time);
        updateForm('time', nextT);
        updateConfig('time', nextT);
      }
    }
    resetForm();
  };

  const resetForm = () => {
    if (!editingId) {
      if (form.text?.startsWith('blob:')) URL.revokeObjectURL(form.text);
      if (form.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(form.audioUrl);
    }
    setForm(p => ({ ...p, text: '', audioUrl: '', replyToId: '', reaction: '', senderId: '' })); setEditingId(null);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleFormSubmit(e);
    }
  };

  const editMessage = (msg) => {
    if (anim.isPlaying) return;
    setEditingId(msg.id); 
    setForm({ type: msg.type, text: msg.text, sender: msg.sender, senderId: msg.senderId || '', senderName: msg.senderName || '', time: msg.time, status: msg.status, replyToId: msg.replyTo?.id || '', reaction: msg.reaction || '', audioUrl: msg.audioUrl || '' });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const cycleMessageStatus = (e, msg) => {
    e.stopPropagation();
    if(anim.isPlaying) return;
    const statuses = ['sent', 'delivered', 'read'];
    const nextIdx = (statuses.indexOf(msg.status) + 1) % statuses.length;
    setMessages(messages.map(m => m.id === msg.id ? { ...m, status: statuses[nextIdx] } : m));
  };

  const startVideoRecording = async () => {
    alert("IMPORTANT: On the next screen, ensure 'Share Tab Audio' or 'Share System Audio' is checked to capture sound effects.");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, preferCurrentTab: true });
      const mr = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `memesage-record-${Date.now()}.webm`; a.click();
        stream.getTracks().forEach(t => t.stop());
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      mediaRecorderRef.current = mr; mr.start();
      initAudio(); setTimeout(() => { if (!anim.isPlaying) runAnimation(); }, 1000);
    } catch (err) { console.error(err); alert("Recording cancelled or system audio unsupported."); }
  };

  const triggerExport = async () => {
    setShowExportModal(false);
    if (!phoneRef.current) return;
    if (!window.html2canvas) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script'); script.id = 'html2canvas-script'; script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = resolve; script.onerror = reject; document.body.appendChild(script);
        });
      } catch (err) { return alert("Failed to load export engine. Disable adblockers or check connection."); }
    }
    try {
      const phoneEl = phoneRef.current; const chatEl = chatContainerRef.current;
      const originalHeight = phoneEl.style.height; const originalOverflow = chatEl.style.overflow;
      phoneEl.style.height = 'max-content'; chatEl.style.overflow = 'visible';
      await new Promise(r => setTimeout(r, 100)); // Paint yield
      const canvas = await window.html2canvas(phoneEl, { scale: exportScale, useCORS: true, allowTaint: true, backgroundColor: exportTransparent ? null : undefined, windowHeight: phoneEl.scrollHeight, logging: false });
      phoneEl.style.height = originalHeight; chatEl.style.overflow = originalOverflow;
      const a = document.createElement('a'); a.download = `memesage-${exportScale}x-${Date.now()}.png`; a.href = canvas.toDataURL('image/png'); a.click();
    } catch (err) { alert("Error exporting image."); console.error(err); }
  };

  const handleMediaUpload = (e, key) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) return alert('Keep media under 10MB.');
    if (!editingId && form[key]?.startsWith('blob:')) URL.revokeObjectURL(form[key]);
    const url = URL.createObjectURL(file);
    updateForm(key, url); e.target.value = '';
    if (key === 'audioUrl') {
      const audio = new Audio(url);
      audio.onloadedmetadata = () => updateForm('text', `${Math.floor(audio.duration / 60)}:${Math.floor(audio.duration % 60).toString().padStart(2, '0')}`);
    }
  };

  const handlePhoneDrop = (e) => {
    e.preventDefault();
    setPhoneHovered(false);
    if (anim.isPlaying) return;
    
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    
    let msgType = 'document';
    if (file.type.startsWith('image/')) msgType = 'image';
    if (file.type.startsWith('video/')) msgType = 'video';
    if (file.type.startsWith('audio/')) msgType = 'audio';

    if (file.size > 10 * 1024 * 1024) return alert('Keep media under 10MB.');
    
    const url = URL.createObjectURL(file);
    
    const msgObj = {
      id: generateId(),
      type: msgType, text: msgType === 'audio' ? '0:05' : (msgType === 'document' ? file.name : url),
      audioUrl: msgType === 'audio' ? url : undefined,
      sender: 'me', senderId: '', senderName: '',
      time: config.time, status: 'read', reaction: '', replyTo: null
    };
    
    setMessages([...messages, msgObj]);
    if (config.autoIncrementTime && messages.length % 2 === 0) {
      const nextT = getNextTime(config.time);
      updateConfig('time', nextT);
      updateForm('time', nextT);
    }
  };

  const renderVirtualKeyboard = () => {
    if (!anim.keyboard) return null;
    const isDark = config.isDarkMode || config.platform === 'whatsapp' || config.platform === 'telegram';
    return (
      <div className={`w-full pb-6 pt-2 px-1 flex flex-col gap-1.5 z-40 ${isDark ? 'bg-[#2b2b2b] border-gray-800' : 'bg-[#d1d5db] border-gray-300'} animate-in slide-in-from-bottom-12 duration-200 border-t`}>
        {[['q','w','e','r','t','y','u','i','o','p'], ['a','s','d','f','g','h','j','k','l'], ['⇧','z','x','c','v','b','n','m','⌫'], ['123','space','return']].map((row, i) => (
          <div key={i} className={`flex justify-center gap-1.5 w-full ${i === 1 ? 'px-4' : ''} ${i === 2 ? 'px-0' : ''}`}>
            {row.map(k => {
              const isActive = (anim.activeKey === ' ' ? 'space' : anim.activeKey) === k;
              const isSpecial = k === '⇧' || k === '⌫' || k === '123' || k === 'return';
              const baseStyle = isDark ? (isSpecial ? 'bg-[#3b3b3b] text-white' : 'bg-[#4a4a4a] text-white shadow-sm') : (isSpecial ? 'bg-[#b5b8bd] text-black' : 'bg-white text-black shadow-sm');
              const activeStyle = isDark ? 'bg-[#7a7a7a] text-white scale-95 shadow-none' : 'bg-[#a3a3a3] text-black scale-95 shadow-none';
              return <div key={k} className={`flex items-center justify-center rounded-md font-medium text-[15px] select-none h-11 transition-all duration-75 ${k === 'space' ? 'w-[45%]' : (k === 'return' ? 'w-[20%]' : (isSpecial ? 'w-[12%]' : 'w-[8.5%]'))} ${isActive ? activeStyle : baseStyle}`}>{k === 'space' ? '' : k}</div>;
            })}
          </div>
        ))}
      </div>
    );
  };

  const getSenderColor = (name) => {
    const colors = ['text-red-500', 'text-blue-500', 'text-green-500', 'text-yellow-600', 'text-purple-500', 'text-pink-500', 'text-indigo-500', 'text-orange-500'];
    let hash = 0; if (name) { for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash); }
    return colors[Math.abs(hash) % colors.length];
  };

  const getAppStyles = () => {
    const d = config.isDarkMode;
    switch(config.platform) {
      case 'whatsapp': return { headerBg: d ? 'bg-[#1f2c34]' : 'bg-[#075e54]', headerText: d ? 'text-[#e9edef]' : 'text-white', chatBg: d ? 'bg-[#0b141a]' : 'bg-[#efeae2]', meBubble: d ? 'bg-[#005c4b] text-[#e9edef]' : 'bg-[#dcf8c6] text-black', themBubble: d ? 'bg-[#202c33] text-[#e9edef]' : 'bg-white text-black', footerBg: d ? 'bg-[#1f2c34]' : 'bg-[#f0f0f0]', inputBg: d ? 'bg-[#2a3942] text-[#e9edef]' : 'bg-white text-black', subText: d ? 'text-[#8696a0]' : 'text-gray-500' };
      case 'telegram': return { headerBg: d ? 'bg-[#1c242d]' : 'bg-[#517fa4]', headerText: 'text-white', chatBg: d ? 'bg-[#0e1621]' : 'bg-[#e4ecef]', meBubble: d ? 'bg-[#2b5278] text-white' : 'bg-[#effdde] text-black', themBubble: d ? 'bg-[#182533] text-white' : 'bg-white text-black', footerBg: d ? 'bg-[#1c242d]' : 'bg-white', inputBg: 'bg-transparent', subText: d ? 'text-[#7e8c99]' : 'text-gray-400' };
      case 'messenger': return { headerBg: d ? 'bg-black border-b border-gray-800' : 'bg-white border-b border-gray-200', headerText: d ? 'text-white' : 'text-black', chatBg: d ? 'bg-black' : 'bg-white', meBubble: 'bg-[#0084ff] text-white', themBubble: d ? 'bg-[#3e4042] text-white' : 'bg-[#e4e6eb] text-black', footerBg: d ? 'bg-black' : 'bg-white', inputBg: d ? 'bg-[#3e4042] text-white' : 'bg-gray-100 text-black', subText: d ? 'text-gray-500' : 'text-gray-500' };
      default: return {};
    }
  };
  const styles = getAppStyles();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-4 md:p-8 font-sans text-gray-800">
      
      {/* MODALS */}
      <ConfirmModal isOpen={showClearModal} onClose={() => setShowClearModal(false)} onConfirm={clearAllMessages} title="Clear All Messages" message="Are you sure you want to clear the timeline? You can Undo this action later." />
      
      {showExportModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h2 className="text-lg font-bold flex items-center gap-2"><Image size={20} className="text-blue-500"/> Export Settings</h2>
              <button onClick={() => setShowExportModal(false)} aria-label="Close" className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full font-bold text-gray-500"><X size={16}/></button>
            </div>
            <div className="space-y-4 py-2">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">Note: Embedded Videos will export as blank squares. Use screen recording instead for video elements.</div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Resolution Scale</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map(s => <button key={s} onClick={() => setExportScale(s)} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${exportScale === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s}x {s===3 && '(4K)'}</button>)}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-sm font-bold text-gray-700">Transparent Background</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={exportTransparent} onChange={() => setExportTransparent(!exportTransparent)} />
                  <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
            </div>
            <button onClick={triggerExport} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95">Download PNG</button>
          </div>
        </div>
      )}

      {showLoadModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h2 className="text-lg font-bold flex items-center gap-2"><FolderOpen size={20} className="text-blue-500"/> Load Project</h2>
              <button onClick={() => setShowLoadModal(false)} aria-label="Close" className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full font-bold text-gray-500"><X size={16}/></button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {savedProjectsList.map((p, i) => (
                <div key={i} onClick={() => {
                  messages.forEach(msg => { if (msg.text?.startsWith('blob:')) URL.revokeObjectURL(msg.text); if (msg.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(msg.audioUrl); });
                  setConfig(prev => ({...prev, ...p})); resetHistory(p.messages || []); setShowLoadModal(false);
                }} className="flex items-center justify-between p-3 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer rounded-xl transition-all">
                  <div><div className="font-bold text-gray-800">{p.name}</div><div className="text-xs text-gray-500">{new Date(p.date).toLocaleString()} • {p.messages?.length || 0} msgs</div></div>
                  <button onClick={(e) => { e.stopPropagation(); const rem = savedProjectsList.filter(x => x.name !== p.name); localStorage.setItem('memesage_projects', JSON.stringify(rem)); setSavedProjectsList(rem); if(rem.length===0) setShowLoadModal(false); }} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MAIN LAYOUT --- */}
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 relative">
        
        {/* --- CONTROL PANEL (LEFT COLUMN) --- */}
        <div className="w-full lg:w-7/12 flex flex-col gap-6">
          
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white"><MessageSquare size={24} /></div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">MemeSage <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Pro</span></h1>
                <p className="text-sm text-gray-500 font-medium">Ultimate Mock Chat Generator</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button disabled={anim.isPlaying} onClick={() => {
                const name = prompt("Project Name:", "My Script"); if(!name) return;
                const clean = messages.map(m => ({...m, text: m.text?.startsWith('blob:')?'':m.text, audioUrl: m.audioUrl?.startsWith('blob:')?'':m.audioUrl}));
                try {
                  const ex = JSON.parse(localStorage.getItem('memesage_projects')||'[]').filter(p=>p.name!==name);
                  localStorage.setItem('memesage_projects', JSON.stringify([...ex, {name, date: new Date().toISOString(), messages: clean, ...config}]));
                  alert('Saved! Local media excluded.');
                } catch(e) { alert('Project too large to save.'); }
              }} className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all disabled:opacity-50"><Save size={16} /> Save</button>
              <button disabled={anim.isPlaying} onClick={() => {
                try { const ex = JSON.parse(localStorage.getItem('memesage_projects')||'[]'); if(ex.length===0) return alert('No saved projects.'); setSavedProjectsList(ex); setShowLoadModal(true); } catch(e){}
              }} className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all disabled:opacity-50"><FolderOpen size={16} /> Load</button>
              
              <div className="w-px h-6 bg-gray-300 self-center mx-1 hidden sm:block"></div>
              
              <button disabled={anim.isPlaying} onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all disabled:opacity-50" title="Import JSON"><UploadCloud size={16} /> Import</button>
              <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={importJSON} />
              <button disabled={anim.isPlaying} onClick={exportJSON} className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all disabled:opacity-50" title="Export JSON"><Download size={16} /> Export</button>

              <div className="w-px h-6 bg-gray-300 self-center mx-1 hidden sm:block"></div>
              <button disabled={anim.isPlaying} onClick={() => setShowExportModal(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-black text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"><Image size={16} /> Image</button>
              <button disabled={anim.isPlaying} onClick={startVideoRecording} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"><VideoIcon size={16} /> Video</button>
            </div>
          </div>

          <div className="flex p-1.5 bg-gray-200/50 rounded-2xl backdrop-blur-sm shadow-inner">
            <button disabled={anim.isPlaying} onClick={() => setActiveTab('messages')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all disabled:opacity-50 ${activeTab === 'messages' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}><LayoutPanelLeft size={18} /> Messages & Editing</button>
            <button disabled={anim.isPlaying} onClick={() => setActiveTab('settings')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all disabled:opacity-50 ${activeTab === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}><Settings size={18} /> Global Settings</button>
          </div>

          <div className="space-y-6">
            {activeTab === 'settings' ? (
              <div className="grid gap-6 animate-in fade-in duration-300">
                <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-5 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800">Platform & Theme</h3>
                    <button onClick={() => updateConfig('isDarkMode', !config.isDarkMode)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${config.isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {config.isDarkMode ? <Moon size={14} /> : <Sun size={14} />} {config.isDarkMode ? 'Dark Mode' : 'Light Mode'}
                    </button>
                  </div>
                  <div className="flex gap-3">
                    {['whatsapp', 'telegram', 'messenger'].map(app => (
                      <button key={app} onClick={() => updateConfig('platform', app)} className={`flex-1 py-3 px-2 rounded-xl capitalize font-bold text-sm transition-all ${config.platform === app ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>{app}</button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3"><div className="p-2 bg-white rounded-lg shadow-sm text-blue-500"><Users size={18} /></div><div><span className="block text-sm font-bold text-gray-800">Group Chat Mode</span><span className="text-xs text-gray-500">Enable names for incoming messages</span></div></div>
                    <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={config.isGroupChat} onChange={() => updateConfig('isGroupChat', !config.isGroupChat)} /><div className="w-12 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div></label>
                  </div>

                  {config.isGroupChat && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-gray-800">Group Characters</h4>
                        <button onClick={addCharacter} className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors shadow-sm">+ Add Character</button>
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                        {config.characters?.map((c) => (
                          <div key={c.id} className="flex gap-3 items-center bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-sm transition-all hover:border-gray-300">
                            <img src={c.avatar} className="w-10 h-10 rounded-full object-cover shrink-0 shadow-sm border border-gray-200" onError={e=>e.target.src=FALLBACK_AVATAR}/>
                            <div className="flex-1 space-y-2">
                              <div className="flex gap-2">
                                <input type="text" value={c.name} onChange={e=>updateCharacter(c.id, 'name', e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg p-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="Name" />
                                <select value={c.color} onChange={e=>updateCharacter(c.id, 'color', e.target.value)} className={`w-28 bg-white border border-gray-200 rounded-lg p-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 ${c.color}`}>
                                  {['text-red-500', 'text-blue-500', 'text-green-500', 'text-yellow-600', 'text-purple-500', 'text-pink-500', 'text-indigo-500', 'text-orange-500'].map(col => <option key={col} value={col} className={col}>{col.split('-')[1].charAt(0).toUpperCase() + col.split('-')[1].slice(1)}</option>)}
                                </select>
                              </div>
                              <input type="text" value={c.avatar} onChange={e=>updateCharacter(c.id, 'avatar', e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg p-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500" placeholder="Avatar Image URL..." />
                            </div>
                            <button onClick={()=>removeCharacter(c.id)} aria-label="Remove" className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors self-start mt-1"><Trash2 size={16}/></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-5">
                  <h3 className="font-bold text-gray-800 pb-3 mb-4 border-b border-gray-100">Chat Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5"><label className="text-xs font-bold text-gray-500">{config.isGroupChat ? 'Group Name' : 'Contact Name'}</label><input type="text" value={config.contactName} onChange={e => updateConfig('contactName', e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm focus:ring-2 focus:ring-blue-500" /></div>
                    <div className="space-y-1.5"><label className="text-xs font-bold text-gray-500">{config.isGroupChat ? 'Group Subtext' : 'Status text'}</label><input type="text" value={config.contactStatus} onChange={e => updateConfig('contactStatus', e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm focus:ring-2 focus:ring-blue-500" /></div>
                    <div className="space-y-1.5"><label className="text-xs font-bold text-gray-500">Their Profile Pic (URL)</label><input type="text" value={config.profilePic} onChange={e => updateConfig('profilePic', e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm focus:ring-2 focus:ring-blue-500" /></div>
                    <div className="space-y-1.5"><label className="text-xs font-bold text-gray-500">Your Profile Pic (URL)</label><input type="text" value={config.myProfilePic} onChange={e => updateConfig('myProfilePic', e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm focus:ring-2 focus:ring-blue-500" /></div>
                    <div className="space-y-1.5 md:col-span-2"><label className="text-xs font-bold text-gray-500">Custom Wallpaper</label><div className="flex gap-2"><input type="url" value={config.wallpaperUrl} onChange={e => updateConfig('wallpaperUrl', e.target.value)} placeholder="Image URL..." className="flex-1 p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm focus:ring-2 focus:ring-blue-500" /><label className="flex items-center justify-center px-4 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl cursor-pointer text-gray-600"><UploadCloud size={20}/><input type="file" accept="image/*" className="hidden" onChange={(e) => { const f=e.target.files[0]; if(f) updateConfig('wallpaperUrl', URL.createObjectURL(f)); e.target.value=''; }} /></label></div></div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-5">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4"><h3 className="font-bold text-gray-800">Device Settings</h3><button onClick={() => { const d=new Date(); updateConfig('time', d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})); if(navigator.getBattery) navigator.getBattery().then(b=>updateConfig('battery', Math.floor(b.level*100))); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold transition-colors"><Wand2 size={14}/> Sync Live</button></div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5"><label className="text-xs font-bold text-gray-500">Phone Frame</label><select value={config.phoneFrame} onChange={e => updateConfig('phoneFrame', e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm font-medium"><option value="modern">Modern iPhone</option><option value="classic">Classic iPhone</option><option value="android">Android Phone</option><option value="none">No Frame</option></select></div>
                    <div className="space-y-1.5"><label className="text-xs font-bold text-gray-500">OS Style</label><select value={config.navStyle} onChange={e => updateConfig('navStyle', e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm font-medium"><option value="ios">iOS Style</option><option value="android">Android Style</option></select></div>
                    <div className="space-y-1.5"><label className="text-xs font-bold text-gray-500">Connection</label><select value={config.connectionType} onChange={e => updateConfig('connectionType', e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm font-medium"><option value="wifi">WiFi</option><option value="5g">5G</option><option value="lte">LTE</option><option value="airplane">Airplane</option></select></div>
                    <div className="space-y-1.5"><label className="text-xs font-bold text-gray-500">Battery %</label><input type="number" value={config.battery} onChange={e => updateConfig('battery', e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm" min="1" max="100" /></div>
                    <div className="space-y-1.5 col-span-2"><label className="text-xs font-bold text-gray-500">Time</label><input type="text" value={config.time} onChange={e => { updateConfig('time', e.target.value); updateForm('time', e.target.value); }} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm" /></div>
                    <div className="col-span-2 flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 self-end h-[46px] mt-auto">
                      <span className="text-sm font-bold text-gray-700">Auto-increment Time</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={config.autoIncrementTime} onChange={() => updateConfig('autoIncrementTime', !config.autoIncrementTime)} />
                        <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200/60 shadow-sm p-5">
                  <h3 className="font-bold text-amber-900 pb-3 border-b border-amber-200/50 flex items-center gap-2"><Settings size={18}/> Pro Animation Features</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-1.5"><label className="text-xs font-bold text-amber-800">Animation Type Speed</label><input type="range" min="1" max="5" value={config.typingSpeed} onChange={e => updateConfig('typingSpeed', Number(e.target.value))} className="w-full mt-3 accent-amber-600" /><div className="flex justify-between text-[10px] text-amber-700 font-bold px-1"><span>Slow</span><span>Fast</span></div></div>
                    <div className="flex flex-col justify-center gap-4">
                      <div className="flex items-center justify-between p-3 bg-white/50 rounded-xl border border-amber-200"><span className="text-xs font-bold text-amber-900 flex items-center gap-2"><Keyboard size={14}/> Clumsy Typist</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={config.clumsyTypist} onChange={() => updateConfig('clumsyTypist', !config.clumsyTypist)} /><div className="w-10 h-5 bg-amber-200 rounded-full peer peer-checked:bg-amber-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div></label></div>
                      <div className="flex items-center justify-between p-3 bg-white/50 rounded-xl border border-amber-200"><span className="text-xs font-bold text-amber-900 flex items-center gap-2"><Image size={14}/> Watermark</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={config.showWatermark} onChange={() => updateConfig('showWatermark', !config.showWatermark)} /><div className="w-10 h-5 bg-amber-200 rounded-full peer peer-checked:bg-amber-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div></label></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* --- MESSAGES TAB --- */
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100/50 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div><h3 className="font-bold text-indigo-900 text-lg">Screen Record Mode</h3><p className="text-sm text-indigo-700/80">Plays chat sequentially with typing animations & sound fx.</p></div>
                  <div className="flex gap-2">
                    {anim.isPlaying && (
                      <button onClick={togglePause} aria-label={anim.isPaused ? "Resume" : "Pause"} className="flex items-center justify-center w-12 h-12 rounded-xl font-bold text-indigo-600 bg-white border border-indigo-200 transition-all shadow-md active:scale-95">
                        {anim.isPaused ? <PlayCircle size={20} fill="currentColor"/> : <PauseCircle size={20} fill="currentColor"/>}
                      </button>
                    )}
                    <button onClick={anim.isPlaying ? stopAnimation : runAnimation} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 ${anim.isPlaying ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'}`}>
                      {anim.isPlaying ? <><Square size={18} fill="currentColor" /> Stop</> : <><Play size={18} fill="currentColor" /> Play Demo</>}
                    </button>
                  </div>
                </div>

                {/* FORM */}
                <form ref={formRef} onSubmit={handleFormSubmit} className={`p-5 rounded-2xl border shadow-sm space-y-5 transition-all duration-300 ${anim.isPlaying ? 'opacity-50 pointer-events-none' : ''} ${editingId ? 'bg-amber-50 border-amber-300 ring-4 ring-amber-100' : 'bg-white border-gray-200/60'}`}>
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <h3 className={`font-black flex items-center gap-2 text-lg shrink-0 ${editingId ? 'text-amber-700' : 'text-gray-800'}`}>
                      {editingId ? <><Edit size={20} /> Edit Message</> : <><PlusCircle size={20} className="text-blue-600" /> Compose Message</>}
                    </h3>
                    <div className="flex bg-gray-100 p-1 rounded-lg w-full xl:w-auto overflow-x-auto custom-scrollbar pb-1 xl:pb-0">
                      {['text', 'image', 'video', 'audio', 'document', 'location', 'system'].map(t => (
                        <button key={t} type="button" onClick={() => { updateForm('type', t); if(!editingId) updateForm('text', ''); }} className={`px-3 py-1.5 text-xs font-bold rounded-md capitalize whitespace-nowrap transition-all ${form.type === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  
                  {form.type === 'text' && <textarea value={form.text} onChange={e => updateForm('text', e.target.value)} onKeyDown={handleKeyDown} placeholder="Type message content here... (Cmd/Ctrl + Enter to send)" className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24 text-sm bg-gray-50" required />}
                  {(form.type === 'document' || form.type === 'location') && <input type="text" value={form.text} onChange={e => updateForm('text', e.target.value)} onKeyDown={handleKeyDown} placeholder={form.type === 'document' ? "Filename (e.g. Contract.pdf)" : "Location Name (e.g. Central Park)"} className="w-full p-4 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500" required />}

                  {(form.type === 'image' || form.type === 'video') && (
                    <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                      <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-100 hover:border-blue-400 transition-all text-sm text-gray-600 font-bold bg-white">
                        <UploadCloud size={24} className={form.text.startsWith('blob:') || form.text.startsWith('data:') ? "text-green-500 mb-2" : "text-gray-400 mb-2"} />
                        {form.text.startsWith('blob:') || form.text.startsWith('data:') ? `Local ${form.type} Attached!` : `Upload Local ${form.type} File`}
                        <span className="text-xs font-normal mt-1 opacity-70">Loads instantly via ObjectURL.</span>
                        <input type="file" accept={form.type === 'video' ? 'video/*' : 'image/*'} className="hidden" onChange={e => handleMediaUpload(e, 'text')} />
                      </label>
                      <div className="text-center font-bold text-xs text-gray-400">OR</div>
                      <input type="url" value={form.text} onChange={e => updateForm('text', e.target.value)} placeholder="Paste External URL instead..." className="w-full p-3 border border-gray-200 rounded-xl outline-none text-sm bg-white focus:ring-2 focus:ring-blue-500" />
                    </div>
                  )}
                  
                  {form.type === 'audio' && (
                    <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                      <input type="text" value={form.text} onChange={e => updateForm('text', e.target.value)} placeholder="Fake Duration (e.g. 0:14) if no real file" className="w-full p-3 border border-gray-200 rounded-xl outline-none text-sm bg-white" />
                      <div className="flex items-center gap-2">
                        <label className="flex-1 flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-100 hover:border-blue-400 transition-all text-sm text-gray-600 font-bold bg-white">
                          <UploadCloud size={20} className={form.audioUrl ? "text-green-500" : "text-gray-400"} />
                          {form.audioUrl ? 'Audio Uploaded! Click to swap' : 'Upload Real Audio File (Max 5MB)'}
                          <input type="file" accept="audio/*" className="hidden" onChange={e => handleMediaUpload(e, 'audioUrl')} />
                        </label>
                        {form.audioUrl && <button type="button" onClick={() => updateForm('audioUrl', '')} aria-label="Remove Audio" className="p-4 text-red-500 bg-white hover:bg-red-50 rounded-xl border border-gray-200 shadow-sm transition-colors"><Trash2 size={20} /></button>}
                      </div>
                    </div>
                  )}

                  {form.type === 'system' && <input type="text" value={form.text} onChange={e => updateForm('text', e.target.value)} placeholder="e.g. Today, Messages are encrypted" className="w-full p-4 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 text-center font-medium focus:ring-2 focus:ring-blue-500" required />}

                  {form.type !== 'system' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:flex lg:flex-wrap gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                      <div className="space-y-1.5 flex-1 min-w-[120px]"><label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sender</label><select value={form.sender} onChange={e => updateForm('sender', e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none text-sm font-bold"><option value="them">Them (Left)</option><option value="me">Me (Right)</option></select></div>
                      
                      {config.isGroupChat && form.sender === 'them' && (
                        <div className="space-y-1.5 flex-1 min-w-[120px]">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Character</label>
                          <select value={form.senderId} onChange={e => {
                            updateForm('senderId', e.target.value);
                            const char = config.characters?.find(c => c.id === e.target.value);
                            if (char) updateForm('senderName', char.name);
                          }} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-sm bg-white font-bold" required>
                            <option value="" disabled>Select Char...</option>
                            {config.characters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}

                      <div className="space-y-1.5 flex-1 min-w-[140px]"><label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reply To</label><select value={form.replyToId} onChange={e => updateForm('replyToId', e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none text-sm text-gray-600"><option value="">None</option>{messages.filter(m => m.type !== 'system' && m.id !== editingId).map(m => <option key={m.id} value={m.id}>{m.type === 'text' ? m.text.substring(0, 15) + '...' : `[${m.type}]`}</option>)}</select></div>
                      <div className="space-y-1.5 w-[100px] shrink-0"><label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Time</label><input type="text" value={form.time} onChange={e => updateForm('time', e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-sm bg-white" /></div>
                      <div className="space-y-1.5 flex-1 min-w-[180px]">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status / Reaction</label>
                        <div className="flex gap-2">
                          {form.sender === 'me' && config.platform !== 'messenger' && <select value={form.status} onChange={e => updateForm('status', e.target.value)} className="flex-1 p-2.5 border border-gray-200 rounded-lg bg-white outline-none text-sm"><option value="sent">1 Tick</option><option value="delivered">2 Ticks</option><option value="read">Blue</option></select>}
                          <input type="text" value={form.reaction} onChange={e => updateForm('reaction', e.target.value)} placeholder="Emoji (👍)" className="w-[80px] p-2.5 border border-gray-200 rounded-lg outline-none text-sm text-center bg-white" maxLength="10" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2 border-t border-gray-100">
                    <button type="submit" className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 ${editingId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30 text-white' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30 text-white'}`}>
                      {editingId ? 'Update Message' : 'Add to Chat'} <Send size={18} />
                    </button>
                    {editingId && <button type="button" onClick={resetForm} className="px-6 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-bold transition-colors shadow-sm active:scale-95">Cancel</button>}
                  </div>
                </form>

                {/* TIMELINE */}
                <div className={`bg-white p-5 rounded-2xl border border-gray-200/60 shadow-sm space-y-3 transition-opacity ${anim.isPlaying ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                    <h3 className="font-bold text-gray-800 text-sm">Manage Timeline</h3>
                    <div className="flex gap-1 items-center">
                      <button onClick={() => { if(!anim.isPlaying) undo(); }} disabled={undoStack.length === 0 || anim.isPlaying} aria-label="Undo" className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-30 transition-colors"><Undo size={16}/></button>
                      <button onClick={() => { if(!anim.isPlaying) redo(); }} disabled={redoStack.length === 0 || anim.isPlaying} aria-label="Redo" className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-30 transition-colors"><Redo size={16}/></button>
                      <div className="w-px h-4 bg-gray-300 mx-1"></div>
                      <button onClick={() => setShowClearModal(true)} disabled={messages.length === 0 || anim.isPlaying} aria-label="Clear All" className="p-1.5 text-red-500 hover:bg-red-50 rounded-md disabled:opacity-30 transition-colors"><Trash2 size={16}/></button>
                    </div>
                  </div>
                  
                  {messages.length === 0 && <p className="text-sm text-gray-500 font-medium text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">No messages yet. Add one above.</p>}
                  
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                    {messages.map((msg, index) => (
                      <div key={msg.id} draggable={!anim.isPlaying} onDragStart={e => { if(!anim.isPlaying) { setDraggedIdx(index); e.dataTransfer.effectAllowed="move"; } }} onDragOver={e=>e.preventDefault()} onDrop={e => { e.preventDefault(); if(anim.isPlaying || draggedIdx === null || draggedIdx === index) return; const nm = [...messages]; const dm = nm.splice(draggedIdx, 1)[0]; nm.splice(index, 0, dm); setMessages(nm); setDraggedIdx(null); }} className={`flex items-center justify-between p-2 rounded-xl border transition-all group ${draggedIdx === index ? 'opacity-50 scale-95' : 'opacity-100'} ${editingId === msg.id ? 'border-amber-400 bg-amber-50/50 shadow-sm ring-1 ring-amber-100' : 'border-gray-100 bg-gray-50 hover:border-gray-300 hover:bg-white cursor-grab active:cursor-grabbing'}`}>
                        <div className="flex flex-col gap-0.5 mr-1 lg:hidden">
                           <button aria-label="Move Up" onClick={() => { if(index>0) { const nm=[...messages]; [nm[index-1], nm[index]]=[nm[index], nm[index-1]]; setMessages(nm); } }} disabled={index === 0} className="text-gray-500 hover:text-blue-600 disabled:opacity-20 p-1"><ArrowUp size={14} strokeWidth={3}/></button>
                           <button aria-label="Move Down" onClick={() => { if(index<messages.length-1) { const nm=[...messages]; [nm[index+1], nm[index]]=[nm[index], nm[index+1]]; setMessages(nm); } }} disabled={index === messages.length - 1} className="text-gray-500 hover:text-blue-600 disabled:opacity-20 p-1"><ArrowDown size={14} strokeWidth={3}/></button>
                        </div>
                        <div className="hidden lg:flex items-center text-gray-400 mr-2"><GripVertical size={18}/></div>
                        
                        <div className="truncate flex-1 pr-3 text-sm flex items-center gap-3">
                          {msg.type === 'system' ? <span className="text-gray-500 font-semibold text-xs bg-gray-200/50 px-2 py-1 rounded">Sys: {msg.text}</span> : (
                            <>
                            <span className={`font-black text-[10px] uppercase tracking-wider px-2 py-1 rounded-md shrink-0 shadow-sm flex items-center gap-1.5 ${msg.sender === 'me' ? 'bg-blue-100 text-blue-800' : 'bg-white border border-gray-200 text-gray-700'}`}>
                              {msg.sender === 'me' ? 'Me' : (config.isGroupChat && msg.senderName ? msg.senderName : 'Them')}
                              {msg.sender === 'me' && config.platform !== 'messenger' && (
                                <button type="button" onClick={(e) => cycleMessageStatus(e, msg)} aria-label="Cycle Status" className="hover:bg-blue-200/70 p-0.5 rounded transition-colors -mr-1">
                                  {msg.status === 'sent' && <Check size={12} strokeWidth={3} />}
                                  {msg.status === 'delivered' && <CheckCheck size={12} strokeWidth={3} />}
                                  {msg.status === 'read' && <CheckCheck size={12} strokeWidth={3} className="text-blue-500" />}
                                </button>
                              )}
                            </span>
                            {msg.type === 'text' && <span className="text-gray-700 font-medium truncate">{msg.text}</span>}
                            {msg.type === 'image' && <div className="flex items-center gap-1.5 text-gray-700 font-medium truncate"><ImageIcon size={14} className="text-blue-500 shrink-0"/><img src={msg.text} className="w-5 h-5 rounded object-cover bg-gray-200" alt="thumb"/></div>}
                            {msg.type === 'video' && <div className="flex items-center gap-1.5 text-gray-700 font-medium truncate"><Video size={14} className="text-purple-500 shrink-0"/>[Video]</div>}
                            {msg.type === 'audio' && <div className="flex items-center gap-1.5 text-gray-700 font-medium truncate"><Mic size={14} className="text-green-500 shrink-0"/>{msg.text}</div>}
                            {(msg.type === 'document' || msg.type === 'location') && <div className="flex items-center gap-1.5 text-gray-700 font-medium truncate"><FileText size={14} className="text-orange-500 shrink-0"/>{msg.type === 'document' ? msg.text : 'Location'}</div>}
                            {msg.reaction && <span className="text-xs bg-white border border-gray-200 rounded-full px-1.5 py-0.5 shadow-sm shrink-0">{msg.reaction}</span>}</>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 opacity-100 lg:opacity-40 lg:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setMessages([...messages, {...msg, id: generateId()}])} aria-label="Duplicate" className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"><PlusCircle size={16} /></button>
                          <button onClick={() => editMessage(msg)} aria-label="Edit Message" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={16} /></button>
                          <button onClick={() => { if(!anim.isPlaying) setMessages(messages.filter(m => m.id !== msg.id)); }} aria-label="Delete Message" className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* --- PREVIEW PANEL (RIGHT COLUMN - MOBILE TOP) --- */}
        {/* UX FIX: Uses order-first lg:order-last to place preview at top on mobile */}
        <div className="w-full lg:w-5/12 flex justify-center lg:sticky lg:top-8 h-fit pb-12 order-first lg:order-last">
          
          <div className="relative">
            {config.phoneFrame !== 'none' && (
              <>
                <div className="absolute top-24 -left-1 w-1 h-8 bg-gray-300 rounded-l-md shadow-inner"></div>
                <div className="absolute top-36 -left-1 w-1 h-12 bg-gray-300 rounded-l-md shadow-inner"></div>
                <div className="absolute top-52 -left-1 w-1 h-12 bg-gray-300 rounded-l-md shadow-inner"></div>
                <div className="absolute top-32 -right-1 w-1 h-16 bg-gray-300 rounded-r-md shadow-inner"></div>
              </>
            )}

            <div 
              ref={phoneRef} 
              onDragOver={(e) => { e.preventDefault(); if(!anim.isPlaying) setPhoneHovered(true); }}
              onDragLeave={() => setPhoneHovered(false)}
              onDrop={handlePhoneDrop}
              className={`relative w-[375px] h-[812px] rounded-[50px] shadow-2xl overflow-hidden flex flex-col shrink-0 transition-transform ${phoneHovered ? 'scale-[1.02] ring-4 ring-blue-500' : ''} ${config.phoneFrame === 'none' ? 'border-none rounded-none shadow-none ring-1 ring-gray-200 bg-transparent' : 'bg-black border-[8px] border-gray-900 ring-2 ring-gray-200 shadow-[0_20px_50px_rgba(0,0,0,0.3)]'}`}
            >
              
              {phoneHovered && (
                <div className="absolute inset-0 z-[100] bg-blue-500/20 backdrop-blur-sm flex items-center justify-center rounded-[40px]">
                  <div className="bg-white px-6 py-4 rounded-2xl shadow-xl flex flex-col items-center gap-2 animate-in zoom-in-95 duration-200">
                    <UploadCloud size={32} className="text-blue-600" />
                    <span className="font-bold text-gray-800">Drop Media to Add Message</span>
                  </div>
                </div>
              )}

              {config.phoneFrame === 'modern' && <div className="absolute top-0 w-full h-7 z-50 flex justify-center pointer-events-none"><div className="w-32 h-6 bg-black rounded-b-3xl"></div></div>}
              {config.phoneFrame === 'classic' && <div className="absolute top-0 w-full h-7 z-50 flex justify-center pointer-events-none"><div className="w-44 h-6 bg-black rounded-b-[20px]"></div></div>}
              {config.phoneFrame === 'android' && <div className="absolute top-2 w-full flex justify-center pointer-events-none z-50"><div className="w-5 h-5 bg-black rounded-full shadow-inner shadow-gray-700/50"></div></div>}

              <div className={`flex justify-between items-center px-6 pt-3 pb-1 text-xs font-bold z-40 transition-colors ${styles.headerBg} ${styles.headerText} ${config.phoneFrame === 'none' ? 'pt-4' : ''}`}>
                {config.navStyle === 'android' ? (
                  <>
                    <span>{config.time}</span>
                    <div className="flex items-center gap-1.5">
                      {config.connectionType === 'airplane' && <Plane size={14} className="transform -rotate-45" />}
                      {config.connectionType === 'wifi' && <Wifi size={14} />}
                      {config.connectionType !== 'airplane' && <Signal size={14} />}
                      {config.connectionType === '5g' && <span className="text-[10px] font-black tracking-tighter mt-0.5">5G</span>}
                      {config.connectionType === 'lte' && <span className="text-[10px] font-black tracking-tighter mt-0.5">LTE</span>}
                      <div className="flex items-center gap-1 ml-0.5">
                        <span className="text-[10px] font-bold">{config.battery}%</span>
                        <div className={`w-[11px] h-[14px] border border-current rounded-[2px] p-[1px] relative flex flex-col justify-end opacity-90 ${Number(config.battery) <= 20 ? 'text-red-500 border-red-500' : ''}`}>
                           <div className="absolute -top-[2px] left-[20%] right-[20%] h-[2px] bg-current rounded-t-[1px]"></div>
                           <div className="w-full bg-current rounded-[1px] transition-all duration-300" style={{ height: `${Math.min(100, Math.max(0, config.battery))}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span>{config.time}</span>
                    <div className="flex items-center gap-1.5">
                      <Signal size={14} />
                      {config.connectionType === 'wifi' && <Wifi size={14} />}
                      {config.connectionType === '5g' && <span className="text-[10px] font-black tracking-tighter mt-0.5">5G</span>}
                      {config.connectionType === 'lte' && <span className="text-[10px] font-black tracking-tighter mt-0.5">LTE</span>}
                      {config.connectionType === 'airplane' && <Plane size={14} className="transform -rotate-45" />}
                      <div className="flex items-center gap-0.5 ml-0.5">
                        <div className={`w-[20px] h-[10px] border border-current rounded-[3px] p-[1px] relative flex items-center opacity-90 ${Number(config.battery) <= 20 ? 'text-red-500 border-red-500' : ''}`}>
                          <div className="h-full bg-current rounded-[1px] transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, config.battery))}%` }}></div>
                          <div className="absolute -right-[3px] top-[25%] h-[50%] w-[1.5px] bg-current rounded-r-sm"></div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Notification Banner */}
              <div className={`absolute top-4 left-4 right-4 bg-white/90 backdrop-blur-xl rounded-2xl p-3 shadow-xl border border-gray-100/50 transition-all duration-500 z-[60] flex items-center gap-3 ${anim.notification ? 'translate-y-6 opacity-100' : '-translate-y-24 opacity-0 pointer-events-none'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner text-white shrink-0 ${config.platform === 'messenger' ? 'bg-gradient-to-br from-blue-500 to-blue-700' : config.platform === 'telegram' ? 'bg-gradient-to-br from-sky-400 to-blue-500' : 'bg-gradient-to-br from-green-400 to-green-600'}`}><MessageSquare size={20} fill="currentColor"/></div>
                <div className="flex-1 min-w-0"><div className="font-bold text-sm text-gray-900 truncate">{anim.notification?.title}</div><div className="text-xs text-gray-600 truncate">{anim.notification?.text}</div></div>
                <div className="text-[10px] text-gray-500 font-bold self-start">now</div>
              </div>

              {/* Header */}
              <button onClick={() => setShowContactInfo(true)} aria-label="View Contact Info" className={`w-full px-2 py-2 flex items-center justify-between z-30 shadow-sm transition-colors cursor-pointer hover:opacity-90 active:bg-black/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/50 ${styles.headerBg} ${styles.headerText}`}>
                <div className="flex items-center gap-1 overflow-hidden pointer-events-none text-left">
                  <div className="p-1"><ChevronLeft size={24} className={config.platform === 'messenger' ? 'text-[#0084ff]' : ''} /></div>
                  <div className="relative shrink-0">
                    {config.isGroupChat ? (
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 overflow-hidden relative shadow-sm"><img src={config.profilePic} alt="Group" className="w-full h-full object-cover" onError={e => e.target.src = FALLBACK_AVATAR} /></div>
                    ) : (
                      <img src={config.profilePic} alt="Profile" className="w-10 h-10 rounded-full object-cover bg-gray-300 shadow-sm" onError={e => e.target.src = FALLBACK_AVATAR} />
                    )}
                    {config.platform === 'messenger' && !config.isGroupChat && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                  </div>
                  <div className="ml-2.5 flex flex-col justify-center min-w-0">
                    <span className="font-bold text-[16px] leading-tight truncate">{config.contactName}</span>
                    {(anim.activity || config.contactStatus) && (
                      <span className={`text-[12px] truncate ${anim.activity ? 'text-green-500 font-semibold' : ''} ${config.platform === 'messenger' ? (config.isDarkMode ? 'text-gray-400' : 'text-gray-500') : 'opacity-90'}`}>
                        {anim.activity ? (config.isGroupChat && anim.activity === 'typing...' ? `${form.senderName || 'Someone'} is typing...` : anim.activity) : config.contactStatus}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 pr-2 shrink-0 pointer-events-none">
                  {config.platform === 'whatsapp' && <><Video size={20} className="fill-current" /><Phone size={18} className="fill-current" /><MoreVertical size={20} /></>}
                  {config.platform === 'telegram' && <><Phone size={20} /><MoreVertical size={20} /></>}
                  {config.platform === 'messenger' && <><Phone size={20} className="text-[#0084ff] fill-current" /><Video size={24} className="text-[#0084ff] fill-current" /><Info size={22} className="text-[#0084ff]" /></>}
                </div>
              </button>

              {/* Chat Viewport */}
              <div ref={chatContainerRef} className={`flex-1 overflow-y-auto p-4 flex flex-col gap-3 relative transition-colors ${styles.chatBg}`}>
                <style>{`@keyframes popIn{0%{opacity:0;transform:scale(0.9) translateY(10px);}100%{opacity:1;transform:scale(1) translateY(0);}}.bubble-pop{animation:popIn 0.3s cubic-bezier(0.175,0.885,0.32,1.275) forwards;}@keyframes reactionPop{0%{opacity:0;transform:scale(0.5);}50%{transform:scale(1.2);}100%{opacity:1;transform:scale(1);}}.reaction-pop{animation:reactionPop 0.3s cubic-bezier(0.175,0.885,0.32,1.275) forwards;}.custom-scrollbar::-webkit-scrollbar{width:4px;}.custom-scrollbar::-webkit-scrollbar-track{background:transparent;}.custom-scrollbar::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px;}.no-scrollbar::-webkit-scrollbar{display:none;}`}</style>
                {config.wallpaperUrl ? <div className="absolute inset-0 z-0 opacity-100 bg-cover bg-center" style={{ backgroundImage: `url(${config.wallpaperUrl})`}}></div> : (config.platform === 'whatsapp' && <div className={`absolute inset-0 pointer-events-none z-0 ${config.isDarkMode ? 'opacity-[0.03]' : 'opacity-5'}`} style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '20px 20px', color: config.isDarkMode ? 'white' : 'black' }}></div>)}
                {config.showWatermark && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden opacity-[0.04]"><span className={`text-6xl font-black transform -rotate-45 whitespace-nowrap ${config.isDarkMode ? 'text-white' : 'text-black'}`}>@memesage</span></div>}

                {(anim.isPlaying ? anim.visibleMessages : messages).map((msg, index, arr) => {
                  if (msg.type === 'system') return <div key={msg.id} className="flex justify-center my-2 z-10 bubble-pop"><span className={`text-[11px] px-3 py-1 rounded-lg shadow-sm font-medium ${config.isDarkMode ? (config.platform === 'messenger' ? 'text-gray-400' : 'bg-[#18222d] text-gray-300') : (config.platform === 'messenger' ? 'text-gray-600' : 'bg-[#e1f0fa] text-gray-700')}`}>{msg.text}</span></div>;
                  
                  const isMe = msg.sender === 'me';
                  const prevMsg = index > 0 ? arr[index - 1] : null;
                  const nextMsg = index < arr.length - 1 ? arr[index + 1] : null;
                  const isFirstInGroup = !prevMsg || prevMsg.sender !== msg.sender || prevMsg.type === 'system' || (config.isGroupChat && !isMe && prevMsg.senderId !== msg.senderId);
                  const isLastInGroup = !nextMsg || nextMsg.sender !== msg.sender || nextMsg.type === 'system' || (config.isGroupChat && !isMe && nextMsg.senderId !== msg.senderId);

                  let roundedClasses = 'rounded-2xl';
                  if (config.platform === 'whatsapp' || config.platform === 'telegram') roundedClasses = `rounded-lg ${isFirstInGroup ? (isMe ? 'rounded-tr-none' : 'rounded-tl-none') : ''}`;
                  else if (config.platform === 'messenger') roundedClasses = `rounded-3xl ${!isFirstInGroup ? (isMe ? 'rounded-tr-md' : 'rounded-tl-md') : ''} ${!isLastInGroup ? (isMe ? 'rounded-br-md' : 'rounded-bl-md') : ''}`;

                  const hasClearedMedia = (msg.type === 'image' || msg.type === 'video') && !msg.text;
                  const isPlayingThis = audioPlayback.id === msg.id;
                  
                  // Lookup character details for group chats
                  const charObj = (config.isGroupChat && !isMe) ? (config.characters?.find(c => c.id === msg.senderId) || config.characters?.find(c => c.name === msg.senderName) || { name: msg.senderName || 'Unknown', avatar: config.profilePic, color: getSenderColor(msg.senderName) }) : null;

                  return (
                    <div key={msg.id} 
                         onClick={() => { if (!anim.isPlaying) editMessage(msg); }}
                         className={`flex z-10 bubble-pop ${isMe ? 'justify-end' : 'justify-start'} ${(!isLastInGroup && !msg.reaction) ? 'mb-[-4px]' : (msg.reaction ? 'mb-4' : 'mb-2')} ${!anim.isPlaying ? 'cursor-pointer hover:brightness-95 transition-all group/bubble' : ''}`}>
                      {!isMe && (config.platform === 'messenger' || config.isGroupChat) && (
                        <div className={`w-7 h-7 mr-2 shrink-0 flex items-end ${config.platform !== 'messenger' && isFirstInGroup ? 'items-start pt-1' : ''}`}>
                          {(isLastInGroup || (config.platform !== 'messenger' && isFirstInGroup)) && (
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-800 overflow-hidden shadow-sm">
                               {config.isGroupChat ? (
                                  charObj?.avatar ? <img src={charObj.avatar} alt="" className="w-full h-full object-cover" onError={e => e.target.src = FALLBACK_AVATAR} /> : (charObj?.name?.charAt(0).toUpperCase() || '?')
                               ) : <img src={config.profilePic} alt="" className="w-full h-full object-cover" onError={e => e.target.src = FALLBACK_AVATAR} />}
                            </div>
                          )}
                        </div>
                      )}

                      <div className={`relative max-w-[75%] px-3 py-1.5 shadow-sm text-[15px] leading-snug ${isMe ? styles.meBubble : styles.themBubble} ${roundedClasses} ${!anim.isPlaying ? 'ring-2 ring-transparent group-hover/bubble:ring-blue-400/50' : ''}`}>
                        <div className="flex flex-col relative">
                          {config.isGroupChat && !isMe && charObj?.name && isFirstInGroup && <div className={`text-[12px] font-bold mb-0.5 ${charObj.color}`}>{charObj.name}</div>}
                          {msg.replyTo && (
                            <div className={`text-[13px] p-1.5 mb-1.5 rounded-md border-l-4 ${isMe ? (config.isDarkMode && config.platform === 'whatsapp' ? 'bg-black/20 border-[#53bdeb]' : 'bg-black/10 border-black/30') : (config.isDarkMode ? 'bg-white/5 border-blue-400' : 'bg-black/5 border-blue-500')}`}>
                              <div className={`font-semibold text-[11px] mb-0.5 ${isMe ? (config.isDarkMode && config.platform === 'whatsapp' ? 'text-[#53bdeb]' : 'text-blue-700') : (config.isDarkMode ? 'text-blue-400' : 'text-blue-600')}`}>{msg.replyTo.sender === msg.sender ? 'You' : (config.isGroupChat ? (msg.replyTo.senderName || config.contactName) : config.contactName)}</div>
                              <div className="truncate opacity-80 max-w-[200px]">{msg.replyTo.type === 'text' ? msg.replyTo.text : `[${msg.replyTo.type}]`}</div>
                            </div>
                          )}
                          {hasClearedMedia && <div className="w-[200px] h-[120px] bg-gray-200 dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center text-gray-600 mb-1 border border-dashed border-gray-400 gap-2 p-2 text-center"><AlertCircle size={24} /><span className="text-[10px] font-bold">Local Media Cleared<br/>Edit to re-upload</span></div>}
                          {msg.type === 'image' && !hasClearedMedia && <img src={msg.text} alt="Shared" className="rounded-lg max-w-[220px] w-full h-auto object-contain mb-1 bg-black/10" />}
                          {msg.type === 'video' && !hasClearedMedia && <video src={msg.text} autoPlay loop muted playsInline className="rounded-lg max-w-[220px] w-full h-auto mb-1 bg-black/10" />}
                          {msg.type === 'document' && (
                            <div className={`flex items-center gap-3 p-2.5 rounded-lg mb-1 ${isMe ? 'bg-black/10' : 'bg-gray-100 dark:bg-white/10'}`}>
                              <div className={`p-2 rounded ${isMe ? 'bg-white/20 text-white' : 'bg-blue-500 text-white'}`}><FileText size={20}/></div>
                              <div className="flex flex-col min-w-[120px]"><span className="text-sm font-bold truncate max-w-[150px]">{msg.text || 'Document.pdf'}</span><span className="text-[10px] opacity-70 flex gap-2"><span>PDF</span><span>1.2 MB</span></span></div>
                            </div>
                          )}
                          {msg.type === 'location' && (
                            <div className="w-[200px] h-[120px] bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center relative overflow-hidden mb-1">
                              <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div><MapPin className="text-red-500 z-10" size={32} fill="white"/>
                              <div className="absolute bottom-2 left-2 right-2 bg-white/90 dark:bg-black/80 dark:text-white px-2 py-1.5 text-xs font-bold rounded shadow-sm truncate text-center z-10">{msg.text || 'Shared Location'}</div>
                            </div>
                          )}
                          {msg.type === 'audio' && (
                            <div className="flex items-center gap-2 mb-1 min-w-[160px] py-1">
                              <button aria-label="Play Audio" onClick={() => togglePlayAudio(msg)} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 ${isMe && config.platform === 'whatsapp' && !config.isDarkMode ? 'bg-[#00a884] text-white' : 'bg-blue-500 text-white'}`}>{isPlayingThis ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}</button>
                              <div className="flex-1 flex items-center gap-[3px] opacity-80 h-5">{[0.4,0.8,0.5,0.9,0.3,0.7,0.4,0.2,0.8,0.5].map((h, i) => <div key={i} className={`w-1 rounded-full waveform-bar transition-colors ${isPlayingThis && (i/10)<=audioPlayback.progress ? (isMe && config.platform === 'whatsapp' && !config.isDarkMode ? 'bg-[#00a884]' : 'bg-blue-500') : 'bg-current opacity-40'}`} style={{ height: `${h * 100}%` }}></div>)}</div>
                              <span className="text-[11px] font-medium ml-1 shrink-0">{msg.text || '0:15'}</span>
                            </div>
                          )}
                          {msg.type === 'text' && <span className="whitespace-pre-wrap break-words">{msg.text}</span>}
                        </div>
                        
                        {config.platform !== 'messenger' && (
                          <div className={`flex items-center justify-end gap-1 mt-1 -mb-1 ${isMe && config.platform==='whatsapp' && !config.isDarkMode ? 'text-gray-600' : 'opacity-70'}`}>
                            <span className="text-[10px] font-medium">{msg.time}</span>
                            {isMe && config.platform === 'whatsapp' && <span className="ml-0.5">{msg.status === 'sent' && <Check size={14} />}{msg.status === 'delivered' && <CheckCheck size={14} />}{msg.status === 'read' && <CheckCheck size={14} className={config.isDarkMode ? "text-[#53bdeb]" : "text-[#53bdeb]"} />}</span>}
                            {isMe && config.platform === 'telegram' && <span className="ml-0.5">{msg.status === 'sent' && <Check size={12} className="text-[#40a7e3]" />}{(msg.status === 'delivered' || msg.status === 'read') && <CheckCheck size={12} className="text-[#40a7e3]" />}</span>}
                          </div>
                        )}

                        {msg.reaction && <div className={`absolute -bottom-3.5 ${isMe ? (config.platform === 'messenger' ? 'right-2' : 'right-0') : (config.platform === 'messenger' ? 'left-2' : 'left-0')} bg-white dark:bg-[#1f2c34] rounded-full px-1.5 py-0.5 text-[12px] shadow-sm border border-gray-100 dark:border-gray-700 z-20 pointer-events-none reaction-pop`}>{msg.reaction}</div>}
                      </div>
                      
                      {isMe && config.platform === 'messenger' && (
                         <div className="w-3.5 h-3.5 ml-1 shrink-0 flex items-end mb-1">
                           {isLastInGroup && msg.status === 'read' && <img src={config.profilePic} alt="" className="w-3.5 h-3.5 rounded-full object-cover shadow-sm" onError={e => e.target.src = FALLBACK_AVATAR} />}
                         </div>
                      )}
                    </div>
                  );
                })}
                
                {anim.activity === 'typing...' && (
                  <div className="flex justify-start mb-2 bubble-pop z-10">
                    <div className={`px-4 py-2.5 shadow-sm flex gap-1 items-center ${config.platform === 'messenger' ? 'bg-[#e4e6eb] dark:bg-[#3e4042] rounded-3xl rounded-bl-md' : 'bg-white dark:bg-[#202c33] rounded-lg rounded-tl-none'}`}>
                      <span className="w-1.5 h-1.5 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                      <span className="w-1.5 h-1.5 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                      <span className="w-1.5 h-1.5 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-2" />
              </div>

              {/* Input Area */}
              <div className={`px-2 py-2 flex items-end gap-2 z-30 ${anim.keyboard ? 'pb-2' : 'pb-6'} transition-colors ${styles.footerBg}`}>
                {anim.recordingTime > 0 ? (
                  // LIVE AUDIO RECORDING UI
                  <div className="flex-1 flex items-center justify-between px-4 py-2 bg-transparent text-red-500 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 font-black text-[15px]"><Mic size={22} className="fill-current animate-pulse" />0:0{anim.recordingTime}</div>
                    <span className="text-sm font-semibold opacity-70 flex items-center gap-1 text-gray-500"><ChevronLeft size={16}/> Slide to cancel</span>
                    <div className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center shrink-0 text-white shadow-sm ml-2"><Send size={18} className="ml-1" /></div>
                  </div>
                ) : config.platform === 'whatsapp' ? (
                  <>
                    <button aria-label="Add Media" className="p-2 text-gray-500 hover:text-gray-700 transition-colors"><PlusCircle size={26} strokeWidth={1.5} /></button>
                    <div className={`flex-1 border rounded-full flex items-center px-4 py-1.5 min-h-[42px] transition-colors ${styles.inputBg} ${config.isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                       <span className={`text-[16px] flex-1 truncate ${anim.input ? '' : styles.subText}`}>{anim.input || (anim.isPlaying ? '' : 'Type a message')}</span>
                       <button aria-label="Attach File" className={`${styles.subText} mx-1 hover:text-gray-700 transition-colors`}><Paperclip size={20} /></button>
                       <button aria-label="Camera" className={`${styles.subText} mx-1 hover:text-gray-700 transition-colors`}><Camera size={20} /></button>
                    </div>
                    <button aria-label="Voice Note" className="w-11 h-11 bg-[#00a884] rounded-full flex items-center justify-center shrink-0 text-white shadow-sm hover:bg-[#009273] transition-colors"><Mic size={22} className="fill-current" /></button>
                  </>
                ) : config.platform === 'telegram' ? (
                  <>
                    <button aria-label="Attach Media" className="p-2 text-gray-500"><Paperclip size={26} strokeWidth={1.5} /></button>
                    <div className={`flex-1 flex items-center py-1.5 min-h-[42px] ${styles.inputBg}`}>
                       <span className={`text-[16px] flex-1 truncate ${anim.input ? (config.isDarkMode ? 'text-white' : 'text-black') : styles.subText}`}>{anim.input || (anim.isPlaying ? '' : 'Message')}</span>
                       <button aria-label="Stickers" className={`${styles.subText} mx-1`}><Smile size={26} strokeWidth={1.5} /></button>
                    </div>
                    <button aria-label="Voice Note" className="w-11 h-11 flex items-center justify-center shrink-0 text-[#3390ec]"><Mic size={26} strokeWidth={1.5} /></button>
                  </>
                ) : (
                  <>
                    <button aria-label="Actions" className="p-2 text-[#0084ff]"><PlusCircle size={24} className="fill-current text-white bg-[#0084ff] rounded-full" /></button>
                    <button aria-label="Gallery" className="p-2 text-[#0084ff]"><ImageIcon size={26} strokeWidth={1.5} /></button>
                    <div className={`flex-1 rounded-full flex items-center px-4 py-2 min-h-[38px] ${styles.inputBg}`}>
                       <span className={`text-[15px] flex-1 truncate ${anim.input ? '' : styles.subText}`}>{anim.input || (anim.isPlaying ? '' : 'Message')}</span>
                       <button aria-label="Emoji" className="text-[#0084ff]"><Smile size={22} strokeWidth={1.5} /></button>
                    </div>
                    <button aria-label="Voice Note" className="p-2 text-[#0084ff]"><Mic size={26} strokeWidth={1.5} /></button>
                  </>
                )}
              </div>

              {renderVirtualKeyboard()}

              {/* Contact Info Overlay */}
              <div className={`absolute inset-0 z-[70] transition-transform duration-300 ${styles.chatBg} ${showContactInfo ? 'translate-x-0' : 'translate-x-full'}`} aria-hidden={!showContactInfo}>
                <div className={`flex items-center gap-4 px-4 py-3 border-b shadow-sm ${styles.headerBg} ${styles.headerText} ${config.isDarkMode ? 'border-gray-800' : 'border-gray-200'} ${config.phoneFrame === 'none' ? 'pt-6' : 'pt-10'}`}>
                  <button aria-label="Close Contact Info" onClick={() => setShowContactInfo(false)} className="p-1 -ml-2"><ChevronLeft size={28} /></button>
                  <span className="font-bold text-lg">Contact Info</span>
                </div>
                <div className="flex flex-col items-center pt-8 pb-4 px-6 border-b border-gray-200/20 bg-black/5 dark:bg-white/5">
                  <img src={config.profilePic} alt="Profile" className="w-32 h-32 rounded-full object-cover shadow-md mb-4 border-4 border-white/20" onError={e => e.target.src = FALLBACK_AVATAR} />
                  <h2 className={`text-2xl font-bold mb-1 ${config.isDarkMode ? 'text-white' : 'text-gray-900'}`}>{config.contactName}</h2>
                  <p className={`text-sm ${config.isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{config.isGroupChat ? `Group • ${config.contactStatus}` : config.contactStatus}</p>
                </div>
                <div className={`p-4 space-y-4 ${config.isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <button className="w-full flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-xl transition-colors hover:bg-black/10 dark:hover:bg-white/10"><span className="flex items-center gap-3"><Image size={20}/> Media, Links, and Docs</span> <ChevronLeft size={16} className="rotate-180 opacity-50"/></button>
                  <div className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-xl"><span className="flex items-center gap-3"><Bell size={20}/> Mute Notifications</span> <label className="relative inline-flex items-center"><input type="checkbox" className="sr-only peer"/><div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div></label></div>
                  <button className="w-full text-red-600 font-bold p-4 bg-red-50 dark:bg-red-500/10 rounded-xl flex items-center gap-3 mt-8 hover:bg-red-100 transition-colors"><Trash2 size={20}/> {config.isGroupChat ? 'Exit Group' : 'Block Contact'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}