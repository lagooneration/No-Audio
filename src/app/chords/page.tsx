"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import StaggeredMenu from "@/components/StaggeredMenu";
import { Spectrogram } from "@/components/Spectrogram";
import { Spectrogram3D } from "@/components/Spectrogram3D";
import { getMenuItemsForPage, SOCIAL_ITEMS } from "@/constants/navigation";
import "@/styles/Piano.css";

interface OscillatorInfo {
  oscillator: OscillatorNode;
  gainNode: GainNode;
}

export default function ChordsPage() {
  // Menu items for navigation (excluding current page)
  const menuItems = getMenuItemsForPage('/chords');
  
  // Audio state for connecting piano to spectrogram
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const activeOscillatorsRef = useRef<Record<string, OscillatorInfo>>({});
  const activeKeysRef = useRef(new Set<string>());
  const pianoRef = useRef<HTMLDivElement | null>(null);

  // Piano key notes with frequencies (memoized to prevent unnecessary re-creations)
  const notes = useMemo(() => ({
    'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23,
    'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
    'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46,
    'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
  }), []);
  
  // Piano keyboard layout
  const pianoKeysLayout = useMemo(() => [
    'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
    'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5'
  ], []);
  
  // Keyboard mapping for computer keyboard
  const keyMap = useMemo(() => ({
    'a': 'C4', 'w': 'C#4', 's': 'D4', 'e': 'D#4', 'd': 'E4', 'f': 'F4', 't': 'F#4',
    'g': 'G4', 'y': 'G#4', 'h': 'A4', 'u': 'A#4', 'j': 'B4', 'k': 'C5', 'o': 'C#5',
    'l': 'D5', 'p': 'D#5', ';': 'E5', "'": 'F5'
  }), []);

  // Initialize audio context and analyzer
  const initAudio = useCallback(() => {
    if (!audioContext) {
      try {
        const AudioContextClass = window.AudioContext || 
          ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
        
        if (!AudioContextClass) {
          console.error('Web Audio API is not supported in this browser');
          return null;
        }
        
        const newAudioContext = new AudioContextClass();
        
        // Create analyzer node for spectrogram
        const newAnalyser = newAudioContext.createAnalyser();
        newAnalyser.fftSize = 2048;
        newAnalyser.minDecibels = -90;
        newAnalyser.maxDecibels = -10;
        newAnalyser.smoothingTimeConstant = 0.85;
        
        // Connect analyzer to audio destination
        newAnalyser.connect(newAudioContext.destination);
        
        // Set state after creation to ensure everything is connected properly
        setAudioContext(newAudioContext);
        setAnalyser(newAnalyser);
        
        return { context: newAudioContext, analyser: newAnalyser };
      } catch (error) {
        console.error('Failed to initialize Web Audio API:', error);
        return null;
      }
    }
    
    return { context: audioContext, analyser };
  }, [audioContext, analyser]);

  // Play a note with the synthesizer
  const playNote = useCallback((note: string, frequency: number) => {
    // Initialize audio if not already done
    const audioData = initAudio();
    if (!audioData) return;
    
    const { context: audio, analyser: spectrogramAnalyser } = audioData;
    
    // Don't create a new oscillator if one already exists for this note
    if (activeOscillatorsRef.current[note]) return;
    
    const now = audio.currentTime;
    
    // Get parameters from UI controls
    const attackSlider = document.getElementById('attack') as HTMLInputElement;
    const decaySlider = document.getElementById('decay') as HTMLInputElement;
    const sustainSlider = document.getElementById('sustain') as HTMLInputElement;
    const oscillatorTypeSelect = document.getElementById('oscillatorType') as HTMLSelectElement;
    
    const attackTime = parseFloat(attackSlider?.value || '0.05');
    const decayTime = parseFloat(decaySlider?.value || '0.1');
    const sustainLevel = parseFloat(sustainSlider?.value || '0.7');
    const oscillatorType = oscillatorTypeSelect?.value || 'sine';
    
    // Create Oscillator and Gain nodes
    const oscillator = audio.createOscillator();
    const gainNode = audio.createGain();

    // Set oscillator properties
    oscillator.type = oscillatorType as OscillatorType;
    oscillator.frequency.setValueAtTime(frequency, now);

    // Connect nodes: Oscillator -> Gain -> Analyzer -> Destination
    oscillator.connect(gainNode);
    
    if (spectrogramAnalyser) {
      gainNode.connect(spectrogramAnalyser);
    } else {
      gainNode.connect(audio.destination);
    }

    // ADSR Envelope
    // Attack
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1.0, now + attackTime);
    
    // Decay to Sustain
    gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);

    // Start the sound
    oscillator.start(now);
    
    // Store the oscillator and gain node to stop it later
    activeOscillatorsRef.current[note] = { oscillator, gainNode };
    
    // Update playing state for spectrogram
    if (Object.keys(activeOscillatorsRef.current).length > 0) {
      setIsPlaying(true);
    }
  }, [initAudio]);

  // Stop a note
  const stopNote = useCallback((note: string) => {
    if (!audioContext || !activeOscillatorsRef.current[note]) return;

    const { oscillator, gainNode } = activeOscillatorsRef.current[note];
    const now = audioContext.currentTime;
    
    const releaseSlider = document.getElementById('release') as HTMLInputElement;
    const releaseTime = parseFloat(releaseSlider?.value || '0.2');
    
    // Release phase
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);

    // Stop the oscillator after the release phase
    oscillator.stop(now + releaseTime);
    
    delete activeOscillatorsRef.current[note];
    
    // Update playing state for spectrogram
    if (Object.keys(activeOscillatorsRef.current).length === 0) {
      setIsPlaying(false);
    }
  }, [audioContext]);

  // Create piano keys UI
  const createPianoKeys = useCallback(() => {
    if (!pianoRef.current) return;
    
    const piano = pianoRef.current;
    // Clear existing piano keys if any
    piano.innerHTML = '';
    
    const whiteKeys = pianoKeysLayout.filter(key => !key.includes('#'));
    
    whiteKeys.forEach(noteName => {
      const keyWrapper = document.createElement('div');
      keyWrapper.classList.add('white-key-wrapper', 'flex-1');
      
      const whiteKey = document.createElement('div');
      whiteKey.classList.add('key', 'white', 'no-select');
      whiteKey.dataset.note = noteName;
      keyWrapper.appendChild(whiteKey);

      // Check if there should be a black key after this white key
      const nextKeyName = pianoKeysLayout[pianoKeysLayout.indexOf(noteName) + 1];
      if (nextKeyName && nextKeyName.includes('#')) {
        const blackKey = document.createElement('div');
        blackKey.classList.add('key', 'black', 'no-select');
        blackKey.dataset.note = nextKeyName;
        keyWrapper.appendChild(blackKey);
      }
      
      piano.appendChild(keyWrapper);
    });
    
    // Add event listeners to all keys
    piano.querySelectorAll('.key').forEach(key => {
      const noteAttr = key.getAttribute('data-note');
      if (!noteAttr) return;
      
      const note = noteAttr;
      const freq = notes[note as keyof typeof notes];

      // Mouse events
      key.addEventListener('mousedown', () => {
        const audioData = initAudio();
        if (!audioData) return;
        
        playNote(note, freq);
        key.classList.add('active');
      });
      
      key.addEventListener('mouseup', () => {
        stopNote(note);
        key.classList.remove('active');
      });
      
      key.addEventListener('mouseleave', () => {
        if (activeOscillatorsRef.current[note]) {
          stopNote(note);
          key.classList.remove('active');
        }
      });
      
      // Touch events
      key.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling
        const audioData = initAudio();
        if (!audioData) return;
        
        playNote(note, freq);
        key.classList.add('active');
      });
      
      key.addEventListener('touchend', () => {
        stopNote(note);
        key.classList.remove('active');
      });
    });
  }, [initAudio, notes, pianoKeysLayout, playNote, stopNote]);

  // Initialize piano and keyboard event listeners
  useEffect(() => {
    // Create the piano keys
    createPianoKeys();
    
    // Create a copy of activeOscillatorsRef for cleanup
    const currentActiveOscillators = { ...activeOscillatorsRef.current };
    
    // Set up keyboard event listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeKeysRef.current.has(e.key)) return; // Prevent key repeat
      const note = keyMap[e.key as keyof typeof keyMap];
      if (note) {
        activeKeysRef.current.add(e.key);
        const audioData = initAudio();
        if (!audioData) return;
        
        const keyElement = document.querySelector(`[data-note="${note}"]`) as HTMLElement;
        if (keyElement) {
          playNote(note, notes[note as keyof typeof notes]);
          keyElement.classList.add('active');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeysRef.current.delete(e.key);
      const note = keyMap[e.key as keyof typeof keyMap];
      if (note) {
        const keyElement = document.querySelector(`[data-note="${note}"]`) as HTMLElement;
        if (keyElement) {
          stopNote(note);
          keyElement.classList.remove('active');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Clean up event listeners and audio context on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      
      if (audioContext) {
        // Stop all active oscillators
        Object.keys(currentActiveOscillators).forEach(note => {
          if (currentActiveOscillators[note]) {
            const { oscillator, gainNode } = currentActiveOscillators[note];
            oscillator.stop();
            gainNode.disconnect();
          }
        });
        audioContext.close();
      }
    };
  }, [audioContext, createPianoKeys, initAudio, keyMap, notes, playNote, stopNote]);

  // Set initial values for sliders
  useEffect(() => {
    const updateSliderValue = (slider: string, spanId: string) => {
      const sliderEl = document.getElementById(slider) as HTMLInputElement;
      const span = document.getElementById(spanId);
      if (sliderEl && span) {
        span.textContent = parseFloat(sliderEl.value).toFixed(2);
        
        sliderEl.addEventListener('input', () => {
          span.textContent = parseFloat(sliderEl.value).toFixed(2);
        });
      }
    };
    
    updateSliderValue('attack', 'attack-val');
    updateSliderValue('decay', 'decay-val');
    updateSliderValue('sustain', 'sustain-val');
    updateSliderValue('release', 'release-val');
    
    // This effect runs once to set up slider listeners
  }, []);

  return (
    <div style={{ height: '100%', minHeight: '100vh', background: '#1a1a1a' }}>
      <StaggeredMenu
        position="right"
        items={menuItems}
        socialItems={SOCIAL_ITEMS}
        displaySocials={true}
        displayItemNumbering={true}
        menuButtonColor="#fff"
        openMenuButtonColor="#000"
        changeMenuColorOnOpen={true}
        colors={['#B19EEF', '#5227FF']}
        logoUrl="/logo.svg"
        accentColor="#ff6b6b"
        onMenuOpen={() => console.log('Menu opened')}
        onMenuClose={() => console.log('Menu closed')}
      />
            <div className="container pb-5">
        <h1 className="text-center text-white my-5">Chords</h1>
        
        {/* Spectrogram Sections */}
        <div className="spectrograms-container">
          <div className="row g-3">
            {/* 2D Spectrogram */}
            <div className="col-md-6">
              <div className="spectrogram-section">
                <h3 className="spectrogram-title">2D Frequency Spectrogram</h3>
                <Spectrogram 
                  analyser={analyser} 
                  isPlaying={isPlaying}
                  height={180}
                />
              </div>
            </div>
            
            {/* 3D Spectrogram */}
            <div className="col-md-6">
              <div className="spectrogram-section">
                <h3 className="spectrogram-title">3D Frequency Spectrogram</h3>
                <div style={{ height: "180px" }}>
                  <Spectrogram3D 
                    analyser={analyser} 
                    isPlaying={isPlaying}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Piano Roll Section */}
        <div className="piano-container">
          
          {/* Keyboard Legend */}
          {/* <div className="keyboard-legend">
            <div className="key-mapping"><span className="key-cap">A</span>C</div>
            <div className="key-mapping"><span className="key-cap">W</span>C#</div>
            <div className="key-mapping"><span className="key-cap">S</span>D</div>
            <div className="key-mapping"><span className="key-cap">E</span>D#</div>
            <div className="key-mapping"><span className="key-cap">D</span>E</div>
            <div className="key-mapping"><span className="key-cap">F</span>F</div>
            <div className="key-mapping"><span className="key-cap">T</span>F#</div>
            <div className="key-mapping"><span className="key-cap">G</span>G</div>
            <div className="key-mapping"><span className="key-cap">Y</span>G#</div>
            <div className="key-mapping"><span className="key-cap">H</span>A</div>
            <div className="key-mapping"><span className="key-cap">U</span>A#</div>
            <div className="key-mapping"><span className="key-cap">J</span>B</div>
            <div className="key-mapping"><span className="key-cap">K</span>C</div>
          </div> */}

           {/* Synth Controls */}
          <div className="synth-controls">
            <div className="control-group">
              <label className="control-label">Oscillator Type</label>
              <select id="oscillatorType">
                <option value="sine">Sine</option>
                <option value="square">Square</option>
                <option value="sawtooth">Sawtooth</option>
                <option value="triangle">Triangle</option>
              </select>
            </div>
            
            <div className="control-group">
              <label className="control-label">Attack <span id="attack-val">0.05</span>s</label>
              <div className="control-row">
                <input type="range" id="attack" min="0.01" max="1.0" step="0.01" defaultValue="0.05" />
              </div>
            </div>
            
            <div className="control-group">
              <label className="control-label">Decay <span id="decay-val">0.10</span>s</label>
              <div className="control-row">
                <input type="range" id="decay" min="0.01" max="1.0" step="0.01" defaultValue="0.1" />
              </div>
            </div>
            
            <div className="control-group">
              <label className="control-label">Sustain <span id="sustain-val">0.70</span></label>
              <div className="control-row">
                <input type="range" id="sustain" min="0.0" max="1.0" step="0.01" defaultValue="0.7" />
              </div>
            </div>
            
            <div className="control-group">
              <label className="control-label">Release <span id="release-val">0.20</span>s</label>
              <div className="control-row">
                <input type="range" id="release" min="0.01" max="2.0" step="0.01" defaultValue="0.2" />
              </div>
            </div>
          </div>

           {/* Piano Keyboard */}
          <div className="piano" id="piano" ref={pianoRef}></div>

        </div>
      </div>
    </div>
  );
}
