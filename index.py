import os
from datetime import datetime

def scan_backend_code(root_dir, output_file="backend_summary.txt"):
    """
    Scans a backend codebase, extracts all files' content, and writes it into a single text file with metadata.
    
    Args:
        root_dir (str): Path to the root directory of your backend code.
        output_file (str): Name of the output consolidated text file.
    """
    ignored_dirs = {'.git', '__pycache__', 'node_modules', 'venv', 'env'}  # Folders to ignore
    ignored_extensions = {'.pyc', '.DS_Store', '.log', '.tmp'}  # File extensions to ignore

    with open(output_file, 'w', encoding='utf-8') as outfile:
        # Write header with metadata
        outfile.write(f"=== BACKEND CODE ANALYSIS REPORT ===\n")
        outfile.write(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        outfile.write(f"Root Directory: {os.path.abspath(root_dir)}\n\n")
        outfile.write("=" * 50 + "\n\n")

        for root, dirs, files in os.walk(root_dir):
            # Skip ignored directories
            dirs[:] = [d for d in dirs if d not in ignored_dirs]

            for file in files:
                file_path = os.path.join(root, file)
                file_ext = os.path.splitext(file)[1]

                if file_ext in ignored_extensions:
                    continue

                try:
                    with open(file_path, 'r', encoding='utf-8') as infile:
                        content = infile.read()
                except UnicodeDecodeError:
                    # Skip binary files (e.g., images, compiled files)
                    continue

                # Write file metadata
                outfile.write(f"║ File: {file_path}\n")
                outfile.write(f"║ Size: {os.path.getsize(file_path)} bytes\n")
                outfile.write(f"║ Last Modified: {datetime.fromtimestamp(os.path.getmtime(file_path))}\n")
                outfile.write("╠" + "═" * 80 + "\n")

                # Write file content
                outfile.write(f"{content}\n")
                outfile.write("\n╚" + "═" * 80 + "\n\n")

        outfile.write(f"=== END OF REPORT ===\n")

if __name__ == "__main__":
    backend_root = input("Enter the path to your backend root folder: ").strip()
    if os.path.isdir(backend_root):
        scan_backend_code(backend_root,output_file="route_summary.txt")
        print(f"Backend code analysis complete. Output saved to 'backend_summary.txt'.")
    else:
        print("Error: Invalid directory path.")