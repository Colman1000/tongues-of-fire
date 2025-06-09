# VTT Subtitle Cleaner

This project provides simple, automated scripts to clean metadata lines from `.vtt` subtitle files. The scripts are designed to be run without any command-line arguments and will automatically process files from a designated `files` folder and save the output to a `clean` folder.

## Features

-   **Fully Automated:** No need to pass file paths as arguments.
-   **Cross-Platform:** Includes separate scripts for Windows (`.bat`) and Linux/macOS (`.sh`).
-   **Simple Folder Structure:** Just drop your files into the `files` folder and run.
-   **Precise Cleaning:** Removes only lines that match a specific metadata pattern (e.g., `4, 1` or `V3, 1`).

## Required Folder Structure

For the scripts to work correctly, you **must** organize your files in the following structure. The `files` folder must be in the same directory as the script you are running.

```
your_project_folder/
│
├── files/
│   ├── subtitle1.vtt
│   ├── subtitle2.vtt
│   └── another_subtitle.vtt
│
├── clean_vtt.sh      (for Linux/macOS users)
└── clean_vtt.bat      (for Windows users)
```

## How to Use

Follow the instructions for your operating system.

### For Windows Users

1.  **Setup:**
    -   Create a folder named `files` in the same directory as `clean_vtt.bat`.
    -   Copy all the `.vtt` files you want to clean into the `files` folder.

2.  **Run the Script:**
    -   Simply **double-click** the `clean_vtt.bat` file.
    -   A command prompt window will appear, show the progress, and close automatically when finished.

3.  **Get Your Files:**
    -   A new folder named `clean` will be created.
    -   Inside the `clean` folder, you will find the cleaned versions of your subtitle files, with the same filenames as the originals.

### For Linux and macOS Users

1.  **Setup:**
    -   Create a folder named `files` in the same directory as `clean_vtt.sh`.
    -   Copy all the `.vtt` files you want to clean into the `files` folder.

2.  **Run the Script:**
    -   Open your **Terminal**.
    -   Navigate to the project folder using the `cd` command. For example:
        ```sh
        cd /path/to/your_project_folder
        ```
    -   Make the script executable (you only need to do this once):
        ```sh
        chmod +x clean_vtt.sh
        ```
    -   Run the script:
        ```sh
        ./clean_vtt.sh
        ```

3.  **Get Your Files:**
    -   A new folder named `clean` will be created.
    -   Inside the `clean` folder, you will find the cleaned versions of your subtitle files.

---

## How It Works

The scripts read each `.vtt` file from the `files` folder and remove any line that matches a specific regular expression pattern.

The pattern being removed is: `^[A-Za-z]?[0-9], [0-9]\r?$`

This means the script will delete any entire line that looks like:
-   `4, 1`
-   `V3, 1`
-   `X5, 2`

It will **not** affect other lines, such as timestamps or the actual subtitle text.
