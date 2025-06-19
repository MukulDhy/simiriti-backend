import pygame
import os
import time
from pathlib import Path

class AudioPlayer:
    def __init__(self, audio_directory="audio_clips"):
        self.audio_directory = audio_directory
        pygame.mixer.init()
        
    def play_audio_file(self, file_path):
        """Play a single audio file"""
        try:
            print(f"Playing: {file_path}")
            pygame.mixer.music.load(file_path)
            pygame.mixer.music.play()
            
            # Wait for playback to complete
            while pygame.mixer.music.get_busy():
                time.sleep(0.1)
                
        except Exception as e:
            print(f"Error playing {file_path}: {e}")
    
    def play_all_files(self):
        """Play all audio files in the directory"""
        audio_files = []
        
        # Get all audio files
        for ext in ['*.wav', '*.mp3', '*.ogg']:
            audio_files.extend(Path(self.audio_directory).glob(ext))
        
        # Sort files by name
        audio_files.sort()
        
        if not audio_files:
            print(f"No audio files found in {self.audio_directory}")
            return
        
        print(f"Found {len(audio_files)} audio files")
        
        for audio_file in audio_files:
            self.play_audio_file(str(audio_file))
            time.sleep(0.5)  # Small pause between files
    
    def play_latest_file(self):
        """Play the most recently created audio file"""
        audio_files = []
        
        for ext in ['*.wav', '*.mp3', '*.ogg']:
            audio_files.extend(Path(self.audio_directory).glob(ext))
        
        if not audio_files:
            print(f"No audio files found in {self.audio_directory}")
            return
        
        # Get the most recent file
        latest_file = max(audio_files, key=os.path.getctime)
        self.play_audio_file(str(latest_file))
    
    def list_files(self):
        """List all audio files in the directory"""
        audio_files = []
        
        for ext in ['*.wav', '*.mp3', '*.ogg']:
            audio_files.extend(Path(self.audio_directory).glob(ext))
        
        if not audio_files:
            print(f"No audio files found in {self.audio_directory}")
            return []
        
        audio_files.sort()
        print(f"\nFound {len(audio_files)} audio files:")
        for i, file in enumerate(audio_files, 1):
            print(f"{i}. {file.name}")
        
        return audio_files
    
    def play_specific_file(self, filename):
        """Play a specific file by name"""
        file_path = Path(self.audio_directory) / filename
        
        if file_path.exists():
            self.play_audio_file(str(file_path))
        else:
            print(f"File not found: {filename}")

# Usage example
if __name__ == "__main__":
    player = AudioPlayer("audio_clips")  # Change to your audio directory
    
    while True:
        print("\nAudio Player Menu:")
        print("1. List all files")
        print("2. Play all files")
        print("3. Play latest file")
        print("4. Play specific file")
        print("5. Exit")
        
        choice = input("Enter choice (1-5): ").strip()
        
        if choice == "1":
            player.list_files()
            
        elif choice == "2":
            player.play_all_files()
            
        elif choice == "3":
            player.play_latest_file()
            
        elif choice == "4":
            files = player.list_files()
            if files:
                try:
                    file_num = int(input("Enter file number to play: ")) - 1
                    if 0 <= file_num < len(files):
                        player.play_audio_file(str(files[file_num]))
                    else:
                        print("Invalid file number")
                except ValueError:
                    print("Please enter a valid number")
                    
        elif choice == "5":
            print("Goodbye!")
            break
            
        else:
            print("Invalid choice. Please try again.")
    
    pygame.mixer.quit()