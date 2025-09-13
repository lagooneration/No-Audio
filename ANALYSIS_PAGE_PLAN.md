# KnowAudio Analysis Page Plan

This document outlines the plan for creating a new audio analysis page for the KnowAudio application. The goal is to provide a comprehensive and user-friendly interface for visualizing and interacting with audio analysis data.

## High-Level Overview

The analysis page will be a dashboard-style interface that presents various aspects of an uploaded audio file. It will leverage existing components from the project and introduce new visualizations to create an informative and engaging user experience. The page will be built using a modular approach, with different analysis "widgets" that can be arranged in a grid layout.

## UI/UX Flow

1.  **File Upload:** The user will be prompted to upload an audio file using the existing `AudioUploader` component.
2.  **Analysis in Progress:** While the audio is being analyzed, a loading indicator will be displayed.
3.  **Dashboard Display:** Once the analysis is complete, the page will display a dashboard of analysis widgets.

## Analysis Widgets

The analysis dashboard will be composed of the following widgets, arranged using the `BentoGrid` component:

### 1. Main Audio Player & Waveform

*   **Components:** `AudioPlayer`, `WaveformVisualizer`
*   **Description:** A central widget that combines the audio player with an interactive waveform visualizer. The user can play, pause, seek, and see the waveform of the entire track. The waveform will be zoomable and pannable for detailed inspection.

### 2. Key & Tempo

*   **Description:** A simple, clear display of the audio's detected musical key and tempo (in Beats Per Minute). This will be presented with icons and large text for easy readability.

### 3. Genre & Mood

*   **Description:** This widget will display the predicted genre(s) of the audio as tags. It will also feature a visual representation of the audio's mood (e.g., using a color gradient or an icon).

### 4. Instrument Separation (Stems)

*   **Description:** A list of instruments detected in the audio (e.g., vocals, drums, bass, guitar). Each instrument will have:
    *   An icon representing the instrument.
    *   "Solo" and "Mute" buttons to allow the user to listen to individual instrument tracks.
    *   A volume slider for each stem.

### 5. Technical Analysis

*   **Description:** This widget will provide technical details about the audio, aimed at producers and engineers. It will include:
    *   **Loudness (LUFS):** A gauge or bar showing the integrated loudness of the track.
    *   **Dynamic Range:** A value and a visual indicator of the audio's dynamic range.
    *   **Stereo Width:** A meter showing the stereo width of the track.

### 6. Structural Analysis

*   **Description:** A timeline view that segments the song into its structural parts (e.g., intro, verse, chorus, bridge, outro). Each segment will be color-coded and clickable to navigate the audio player to that section.

## `CardNav` Component Redesign

The `CardNav` component will be repurposed to provide different views of the analysis data. Instead of being a general navigation component, it will function as a tab bar for the analysis page.

*   **Tabs:**
    *   **Overview:** The default view, showing the main analysis dashboard described above.
    *   **Spectrogram:** A dedicated view showing a detailed, full-screen spectrogram of the audio. This will be interactive, allowing for zooming and frequency analysis.
    *   **Lyrics:** A view to display the transcribed lyrics of the song, with word-by-word highlighting synchronized with the audio playback.

## Interactivity Summary

*   **Interactive Waveform:** Zoom and pan.
*   **Instrument Stems:** Solo, mute, and volume control.
*   **Structural Analysis:** Clickable sections to navigate the audio.
*   **Tabbed Views:** Use of the redesigned `CardNav` to switch between different analysis perspectives.

By implementing these features, the analysis page will become a powerful tool for musicians, producers, and audio enthusiasts, offering deep insights into their audio files in a visually appealing and interactive way.
